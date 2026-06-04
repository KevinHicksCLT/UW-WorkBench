import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { buildRoleResolver, resolveRoleCell } from '../lib/roleMatch.js';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const splitItems = (s: string | null) => (s ? s.split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean) : []);

// Deliverables & Tasks API — the standalone work tracker behind the
// "Deliverables & Tasks" tab. Read-only list endpoint: it returns every
// deliverable and task for the active company (value-stream links resolved to
// names), plus the value-stream options used by the filter dropdowns. Scoped to
// tenant (from the JWT) + the active company (from ?companyId, falling back to
// the tenant's first company).

const router = Router();
router.use(requireAuth);

// Resolve the active company: the requested one (validated against the tenant)
// or the tenant's first company. Sends 404 and returns null when none exist.
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
    const tenantId = req.tenantId;

    const [deliverables, tasks, valueStreams] = await Promise.all([
      prisma.deliverable.findMany({
        where: { tenantId, companyId },
        include: { _count: { select: { tasks: true } } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.task.findMany({
        where: { tenantId, companyId },
        include: { deliverable: { select: { id: true, title: true } } },
        orderBy: [{ source: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    // Resolve deliverable value-stream links to display names in one pass.
    const vsName = new Map(valueStreams.map((v) => [v.id, v.name] as const));

    res.json({
      deliverables: deliverables.map((d) => ({
        id: d.id, title: d.title, description: d.description, owner: d.owner, type: d.type,
        status: d.status, dueDate: d.dueDate, taskCount: d._count.tasks,
        valueStreamId: d.valueStreamId, valueStreamName: d.valueStreamId ? vsName.get(d.valueStreamId) ?? null : null,
      })),
      tasks: tasks.map((t) => ({
        id: t.id, title: t.title, owner: t.owner, status: t.status, priority: t.priority, dueDate: t.dueDate,
        source: t.source, deliverableId: t.deliverableId, deliverableTitle: t.deliverable?.title ?? null,
      })),
      valueStreams,
    });
  } catch (e) { next(e); }
});

// ── Drill-down: a single deliverable ─────────────────────────────────────────
// Re-joins the deliverable back to its source I/O-inventory row(s) to surface the
// roles it's assigned to, its value stream + sub-process, and — crucially — where
// it flows DOWNSTREAM (every place the same work product is consumed as an input).
router.get('/deliverable/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const tenantId = req.tenantId;

    const d = await prisma.deliverable.findFirst({
      where: { id: req.params.id, tenantId, companyId },
      include: {
        tasks: { select: { id: true, title: true, owner: true, priority: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) return res.status(404).json({ error: 'Not found' });

    const [ioItems, roles, vsList] = await Promise.all([
      prisma.ioItem.findMany({
        where: { valueStream: { companyId } },
        select: { type: true, name: true, l3: true, l4: true, keyRoles: true, dataElements: true, valueStreamId: true, valueStream: { select: { id: true, name: true } } },
      }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } }),
      prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true, domain: true } }),
    ]);
    const resolve = buildRoleResolver(roles);
    const vsMap = new Map(vsList.map((v) => [v.id, v] as const));
    const titleN = norm(d.title);

    // Source rows: the same-named deliverable produced in this value stream.
    const source = ioItems.filter((io) => /output|deliver/i.test(io.type) && io.valueStreamId === d.valueStreamId && norm(io.name) === titleN);
    const sourceKeys = new Set(source.map((io) => `${io.valueStreamId}␟${io.l4 ?? ''}`));

    // Assigned roles + sub-processes + data elements from the source rows.
    const assigned = mergeRoles(source.map((io) => io.keyRoles), resolve);
    const subProcesses = [...new Set(source.map((io) => [io.l3, io.l4].filter(Boolean).join(' · ')).filter(Boolean))];
    const dataElements = [...new Set(source.flatMap((io) => splitItems(io.dataElements)))];

    // Downstream: every place this work product is consumed as an INPUT elsewhere.
    const downstream = ioItems
      .filter((io) => /input/i.test(io.type) && norm(io.name) === titleN && !sourceKeys.has(`${io.valueStreamId}␟${io.l4 ?? ''}`))
      .map((io) => ({
        valueStreamId: io.valueStream.id, valueStreamName: io.valueStream.name,
        subProcess: [io.l3, io.l4].filter(Boolean).join(' · ') || null,
        roles: mergeRoles([io.keyRoles], resolve),
      }));

    const vs = d.valueStreamId ? vsMap.get(d.valueStreamId) ?? null : null;
    res.json({
      kind: 'deliverable',
      id: d.id, title: d.title, description: d.description, type: d.type, owner: d.owner,
      valueStream: vs ? { id: vs.id, name: vs.name, domain: vs.domain } : null,
      subProcesses, dataElements,
      assignedRoles: assigned.roles, assignedExtra: assigned.unresolved,
      tasks: d.tasks,
      downstream,
    });
  } catch (e) { next(e); }
});

// ── Drill-down: a single task ────────────────────────────────────────────────
// Re-joins the task back to its source L5 process step to surface lead/supporting
// roles, its value stream + sub-process, the deliverable it feeds, and what its
// output flows into downstream.
router.get('/task/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const tenantId = req.tenantId;

    const t = await prisma.task.findFirst({
      where: { id: req.params.id, tenantId, companyId },
      include: { deliverable: { select: { id: true, title: true, valueStreamId: true } } },
    });
    if (!t) return res.status(404).json({ error: 'Not found' });

    const [steps, ioItems, roles, vsList] = await Promise.all([
      prisma.processStep.findMany({
        where: { valueStream: { companyId } },
        select: { name: true, l3: true, l4: true, leads: true, supporting: true, inputs: true, outputs: true, valueStreamId: true, valueStream: { select: { id: true, name: true } } },
      }),
      prisma.ioItem.findMany({
        where: { valueStream: { companyId }, type: { contains: 'Input' } },
        select: { name: true, l3: true, l4: true, keyRoles: true, valueStreamId: true, valueStream: { select: { id: true, name: true } } },
      }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } }),
      prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);
    const resolve = buildRoleResolver(roles);
    const vsMap = new Map(vsList.map((v) => [v.id, v] as const));
    const nameN = norm(t.title);

    // Source step: name match, preferring the task's deliverable value stream.
    const sameName = steps.filter((s) => norm(s.name) === nameN);
    const step = sameName.find((s) => t.deliverable && s.valueStreamId === t.deliverable.valueStreamId) ?? sameName[0] ?? null;

    const leadRoles = mergeRoles([step?.leads ?? null], resolve);
    const supportRoles = mergeRoles([step?.supporting ?? null], resolve);
    const outputs = splitItems(step?.outputs ?? null);
    const outputsN = new Set(outputs.map(norm));

    // Downstream: where this step's outputs are consumed as inputs elsewhere.
    const downstream = ioItems
      .filter((io) => outputsN.has(norm(io.name)) && io.valueStreamId !== step?.valueStreamId)
      .map((io) => ({
        valueStreamId: io.valueStream.id, valueStreamName: io.valueStream.name,
        subProcess: [io.l3, io.l4].filter(Boolean).join(' · ') || null,
        item: io.name,
        roles: mergeRoles([io.keyRoles], resolve),
      }));

    const dvs = t.deliverable?.valueStreamId ? vsMap.get(t.deliverable.valueStreamId) ?? null : null;
    const vs = step ? { id: step.valueStream.id, name: step.valueStream.name } : (dvs ? { id: dvs.id, name: dvs.name } : null);
    res.json({
      kind: 'task',
      id: t.id, title: t.title, owner: t.owner, priority: t.priority,
      valueStream: vs,
      subProcess: step ? [step.l3, step.l4].filter(Boolean).join(' · ') || null : null,
      leadRoles: leadRoles.roles, leadExtra: leadRoles.unresolved,
      supportRoles: supportRoles.roles, supportExtra: supportRoles.unresolved,
      outputs,
      deliverable: t.deliverable ? { id: t.deliverable.id, title: t.deliverable.title } : null,
      downstream,
    });
  } catch (e) { next(e); }
});

// Merge several role-reference cells into one de-duplicated resolved/unresolved set.
function mergeRoles(cells: (string | null)[], resolve: (t: string) => { id: string; name: string } | null) {
  const roles: { id: string; name: string }[] = [];
  const unresolved: string[] = [];
  const seenIds = new Set<string>(), seenRaw = new Set<string>();
  for (const cell of cells) {
    const r = resolveRoleCell(cell, resolve);
    for (const m of r.roles) if (!seenIds.has(m.id)) { seenIds.add(m.id); roles.push(m); }
    for (const u of r.unresolved) { const k = u.toLowerCase(); if (!seenRaw.has(k)) { seenRaw.add(k); unresolved.push(u); } }
  }
  return { roles, unresolved };
}

export default router;
