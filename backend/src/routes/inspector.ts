import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { processSubtree, streamAncestry, rolesForNodes, appsForNodes } from '../lib/resolvers/index.js';
import { taskPlans, subtreePlanRollup } from '../lib/workPlan.js';
import { subtreeStandards, subtreeRegulations } from '../lib/govRollup.js';
import { logAudit } from '../services/audit.js';

// Value-Streams Inspector (Sidebar-Rework-v2) — the unified read + CRUD surface
// behind the shared inspector that the List and Map both dock on the right.
//
// ONE canonical record per association (single source of truth): every write
// here lands on an existing junction/entity (NodeRole, NodeAppUsage,
// ChecklistItem + NodeChecklist, NodeDeliverable, TestingTemplate, Role,
// Application, Deliverable) — never a per-screen copy and never a new table.
// RACI rides on the existing NodeRole.ownerLevel column; Owner/Participant on
// NodeRole.role_. Reads come straight off the FK junctions + the closure, so a
// change is reflected everywhere the entity appears (rollups, both views, the
// Org chart, the Applications catalog, other streams) with no duplication.
//
// Level semantics (LOCKED, see explorer.ts): a "value stream" is process L2; its
// L3 areas / L4 sub-processes are rollup containers; L5 isTask nodes are the
// editable leaf "steps". The inspector renders a rollup for any container and
// full editable detail for an isTask node.

const router = Router();
router.use(requireAuth);

// ProcessNode.automatability → 1-5 agent-automatability score. Scale (Automatable
// page): 1 Autonomous Agent … 5 Human-only; "automatable" = score ≤ 2. Tokens map
// onto that scale (lower = more AI-automatable). Legacy aliases kept for safety.
const SCORE_OF: Record<string, number> = {
  autonomous: 1, workflow: 2, augmented: 3, assist: 4, manual: 5,
  automated: 1, assisted: 4, // legacy aliases
};

async function activeCompany(req: Request) {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  return prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
}

// A process node the active company owns, or null. Used to scope every read/write.
async function ownedNode(req: Request, companyId: string, nodeId: string) {
  return prisma.processNode.findFirst({
    where: { id: nodeId, companyId },
    select: {
      id: true, displayValue: true, isTask: true, automatability: true, parentId: true, code: true, attributes: true,
      processLevelType: { select: { levelNumber: true, displayValue: true } },
    },
  });
}

const audit = (req: Request, entityType: string, entityId: string, action: string, diff?: unknown) =>
  logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType, entityId, action, diff });

// ── Unified inspector payload ────────────────────────────────────────────────
// Always returns the six-group rollup counts (computed live across the subtree),
// the breadcrumb, the domain (for the accent), and the drill children. At an
// isTask leaf it also returns the node's OWN roles/apps/deliverables/checklist/
// testing for the editable detail view; at a container it returns the top
// aggregated items so the rollup tabs have content.
router.get('/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });

    // Subtree (includes self) → the rollup scope. taskIds = the leaf steps.
    const { nodes } = await processSubtree(node.id);
    const subtreeIds = nodes.map((n) => n.id);
    const taskIds = nodes.filter((n) => n.isTask).map((n) => n.id);
    const detail = node.isTask;
    // Detail reads scope to the node itself; rollups to the whole subtree.
    const scopeIds = detail ? [node.id] : subtreeIds;

    const [nodeRoles, appUsages, delivLinks, checkLinks] = await Promise.all([
      prisma.nodeRole.findMany({
        where: { processNodeId: { in: scopeIds } },
        select: { id: true, processNodeId: true, role_: true, ownerLevel: true, role: { select: { id: true, displayValue: true } } },
      }),
      prisma.nodeAppUsage.findMany({
        where: { processNodeId: { in: scopeIds } },
        select: { id: true, processNodeId: true, usageType: true, application: { select: { id: true, name: true } } },
      }),
      prisma.nodeDeliverable.findMany({
        where: { processNodeId: { in: scopeIds } },
        select: { id: true, processNodeId: true, deliverable: { select: { id: true, title: true } } },
      }),
      prisma.nodeChecklist.findMany({
        where: { processNodeId: { in: scopeIds } },
        select: { id: true, processNodeId: true, checklistItem: { select: { id: true, text: true } } },
      }),
    ]);

    // Testing templates in scope: by task node OR by a deliverable in scope.
    const deliverableIds = [...new Set(delivLinks.map((d) => d.deliverable.id))];
    const testingScopeTaskIds = detail ? [node.id] : taskIds;
    const tOr: any[] = [];
    if (testingScopeTaskIds.length) tOr.push({ taskNodeId: { in: testingScopeTaskIds } });
    if (deliverableIds.length) tOr.push({ deliverableId: { in: deliverableIds } });
    const testingRows = tOr.length
      ? await prisma.testingTemplate.findMany({
          where: { OR: tOr },
          select: { id: true, deliverableId: true, taskNodeId: true, system: true, location: true, checkType: true, expected: true },
        })
      : [];

    // Counts (distinct entities across the scope).
    const counts = {
      roles: new Set(nodeRoles.map((r) => r.role.id)).size,
      applications: new Set(appUsages.map((a) => a.application.id)).size,
      deliverables: deliverableIds.length,
      tasks: detail ? 1 : taskIds.length,
      checklist: new Set(checkLinks.map((c) => c.checklistItem.id)).size,
      testing: new Set(testingRows.map((t) => t.id)).size,
      standards: 0, regulations: 0, // set below once governing links resolve
    };

    // Automation rollup (mirrors the Automatable page): each task's 1-5 score from
    // its automatability; "automatable" = score ≤ 2 (Workflow + Autonomous tier).
    const tiers: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let scored = 0; let auto = 0;
    for (const n of nodes) {
      if (!n.isTask || !n.automatability) continue;
      const s = SCORE_OF[n.automatability];
      if (typeof s !== 'number') continue;
      tiers[s] += 1; scored += 1; if (s <= 2) auto += 1;
    }
    const automation = {
      score: detail ? (node.automatability ? SCORE_OF[node.automatability] ?? null : null) : null,
      scored, auto, pct: scored ? Math.round((100 * auto) / scored) : null, tiers,
    };

    // Roles: detail = the node's rows (with the NodeRole id so the row is editable);
    // rollup = one entry per role, Owner wins, with a task degree for "· N tasks".
    let roles: any[];
    if (detail) {
      roles = nodeRoles
        .map((r) => ({ nodeRoleId: r.id, roleId: r.role.id, name: r.role.displayValue, relation: r.role_, raci: r.ownerLevel ?? null }))
        .sort((a, b) => (a.relation === b.relation ? a.name.localeCompare(b.name) : a.relation === 'Owner' ? -1 : 1));
    } else {
      const byRole = new Map<string, { roleId: string; name: string; owner: boolean; tasks: number }>();
      for (const r of nodeRoles) {
        let e = byRole.get(r.role.id);
        if (!e) { e = { roleId: r.role.id, name: r.role.displayValue, owner: false, tasks: 0 }; byRole.set(r.role.id, e); }
        e.tasks += 1;
        if (r.role_ === 'Owner') e.owner = true;
      }
      roles = [...byRole.values()]
        .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))
        .map((e) => ({ roleId: e.roleId, name: e.name, relation: e.owner ? 'Owner' : 'Participant', tasks: e.tasks }));
    }

    // Applications: detail = node rows (usageId editable); rollup = one per app.
    let applications: any[];
    if (detail) {
      applications = appUsages
        .map((a) => ({ usageId: a.id, appId: a.application.id, name: a.application.name, usageType: a.usageType }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const byApp = new Map<string, { appId: string; name: string; types: Set<string>; tasks: number }>();
      for (const a of appUsages) {
        let e = byApp.get(a.application.id);
        if (!e) { e = { appId: a.application.id, name: a.application.name, types: new Set(), tasks: 0 }; byApp.set(a.application.id, e); }
        e.types.add(a.usageType); e.tasks += 1;
      }
      applications = [...byApp.values()]
        .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))
        .map((e) => ({ appId: e.appId, name: e.name, usageType: [...e.types].join(' · '), tasks: e.tasks }));
    }

    // Deliverables: detail = node links (linkId editable); rollup = distinct list.
    let deliverables: any[];
    if (detail) {
      deliverables = delivLinks.map((d) => ({ linkId: d.id, deliverableId: d.deliverable.id, title: d.deliverable.title }));
    } else {
      const seen = new Map<string, string>();
      for (const d of delivLinks) if (!seen.has(d.deliverable.id)) seen.set(d.deliverable.id, d.deliverable.title);
      deliverables = [...seen.entries()].map(([id, title]) => ({ deliverableId: id, title }));
    }

    // Checklist: detail = node items (editable); rollup = distinct texts + count.
    let checklist: any[];
    if (detail) {
      const seen = new Set<string>();
      checklist = checkLinks
        .filter((c) => { if (seen.has(c.checklistItem.id)) return false; seen.add(c.checklistItem.id); return true; })
        .map((c) => ({ nodeChecklistId: c.id, checklistItemId: c.checklistItem.id, text: c.checklistItem.text }));
    } else {
      const seen = new Set<string>();
      checklist = checkLinks
        .filter((c) => { if (seen.has(c.checklistItem.id)) return false; seen.add(c.checklistItem.id); return true; })
        .map((c) => ({ checklistItemId: c.checklistItem.id, text: c.checklistItem.text }));
    }

    // Testing: detail = the single template tied to this node (first), as editable
    // fields; rollup = a flat list with task/deliverable context.
    let testing: any = null;
    if (detail) {
      const own = testingRows.find((t) => t.taskNodeId === node.id) ?? testingRows[0] ?? null;
      testing = own
        ? { id: own.id, deliverableId: own.deliverableId, system: own.system, location: own.location, checkType: own.checkType, expected: own.expected }
        : { id: null, deliverableId: deliverableIds[0] ?? null, system: '', location: '', checkType: 'presence', expected: '' };
    } else {
      testing = testingRows.map((t) => ({ id: t.id, system: t.system, location: t.location, checkType: t.checkType, expected: t.expected }));
    }

    // Work Library plan surfacing: detail = the task's full plan (checklist/
    // testing key rows + tied standards/regs steps, ✓ defined / ✗ missing);
    // rollup = defined/total counts across the subtree's tasks.
    let plan: any = null;
    let planRollup: any = null;
    if (detail) {
      plan = (await taskPlans([node.id], { includeTied: true })).get(node.id) ?? null;
      counts.checklist = plan?.checklist.length ?? 0;
      counts.testing = plan?.testing.length ?? 0;
    } else if (taskIds.length) {
      // One aggregate SQL round trip — never loads each task's full plan.
      const r = await subtreePlanRollup(node.id);
      planRollup = { tasks: taskIds.length, tasksWithPlan: r.tasksWithPlan, defined: r.defined, total: r.total };
      counts.checklist = r.checklistKeys; counts.testing = r.testingKeys;
    }

    // Breadcrumb (ancestors top→down) + domain (topmost ancestor) for the accent.
    const ancEdges = await prisma.processNodeClosure.findMany({
      where: { descendantId: node.id, depth: { gt: 0 } },
      select: { ancestorId: true, depth: true },
    });
    const ancNodes = ancEdges.length
      ? await prisma.processNode.findMany({ where: { id: { in: ancEdges.map((e) => e.ancestorId) } }, select: { id: true, displayValue: true } })
      : [];
    const depthOf = new Map(ancEdges.map((e) => [e.ancestorId, e.depth]));
    const ancNameById = new Map(ancNodes.map((n) => [n.id, n.displayValue]));
    const breadcrumb = [...ancEdges]
      .sort((a, b) => b.depth - a.depth) // deepest depth = topmost ancestor → first crumb
      .map((e) => ({ id: e.ancestorId, name: ancNameById.get(e.ancestorId) ?? '—' }));
    const domain = breadcrumb[0]?.name ?? null;
    // Value stream = the L2 ancestor (or self if this node is L2).
    let valueStreamId: string | null = node.processLevelType.levelNumber === 2 ? node.id : null;
    if (!valueStreamId && ancNodes.length) {
      const ancLevels = await prisma.processNode.findMany({ where: { id: { in: ancNodes.map((n) => n.id) } }, select: { id: true, processLevelType: { select: { levelNumber: true } } } });
      valueStreamId = ancLevels.find((a) => a.processLevelType.levelNumber === 2)?.id ?? null;
    }

    // Standards + regulations governing this node: those attached to its L2/L3
    // process ancestors (value stream + area) plus the node itself when it is an
    // L2/L3 container — the same inheritance the Tasks list surfaces on a leaf.
    // Standards/regs live on TASK nodes only; any level (a task itself or a
    // container) rolls up the distinct set across its subtree's tasks.
    const [stdRows, regRows] = await Promise.all([subtreeStandards(node.id), subtreeRegulations(node.id)]);
    const standards = stdRows.map((r) => ({ standardId: r.standardId, name: r.name }));
    const regulations = regRows.map((r) => ({ regId: r.regId, title: r.title }));
    counts.standards = standards.length;
    counts.regulations = regulations.length;

    // Drill children (the Tasks tab list at a container; siblings-context at a leaf).
    const children = await prisma.processNode.findMany({
      where: { parentId: node.id },
      orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
      select: { id: true, displayValue: true, isTask: true, processLevelType: { select: { displayValue: true } } },
    });

    // % automatable by the next level down (this node's direct children): each
    // task's score attributed to the direct child it descends from. Lets the
    // Overview show "% automatable by <PL3 / PL4 / step>" at whatever level we sit.
    const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
    const topChildOf = (taskId: string): string | null => {
      let cur: string | null = taskId; let guard = 0;
      while (cur && guard++ < 64) {
        const p: string | null = parentOf.get(cur) ?? null;
        if (p === node.id) return cur;
        if (!p || !parentOf.has(p)) return null;
        cur = p;
      }
      return null;
    };
    const childAgg = new Map<string, { auto: number; scored: number }>();
    for (const n of nodes) {
      if (!n.isTask || !n.automatability) continue;
      const s = SCORE_OF[n.automatability];
      if (typeof s !== 'number') continue;
      const c = topChildOf(n.id);
      if (!c) continue;
      const e = childAgg.get(c) ?? { auto: 0, scored: 0 };
      e.scored += 1; if (s <= 2) e.auto += 1;
      childAgg.set(c, e);
    }
    const byChild = children.map((c) => {
      const e = childAgg.get(c.id);
      return { id: c.id, name: c.displayValue, isTask: c.isTask, scored: e?.scored ?? 0, auto: e?.auto ?? 0, pct: e && e.scored ? Math.round((100 * e.auto) / e.scored) : null };
    });
    const byChildLabel = children[0]?.processLevelType.displayValue ?? null;

    res.json({
      id: node.id,
      name: node.displayValue,
      levelNumber: node.processLevelType.levelNumber,
      levelLabel: node.processLevelType.displayValue,
      isTask: node.isTask,
      detail,
      code: node.code ?? null,
      attributes: node.attributes ?? null,
      automatability: node.automatability ?? null,
      automation: { ...automation, byChild, byChildLabel },
      domain,
      valueStreamId,
      breadcrumb,
      counts,
      roles,
      applications,
      deliverables,
      checklist,
      testing,
      plan,
      planRollup,
      standards,
      regulations,
      children: children.map((c) => ({ id: c.id, name: c.displayValue, isTask: c.isTask })),
    });
  } catch (e) { next(e); }
});

// ── Connected chain (Deliverable → Tasks → Checklist → Testing) ──────────────
// One organized view of how a deliverable is produced: the task steps that
// produce it (NodeDeliverable on isTask nodes), each task's checklist items
// (NodeChecklist), and the testing templates verifying it (TestingTemplate by
// task node, plus deliverable-level templates). Scope = the node itself at a
// leaf (detail) or its whole subtree at a container (rollup).
router.get('/:nodeId/chain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });

    const { nodes } = await processSubtree(node.id);
    const detail = node.isTask;
    const scopeIds = detail ? [node.id] : nodes.map((n) => n.id);
    const isTaskSet = new Set(nodes.filter((n) => n.isTask).map((n) => n.id));
    const nameById = new Map(nodes.map((n) => [n.id, n.displayValue]));
    nameById.set(node.id, node.displayValue);

    const delivLinks = await prisma.nodeDeliverable.findMany({
      where: { processNodeId: { in: scopeIds } },
      select: { id: true, processNodeId: true, deliverable: { select: { id: true, title: true } } },
    });
    if (!delivLinks.length) return res.json({ chain: [] });

    const taskNodeIds = [...new Set(delivLinks.map((l) => l.processNodeId).filter((id) => isTaskSet.has(id) || detail))];
    const deliverableIds = [...new Set(delivLinks.map((l) => l.deliverable.id))];

    // Work Library plans drive the checklist/testing content of each task card
    // (✓ defined value / ✗ missing key), including tied standard/reg steps.
    const [plans, roleEntries, appEntries] = await Promise.all([
      taskPlans(taskNodeIds, { includeTied: true }),
      rolesForNodes(taskNodeIds),
      appsForNodes(taskNodeIds),
    ]);

    const rolesForTask = (nodeId: string) => {
      const seen = new Map<string, { roleId: string; name: string; relation: string }>();
      for (const e of roleEntries.get(nodeId) ?? []) {
        const cur = seen.get(e.id);
        if (!cur || (e.role_ === 'Owner' && cur.relation !== 'Owner')) seen.set(e.id, { roleId: e.id, name: e.name, relation: e.role_ });
      }
      return [...seen.values()].sort((a, b) => (a.relation === b.relation ? a.name.localeCompare(b.name) : a.relation === 'Owner' ? -1 : 1));
    };
    const appsForTask = (nodeId: string) => {
      const seen = new Map<string, { appId: string; name: string; types: Set<string> }>();
      for (const a of appEntries.get(nodeId) ?? []) {
        let e = seen.get(a.id); if (!e) { e = { appId: a.id, name: a.name, types: new Set() }; seen.set(a.id, e); }
        e.types.add(a.usageType);
      }
      return [...seen.values()].map((e) => ({ appId: e.appId, name: e.name, usageType: [...e.types].join(' · ') })).sort((a, b) => a.name.localeCompare(b.name));
    };

    // Group links by deliverable; tasks = the (task) nodes producing it.
    const byDeliv = new Map<string, { title: string; linkId: string | null; taskIds: { nodeId: string; linkId: string }[] }>();
    for (const l of delivLinks) {
      let e = byDeliv.get(l.deliverable.id);
      if (!e) { e = { title: l.deliverable.title, linkId: null, taskIds: [] }; byDeliv.set(l.deliverable.id, e); }
      if (detail && l.processNodeId === node.id) e.linkId = l.id;
      if (isTaskSet.has(l.processNodeId) || (detail && l.processNodeId === node.id)) e.taskIds.push({ nodeId: l.processNodeId, linkId: l.id });
    }

    const chain = [...byDeliv.entries()].map(([deliverableId, d]) => {
      const tasks = d.taskIds.map(({ nodeId }) => {
        const p = plans.get(nodeId);
        return {
          taskId: nodeId,
          name: nameById.get(nodeId) ?? '—',
          roles: rolesForTask(nodeId),
          applications: appsForTask(nodeId),
          checklist: p?.checklist ?? [],
          testing: p?.testing ?? [],
          standards: p?.standards ?? [],
          regulations: p?.regulations ?? [],
        };
      });
      // Deliverable roll-up = verified/total across its tasks' plan rows.
      let defined = 0; let total = 0;
      for (const { nodeId } of d.taskIds) {
        const p = plans.get(nodeId);
        if (p) { defined += p.defined; total += p.total; }
      }
      return { deliverableId, title: d.title, linkId: d.linkId, tasks, rollup: { defined, total } };
    }).sort((a, b) => a.title.localeCompare(b.title));

    res.json({ chain });
  } catch (e) { next(e); }
});

// ── Pickers (associate an existing entity) ───────────────────────────────────
router.get('/search/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await prisma.role.findMany({
      where: { companyId: company.id, ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { displayValue: 'asc' }, take: 20,
      select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
    });
    res.json({ items: rows.map((r) => ({ id: r.id, name: r.displayValue, sub: r.orgUnit?.displayValue ?? null })) });
  } catch (e) { next(e); }
});

router.get('/search/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await prisma.application.findMany({
      where: { companyId: company.id, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { name: 'asc' }, take: 20,
      select: { id: true, name: true, category: true },
    });
    res.json({ items: rows.map((a) => ({ id: a.id, name: a.name, sub: a.category ?? null })) });
  } catch (e) { next(e); }
});

router.get('/search/deliverables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await prisma.deliverable.findMany({
      where: { companyId: company.id, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { title: 'asc' }, take: 20,
      select: { id: true, title: true },
    });
    res.json({ items: rows.map((d) => ({ id: d.id, name: d.title })) });
  } catch (e) { next(e); }
});

// Propagation summary for a role: distinct value streams (process L2) it touches,
// so the UI can say "now applied in Org chart, Applications & N streams".
async function rolePropagation(roleId: string) {
  const links = await prisma.nodeRole.findMany({ where: { roleId }, select: { processNodeId: true } });
  const anc = await streamAncestry(links.map((l) => l.processNodeId));
  const streams = new Set<string>();
  for (const a of anc.values()) if (a.valueStreamId) streams.add(a.valueStreamId);
  return { places: ['Org chart'], streams: streams.size };
}

// ── Roles (associate existing / add new · Owner|Participant + RACI · detach) ──
const roleBody = z.object({
  roleId: z.string().optional(),
  newRoleName: z.string().min(1).optional(),
  relation: z.enum(['Owner', 'Participant']).default('Participant'),
  raci: z.string().optional(),
}).refine((b) => b.roleId || b.newRoleName, { message: 'roleId or newRoleName required' });

router.post('/:nodeId/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = roleBody.parse(req.body);

    let roleId = body.roleId;
    let created = false;
    if (!roleId) {
      const role = await prisma.role.create({
        data: { companyId: company.id, dbValue: body.newRoleName!, displayValue: body.newRoleName! },
        select: { id: true },
      });
      roleId = role.id; created = true;
      await audit(req, 'Role', roleId, 'create', { displayValue: body.newRoleName });
    } else {
      const owned = await prisma.role.findFirst({ where: { id: roleId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Role not found' });
    }

    // One canonical NodeRole (processNodeId, roleId, role_); RACI on ownerLevel.
    const link = await prisma.nodeRole.upsert({
      where: { processNodeId_roleId_role_: { processNodeId: node.id, roleId: roleId!, role_: body.relation } },
      update: { ownerLevel: body.raci ?? null },
      create: { companyId: company.id, processNodeId: node.id, roleId: roleId!, role_: body.relation, ownerLevel: body.raci ?? null },
      select: { id: true, role_: true, ownerLevel: true, role: { select: { id: true, displayValue: true } } },
    });
    await audit(req, 'NodeRole', link.id, 'associate', { processNodeId: node.id, roleId, relation: body.relation });
    const propagation = await rolePropagation(roleId!);
    res.status(201).json({
      role: { nodeRoleId: link.id, roleId: link.role.id, name: link.role.displayValue, relation: link.role_, raci: link.ownerLevel },
      created, propagation,
    });
  } catch (e) { next(e); }
});

router.patch('/roles/:nodeRoleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeRole.findFirst({ where: { id: req.params.nodeRoleId, companyId: company.id }, select: { id: true, processNodeId: true, roleId: true, role_: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ relation: z.enum(['Owner', 'Participant']).optional(), raci: z.string().nullable().optional() }).parse(req.body);

    const link = await prisma.nodeRole.update({
      where: { id: existing.id },
      data: { ...(body.relation ? { role_: body.relation } : {}), ...(body.raci !== undefined ? { ownerLevel: body.raci } : {}) },
      select: { id: true, role_: true, ownerLevel: true, role: { select: { id: true, displayValue: true } } },
    });
    await audit(req, 'NodeRole', link.id, 'update', body);
    res.json({ role: { nodeRoleId: link.id, roleId: link.role.id, name: link.role.displayValue, relation: link.role_, raci: link.ownerLevel } });
  } catch (e) { next(e); }
});

router.delete('/roles/:nodeRoleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeRole.findFirst({ where: { id: req.params.nodeRoleId, companyId: company.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeRole.delete({ where: { id: existing.id } });
    await audit(req, 'NodeRole', existing.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Applications (associate existing / add new · usage · detach) ─────────────
const appBody = z.object({
  applicationId: z.string().optional(),
  newAppName: z.string().min(1).optional(),
  usageType: z.enum(['performed', 'memorialized']).default('performed'),
}).refine((b) => b.applicationId || b.newAppName, { message: 'applicationId or newAppName required' });

router.post('/:nodeId/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = appBody.parse(req.body);

    let appId = body.applicationId;
    let created = false;
    if (!appId) {
      const app = await prisma.application.create({
        data: { companyId: company.id, name: body.newAppName!, kind: 'Tool', illustrative: true },
        select: { id: true },
      });
      appId = app.id; created = true;
      await audit(req, 'Application', appId, 'create', { name: body.newAppName });
    } else {
      const owned = await prisma.application.findFirst({ where: { id: appId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Application not found' });
    }

    const link = await prisma.nodeAppUsage.upsert({
      where: { processNodeId_applicationId_usageType: { processNodeId: node.id, applicationId: appId!, usageType: body.usageType } },
      update: {},
      create: { companyId: company.id, processNodeId: node.id, applicationId: appId!, usageType: body.usageType },
      select: { id: true, usageType: true, application: { select: { id: true, name: true } } },
    });
    await audit(req, 'NodeAppUsage', link.id, 'associate', { processNodeId: node.id, applicationId: appId, usageType: body.usageType });
    res.status(201).json({
      application: { usageId: link.id, appId: link.application.id, name: link.application.name, usageType: link.usageType },
      created, propagation: { places: ['Applications catalog'], streams: 0 },
    });
  } catch (e) { next(e); }
});

router.patch('/applications/:usageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeAppUsage.findFirst({ where: { id: req.params.usageId, companyId: company.id }, select: { id: true, processNodeId: true, applicationId: true, usageType: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ usageType: z.enum(['performed', 'memorialized']) }).parse(req.body);
    if (body.usageType === existing.usageType) {
      const link = await prisma.nodeAppUsage.findUnique({ where: { id: existing.id }, select: { id: true, usageType: true, application: { select: { id: true, name: true } } } });
      return res.json({ application: { usageId: link!.id, appId: link!.application.id, name: link!.application.name, usageType: link!.usageType } });
    }
    // The unique key includes usageType, so re-key by delete+create (idempotent).
    await prisma.nodeAppUsage.delete({ where: { id: existing.id } });
    const link = await prisma.nodeAppUsage.upsert({
      where: { processNodeId_applicationId_usageType: { processNodeId: existing.processNodeId, applicationId: existing.applicationId, usageType: body.usageType } },
      update: {},
      create: { companyId: company.id, processNodeId: existing.processNodeId, applicationId: existing.applicationId, usageType: body.usageType },
      select: { id: true, usageType: true, application: { select: { id: true, name: true } } },
    });
    await audit(req, 'NodeAppUsage', link.id, 'update', { usageType: body.usageType });
    res.json({ application: { usageId: link.id, appId: link.application.id, name: link.application.name, usageType: link.usageType } });
  } catch (e) { next(e); }
});

router.delete('/applications/:usageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const existing = await prisma.nodeAppUsage.findFirst({ where: { id: req.params.usageId, companyId: company.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeAppUsage.delete({ where: { id: existing.id } });
    await audit(req, 'NodeAppUsage', existing.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Checklist items (add / edit text / remove) ───────────────────────────────
// A ChecklistItem must live in a Checklist container; we keep one per company
// ("Process checklist") so a step's item is a real, shared ChecklistItem the
// rest of the app reads. NodeChecklist binds it to the step.
async function defaultChecklistId(companyId: string) {
  const found = await prisma.checklist.findFirst({ where: { companyId, name: 'Process checklist' }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.checklist.create({ data: { companyId, name: 'Process checklist' }, select: { id: true } });
  return created.id;
}

router.post('/:nodeId/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ text: z.string().min(1) }).parse(req.body);

    const checklistId = await defaultChecklistId(company.id);
    const item = await prisma.checklistItem.create({ data: { checklistId, text: body.text }, select: { id: true, text: true } });
    const link = await prisma.nodeChecklist.create({
      data: { companyId: company.id, processNodeId: node.id, checklistItemId: item.id },
      select: { id: true },
    });
    await audit(req, 'ChecklistItem', item.id, 'create', { processNodeId: node.id, text: body.text });
    res.status(201).json({ item: { nodeChecklistId: link.id, checklistItemId: item.id, text: item.text } });
  } catch (e) { next(e); }
});

router.patch('/checklist/:checklistItemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    // scope: the item must be linked to a node this company owns.
    const link = await prisma.nodeChecklist.findFirst({ where: { checklistItemId: req.params.checklistItemId, companyId: company.id }, select: { id: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    const body = z.object({ text: z.string().min(1) }).parse(req.body);
    const item = await prisma.checklistItem.update({ where: { id: req.params.checklistItemId }, data: { text: body.text }, select: { id: true, text: true } });
    await audit(req, 'ChecklistItem', item.id, 'update', body);
    res.json({ item: { checklistItemId: item.id, text: item.text } });
  } catch (e) { next(e); }
});

router.delete('/checklist/:nodeChecklistId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const link = await prisma.nodeChecklist.findFirst({ where: { id: req.params.nodeChecklistId, companyId: company.id }, select: { id: true, checklistItemId: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeChecklist.delete({ where: { id: link.id } });
    // The item is step-specific (created here), so remove it too unless shared.
    const otherLinks = await prisma.nodeChecklist.count({ where: { checklistItemId: link.checklistItemId } });
    if (otherLinks === 0) await prisma.checklistItem.delete({ where: { id: link.checklistItemId } }).catch(() => {});
    await audit(req, 'NodeChecklist', link.id, 'remove');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Deliverables (associate existing / add new · detach) ─────────────────────
const delivBody = z.object({
  deliverableId: z.string().optional(),
  newTitle: z.string().min(1).optional(),
}).refine((b) => b.deliverableId || b.newTitle, { message: 'deliverableId or newTitle required' });

router.post('/:nodeId/deliverables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = delivBody.parse(req.body);

    let deliverableId = body.deliverableId;
    let created = false;
    if (!deliverableId) {
      const d = await prisma.deliverable.create({ data: { companyId: company.id, title: body.newTitle! }, select: { id: true } });
      deliverableId = d.id; created = true;
      await audit(req, 'Deliverable', deliverableId, 'create', { title: body.newTitle });
    } else {
      const owned = await prisma.deliverable.findFirst({ where: { id: deliverableId, companyId: company.id }, select: { id: true } });
      if (!owned) return res.status(404).json({ error: 'Deliverable not found' });
    }

    const link = await prisma.nodeDeliverable.upsert({
      where: { processNodeId_deliverableId: { processNodeId: node.id, deliverableId: deliverableId! } },
      update: {},
      create: { companyId: company.id, processNodeId: node.id, deliverableId: deliverableId! },
      select: { id: true, deliverable: { select: { id: true, title: true } } },
    });
    await audit(req, 'NodeDeliverable', link.id, 'associate', { processNodeId: node.id, deliverableId });
    res.status(201).json({ deliverable: { linkId: link.id, deliverableId: link.deliverable.id, title: link.deliverable.title }, created });
  } catch (e) { next(e); }
});

router.delete('/deliverables/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const link = await prisma.nodeDeliverable.findFirst({ where: { id: req.params.linkId, companyId: company.id }, select: { id: true } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeDeliverable.delete({ where: { id: link.id } });
    await audit(req, 'NodeDeliverable', link.id, 'detach');
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Testing template (edit System / Location / Check / Expected) ─────────────
// PRIMARY tie is a Deliverable; we tie the row to the step (taskNodeId) and to
// the step's first deliverable, creating a deliverable for the step if it has
// none (so the canonical TestingTemplate always has its required deliverable).
router.put('/:nodeId/testing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const node = await ownedNode(req, company.id, req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Not found' });
    const body = z.object({
      system: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      checkType: z.enum(['presence', 'absence']).optional().nullable(),
      expected: z.string().optional().nullable(),
    }).parse(req.body);

    const existing = await prisma.testingTemplate.findFirst({ where: { taskNodeId: node.id }, select: { id: true } });
    if (existing) {
      const row = await prisma.testingTemplate.update({
        where: { id: existing.id },
        data: { system: body.system ?? null, location: body.location ?? null, checkType: body.checkType ?? null, expected: body.expected ?? null },
        select: { id: true, deliverableId: true, system: true, location: true, checkType: true, expected: true },
      });
      await audit(req, 'TestingTemplate', row.id, 'update', body);
      return res.json({ testing: { ...row } });
    }

    // No template yet — resolve (or create) a deliverable for the step.
    let deliverableId: string | null = (await prisma.nodeDeliverable.findFirst({ where: { processNodeId: node.id, companyId: company.id }, select: { deliverableId: true } }))?.deliverableId ?? null;
    if (!deliverableId) {
      const d = await prisma.deliverable.create({ data: { companyId: company.id, title: node.displayValue }, select: { id: true } });
      deliverableId = d.id;
      await prisma.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: node.id, deliverableId } });
      await audit(req, 'Deliverable', deliverableId, 'create', { title: node.displayValue, reason: 'testing-template' });
    }
    const row = await prisma.testingTemplate.create({
      data: { deliverableId, taskNodeId: node.id, system: body.system ?? null, location: body.location ?? null, checkType: body.checkType ?? null, expected: body.expected ?? null },
      select: { id: true, deliverableId: true, system: true, location: true, checkType: true, expected: true },
    });
    await audit(req, 'TestingTemplate', row.id, 'create', body);
    res.status(201).json({ testing: { ...row } });
  } catch (e) { next(e); }
});

export default router;
