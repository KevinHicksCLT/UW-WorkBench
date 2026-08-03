import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { ancestorNames, companyTaskAncestorNames } from '../../lib/resolvers/index.js';
import {
  DEFAULT_TAKE,
  SCORE_OF,
  TOP_CONTRIB,
  activeCompanyId,
  isExec,
  type PageArgs,
} from './helpers.js';

// List grain of /work — the Deliverables and Tasks tabs. erd_v5: deliverables =
// Deliverable rows (owner + value stream + processes via RoleDeliverable /
// NodeDeliverable → closure); tasks = L5 task ProcessNodes (owner via NodeRole,
// location via the closure). Keyset pagination is supported (`?take`/`?cursor`
// on id); `?kind=deliverables|tasks` loads one grain only (each tab fetches
// just its own rows); no `kind` keeps the legacy both-grains response.

// Standards / regulations column cap per task row.
const STD_CAP = 8;

// One row per Deliverable. Base rows + both junctions load as one parallel
// round of flat company-scoped queries (no nested includes, which load
// relations serially); ancestry then resolves only each deliverable's FIRST
// producing node — the single node the row mapping reads — instead of every
// linked node (~10x fewer ids for the resolver).
async function loadDeliverables(companyId: string, pageArgs: PageArgs) {
  const [rows, roleLinks, nodeLinks] = await Promise.all([
    prisma.deliverable.findMany({
      where: { companyId },
      orderBy: { id: 'asc' },
      ...pageArgs,
      select: { id: true, title: true, description: true },
    }),
    prisma.roleDeliverable.findMany({
      where: { deliverable: { companyId } },
      select: { deliverableId: true, role_: true, role: { select: { displayValue: true } } },
    }),
    prisma.nodeDeliverable.findMany({
      where: { deliverable: { companyId } },
      orderBy: { id: 'asc' },
      select: {
        deliverableId: true,
        processNodeId: true,
        processNode: { select: { isTask: true } },
      },
    }),
  ]);

  type DRoleLink = (typeof roleLinks)[number];
  const rolesByDeliv = new Map<string, DRoleLink[]>();
  for (const l of roleLinks) {
    const a = rolesByDeliv.get(l.deliverableId) ?? [];
    a.push(l);
    rolesByDeliv.set(l.deliverableId, a);
  }
  type DNodeLink = (typeof nodeLinks)[number];
  const nodesByDeliv = new Map<string, DNodeLink[]>();
  for (const l of nodeLinks) {
    const a = nodesByDeliv.get(l.deliverableId) ?? [];
    a.push(l);
    nodesByDeliv.set(l.deliverableId, a);
  }

  const firstNodeIds = rows
    .map((d) => nodesByDeliv.get(d.id)?.[0]?.processNodeId)
    .filter((x): x is string => !!x);
  const loc = await ancestorNames(firstNodeIds);

  return rows.map((d) => {
    const dRoles = rolesByDeliv.get(d.id) ?? [];
    const dNodes = nodesByDeliv.get(d.id) ?? [];
    const owner =
      dRoles.find((r) => r.role_ === 'Owner')?.role.displayValue ??
      dRoles[0]?.role.displayValue ??
      null;
    const contributors = [
      ...new Set(dRoles.filter((r) => r.role_ === 'Contributor').map((r) => r.role.displayValue)),
    ].sort();
    // Deliverable groups its L4's L5 task nodes; the L4 node self-links too.
    const taskCount = dNodes.filter((n) => n.processNode?.isTask).length;
    // value stream + processes from the first producing node (L4 or a task — both resolve the same VS).
    const firstNode = dNodes[0]?.processNodeId;
    const a = firstNode ? loc.get(firstNode) : undefined;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      owner,
      contributors,
      type: 'Deliverable',
      status: 'OPEN',
      dueDate: null,
      taskCount,
      valueStreamId: a?.valueStreamId ?? null,
      valueStreamName: a?.valueStreamName ?? null,
      roles: [...new Set(dRoles.map((r) => r.role.displayValue))].sort(),
      processes: a ? [a.l4 ?? a.l3].filter((x): x is string => !!x) : [],
      level3: a?.l3 ?? null,
      level4: a?.l4 ?? null,
    };
  });
}

// One row per L5 task ProcessNode. Everything runs as ONE parallel round of
// flat company-scoped queries — no nested Prisma includes (which load
// relations serially) and no multi-thousand-id `IN` lists. The junction
// queries are company-scoped rather than page-scoped: when `?cursor`/`?take`
// page below the full set they fetch junction rows for off-page tasks too, but
// assembly iterates only the page's base rows, and the default take covers the
// whole company anyway.
async function loadTasks(companyId: string, pageArgs: PageArgs) {
  const taskWhere = { companyId, isTask: true };
  const [baseTasks, roleLinks, delivLinks, nodeStds, nodeRegs, testLinks, loc] = await Promise.all([
    prisma.processNode.findMany({
      where: taskWhere,
      orderBy: { id: 'asc' },
      ...pageArgs,
      select: { id: true, displayValue: true, automatability: true },
    }),
    prisma.nodeRole.findMany({
      where: { processNode: taskWhere },
      select: {
        processNodeId: true,
        role_: true,
        role: { select: { id: true, displayValue: true } },
      },
    }),
    prisma.nodeDeliverable.findMany({
      where: { processNode: taskWhere },
      select: { processNodeId: true, deliverable: { select: { id: true, title: true } } },
    }),
    // Standards + regulations are the task's OWN NodeStandard / NodeRegulation
    // rows (tasks are the single source of truth; higher levels roll up from
    // them). A task carrying neither reads "N/A" in the UI. Aggregated DB-side
    // (one row per task, names pre-sorted) — the flat junction fetch is ~30k
    // rows and 4x slower; Prisma cannot express the array_agg.
    prisma.$queryRaw<{ processNodeId: string; names: string[] }[]>`
      SELECT ns."processNodeId", array_agg(DISTINCT s.name ORDER BY s.name) AS names
      FROM public."NodeStandard" ns
      JOIN public."Standard" s ON s.id = ns."standardId"
      JOIN public."ProcessNode" pn ON pn.id = ns."processNodeId"
      WHERE pn."companyId" = ${companyId} AND pn."isTask" AND NOT ns.excluded
      GROUP BY 1`,
    prisma.$queryRaw<{ processNodeId: string; names: string[] }[]>`
      SELECT nr."processNodeId", array_agg(DISTINCT r.title ORDER BY r.title) AS names
      FROM public."NodeRegulation" nr
      JOIN public."RegulatoryRequirement" r ON r.id = nr."regId"
      JOIN public."ProcessNode" pn ON pn.id = nr."processNodeId"
      WHERE pn."companyId" = ${companyId} AND pn."isTask" AND NOT nr.excluded
      GROUP BY 1`,
    // Work Library testing pattern; a task without one reads "✗ Missing".
    prisma.nodeWorkTemplate.findMany({
      where: { template: { kind: 'TEST' }, processNode: taskWhere },
      select: { processNodeId: true, template: { select: { name: true } } },
    }),
    companyTaskAncestorNames(companyId),
  ]);

  type RoleLink = (typeof roleLinks)[number];
  const rolesByTask = new Map<string, RoleLink[]>();
  for (const l of roleLinks) {
    const a = rolesByTask.get(l.processNodeId) ?? [];
    a.push(l);
    rolesByTask.set(l.processNodeId, a);
  }
  const delivByTask = new Map<string, { id: string; title: string }>();
  for (const l of delivLinks) {
    if (!delivByTask.has(l.processNodeId)) delivByTask.set(l.processNodeId, l.deliverable);
  }
  // array_agg(DISTINCT x) returns each list deduped and sorted — just cap it.
  const stdsByTask = new Map(nodeStds.map((x) => [x.processNodeId, x.names.slice(0, STD_CAP)]));
  const regsByTask = new Map(nodeRegs.map((x) => [x.processNodeId, x.names.slice(0, STD_CAP)]));
  const testByTask = new Map(testLinks.map((l) => [l.processNodeId, l.template.name]));

  return baseTasks.map((t) => {
    const links = rolesByTask.get(t.id) ?? [];
    const a = loc.get(t.id);
    const owner = links.find((r) => r.role_ === 'Owner')?.role ?? links[0]?.role ?? null;
    const contributors = [
      ...new Set(
        links
          .filter(
            (r) =>
              r.role_ === 'Participant' &&
              r.role.displayValue !== owner?.displayValue &&
              !isExec(r.role.displayValue),
          )
          .map((r) => r.role.displayValue),
      ),
    ].slice(0, TOP_CONTRIB);
    const deliv = delivByTask.get(t.id) ?? null;
    return {
      id: t.id,
      title: t.displayValue,
      owner: owner?.displayValue ?? null,
      contributors,
      deliverableId: deliv?.id ?? null,
      deliverableTitle: deliv?.title ?? null,
      level4: a?.l4 ?? null,
      division: a?.division ?? null,
      valueStreamName: a?.valueStreamName ?? null,
      agentScore: t.automatability ? (SCORE_OF[t.automatability] ?? null) : null,
      agentRationale: null,
      testPattern: testByTask.get(t.id) ?? null,
      standards: stdsByTask.get(t.id) ?? [],
      regulations: regsByTask.get(t.id) ?? [],
    };
  });
}

export function registerListRoutes(router: Router): void {
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
      const pageArgs: PageArgs = cursorId ? { take, skip: 1, cursor: { id: cursorId } } : { take };
      const kind =
        req.query.kind === 'deliverables' || req.query.kind === 'tasks' ? req.query.kind : null;

      const [deliverables, tasks, vsNodes] = await Promise.all([
        kind !== 'tasks' ? loadDeliverables(companyId, pageArgs) : [],
        kind !== 'deliverables' ? loadTasks(companyId, pageArgs) : [],
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

      res.json({
        deliverables,
        tasks,
        valueStreams: vsNodes.map((v) => ({ id: v.id, name: v.displayValue })),
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Checklist grain: one row per checklist item ─────────────────────────────
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
}
