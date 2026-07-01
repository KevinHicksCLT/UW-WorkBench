import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ancestorNames } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);

// Per-role list columns fed by unbounded links (tasks, checklist, deliverables)
// are capped so the flat table stays a scannable summary and the payload stays
// small — the full set lives in the role drawer (GET /roles/:id). Value streams
// and standards are naturally small per role, so they render in full.
const LIST_CAP = 25;
const capped = (items: string[]) => (items.length > LIST_CAP ? items.slice(0, LIST_CAP) : items);

// GET /roles — flat table for the Roles tab list view: one row per role.
// Department/Division come off the org spine (OrgUnit L3/L2); a role homed
// straight on a division has no department ("Direct to division"). The four
// participation columns (value streams / deliverables / tasks / standards) plus
// checklist responsibilities are resolved for EVERY role in a handful of batched
// queries — no per-role fan-out.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      where: { company: { tenantId: req.tenantId } },
      select: {
        id: true, displayValue: true, roleType: true,
        orgUnit: {
          select: {
            displayValue: true, orgLevelType: { select: { levelNumber: true } },
            parent: { select: { displayValue: true, orgLevelType: { select: { levelNumber: true } } } },
          },
        },
      },
      orderBy: { displayValue: 'asc' },
    });

    const orgOf = (role: (typeof roles)[number]) => {
      let division: string | null = null;
      let department: string | null = null;
      if (role.orgUnit) {
        if (role.orgUnit.orgLevelType.levelNumber === 3) {
          department = role.orgUnit.displayValue;
          if (role.orgUnit.parent?.orgLevelType.levelNumber === 2) division = role.orgUnit.parent.displayValue;
        } else {
          division = role.orgUnit.displayValue;
          department = 'Direct to division';
        }
      }
      return { division, department };
    };

    const roleIds = roles.map((r) => r.id);
    // Batch every link once, keyed by roleId (or node) — never per role.
    const [nodeRoles, roleDelivs, roleStandards] = await Promise.all([
      prisma.nodeRole.findMany({ where: { roleId: { in: roleIds } }, select: { roleId: true, processNodeId: true, processNode: { select: { displayValue: true } } } }),
      prisma.roleDeliverable.findMany({ where: { roleId: { in: roleIds } }, select: { roleId: true, deliverable: { select: { title: true } } } }),
      prisma.roleStandard.findMany({ where: { roleId: { in: roleIds } }, select: { roleId: true, standard: { select: { name: true } } } }),
    ]);

    const nodeIds = [...new Set(nodeRoles.map((n) => n.processNodeId))];
    // One closure pass over every role's task nodes → each node's L2 (value
    // stream) name and its L3 (area) ancestor ids (the areas whose standards the
    // role is governed by). Plus the checklists + deliverables carried on those
    // nodes, so a role with no DIRECT standard/deliverable link still fills the
    // column from the work it actually does.
    const [closureEdges, nodeChecks, nodeDelivs] = await Promise.all([
      prisma.processNodeClosure.findMany({ where: { descendantId: { in: nodeIds } }, select: { ancestorId: true, descendantId: true } }),
      prisma.nodeChecklist.findMany({ where: { processNodeId: { in: nodeIds } }, select: { processNodeId: true, checklistItem: { select: { text: true } } } }),
      prisma.nodeDeliverable.findMany({ where: { processNodeId: { in: nodeIds } }, select: { processNodeId: true, deliverable: { select: { title: true } } } }),
    ]);
    const ancestorIds = [...new Set(closureEdges.map((e) => e.ancestorId))];
    const ancestors = await prisma.processNode.findMany({
      where: { id: { in: ancestorIds }, processLevelType: { levelNumber: { in: [2, 3] } } },
      select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } } },
    });
    const ancById = new Map(ancestors.map((a) => [a.id, { name: a.displayValue, level: a.processLevelType.levelNumber }] as const));
    // L3 area node → its standards' names (governing standards for that area).
    const l3Ids = ancestors.filter((a) => a.processLevelType.levelNumber === 3).map((a) => a.id);
    const areaStds = await prisma.nodeStandard.findMany({ where: { processNodeId: { in: l3Ids } }, select: { processNodeId: true, standard: { select: { name: true } } } });
    const stdByL3 = new Map<string, string[]>();
    for (const ns of areaStds) { const a = stdByL3.get(ns.processNodeId) ?? []; a.push(ns.standard.name); stdByL3.set(ns.processNodeId, a); }
    // node → { value stream name, L3 ancestor ids }
    const vsByNode = new Map<string, string>();
    const l3ByNode = new Map<string, string[]>();
    for (const e of closureEdges) {
      const anc = ancById.get(e.ancestorId);
      if (!anc) continue;
      if (anc.level === 2) vsByNode.set(e.descendantId, anc.name);
      else if (anc.level === 3) { const a = l3ByNode.get(e.descendantId) ?? []; a.push(e.ancestorId); l3ByNode.set(e.descendantId, a); }
    }
    // node → checklist texts / deliverable titles.
    const checksByNode = new Map<string, string[]>();
    for (const nc of nodeChecks) { const a = checksByNode.get(nc.processNodeId) ?? []; a.push(nc.checklistItem.text); checksByNode.set(nc.processNodeId, a); }
    const delivsByNode = new Map<string, string[]>();
    for (const nd of nodeDelivs) { const a = delivsByNode.get(nd.processNodeId) ?? []; a.push(nd.deliverable.title); delivsByNode.set(nd.processNodeId, a); }

    // Aggregate per role.
    const vsByRole = new Map<string, Set<string>>();
    const tasksByRole = new Map<string, Set<string>>();
    const checksByRole = new Map<string, Set<string>>();
    const nodeDelivByRole = new Map<string, Set<string>>();
    const areaStdByRole = new Map<string, Set<string>>();
    const push = (m: Map<string, Set<string>>, k: string, v: string | null | undefined) => {
      if (!v) return;
      const s = m.get(k) ?? new Set<string>(); s.add(v); m.set(k, s);
    };
    for (const nr of nodeRoles) {
      push(tasksByRole, nr.roleId, nr.processNode.displayValue);
      push(vsByRole, nr.roleId, vsByNode.get(nr.processNodeId));
      for (const text of checksByNode.get(nr.processNodeId) ?? []) push(checksByRole, nr.roleId, text);
      for (const title of delivsByNode.get(nr.processNodeId) ?? []) push(nodeDelivByRole, nr.roleId, title);
      for (const l3 of l3ByNode.get(nr.processNodeId) ?? []) for (const sn of stdByL3.get(l3) ?? []) push(areaStdByRole, nr.roleId, sn);
    }
    // Direct links take priority; fall back to work-derived where a role has none.
    const delivByRole = new Map<string, Set<string>>();
    for (const rd of roleDelivs) push(delivByRole, rd.roleId, rd.deliverable.title);
    const stdByRole = new Map<string, Set<string>>();
    for (const rs of roleStandards) push(stdByRole, rs.roleId, rs.standard.name);

    type Row = {
      key: string; roleId: string; role: string; roleType: string | null;
      department: string | null; division: string | null;
      valueStreams: string[]; deliverables: string[]; tasks: string[]; standards: string[];
      checklist: string[];
    };
    const setArr = (m: Map<string, Set<string>>, id: string) => [...(m.get(id) ?? new Set<string>())].sort();
    // Union of direct + work-derived links (direct first), de-duplicated.
    const merged = (a: Map<string, Set<string>>, b: Map<string, Set<string>>, id: string) =>
      [...new Set([...(a.get(id) ?? []), ...(b.get(id) ?? [])])].sort();
    const rows: Row[] = roles.map((role) => {
      const { division, department } = orgOf(role);
      return {
        key: role.id, roleId: role.id, role: role.displayValue, roleType: role.roleType ?? null,
        department, division,
        valueStreams: setArr(vsByRole, role.id),
        deliverables: capped(merged(delivByRole, nodeDelivByRole, role.id)),
        tasks: capped(setArr(tasksByRole, role.id)),
        standards: capped(merged(stdByRole, areaStdByRole, role.id)),
        checklist: capped(setArr(checksByRole, role.id)),
      };
    });
    res.json({ rows });
  } catch (e) { next(e); }
});

// GET /roles/org-chart — the reporting-line root. Manager chains aren't backfilled
// yet (Role.managerRoleId is unset company-wide), so for now this returns just the
// CEO with an empty `reports` list — the org chart's top box and nothing under it.
router.get('/org-chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ceo = await prisma.role.findFirst({
      where: { company: { tenantId: req.tenantId }, displayValue: { contains: 'Chief Executive', mode: 'insensitive' } },
      select: { id: true, displayValue: true },
    });
    res.json({ root: ceo ? { id: ceo.id, name: ceo.displayValue, reports: [] } : null });
  } catch (e) { next(e); }
});

// Group responsibilities by their checklist name for display, de-duplicating by
// normalized text within each group.
function groupByChecklist(rows: { text: string; checklist: string | null }[]) {
  const m = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const cat = r.checklist ?? 'Uncategorized';
    if (!m.has(cat)) { m.set(cat, []); seen.set(cat, new Set()); }
    const key = r.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.get(cat)!.has(key)) continue;
    seen.get(cat)!.add(key);
    m.get(cat)!.push(r.text);
  }
  return [...m.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

// GET /roles/:id — role + division/department (org closure), value-stream
// participation, deliverables, the role's task ProcessNodes and its checklist
// responsibilities. erd_v5: every link is an FK seek off the role (NodeRole,
// RoleDeliverable, ChecklistItem) — no company-wide text scan.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: {
        id: true, displayValue: true, companyId: true, orgUnitId: true,
        company: { select: { id: true, name: true } },
        orgUnit: {
          select: {
            id: true, displayValue: true,
            orgLevelType: { select: { levelNumber: true } },
            parent: { select: { id: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } } },
          },
        },
      },
    });
    if (!role) return res.status(404).json({ error: 'Not found' });

    const [nodeRoles, roleDelivs, checkItems] = await Promise.all([
      // The role's task links (Owner = Lead, Participant = Support).
      prisma.nodeRole.findMany({
        where: { roleId: role.id },
        select: {
          role_: true,
          processNode: { select: { id: true, displayValue: true, sortOrder: true } },
        },
      }),
      // The deliverables the role owns/contributes.
      prisma.roleDeliverable.findMany({
        where: { roleId: role.id },
        select: { role_: true, deliverable: { select: { id: true, title: true } } },
      }),
      // Responsibilities — checklist items assigned to the role.
      prisma.checklistItem.findMany({
        where: { roleId: role.id },
        orderBy: { id: 'asc' },
        select: { text: true, checklist: { select: { name: true } } },
      }),
    ]);

    // Resolve each task node's location strings once via the closure.
    const nodeIds = nodeRoles.map((n) => n.processNode.id);
    const loc = await ancestorNames(nodeIds);

    // processTasks — one per task node the role leads/supports.
    type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
    const processTasks: ProcTask[] = nodeRoles.map((nr) => {
      const a = loc.get(nr.processNode.id);
      return {
        valueStreamId: a?.valueStreamId ?? '',
        valueStreamName: a?.valueStreamName ?? '—',
        l3: a?.l3 ?? null,
        l4: a?.l4 ?? null,
        stepNumber: nr.processNode.sortOrder,
        name: nr.processNode.displayValue,
        relation: (nr.role_ === 'Owner' ? 'Lead' : 'Support') as 'Lead' | 'Support',
        outputs: null,
      };
    }).sort((a, b) => a.valueStreamName.localeCompare(b.valueStreamName) || String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')) || a.stepNumber - b.stepNumber);

    // ioRows — the role's deliverables grouped by (value stream, L4). The task
    // location feeding a deliverable is no longer stored, so they group under the
    // role's strongest stream (the value stream most of its task nodes roll up to).
    const primaryVs = (() => {
      const counts = new Map<string, { name: string; n: number }>();
      for (const a of loc.values()) {
        if (!a.valueStreamId) continue;
        const e = counts.get(a.valueStreamId) ?? { name: a.valueStreamName ?? '—', n: 0 };
        e.n++; counts.set(a.valueStreamId, e);
      }
      const top = [...counts.entries()].sort((x, y) => y[1].n - x[1].n)[0];
      const first = processTasks[0];
      return top ? { id: top[0], name: top[1].name, l3: null as string | null, l4: null as string | null } : (first ? { id: first.valueStreamId, name: first.valueStreamName, l3: first.l3, l4: first.l4 } : null);
    })();
    const ioRows = roleDelivs.length && primaryVs
      ? [{ valueStreamId: primaryVs.id, valueStreamName: primaryVs.name, domain: null as string | null, l3: primaryVs.l3, l4: primaryVs.l4, inputs: [] as string[], deliverables: [...new Set(roleDelivs.map((d) => d.deliverable.title))] }]
      : [];
    const deliverableCount = ioRows.reduce((n, r) => n + r.deliverables.length, 0);
    const inputCount = 0;

    // participation — the distinct value streams the role's task nodes roll up
    // to, with the strongest relation (Lead beats Support).
    const partMap = new Map<string, { valueStreamId: string; valueStreamName: string; participationType: 'Lead' | 'Support' }>();
    for (const nr of nodeRoles) {
      const a = loc.get(nr.processNode.id);
      if (!a?.valueStreamId) continue;
      const rel = nr.role_ === 'Owner' ? 'Lead' : 'Support';
      const cur = partMap.get(a.valueStreamId);
      if (!cur || (rel === 'Lead' && cur.participationType !== 'Lead')) {
        partMap.set(a.valueStreamId, { valueStreamId: a.valueStreamId, valueStreamName: a.valueStreamName ?? '—', participationType: rel });
      }
    }
    const participation = [...partMap.values()]
      .sort((a, b) => (a.participationType === b.participationType ? a.valueStreamName.localeCompare(b.valueStreamName) : a.participationType === 'Lead' ? -1 : 1))
      .map((p) => ({ valueStreamId: p.valueStreamId, valueStreamName: p.valueStreamName, domain: null, participationType: p.participationType, subStream: null, inputs: null, outputs: null }));

    // org context: a role homed at L3 (Department) → department = orgUnit,
    // division = its L2 parent; a role homed directly at L2 → division = orgUnit,
    // department = null ("Direct to division").
    let division: { id: string; name: string } | null = null;
    let department: { id: string; name: string } | null = null;
    if (role.orgUnit) {
      const lvl = role.orgUnit.orgLevelType?.levelNumber;
      if (lvl === 3) {
        department = { id: role.orgUnit.id, name: role.orgUnit.displayValue };
        if (role.orgUnit.parent && role.orgUnit.parent.orgLevelType?.levelNumber === 2) {
          division = { id: role.orgUnit.parent.id, name: role.orgUnit.parent.displayValue };
        }
      } else {
        division = { id: role.orgUnit.id, name: role.orgUnit.displayValue };
      }
    }

    res.json({
      ioRows,
      deliverableCount,
      inputCount,
      processTasks,
      id: role.id,
      name: role.displayValue,
      roleFamily: null,
      roleLevel: null,
      company: role.company,
      division,
      department,
      participation,
      responsibilities: groupByChecklist(checkItems.map((c) => ({ text: c.text, checklist: c.checklist?.name ?? null }))),
    });
  } catch (e) { next(e); }
});

export default router;
