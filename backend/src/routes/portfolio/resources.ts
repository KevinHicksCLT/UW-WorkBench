/**
 * Initiative resources, dependency options/validation, and activities.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, ownInitiative } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerResourceActivityRoutes(router: Router): void {
const resourceCreateSchema = z.object({
  name: z.string().min(1),
  roleName: z.string().nullable().optional(),
  allocationPct: z.number().int().min(1).max(100),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/initiatives/:id/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = resourceCreateSchema.parse(req.body);
    // erd_v5 InitiativeResource has no free-text roleName column (role is now an
    // optional Role FK). The legacy free-text roleName is accepted but not stored;
    // reads resolve roleName from the linked Role's displayValue.
    const resource = await prisma.initiativeResource.create({
      data: {
        initiativeId: req.params.id,
        name: data.name,
        allocationPct: data.allocationPct,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'RESOURCE_ADDED', diff: { resource: data.name, allocationPct: data.allocationPct } });
    res.status(201).json(resource);
  } catch (e) { next(e); }
});

async function ownResource(id: string, tenantId: string) {
  const r = await prisma.initiativeResource.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return r && r.initiative.tenantId === tenantId ? r : null;
}

router.patch('/initiatives/resources/:rid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownResource(req.params.rid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = resourceCreateSchema.partial().parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    // roleName is not an erd_v5 column — never write it through.
    delete patch.roleName;
    const updated = await prisma.initiativeResource.update({ where: { id: req.params.rid }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'RESOURCE_UPDATED', diff: { resource: existing.name, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/resources/:rid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownResource(req.params.rid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.initiativeResource.delete({ where: { id: req.params.rid } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'RESOURCE_REMOVED', diff: { resource: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Per-resource-name utilization across a program's initiatives. The total only
// counts assignments whose date range covers today (active allocations).
router.get('/programs/:id/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const resources = await prisma.initiativeResource.findMany({
      where: { initiative: { workstream: { programId: req.params.id } } },
      include: { initiative: { select: { id: true, name: true } }, role: { select: { displayValue: true } } },
      orderBy: { name: 'asc' },
    });
    const today = new Date();
    type Row = {
      name: string; roleName: string | null; totalAllocationPct: number;
      assignments: { initiativeId: string; initiativeName: string; allocationPct: number; startDate: Date; endDate: Date }[];
    };
    const byName = new Map<string, Row>();
    for (const r of resources) {
      // roleName is resolved from the linked Role (erd_v5 dropped the free-text column).
      const roleName = r.role?.displayValue ?? null;
      const row = byName.get(r.name) ?? { name: r.name, roleName, totalAllocationPct: 0, assignments: [] };
      if (!row.roleName && roleName) row.roleName = roleName;
      row.assignments.push({ initiativeId: r.initiative.id, initiativeName: r.initiative.name, allocationPct: r.allocationPct, startDate: r.startDate, endDate: r.endDate });
      if (r.startDate <= today && r.endDate >= today) row.totalAllocationPct += r.allocationPct;
      byName.set(r.name, row);
    }
    res.json([...byName.values()].map((row) => ({ ...row, overUtilized: row.totalAllocationPct > 100 })));
  } catch (e) { next(e); }
});

// ─── Workplan activities (I9) ───────────────────────────────────────────────
const activityCreateSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  assignedTo: z.string().nullable().optional(),
  dependsOnId: z.string().nullable().optional(),
  // Typed dependency (FB-19): type + the chosen value (refId from a list, or a
  // free-text label for Person / Change-control approval).
  dependencyType: z.enum(['TEAM', 'ROLE', 'PERSON', 'PROJECT', 'CHANGE_APPROVAL']).nullable().optional(),
  dependencyRefId: z.string().nullable().optional(),
  dependencyLabel: z.string().nullable().optional(),
});

// Cascading dependency options for the workplan-activity modal: the second
// dropdown is populated from these per the selected type. Person and
// change-control approval are free-text (no canonical list in the model).
router.get('/dependency-options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const [teams, roles, projects] = await Promise.all([
      prisma.orgUnit.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.program.findMany({ where: { tenantId: req.tenantId, companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({
      TEAM: teams.map((t) => ({ id: t.id, name: t.displayValue })),
      ROLE: roles.map((r) => ({ id: r.id, name: r.displayValue })),
      PROJECT: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (e) { next(e); }
});

// A dependency must point at another activity of the same initiative.
async function validDependency(dependsOnId: string, initiativeId: string, selfId?: string): Promise<boolean> {
  if (dependsOnId === selfId) return false;
  const dep = await prisma.workplanActivity.findFirst({ where: { id: dependsOnId, initiativeId }, select: { id: true } });
  return !!dep;
}

router.post('/initiatives/:id/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = activityCreateSchema.parse(req.body);
    if (data.dependsOnId && !(await validDependency(data.dependsOnId, req.params.id))) {
      return res.status(400).json({ error: 'dependsOnId must reference an activity of the same initiative' });
    }
    const last = await prisma.workplanActivity.aggregate({ where: { initiativeId: req.params.id }, _max: { sortOrder: true } });
    const activity = await prisma.workplanActivity.create({
      data: {
        initiativeId: req.params.id,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        assignedTo: data.assignedTo ?? null,
        dependsOnId: data.dependsOnId ?? null,
        dependencyType: data.dependencyType ?? null,
        dependencyRefId: data.dependencyRefId ?? null,
        dependencyLabel: data.dependencyLabel ?? null,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'ACTIVITY_CREATED', diff: { activity: data.name } });
    res.status(201).json(activity);
  } catch (e) { next(e); }
});

async function ownActivity(id: string, tenantId: string) {
  const a = await prisma.workplanActivity.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return a && a.initiative.tenantId === tenantId ? a : null;
}

router.patch('/initiatives/activities/:aid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activity = await ownActivity(req.params.aid, req.tenantId);
    if (!activity) return res.status(404).json({ error: 'Not found' });
    const data = activityCreateSchema.partial().extend({
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
    }).parse(req.body);
    if (data.dependsOnId && !(await validDependency(data.dependsOnId, activity.initiativeId, activity.id))) {
      return res.status(400).json({ error: 'dependsOnId must reference an activity of the same initiative' });
    }
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const updated = await prisma.workplanActivity.update({ where: { id: req.params.aid }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: activity.initiativeId, action: 'ACTIVITY_UPDATED', diff: { activity: activity.name, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/activities/:aid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownActivity(req.params.aid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.workplanActivity.delete({ where: { id: req.params.aid } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'ACTIVITY_DELETED', diff: { activity: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Benefit / Cost lines + time-phased values ─────────────────────────────
}
