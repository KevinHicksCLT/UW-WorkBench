// Role management routes — the SCRUM-34 "amend/add/remove a Role" user flow,
// mounted at /roles BEFORE the read router so specific paths are never
// captured by its `/:id` catch-all. Permission comes from the `roles` menu
// key: the HTTP method derives create/update/delete, so only users granted
// write access on the Roles tab can mutate. Every mutation is audited.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit, computeDiff } from '../services/audit.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('roles'));

const EDITABLE_FIELDS = [
  'displayValue',
  'description',
  'roleFamily',
  'roleLevel',
  'roleType',
  'orgUnitId',
] as const;

const roleBody = z.object({
  displayValue: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).nullish(),
  roleFamily: z.string().trim().max(120).nullish(),
  roleLevel: z.string().trim().max(120).nullish(),
  roleType: z.string().trim().max(120).nullish(),
  orgUnitId: z.string().nullish(),
});

async function tenantCompany(req: Request) {
  return prisma.company.findFirst({
    where: { tenantId: req.tenantId },
    select: { id: true },
  });
}

/** Org unit must belong to the same tenant; returns false on a miss. */
async function orgUnitInTenant(req: Request, orgUnitId: string): Promise<boolean> {
  const hit = await prisma.orgUnit.findFirst({
    where: { id: orgUnitId, company: { tenantId: req.tenantId } },
    select: { id: true },
  });
  return !!hit;
}

// GET /roles/manage/options — form options: org units (division/department)
// plus the distinct families/levels already in use, for consistent tagging.
router.get('/manage/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [units, roles] = await Promise.all([
      prisma.orgUnit.findMany({
        where: {
          company: { tenantId: req.tenantId },
          orgLevelType: { levelNumber: { in: [2, 3] } },
        },
        orderBy: { displayValue: 'asc' },
        select: {
          id: true,
          displayValue: true,
          orgLevelType: { select: { levelNumber: true } },
          parent: { select: { displayValue: true } },
        },
      }),
      prisma.role.findMany({
        where: { company: { tenantId: req.tenantId } },
        select: { roleFamily: true, roleLevel: true },
      }),
    ]);
    res.json({
      orgUnits: units.map((u) => ({
        id: u.id,
        name: u.displayValue,
        level: u.orgLevelType?.levelNumber === 3 ? 'Department' : 'Division',
        parent: u.parent?.displayValue ?? null,
      })),
      roleFamilies: [...new Set(roles.map((r) => r.roleFamily).filter(Boolean))].sort() as string[],
      roleLevels: [...new Set(roles.map((r) => r.roleLevel).filter(Boolean))].sort() as string[],
    });
  } catch (e) {
    next(e);
  }
});

// GET /roles/:id/impact — what a delete would touch, so the confirm dialog can
// spell out the consequences (cascade links vs. silently-unassigned rows).
router.get('/:id/impact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: { id: true, displayValue: true },
    });
    if (!role) return res.status(404).json({ error: 'Not found' });
    const [tasks, deliverables, checklistItems, ownedStandards, reports, standards, regulations] =
      await Promise.all([
        prisma.nodeRole.count({ where: { roleId: role.id } }),
        prisma.roleDeliverable.count({ where: { roleId: role.id } }),
        prisma.checklistItem.count({ where: { roleId: role.id } }),
        prisma.standard.count({ where: { ownerRoleId: role.id } }),
        prisma.role.count({ where: { managerRoleId: role.id } }),
        prisma.roleStandard.count({ where: { roleId: role.id } }),
        prisma.roleRegulation.count({ where: { roleId: role.id } }),
      ]);
    res.json({
      id: role.id,
      name: role.displayValue,
      // Removed with the role (junction links).
      removedLinks: { tasks, deliverables, standards, regulations },
      // Left in place but unassigned (FKs null out silently).
      unassigned: { checklistItems, ownedStandards, reports },
    });
  } catch (e) {
    next(e);
  }
});

// POST /roles — create a role (dbValue = the label; unique per company).
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await tenantCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const body = roleBody.parse(req.body);
    if (body.orgUnitId && !(await orgUnitInTenant(req, body.orgUnitId))) {
      return res.status(404).json({ error: 'Org unit not found' });
    }
    const dup = await prisma.role.findFirst({
      where: { companyId: company.id, dbValue: body.displayValue },
      select: { id: true },
    });
    if (dup) return res.status(409).json({ error: 'A role with this name already exists' });

    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        dbValue: body.displayValue,
        displayValue: body.displayValue,
        description: body.description ?? null,
        roleFamily: body.roleFamily ?? null,
        roleLevel: body.roleLevel ?? null,
        roleType: body.roleType ?? null,
        orgUnitId: body.orgUnitId ?? null,
      },
      select: { id: true, displayValue: true },
    });
    await logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'Role',
      entityId: role.id,
      action: 'CREATE',
      diff: { displayValue: role.displayValue },
    });
    res.status(201).json({ id: role.id, name: role.displayValue });
  } catch (e) {
    next(e);
  }
});

// PATCH /roles/:id — amend a role's profile fields / org home.
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: {
        id: true,
        displayValue: true,
        description: true,
        roleFamily: true,
        roleLevel: true,
        roleType: true,
        orgUnitId: true,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = roleBody.partial().parse(req.body);
    if (body.orgUnitId && !(await orgUnitInTenant(req, body.orgUnitId))) {
      return res.status(404).json({ error: 'Org unit not found' });
    }
    const data: Record<string, string | null> = {};
    for (const f of EDITABLE_FIELDS) {
      if (body[f] !== undefined) data[f] = body[f] ?? null;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

    const updated = await prisma.role.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        displayValue: true,
        description: true,
        roleFamily: true,
        roleLevel: true,
        roleType: true,
        orgUnitId: true,
      },
    });
    await logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'Role',
      entityId: existing.id,
      action: 'UPDATE',
      diff: computeDiff(existing, updated, [...EDITABLE_FIELDS]),
    });
    res.json({ id: updated.id, name: updated.displayValue });
  } catch (e) {
    next(e);
  }
});

// DELETE /roles/:id — remove a role. Junction links cascade; optional owner
// FKs (checklist items, owned standards, reports) null out — the client shows
// the /impact summary in its confirm dialog first.
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: { id: true, displayValue: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.role.delete({ where: { id: existing.id } });
    await logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'Role',
      entityId: existing.id,
      action: 'DELETE',
      diff: { displayValue: existing.displayValue },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
