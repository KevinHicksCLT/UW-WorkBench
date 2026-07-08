// Role-task validation routes — mounted at /roles BEFORE the main roles router
// so `/validation-targets` and `/task-links/…` are never captured by its
// `/:id` catch-all. A role-holder attests each NodeRole link ("yes I do this" /
// "someone else does it" / "we don't do this"); the decision is stored ONLY on
// the NodeRole row, so every surface (profile, drawer, Inspector, Tasks)
// derives the same state. Reassignments also write the real graph link for the
// new doer (NodeRole / NodeAppUsage / ExternalInteraction) so the rest of the
// app reflects the change immediately.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../services/audit.js';
import {
  REASSIGN_KINDS,
  VALIDATION_SELECT,
  VALIDATION_STATUSES,
  validationUpdateData,
  validationView,
} from '../lib/roleTaskValidation.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('roles'));

// GET /roles/validation-targets?kind=role|application|externalParty&q=…
// Tenant-scoped picker options for the "who does it instead?" flow.
router.get('/validation-targets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = z.enum(REASSIGN_KINDS).parse(req.query.kind);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const name = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const take = 20;
    const tenantId = req.tenantId;

    let targets: { id: string; name: string; detail: string | null }[];
    if (kind === 'role') {
      const rows = await prisma.role.findMany({
        where: { company: { tenantId }, ...(name ? { displayValue: name } : {}) },
        orderBy: { displayValue: 'asc' },
        take,
        select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
      });
      targets = rows.map((r) => ({
        id: r.id,
        name: r.displayValue,
        detail: r.orgUnit?.displayValue ?? null,
      }));
    } else if (kind === 'application') {
      const rows = await prisma.application.findMany({
        where: { company: { tenantId }, ...(name ? { name } : {}) },
        orderBy: { name: 'asc' },
        take,
        select: { id: true, name: true, kind: true },
      });
      targets = rows.map((r) => ({ id: r.id, name: r.name, detail: r.kind }));
    } else {
      const rows = await prisma.externalParty.findMany({
        where: { company: { tenantId }, ...(name ? { name } : {}) },
        orderBy: { name: 'asc' },
        take,
        select: { id: true, name: true, partyType: true },
      });
      targets = rows.map((r) => ({ id: r.id, name: r.name, detail: r.partyType }));
    }
    res.json({ targets });
  } catch (e) {
    next(e);
  }
});

const validationBody = z.object({
  status: z.enum(VALIDATION_STATUSES),
  note: z.string().max(2000).nullish(),
  reassignTo: z.object({ kind: z.enum(REASSIGN_KINDS), id: z.string().min(1) }).nullish(),
});

// PATCH /roles/task-links/:nodeRoleId/validation — record the attestation.
router.patch(
  '/task-links/:nodeRoleId/validation',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.nodeRole.findFirst({
        where: { id: req.params.nodeRoleId, role: { company: { tenantId: req.tenantId } } },
        select: {
          id: true,
          companyId: true,
          processNodeId: true,
          roleId: true,
          role_: true,
          validationStatus: true,
        },
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const body = validationBody.parse(req.body);
      const computed = validationUpdateData(
        { status: body.status, note: body.note ?? null, reassignTo: body.reassignTo ?? null },
        req.user.email,
        new Date(),
      );
      if ('error' in computed) return res.status(400).json({ error: computed.error });

      // Reassignment target must exist in-tenant; a miss is a 404 like any
      // other cross-tenant read. Reassigning a link to its own role is a no-op
      // mistake — reject it.
      const target = body.status === 'REASSIGNED' ? body.reassignTo! : null;
      if (target) {
        if (target.kind === 'role') {
          if (target.id === existing.roleId) {
            return res.status(400).json({ error: 'Cannot reassign a task to the same role' });
          }
          const hit = await prisma.role.findFirst({
            where: { id: target.id, company: { tenantId: req.tenantId } },
            select: { id: true },
          });
          if (!hit) return res.status(404).json({ error: 'Target role not found' });
        } else if (target.kind === 'application') {
          const hit = await prisma.application.findFirst({
            where: { id: target.id, company: { tenantId: req.tenantId } },
            select: { id: true },
          });
          if (!hit) return res.status(404).json({ error: 'Target application not found' });
        } else {
          const hit = await prisma.externalParty.findFirst({
            where: { id: target.id, company: { tenantId: req.tenantId } },
            select: { id: true },
          });
          if (!hit) return res.status(404).json({ error: 'Target external party not found' });
        }
      }

      const updated = await prisma.nodeRole.update({
        where: { id: existing.id },
        data: computed.data,
        select: { id: true, ...VALIDATION_SELECT },
      });

      // Keep the graph truthful: the reassignment's "new doer" becomes a real
      // link, so the task's roles/apps/third-parties reflect it everywhere.
      if (target?.kind === 'role') {
        await prisma.nodeRole.upsert({
          where: {
            processNodeId_roleId_role_: {
              processNodeId: existing.processNodeId,
              roleId: target.id,
              role_: existing.role_,
            },
          },
          create: {
            companyId: existing.companyId,
            processNodeId: existing.processNodeId,
            roleId: target.id,
            role_: existing.role_,
          },
          update: {},
        });
      } else if (target?.kind === 'application') {
        await prisma.nodeAppUsage.upsert({
          where: {
            processNodeId_applicationId_usageType: {
              processNodeId: existing.processNodeId,
              applicationId: target.id,
              usageType: 'performed',
            },
          },
          create: {
            companyId: existing.companyId,
            processNodeId: existing.processNodeId,
            applicationId: target.id,
            usageType: 'performed',
          },
          update: {},
        });
      } else if (target?.kind === 'externalParty') {
        const interaction = await prisma.externalInteraction.findFirst({
          where: {
            externalPartyId: target.id,
            processNodeId: existing.processNodeId,
            nature: 'service',
          },
          select: { id: true },
        });
        if (!interaction) {
          await prisma.externalInteraction.create({
            data: {
              externalPartyId: target.id,
              processNodeId: existing.processNodeId,
              nature: 'service',
            },
          });
        }
      }

      await logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'NodeRole',
        entityId: existing.id,
        action: 'validate',
        diff: {
          from: existing.validationStatus,
          to: body.status,
          reassignTo: target ?? null,
        },
      });

      res.json({ link: { nodeRoleId: updated.id, validation: validationView(updated) } });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
