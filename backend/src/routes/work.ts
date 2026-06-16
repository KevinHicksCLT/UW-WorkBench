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

    const [deliverables, tasks, valueStreams, ioItems, steps, roles, divisions] = await Promise.all([
      prisma.deliverable.findMany({
        where: { tenantId, companyId },
        include: { _count: { select: { tasks: true } } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.task.findMany({
        where: { tenantId, companyId },
        include: { deliverable: { select: { id: true, title: true, valueStreamId: true } } },
        orderBy: [{ source: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.ioItem.findMany({
        where: { valueStream: { companyId } },
        select: { type: true, name: true, l3: true, l4: true, keyRoles: true, valueStreamId: true },
      }),
      prisma.processStep.findMany({
        where: { valueStream: { companyId } },
        select: { name: true, l3: true, l4: true, leads: true, supporting: true, valueStreamId: true },
      }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true, divisionId: true } }),
      prisma.division.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);

    // Resolve deliverable value-stream links to display names in one pass.
    const vsName = new Map(valueStreams.map((v) => [v.id, v.name] as const));
    // Owner → division (org group) for the task table column, reached from the
    // free-text owner via the same resolver used below.
    const roleById = new Map(roles.map((r) => [r.id, r] as const));
    const divisionName = new Map(divisions.map((d) => [d.id, d.name] as const));

    // Per-row Role / Process enrichment for the header filters — same joins the
    // drill-down endpoints use, computed once across all rows. Deliverables key
    // back to their source output/deliverable I/O rows (value stream + name);
    // tasks key back to their source L5 step (name, preferring the
    // deliverable's value stream).
    const resolve = buildRoleResolver(roles);
    const cellNames = (cell: string | null) => {
      const r = resolveRoleCell(cell, resolve);
      return [...r.roles.map((m) => m.name), ...r.unresolved];
    };
    const ioByKey = new Map<string, { roles: Set<string>; processes: Set<string> }>();
    for (const io of ioItems) {
      if (!/output|deliver/i.test(io.type)) continue;
      const k = `${io.valueStreamId}␟${norm(io.name)}`;
      let e = ioByKey.get(k);
      if (!e) { e = { roles: new Set(), processes: new Set() }; ioByKey.set(k, e); }
      for (const n of cellNames(io.keyRoles)) e.roles.add(n);
      const p = io.l4 ?? io.l3;
      if (p) e.processes.add(p);
    }
    const stepsByName = new Map<string, typeof steps>();
    for (const s of steps) {
      const k = norm(s.name);
      if (!stepsByName.has(k)) stepsByName.set(k, []);
      stepsByName.get(k)!.push(s);
    }

    res.json({
      deliverables: deliverables.map((d) => {
        const e = d.valueStreamId ? ioByKey.get(`${d.valueStreamId}␟${norm(d.title)}`) : undefined;
        return {
          id: d.id, title: d.title, description: d.description, owner: d.owner, type: d.type,
          status: d.status, dueDate: d.dueDate, taskCount: d._count.tasks,
          valueStreamId: d.valueStreamId, valueStreamName: d.valueStreamId ? vsName.get(d.valueStreamId) ?? null : null,
          roles: [...(e?.roles ?? [])].sort(),
          processes: [...(e?.processes ?? [])].sort(),
        };
      }),
      tasks: tasks.map((t) => {
        // Same-named L5 steps exist within one stream (e.g. the two Claims
        // "Negotiate Settlement" flows) — after narrowing by value stream,
        // disambiguate by matching the task owner to a step lead role.
        const sameName = stepsByName.get(norm(t.title)) ?? [];
        const inVs = t.deliverable?.valueStreamId ? sameName.filter((s) => s.valueStreamId === t.deliverable!.valueStreamId) : [];
        const pool = inVs.length ? inVs : sameName;
        const step = (pool.length > 1 && t.owner
          ? pool.find((s) => cellNames(s.leads).some((n) => norm(n) === norm(t.owner!)))
          : null) ?? pool[0] ?? null;
        // Role-sourced tasks have no L5 step — fall back to the process of the
        // deliverable they feed (its source output/deliverable I/O row).
        const dEntry = !step && t.deliverable?.valueStreamId
          ? ioByKey.get(`${t.deliverable.valueStreamId}␟${norm(t.deliverable.title)}`)
          : undefined;
        const p = step ? step.l4 ?? step.l3 : null;
        // Role-sourced tasks have no L5 step; their owner IS the role.
        const stepRoles = step ? [...new Set([...cellNames(step.leads), ...cellNames(step.supporting)])].sort() : [];
        // Owner → role attributes for the table columns (family, level, division).
        const ownerRole = t.owner ? resolve(t.owner) : null;
        const rec = ownerRole ? roleById.get(ownerRole.id) : null;
        return {
          id: t.id, title: t.title, owner: t.owner, status: t.status, priority: t.priority, dueDate: t.dueDate,
          source: t.source, deliverableId: t.deliverableId, deliverableTitle: t.deliverable?.title ?? null,
          roles: stepRoles.length ? stepRoles : (t.owner ? [t.owner] : []),
          processes: p ? [p] : [...(dEntry?.processes ?? [])].sort(),
          division: rec?.divisionId ? divisionName.get(rec.divisionId) ?? null : null,
          agentScore: t.agentScore ?? null,
          agentRationale: t.agentRationale ?? null,
        };
      }),
      valueStreams,
    });
  } catch (e) { next(e); }
});

// ── Checklist grain: one row per checklist item ───────────────────────────────
// Checklist items hang off ROLES (with a category). The Tasks tab's checklist
// view ties each item to a parent task: the role's task in the same category
// (falling back to any of the role's tasks), matched back to the seeded Task
// row by (owner = role name, title = role-task text) — the same identity the
// work seeder used, so the row can deep-link into the task drill-down.
router.get('/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const tenantId = req.tenantId;

    const [items, roleTasks, tasks, valueStreams] = await Promise.all([
      prisma.checklistItem.findMany({
        where: { role: { companyId } },
        select: {
          id: true, text: true, roleId: true, categoryId: true,
          role: { select: { name: true } }, category: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.roleTask.findMany({
        where: { role: { companyId } },
        select: { roleId: true, categoryId: true, text: true },
        orderBy: { id: 'asc' },
      }),
      prisma.task.findMany({
        where: { tenantId, companyId, source: 'role' },
        select: { id: true, title: true, owner: true, deliverable: { select: { valueStreamId: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);
    const vsName = new Map(valueStreams.map((v) => [v.id, v.name] as const));

    // First role-task text per role+category (then per role) — the parent task.
    const rtByRoleCat = new Map<string, string>();
    const rtByRole = new Map<string, string>();
    for (const rt of roleTasks) {
      const kc = `${rt.roleId}␟${rt.categoryId ?? ''}`;
      if (!rtByRoleCat.has(kc)) rtByRoleCat.set(kc, rt.text);
      if (!rtByRole.has(rt.roleId)) rtByRole.set(rt.roleId, rt.text);
    }
    // Seeded Task row per (owner role name, title) — first occurrence wins.
    const taskByKey = new Map<string, (typeof tasks)[number]>();
    for (const t of tasks) {
      const k = `${norm(t.owner ?? '')}␟${norm(t.title)}`;
      if (!taskByKey.has(k)) taskByKey.set(k, t);
    }

    res.json({
      items: items.map((ci) => {
        const text = rtByRoleCat.get(`${ci.roleId}␟${ci.categoryId ?? ''}`) ?? rtByRole.get(ci.roleId) ?? null;
        const task = text ? taskByKey.get(`${norm(ci.role.name)}␟${norm(text)}`) ?? null : null;
        return {
          id: ci.id, text: ci.text,
          roleId: ci.roleId, roleName: ci.role.name,
          category: ci.category?.name ?? null,
          taskId: task?.id ?? null, taskTitle: task?.title ?? text,
          valueStreamName: task?.deliverable?.valueStreamId ? vsName.get(task.deliverable.valueStreamId) ?? null : null,
        };
      }),
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

    // Upstream: the INPUTS consumed by the same sub-process(es) that produce this
    // deliverable (the other half of the source I/O inventory — DT2).
    const seenInputs = new Set<string>();
    const inputs = ioItems
      .filter((io) => /input/i.test(io.type) && sourceKeys.has(`${io.valueStreamId}␟${io.l4 ?? ''}`))
      .filter((io) => { const k = norm(io.name); if (seenInputs.has(k)) return false; seenInputs.add(k); return true; })
      .map((io) => ({
        name: io.name,
        dataElements: splitItems(io.dataElements),
        roles: mergeRoles([io.keyRoles], resolve),
      }));

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
      id: d.id, title: d.title, description: d.description, type: d.type, owner: d.owner, jiraKey: d.jiraKey,
      valueStream: vs ? { id: vs.id, name: vs.name, domain: vs.domain } : null,
      subProcesses, dataElements, inputs,
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
    // The task's single owning role, resolved to a linkable role where possible.
    const ownerRole = t.owner ? resolve(t.owner) : null;
    const vsMap = new Map(vsList.map((v) => [v.id, v] as const));
    const nameN = norm(t.title);

    // Source step: name match, preferring the task's deliverable value stream;
    // same-named steps within that stream are disambiguated by the task owner
    // matching a step lead role (mirrors the list endpoint).
    const sameName = steps.filter((s) => norm(s.name) === nameN);
    const inVs = t.deliverable ? sameName.filter((s) => s.valueStreamId === t.deliverable!.valueStreamId) : [];
    const pool = inVs.length ? inVs : sameName;
    const ownerMatch = (s: (typeof steps)[number]) => {
      const r = mergeRoles([s.leads], resolve);
      return [...r.roles.map((m) => m.name), ...r.unresolved].some((n) => norm(n) === norm(t.owner!));
    };
    const step = (pool.length > 1 && t.owner ? pool.find(ownerMatch) : null) ?? pool[0] ?? null;

    // Role-sourced tasks have no L5 step — fall back to the process of the
    // deliverable they feed (its source output/deliverable I/O row).
    let dIo: { l3: string | null; l4: string | null } | null = null;
    if (!step && t.deliverable?.valueStreamId) {
      const cands = await prisma.ioItem.findMany({
        where: { valueStreamId: t.deliverable.valueStreamId },
        select: { name: true, type: true, l3: true, l4: true },
      });
      dIo = cands.find((io) => /output|deliver/i.test(io.type) && norm(io.name) === norm(t.deliverable!.title)) ?? null;
    }

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
      id: t.id, title: t.title, owner: t.owner, priority: t.priority, jiraKey: t.jiraKey,
      ownerRole: ownerRole ? { id: ownerRole.id, name: ownerRole.name } : null,
      agentScore: t.agentScore ?? null, agentRationale: t.agentRationale ?? null,
      valueStream: vs,
      subProcess: step
        ? [step.l3, step.l4].filter(Boolean).join(' · ') || null
        : dIo ? [dIo.l3, dIo.l4].filter(Boolean).join(' · ') || null : null,
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
