import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAnyPermission } from '../middleware/permissions.js';
import { cacheResponses } from '../lib/responseCache.js';
import { ancestorNames, appsForNodes, rolesForNodes } from '../lib/resolvers/index.js';
import { taskPlans } from '../lib/workPlan.js';

// Deliverables & Tasks API — the standalone work tracker behind the
// "Deliverables & Tasks" tab. erd_v5: deliverables = Deliverable rows (owner +
// value stream + processes via RoleDeliverable / NodeDeliverable → closure);
// tasks = L5 task ProcessNodes (owner via NodeRole, location via the closure).
// Keyset pagination is supported (`?take`/`?cursor` on id); the default `take`
// is high so the existing one-shot table renders unchanged until rewired.

const router = Router();
router.use(requireAuth);
// /work backs BOTH the Deliverables and Tasks tabs — access on either menu key
// admits the request so neither tab's grant breaks the other.
router.use(requireAnyPermission(['tasks', 'deliverables']));
router.use(cacheResponses(15_000));

const DEFAULT_TAKE = 5000;
// ProcessNode.automatability → 1-5 agent-automatability score. Scale: 1 Autonomous
// Agent (AI does it end-to-end) … 5 Human-only; "automatable" = score ≤ 2. Lower =
// more AI-automatable. Legacy aliases kept for safety.
const SCORE_OF: Record<string, number> = {
  autonomous: 1,
  workflow: 2,
  augmented: 3,
  assist: 4,
  manual: 5,
  automated: 1,
  assisted: 4, // legacy aliases
};
// executive/senior roles are not surfaced as task-level contributors.
// (Two regexes — same union as the old single one, kept under the lint
// complexity budget.)
const EXEC_TITLES = /\b(chief|officer|c-?suite|cxo|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio)\b/i;
const EXEC_RANKS = /\b(president|vice[- ]president|vp|head of|head,|director|board)\b/i;
const isExec = (name: string): boolean => EXEC_TITLES.test(name) || EXEC_RANKS.test(name);
const TOP_CONTRIB = 5;

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const take =
      typeof req.query.take === 'string'
        ? Math.max(1, Math.min(30000, Number(req.query.take) || DEFAULT_TAKE))
        : DEFAULT_TAKE;
    const cursorId =
      typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    const pageArgs: { take: number; skip?: number; cursor?: { id: string } } = cursorId
      ? { take, skip: 1, cursor: { id: cursorId } }
      : { take };

    const [deliverables, taskNodes, vsNodes] = await Promise.all([
      prisma.deliverable.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
        ...pageArgs,
        select: {
          id: true,
          title: true,
          description: true,
          automatability: true,
          roleDeliverables: { select: { role_: true, role: { select: { displayValue: true } } } },
          nodeDeliverables: {
            select: { processNodeId: true, processNode: { select: { isTask: true } } },
          },
          testingTemplates: { select: { expected: true } },
        },
      }),
      // tasks = L5 task ProcessNodes.
      prisma.processNode.findMany({
        where: { companyId, isTask: true },
        orderBy: { id: 'asc' },
        ...pageArgs,
        select: {
          id: true,
          displayValue: true,
          description: true,
          automatability: true,
          nodeRoles: {
            select: { role_: true, role: { select: { id: true, displayValue: true } } },
          },
          nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
          testingTemplates: { select: { expected: true } },
        },
      }),
      // value-stream options for the filter dropdown.
      (async () => {
        const types = await prisma.processLevelType.findMany({
          where: { companyId },
          select: { id: true, levelNumber: true },
        });
        const l2 = types.find((t) => t.levelNumber === 2)?.id;
        return l2
          ? prisma.processNode.findMany({
              where: { companyId, processLevelTypeId: l2 },
              orderBy: { displayValue: 'asc' },
              select: { id: true, displayValue: true },
            })
          : [];
      })(),
    ]);

    // Resolve location strings for every deliverable-producing node + every task.
    const delivNodeIds = deliverables.flatMap((d) =>
      d.nodeDeliverables.map((n) => n.processNodeId),
    );
    const taskIds = taskNodes.map((t) => t.id);

    // Everything below depends only on the first batch, so run the location
    // resolution, the task-level standards/regulations, and the Work Library
    // testing-pattern lookups as ONE parallel round (they were 3 serial rounds).
    //
    // Standards + regulations are the task's OWN NodeStandard / NodeRegulation
    // rows (tasks are the single source of truth; higher levels roll up from
    // them). A task carrying neither reads "N/A" in the UI. testLinks: null =
    // no TEST template assigned yet.
    const STD_CAP = 8;
    const [loc, nodeStds, nodeRegs, testLinks] = await Promise.all([
      ancestorNames([...new Set([...delivNodeIds, ...taskIds])]),
      taskIds.length
        ? prisma.nodeStandard.findMany({
            where: { processNodeId: { in: taskIds }, excluded: false },
            select: { processNodeId: true, standard: { select: { name: true } } },
          })
        : [],
      taskIds.length
        ? prisma.nodeRegulation.findMany({
            where: { processNodeId: { in: taskIds }, excluded: false },
            select: { processNodeId: true, regulation: { select: { title: true } } },
          })
        : [],
      taskIds.length
        ? prisma.nodeWorkTemplate.findMany({
            where: { processNodeId: { in: taskIds }, template: { kind: 'TEST' } },
            select: { processNodeId: true, template: { select: { name: true } } },
          })
        : [],
    ]);
    const stdByAnc = new Map<string, string[]>();
    for (const x of nodeStds) {
      const a = stdByAnc.get(x.processNodeId) ?? [];
      a.push(x.standard.name);
      stdByAnc.set(x.processNodeId, a);
    }
    const regByAnc = new Map<string, string[]>();
    for (const x of nodeRegs) {
      const a = regByAnc.get(x.processNodeId) ?? [];
      a.push(x.regulation.title);
      regByAnc.set(x.processNodeId, a);
    }
    const taskLinks = (id: string, m: Map<string, string[]>) =>
      [...new Set(m.get(id) ?? [])].sort().slice(0, STD_CAP);
    const testByTask = new Map(testLinks.map((l) => [l.processNodeId, l.template.name]));

    res.json({
      deliverables: deliverables.map((d) => {
        const owner =
          d.roleDeliverables.find((r) => r.role_ === 'Owner')?.role.displayValue ??
          d.roleDeliverables[0]?.role.displayValue ??
          null;
        const contributors = [
          ...new Set(
            d.roleDeliverables
              .filter((r) => r.role_ === 'Contributor')
              .map((r) => r.role.displayValue),
          ),
        ].sort();
        // Deliverable groups its L4's L5 task nodes; the L4 node self-links too.
        const taskNodeIds = d.nodeDeliverables
          .filter((n) => n.processNode?.isTask)
          .map((n) => n.processNodeId);
        // value stream + processes from the first producing node (L4 or a task — both resolve the same VS).
        const firstNode = d.nodeDeliverables[0]?.processNodeId;
        const a = firstNode ? loc.get(firstNode) : undefined;
        const processes = a ? [a.l4 ?? a.l3].filter((x): x is string => !!x) : [];
        return {
          id: d.id,
          title: d.title,
          description: d.description,
          owner,
          contributors,
          type: 'Deliverable',
          status: 'OPEN',
          dueDate: null,
          taskCount: taskNodeIds.length,
          valueStreamId: a?.valueStreamId ?? null,
          valueStreamName: a?.valueStreamName ?? null,
          roles: [...new Set(d.roleDeliverables.map((r) => r.role.displayValue))].sort(),
          processes,
          level3: a?.l3 ?? null,
          level4: a?.l4 ?? null,
          test: d.testingTemplates[0]?.expected ?? null,
        };
      }),
      tasks: taskNodes.map((t) => {
        const a = loc.get(t.id);
        const owner =
          t.nodeRoles.find((r) => r.role_ === 'Owner')?.role ?? t.nodeRoles[0]?.role ?? null;
        const contributors = [
          ...new Set(
            t.nodeRoles
              .filter(
                (r) =>
                  r.role_ === 'Participant' &&
                  r.role.displayValue !== owner?.displayValue &&
                  !isExec(r.role.displayValue),
              )
              .map((r) => r.role.displayValue),
          ),
        ].slice(0, TOP_CONTRIB);
        const deliv = t.nodeDeliverables[0]?.deliverable ?? null;
        return {
          id: t.id,
          title: t.displayValue,
          description: t.description,
          owner: owner?.displayValue ?? null,
          contributors,
          status: 'OPEN',
          dueDate: null,
          source: 'step',
          deliverableId: deliv?.id ?? null,
          deliverableTitle: deliv?.title ?? null,
          roles: owner ? [owner.displayValue] : [],
          processes: a ? [a.l4 ?? a.l3].filter((x): x is string => !!x) : [],
          level3: a?.l3 ?? null,
          level4: a?.l4 ?? null,
          division: a?.division ?? null,
          department: a?.department ?? null,
          roleName: owner?.displayValue ?? null,
          valueStreamName: a?.valueStreamName ?? null,
          agentScore: t.automatability ? (SCORE_OF[t.automatability] ?? null) : null,
          agentRationale: null,
          test: t.testingTemplates[0]?.expected ?? null,
          testPattern: testByTask.get(t.id) ?? null,
          standards: taskLinks(t.id, stdByAnc),
          regulations: taskLinks(t.id, regByAnc),
        };
      }),
      valueStreams: vsNodes.map((v) => ({ id: v.id, name: v.displayValue })),
    });
  } catch (e) {
    next(e);
  }
});

// ── Checklist grain: one row per checklist item ───────────────────────────────
router.get('/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const items = await prisma.checklistItem.findMany({
      where: { checklist: { companyId } },
      orderBy: { id: 'asc' },
      take: DEFAULT_TAKE,
      select: {
        id: true,
        text: true,
        roleId: true,
        role: { select: { displayValue: true } },
        checklist: { select: { name: true } },
      },
    });
    res.json({
      items: items.map((ci) => ({
        id: ci.id,
        text: ci.text,
        roleId: ci.roleId,
        roleName: ci.role?.displayValue ?? null,
        category: ci.checklist?.name ?? null,
        taskId: null,
        taskTitle: ci.text,
        valueStreamName: null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ── Drill-down: a single deliverable ─────────────────────────────────────────
router.get('/deliverable/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const d = await prisma.deliverable.findFirst({
      where: { id: req.params.id, companyId },
      select: {
        id: true,
        title: true,
        description: true,
        automatability: true,
        roleDeliverables: {
          select: { role_: true, role: { select: { id: true, displayValue: true } } },
        },
        nodeDeliverables: {
          select: { processNodeId: true, processNode: { select: { isTask: true } } },
        },
      },
    });
    if (!d) return res.status(404).json({ error: 'Not found' });

    const nodeIds = d.nodeDeliverables.map((n) => n.processNodeId);
    // The L4's grouped L5 tasks (exclude the L4 self-link).
    const taskNodeIds = d.nodeDeliverables
      .filter((n) => n.processNode?.isTask)
      .map((n) => n.processNodeId);
    // One parallel round: locations, task roles, task apps, and the standards /
    // regulations attached to the tasks (tasks are the single source of truth
    // for governance links — see the list endpoint above).
    const [loc, nodeRoles, appsByNode, nodeStds, nodeRegs] = await Promise.all([
      ancestorNames(nodeIds),
      rolesForNodes(taskNodeIds),
      appsForNodes(taskNodeIds),
      taskNodeIds.length
        ? prisma.nodeStandard.findMany({
            where: { processNodeId: { in: taskNodeIds }, excluded: false },
            select: { standard: { select: { id: true, name: true } } },
          })
        : [],
      taskNodeIds.length
        ? prisma.nodeRegulation.findMany({
            where: { processNodeId: { in: taskNodeIds }, excluded: false },
            select: { regulation: { select: { id: true, title: true } } },
          })
        : [],
    ]);
    const first = nodeIds[0];
    const a = first ? loc.get(first) : undefined;
    const ownerRoles = d.roleDeliverables
      .filter((r) => r.role_ === 'Owner')
      .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    const contributorRoles = d.roleDeliverables
      .filter((r) => r.role_ === 'Contributor')
      .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    // Deliverable roll-up = defined/total plan keys across its tasks (Work Library).
    const plans = await taskPlans(taskNodeIds);
    let planDefined = 0;
    let planTotal = 0;
    for (const p of plans.values()) {
      planDefined += p.defined;
      planTotal += p.total;
    }
    const subProcesses = [
      ...new Set(
        [...loc.values()].map((x) => [x.l3, x.l4].filter(Boolean).join(' · ')).filter(Boolean),
      ),
    ];

    // The L4's grouped L5 task nodes are the deliverable's tasks — each with
    // its own automatability score and Work Library plan coverage (no invented
    // fields; everything here is a DB row or derived from one).
    const tasks = taskNodeIds.length
      ? (
          await prisma.processNode.findMany({
            where: { id: { in: taskNodeIds } },
            orderBy: { displayValue: 'asc' },
            select: { id: true, displayValue: true, automatability: true },
          })
        ).map((n) => {
          const plan = plans.get(n.id);
          return {
            id: n.id,
            title: n.displayValue,
            owner: nodeRoles.get(n.id)?.find((r) => r.role_ === 'Owner')?.name ?? null,
            agentScore: n.automatability ? (SCORE_OF[n.automatability] ?? null) : null,
            plan: plan ? { defined: plan.defined, total: plan.total } : null,
          };
        })
      : [];

    // Distinct applications / standards / regulations across the tasks.
    const appMap = new Map<string, { id: string; name: string }>();
    for (const list of appsByNode.values())
      for (const app of list) appMap.set(app.id, { id: app.id, name: app.name });
    const dedupe = <T extends { id: string; name: string }>(rows: T[]) =>
      [...new Map(rows.map((r) => [r.id, r])).values()].sort((x, y) =>
        x.name.localeCompare(y.name),
      );

    res.json({
      kind: 'deliverable',
      id: d.id,
      title: d.title,
      description: d.description,
      type: 'Deliverable',
      owner: ownerRoles[0]?.name ?? null,
      valueStream: a?.valueStreamId
        ? { id: a.valueStreamId, name: a.valueStreamName, domain: a.domain }
        : null,
      level3: a?.l3 ?? null,
      level4: a?.l4 ?? null,
      division: a?.division ?? null,
      department: a?.department ?? null,
      subProcesses,
      ownerRoles,
      contributorRoles,
      planRollup: { defined: planDefined, total: planTotal },
      tasks,
      applications: dedupe([...appMap.values()]),
      standards: dedupe(nodeStds.map((s) => s.standard)),
      regulations: dedupe(nodeRegs.map((r) => ({ id: r.regulation.id, name: r.regulation.title }))),
    });
  } catch (e) {
    next(e);
  }
});

// ── Drill-down: a single task ────────────────────────────────────────────────
router.get('/task/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const t = await prisma.processNode.findFirst({
      where: { id: req.params.id, companyId, isTask: true },
      select: {
        id: true,
        displayValue: true,
        description: true,
        automatability: true,
        attributes: true,
        nodeRoles: { select: { role_: true, role: { select: { id: true, displayValue: true } } } },
        nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
      },
    });
    if (!t) return res.status(404).json({ error: 'Not found' });

    const loc = (await ancestorNames([t.id])).get(t.id);
    const plan = (await taskPlans([t.id])).get(t.id) ?? null;
    const ownerRole = t.nodeRoles.find((r) => r.role_ === 'Owner')?.role ?? null;
    const leadRoles = t.nodeRoles
      .filter((r) => r.role_ === 'Owner')
      .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    // contributors = participant roles, exec-stripped + capped (mirrors the list view).
    const supportRoles = t.nodeRoles
      .filter(
        (r) =>
          r.role_ === 'Participant' && r.role.id !== ownerRole?.id && !isExec(r.role.displayValue),
      )
      .map((r) => ({ id: r.role.id, name: r.role.displayValue }))
      .slice(0, TOP_CONTRIB);
    // The task's own workbook deliverable TEXT (preserved on the node) — what the
    // old per-task Deliverable used to show. Falls back to the L4 grouping title.
    const attrDeliv = (t.attributes as { deliverable?: string } | null)?.deliverable ?? null;
    const groupDeliv = t.nodeDeliverables[0]?.deliverable ?? null;

    res.json({
      kind: 'task',
      id: t.id,
      title: t.displayValue,
      description: t.description,
      owner: ownerRole?.displayValue ?? null,
      jiraKey: null,
      plan: plan
        ? {
            checklist: plan.checklist,
            testing: plan.testing,
            defined: plan.defined,
            total: plan.total,
          }
        : null,
      ownerRole: ownerRole ? { id: ownerRole.id, name: ownerRole.displayValue } : null,
      agentScore: t.automatability ? (SCORE_OF[t.automatability] ?? null) : null,
      agentRationale: null,
      valueStream: loc?.valueStreamId ? { id: loc.valueStreamId, name: loc.valueStreamName } : null,
      level3: loc?.l3 ?? null,
      level4: loc?.l4 ?? null,
      subProcess: loc ? [loc.l3, loc.l4].filter(Boolean).join(' · ') || null : null,
      leadRoles,
      leadExtra: [],
      supportRoles,
      supportExtra: [],
      outputs: [],
      // `deliverable` = the task's own output text (title preserved for the UI);
      // `deliverableGroup` = the L4 sub-process Deliverable row it belongs to.
      deliverable: attrDeliv
        ? { id: groupDeliv?.id ?? null, title: attrDeliv }
        : groupDeliv
          ? { id: groupDeliv.id, title: groupDeliv.title }
          : null,
      deliverableGroup: groupDeliv ? { id: groupDeliv.id, title: groupDeliv.title } : null,
      downstream: [],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
