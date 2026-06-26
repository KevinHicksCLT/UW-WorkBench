import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheResponses } from '../lib/responseCache.js';
import { ancestorNames, rolesForNodes } from '../lib/resolvers/index.js';

// Deliverables & Tasks API — the standalone work tracker behind the
// "Deliverables & Tasks" tab. erd_v5: deliverables = Deliverable rows (owner +
// value stream + processes via RoleDeliverable / NodeDeliverable → closure);
// tasks = L5 task ProcessNodes (owner via NodeRole, location via the closure).
// Keyset pagination is supported (`?take`/`?cursor` on id); the default `take`
// is high so the existing one-shot table renders unchanged until rewired.

const router = Router();
router.use(requireAuth);
router.use(cacheResponses(15_000));

const DEFAULT_TAKE = 5000;
// ProcessNode.automatability → an illustrative 1-5 agent-automatability score
// (same 1=manual … 5=fully-automatable scale the old Task.agentScore used).
const SCORE_OF: Record<string, number> = { manual: 2, augmented: 3, automated: 5 };

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) { res.status(404).json({ error: 'No company found' }); return null; }
  return company.id;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const take = typeof req.query.take === 'string' ? Math.max(1, Math.min(10000, Number(req.query.take) || DEFAULT_TAKE)) : DEFAULT_TAKE;
    const cursorId = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    const pageArgs: { take: number; skip?: number; cursor?: { id: string } } =
      cursorId ? { take, skip: 1, cursor: { id: cursorId } } : { take };

    const [deliverables, taskNodes, vsNodes] = await Promise.all([
      prisma.deliverable.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
        ...pageArgs,
        select: {
          id: true, title: true, automatability: true,
          roleDeliverables: { select: { role_: true, role: { select: { displayValue: true } } } },
          nodeDeliverables: { select: { processNodeId: true, processNode: { select: { isTask: true } } } },
        },
      }),
      // tasks = L5 task ProcessNodes.
      prisma.processNode.findMany({
        where: { companyId, isTask: true },
        orderBy: { id: 'asc' },
        ...pageArgs,
        select: {
          id: true, displayValue: true, automatability: true,
          nodeRoles: { where: { role_: 'Owner' }, select: { role: { select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } } } } },
          nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
        },
      }),
      // value-stream options for the filter dropdown.
      (async () => {
        const types = await prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } });
        const l2 = types.find((t) => t.levelNumber === 2)?.id;
        return l2 ? prisma.processNode.findMany({ where: { companyId, processLevelTypeId: l2 }, orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true } }) : [];
      })(),
    ]);

    // Resolve location strings for every deliverable-producing node + every task.
    const delivNodeIds = deliverables.flatMap((d) => d.nodeDeliverables.map((n) => n.processNodeId));
    const taskIds = taskNodes.map((t) => t.id);
    const loc = await ancestorNames([...new Set([...delivNodeIds, ...taskIds])]);

    res.json({
      deliverables: deliverables.map((d) => {
        const owner = d.roleDeliverables.find((r) => r.role_ === 'Owner')?.role.displayValue
          ?? d.roleDeliverables[0]?.role.displayValue ?? null;
        // Deliverable groups its L4's L5 task nodes; the L4 node self-links too.
        const taskNodeIds = d.nodeDeliverables.filter((n) => n.processNode?.isTask).map((n) => n.processNodeId);
        // value stream + processes from the first producing node (L4 or a task — both resolve the same VS).
        const firstNode = d.nodeDeliverables[0]?.processNodeId;
        const a = firstNode ? loc.get(firstNode) : undefined;
        const processes = a ? [a.l4 ?? a.l3].filter((x): x is string => !!x) : [];
        return {
          id: d.id, title: d.title, description: null, owner, type: 'Deliverable',
          status: 'OPEN', dueDate: null, taskCount: taskNodeIds.length,
          valueStreamId: a?.valueStreamId ?? null, valueStreamName: a?.valueStreamName ?? null,
          roles: [...new Set(d.roleDeliverables.map((r) => r.role.displayValue))].sort(),
          processes,
        };
      }),
      tasks: taskNodes.map((t) => {
        const a = loc.get(t.id);
        const owner = t.nodeRoles[0]?.role ?? null;
        const deliv = t.nodeDeliverables[0]?.deliverable ?? null;
        return {
          id: t.id, title: t.displayValue, owner: owner?.displayValue ?? null,
          status: 'OPEN', priority: 'Medium', dueDate: null, source: 'step',
          deliverableId: deliv?.id ?? null, deliverableTitle: deliv?.title ?? null,
          roles: owner ? [owner.displayValue] : [],
          processes: a ? [a.l4 ?? a.l3].filter((x): x is string => !!x) : [],
          division: owner?.orgUnit?.displayValue ?? null,
          department: null,
          roleName: owner?.displayValue ?? null,
          valueStreamName: a?.valueStreamName ?? null,
          agentScore: t.automatability ? SCORE_OF[t.automatability] ?? null : null,
          agentRationale: null,
        };
      }),
      valueStreams: vsNodes.map((v) => ({ id: v.id, name: v.displayValue })),
    });
  } catch (e) { next(e); }
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
        id: true, text: true, roleId: true,
        role: { select: { displayValue: true } },
        checklist: { select: { name: true } },
      },
    });
    res.json({
      items: items.map((ci) => ({
        id: ci.id, text: ci.text,
        roleId: ci.roleId, roleName: ci.role?.displayValue ?? null,
        category: ci.checklist?.name ?? null,
        taskId: null, taskTitle: ci.text,
        valueStreamName: null,
      })),
    });
  } catch (e) { next(e); }
});

// ── Drill-down: a single deliverable ─────────────────────────────────────────
router.get('/deliverable/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const d = await prisma.deliverable.findFirst({
      where: { id: req.params.id, companyId },
      select: {
        id: true, title: true,
        roleDeliverables: { select: { role_: true, role: { select: { id: true, displayValue: true } } } },
        nodeDeliverables: { select: { processNodeId: true, processNode: { select: { isTask: true } } } },
      },
    });
    if (!d) return res.status(404).json({ error: 'Not found' });

    const nodeIds = d.nodeDeliverables.map((n) => n.processNodeId);
    // The L4's grouped L5 tasks (exclude the L4 self-link).
    const taskNodeIds = d.nodeDeliverables.filter((n) => n.processNode?.isTask).map((n) => n.processNodeId);
    const [loc, nodeRoles] = await Promise.all([ancestorNames(nodeIds), rolesForNodes(taskNodeIds)]);
    const first = nodeIds[0];
    const a = first ? loc.get(first) : undefined;
    const assignedRoles = d.roleDeliverables.map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    const subProcesses = [...new Set([...loc.values()].map((x) => [x.l3, x.l4].filter(Boolean).join(' · ')).filter(Boolean))];

    // The L4's grouped L5 task nodes are the deliverable's tasks.
    const tasks = taskNodeIds.length
      ? (await prisma.processNode.findMany({ where: { id: { in: taskNodeIds } }, select: { id: true, displayValue: true } }))
        .map((n) => ({ id: n.id, title: n.displayValue, owner: nodeRoles.get(n.id)?.find((r) => r.role_ === 'Owner')?.name ?? null, priority: 'Medium' }))
      : [];

    res.json({
      kind: 'deliverable',
      id: d.id, title: d.title, description: null, type: 'Deliverable', owner: assignedRoles[0]?.name ?? null, jiraKey: null,
      valueStream: a?.valueStreamId ? { id: a.valueStreamId, name: a.valueStreamName, domain: a.domain } : null,
      subProcesses, dataElements: [], inputs: [],
      assignedRoles, assignedExtra: [],
      tasks,
      downstream: [],
    });
  } catch (e) { next(e); }
});

// ── Drill-down: a single task ────────────────────────────────────────────────
router.get('/task/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const t = await prisma.processNode.findFirst({
      where: { id: req.params.id, companyId, isTask: true },
      select: {
        id: true, displayValue: true, automatability: true, attributes: true,
        nodeRoles: { select: { role_: true, role: { select: { id: true, displayValue: true } } } },
        nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
      },
    });
    if (!t) return res.status(404).json({ error: 'Not found' });

    const loc = (await ancestorNames([t.id])).get(t.id);
    const ownerRole = t.nodeRoles.find((r) => r.role_ === 'Owner')?.role ?? null;
    const leadRoles = t.nodeRoles.filter((r) => r.role_ === 'Owner').map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    const supportRoles = t.nodeRoles.filter((r) => r.role_ === 'Participant').map((r) => ({ id: r.role.id, name: r.role.displayValue }));
    // The task's own workbook deliverable TEXT (preserved on the node) — what the
    // old per-task Deliverable used to show. Falls back to the L4 grouping title.
    const attrDeliv = (t.attributes as { deliverable?: string } | null)?.deliverable ?? null;
    const groupDeliv = t.nodeDeliverables[0]?.deliverable ?? null;

    res.json({
      kind: 'task',
      id: t.id, title: t.displayValue, owner: ownerRole?.displayValue ?? null, priority: 'Medium', jiraKey: null,
      ownerRole: ownerRole ? { id: ownerRole.id, name: ownerRole.displayValue } : null,
      agentScore: t.automatability ? SCORE_OF[t.automatability] ?? null : null, agentRationale: null,
      valueStream: loc?.valueStreamId ? { id: loc.valueStreamId, name: loc.valueStreamName } : null,
      subProcess: loc ? [loc.l3, loc.l4].filter(Boolean).join(' · ') || null : null,
      leadRoles, leadExtra: [],
      supportRoles, supportExtra: [],
      outputs: [],
      // `deliverable` = the task's own output text (title preserved for the UI);
      // `deliverableGroup` = the L4 sub-process Deliverable row it belongs to.
      deliverable: attrDeliv
        ? { id: groupDeliv?.id ?? null, title: attrDeliv }
        : (groupDeliv ? { id: groupDeliv.id, title: groupDeliv.title } : null),
      deliverableGroup: groupDeliv ? { id: groupDeliv.id, title: groupDeliv.title } : null,
      downstream: [],
    });
  } catch (e) { next(e); }
});

export default router;
