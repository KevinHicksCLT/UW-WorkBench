/**
 * Initiative CRUD, workflow actions, recompute, and milestones.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { recomputeInitiative } from '../../services/portfolioRollup.js';
import { applyWorkflowAction } from '../../services/portfolioWorkflow.js';
import { activeCompanyId, ownInitiative, resolveLinks, withLinkNames } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerInitiativeRoutes(router: Router): void {
  router.get('/initiatives', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const where: Record<string, unknown> = { tenantId: req.tenantId, companyId };
      if (typeof req.query.programId === 'string')
        where.workstream = { programId: req.query.programId };
      if (typeof req.query.workstreamId === 'string') where.workstreamId = req.query.workstreamId;
      if (typeof req.query.stage === 'string') where.stage = req.query.stage;
      if (typeof req.query.status === 'string') where.status = req.query.status;
      const initiatives = await prisma.portfolioInitiative.findMany({
        where,
        include: {
          workstream: { include: { program: { select: { id: true, name: true } } } },
          _count: { select: { raidItems: true, milestones: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      const maps = await resolveLinks(initiatives);
      res.json(initiatives.map((i) => withLinkNames(i, maps)));
    } catch (e) {
      next(e);
    }
  });

  router.get('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const init = await prisma.portfolioInitiative.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
          workstream: { include: { program: true } },
          benefits: { include: { values: true } },
          costs: { include: { values: true } },
          milestones: { orderBy: { dueDate: 'asc' } },
          raidItems: { orderBy: { severity: 'desc' } },
          objectives: {
            include: { objective: { select: { id: true, name: true, weight: true } } },
            orderBy: { createdAt: 'asc' },
          },
          resources: {
            orderBy: { startDate: 'asc' },
            include: { role: { select: { displayValue: true } } },
          },
          activities: { orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }] },
        },
      });
      if (!init) return res.status(404).json({ error: 'Not found' });
      const maps = await resolveLinks([init]);
      // Expose the legacy resource.roleName (resolved from the linked Role).
      const resources = init.resources.map(({ role, ...r }) => ({
        ...r,
        roleName: role?.displayValue ?? null,
      }));
      res.json({ ...withLinkNames(init, maps), resources });
    } catch (e) {
      next(e);
    }
  });

  const initiativeCreateSchema = z.object({
    workstreamId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    startDate: z.string(),
    dueDate: z.string(),
    valueStreamId: z.string().nullable().optional(),
    divisionId: z.string().nullable().optional(),
    ownerRoleId: z.string().nullable().optional(),
    sponsorRoleId: z.string().nullable().optional(),
  });

  router.post('/initiatives', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = initiativeCreateSchema.parse(req.body);
      const ws = await prisma.workstream.findFirst({
        where: { id: data.workstreamId, tenantId: req.tenantId },
        select: { id: true, companyId: true },
      });
      if (!ws) return res.status(404).json({ error: 'Workstream not found' });
      const init = await prisma.portfolioInitiative.create({
        data: {
          tenantId: req.tenantId,
          companyId: ws.companyId,
          workstreamId: data.workstreamId,
          name: data.name,
          description: data.description,
          startDate: new Date(data.startDate),
          dueDate: new Date(data.dueDate),
          // Frontend still sends the legacy keys; map to the erd_v5 FK columns.
          valueStreamNodeId: data.valueStreamId ?? null,
          orgUnitId: data.divisionId ?? null,
          ownerRoleId: data.ownerRoleId ?? null,
          sponsorRoleId: data.sponsorRoleId ?? null,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: init.id,
        action: 'INITIATIVE_CREATED',
        diff: { initiative: data.name },
      });
      res.status(201).json(init);
    } catch (e) {
      next(e);
    }
  });

  const initiativeUpdateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
    statusNote: z.string().optional(),
    charter: z.string().optional(), // user-authored Project Charter (Markdown)
    complexityScore: z.number().min(0).max(10).optional(),
    valueStreamId: z.string().nullable().optional(),
    divisionId: z.string().nullable().optional(),
    ownerRoleId: z.string().nullable().optional(),
    sponsorRoleId: z.string().nullable().optional(),
  });

  router.patch('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await ownInitiative(req.params.id, req.tenantId);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const data = initiativeUpdateSchema.parse(req.body);
      const patch: Record<string, unknown> = { ...data };
      if (data.startDate) patch.startDate = new Date(data.startDate);
      if (data.dueDate) patch.dueDate = new Date(data.dueDate);
      // Translate the legacy link keys to the erd_v5 FK columns (and drop the
      // legacy keys, which are not columns on PortfolioInitiative).
      if ('valueStreamId' in data) {
        patch.valueStreamNodeId = data.valueStreamId ?? null;
        delete patch.valueStreamId;
      }
      if ('divisionId' in data) {
        patch.orgUnitId = data.divisionId ?? null;
        delete patch.divisionId;
      }
      const updated = await prisma.portfolioInitiative.update({
        where: { id: req.params.id },
        data: patch,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: req.params.id,
        action: 'INITIATIVE_UPDATED',
        diff: { initiative: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  router.delete('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await ownInitiative(req.params.id, req.tenantId);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      await prisma.portfolioInitiative.delete({ where: { id: req.params.id } });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: req.params.id,
        action: 'INITIATIVE_DELETED',
        diff: { initiative: existing.name },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.post(
    '/initiatives/:id/workflow',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await ownInitiative(req.params.id, req.tenantId);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const { action } = z
          .object({ action: z.enum(['SUBMIT', 'APPROVE', 'MOVE_BACK']) })
          .parse(req.body);
        const updated = await applyWorkflowAction({
          initiativeId: req.params.id,
          action,
          actor: { tenantId: req.tenantId, email: req.user.email },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    '/initiatives/:id/recompute',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await ownInitiative(req.params.id, req.tenantId);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const updated = await recomputeInitiative(req.params.id);
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  // Milestones (nested under an initiative)
  router.post(
    '/initiatives/:id/milestones',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await ownInitiative(req.params.id, req.tenantId);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const data = z
          .object({ name: z.string().min(1), dueDate: z.string(), isGate: z.boolean().optional() })
          .parse(req.body);
        const m = await prisma.milestone.create({
          data: {
            initiativeId: req.params.id,
            name: data.name,
            dueDate: new Date(data.dueDate),
            isGate: data.isGate ?? false,
          },
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: req.params.id,
          action: 'MILESTONE_CREATED',
          diff: { milestone: data.name, dueDate: data.dueDate },
        });
        res.status(201).json(m);
      } catch (e) {
        next(e);
      }
    },
  );

  async function ownMilestone(id: string, tenantId: string) {
    const m = await prisma.milestone.findUnique({
      where: { id },
      include: { initiative: { select: { tenantId: true } } },
    });
    return m && m.initiative.tenantId === tenantId ? m : null;
  }

  router.patch(
    '/initiatives/milestones/:milestoneId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await ownMilestone(req.params.milestoneId, req.tenantId);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const data = z
          .object({
            name: z.string().optional(),
            dueDate: z.string().optional(),
            status: z.enum(['PENDING', 'DONE', 'MISSED']).optional(),
            isGate: z.boolean().optional(),
          })
          .parse(req.body);
        const patch: Record<string, unknown> = { ...data };
        if (data.dueDate) patch.dueDate = new Date(data.dueDate);
        if (data.status === 'DONE') patch.completedAt = new Date();
        if (data.status && data.status !== 'DONE') patch.completedAt = null;
        const updated = await prisma.milestone.update({
          where: { id: req.params.milestoneId },
          data: patch,
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: existing.initiativeId,
          action: 'MILESTONE_UPDATED',
          diff: { milestone: existing.name, ...data },
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );

  router.delete(
    '/initiatives/milestones/:milestoneId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await ownMilestone(req.params.milestoneId, req.tenantId);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        await prisma.milestone.delete({ where: { id: req.params.milestoneId } });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: existing.initiativeId,
          action: 'MILESTONE_DELETED',
          diff: { milestone: existing.name },
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  // ─── Strategic objectives + alignment links (I3/I4) ────────────────────────
  // valueScore = Σ(link.impact × objective.weight), persisted on the initiative
  // after every link/weight change so list views can sort without joins.
}
