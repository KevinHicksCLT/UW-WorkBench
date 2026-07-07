/**
 * Benefit/cost lines + metric values, RAID items, and change requests.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { recomputeInitiative } from '../../services/portfolioRollup.js';
import { applyChangeRequestUpdate } from '../../services/changeRequests.js';
import { maybeHold } from '../../lib/approvals/engine.js';
import { CHANGE_REQUEST_MAJOR_THRESHOLD } from '@cascade/shared';
import { activeCompanyId, ownInitiative } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerFinanceRaidRoutes(router: Router): void {
  const lineSchema = z.object({
    initiativeId: z.string(),
    name: z.string().min(1),
    category: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    type: z.enum(['BENEFIT', 'COST']),
  });

  router.post('/lines', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = lineSchema.parse(req.body);
      const init = await ownInitiative(data.initiativeId, req.tenantId);
      if (!init) return res.status(404).json({ error: 'Initiative not found' });
      const payload = {
        initiativeId: data.initiativeId,
        name: data.name,
        category: data.category,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      };
      const line =
        data.type === 'BENEFIT'
          ? await prisma.benefitLine.create({ data: payload })
          : await prisma.costLine.create({ data: payload });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: data.initiativeId,
        action: data.type === 'BENEFIT' ? 'BENEFIT_LINE_CREATED' : 'COST_LINE_CREATED',
        diff: { line: data.name, category: data.category ?? null },
      });
      res.status(201).json({ ...line, type: data.type });
    } catch (e) {
      next(e);
    }
  });

  // Walk a benefit/cost line up to its initiative's tenant for the ownership guard.
  async function ownLine(type: string, id: string, tenantId: string) {
    if (type === 'BENEFIT') {
      const l = await prisma.benefitLine.findUnique({
        where: { id },
        include: { initiative: { select: { tenantId: true } } },
      });
      return l && l.initiative.tenantId === tenantId ? l : null;
    }
    const l = await prisma.costLine.findUnique({
      where: { id },
      include: { initiative: { select: { tenantId: true } } },
    });
    return l && l.initiative.tenantId === tenantId ? l : null;
  }

  router.delete('/lines/:type/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, id } = req.params;
      const line = await ownLine(type, id, req.tenantId);
      if (!line) return res.status(404).json({ error: 'Not found' });
      if (type === 'BENEFIT') await prisma.benefitLine.delete({ where: { id } });
      else await prisma.costLine.delete({ where: { id } });
      await recomputeInitiative(line.initiativeId);
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: line.initiativeId,
        action: type === 'BENEFIT' ? 'BENEFIT_LINE_DELETED' : 'COST_LINE_DELETED',
        diff: { line: line.name },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.get('/lines/:type/:id/values', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, id } = req.params;
      const line = await ownLine(type, id, req.tenantId);
      if (!line) return res.status(404).json({ error: 'Not found' });
      const fk = type === 'BENEFIT' ? { benefitLineId: id } : { costLineId: id };
      const values = await prisma.metricValue.findMany({ where: fk });
      res.json(values);
    } catch (e) {
      next(e);
    }
  });

  const valuesSchema = z.object({
    type: z.enum(['BENEFIT', 'COST']),
    lineId: z.string(),
    dataset: z.enum(['ACTUAL', 'TARGET', 'FORECAST']),
    values: z.array(z.object({ periodStart: z.string(), amount: z.number() })),
  });

  router.post('/values', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = valuesSchema.parse(req.body);
      const line = await ownLine(data.type, data.lineId, req.tenantId);
      if (!line) return res.status(404).json({ error: 'Line not found' });
      const fkField = data.type === 'BENEFIT' ? 'benefitLineId' : 'costLineId';

      // Capture the before-state so the audit records the exact month-level
      // before→after changes (and so an unchanged dataset logs nothing).
      const prior = await prisma.metricValue.findMany({
        where: { [fkField]: data.lineId, dataset: data.dataset },
        select: { periodStart: true, amount: true },
      });
      const monthKey = (d: string | Date) => new Date(d).toISOString().slice(0, 7);
      const beforeByMonth = new Map<string, number>();
      for (const v of prior) beforeByMonth.set(monthKey(v.periodStart), v.amount);
      const afterByMonth = new Map<string, number>();
      for (const v of data.values) afterByMonth.set(monthKey(v.periodStart), v.amount);
      const months = [...new Set([...beforeByMonth.keys(), ...afterByMonth.keys()])].sort();
      const changes = months
        .map((m) => ({ period: m, from: beforeByMonth.get(m) ?? 0, to: afterByMonth.get(m) ?? 0 }))
        .filter((c) => c.from !== c.to);

      await prisma.metricValue.deleteMany({
        where: { [fkField]: data.lineId, dataset: data.dataset },
      });
      if (data.values.length > 0) {
        await prisma.metricValue.createMany({
          data: data.values.map((v) => ({
            [fkField]: data.lineId,
            dataset: data.dataset,
            periodStart: new Date(v.periodStart),
            amount: v.amount,
          })),
        });
      }
      await recomputeInitiative(line.initiativeId);
      // Only audit datasets that actually changed — no more 3-rows-per-save noise.
      const DATASET_LABEL: Record<string, string> = {
        ACTUAL: 'Actual',
        TARGET: 'Budget',
        FORECAST: 'Forecast',
      };
      if (changes.length > 0)
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: line.initiativeId,
          action: data.type === 'BENEFIT' ? 'BENEFIT_VALUES_UPDATED' : 'COST_VALUES_UPDATED',
          diff: {
            line: line.name,
            field: `${DATASET_LABEL[data.dataset]} (${data.type === 'BENEFIT' ? 'benefit' : 'cost'})`,
            changes,
          },
        });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  // ─── RAID ──────────────────────────────────────────────────────────────────
  router.get('/raid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const where: Record<string, unknown> = { initiative: { companyId } };
      if (typeof req.query.programId === 'string')
        where.initiative = { companyId, workstream: { programId: req.query.programId } };
      if (typeof req.query.initiativeId === 'string') where.initiativeId = req.query.initiativeId;
      if (typeof req.query.type === 'string') where.type = req.query.type;
      if (typeof req.query.status === 'string') where.status = req.query.status;
      const items = await prisma.raidItem.findMany({
        where,
        include: { initiative: { select: { id: true, name: true } } },
        orderBy: { severity: 'desc' },
      });
      res.json(items);
    } catch (e) {
      next(e);
    }
  });

  const raidCreateSchema = z.object({
    initiativeId: z.string(),
    type: z.enum(['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION']),
    title: z.string().min(1),
    description: z.string().optional(),
    probability: z.number().int().min(1).max(5).optional(),
    impact: z.number().int().min(1).max(5).optional(),
    mitigation: z.string().optional(),
    ownerRoleId: z.string().nullable().optional(),
    dueDate: z.string().optional(),
  });

  router.post('/raid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = raidCreateSchema.parse(req.body);
      const init = await ownInitiative(data.initiativeId, req.tenantId);
      if (!init) return res.status(404).json({ error: 'Initiative not found' });
      const probability = data.probability ?? 3;
      const impact = data.impact ?? 3;
      const item = await prisma.raidItem.create({
        data: {
          initiativeId: data.initiativeId,
          type: data.type,
          title: data.title,
          description: data.description,
          probability,
          impact,
          severity: probability * impact,
          mitigation: data.mitigation,
          ownerRoleId: data.ownerRoleId ?? null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: data.initiativeId,
        action: 'RAID_CREATED',
        diff: { type: data.type, title: data.title },
      });
      res.status(201).json(item);
    } catch (e) {
      next(e);
    }
  });

  const raidUpdateSchema = raidCreateSchema
    .partial()
    .omit({ initiativeId: true })
    .extend({
      status: z.enum(['OPEN', 'MITIGATED', 'CLOSED']).optional(),
    });

  router.patch('/raid/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await prisma.raidItem.findUnique({
        where: { id: req.params.id },
        include: { initiative: { select: { tenantId: true } } },
      });
      if (!item || item.initiative.tenantId !== req.tenantId)
        return res.status(404).json({ error: 'Not found' });
      const data = raidUpdateSchema.parse(req.body);
      const patch: Record<string, unknown> = { ...data };
      if (data.dueDate) patch.dueDate = new Date(data.dueDate);
      const probability = data.probability ?? item.probability;
      const impact = data.impact ?? item.impact;
      if (data.probability !== undefined || data.impact !== undefined)
        patch.severity = probability * impact;
      const updated = await prisma.raidItem.update({ where: { id: req.params.id }, data: patch });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: item.initiativeId,
        action: 'RAID_UPDATED',
        diff: { title: item.title, ...data },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  router.delete('/raid/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await prisma.raidItem.findUnique({
        where: { id: req.params.id },
        include: { initiative: { select: { tenantId: true } } },
      });
      if (!item || item.initiative.tenantId !== req.tenantId)
        return res.status(404).json({ error: 'Not found' });
      await prisma.raidItem.delete({ where: { id: req.params.id } });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'PortfolioInitiative',
        entityId: item.initiativeId,
        action: 'RAID_DELETED',
        diff: { title: item.title },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ─── Change requests / change log (FB-27) ──────────────────────────────────
  router.get(
    '/initiatives/:id/change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await ownInitiative(req.params.id, req.tenantId)))
          return res.status(404).json({ error: 'Not found' });
        const items = await prisma.changeRequest.findMany({
          where: { initiativeId: req.params.id },
          orderBy: { createdAt: 'desc' },
        });
        res.json(items);
      } catch (e) {
        next(e);
      }
    },
  );

  const changeRequestSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    raisedBy: z.string().optional(),
    costImpact: z.number().optional(),
    scheduleImpactDays: z.number().int().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  });

  router.post(
    '/initiatives/:id/change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await ownInitiative(req.params.id, req.tenantId)))
          return res.status(404).json({ error: 'Not found' });
        const data = changeRequestSchema.parse(req.body);
        const cr = await prisma.changeRequest.create({
          data: {
            initiativeId: req.params.id,
            title: data.title,
            description: data.description ?? null,
            raisedBy: data.raisedBy?.trim() || req.user.email,
            costImpact: data.costImpact ?? 0,
            scheduleImpactDays: data.scheduleImpactDays ?? 0,
            status: data.status ?? 'PENDING',
          },
        });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: req.params.id,
          action: 'CHANGE_REQUEST_CREATED',
          diff: {
            changeRequest: data.title,
            costImpact: data.costImpact ?? 0,
            scheduleImpactDays: data.scheduleImpactDays ?? 0,
          },
        });
        res.status(201).json(cr);
      } catch (e) {
        next(e);
      }
    },
  );

  router.patch('/change-requests/:cid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.changeRequest.findUnique({
        where: { id: req.params.cid },
        include: {
          initiative: {
            select: {
              tenantId: true,
              orgUnitId: true,
              valueStreamNodeId: true,
              sponsorRoleId: true,
            },
          },
        },
      });
      if (!existing || existing.initiative.tenantId !== req.tenantId)
        return res.status(404).json({ error: 'Not found' });
      const data = changeRequestSchema.partial().parse(req.body);
      // DA-12: flipping a CR to APPROVED is a governed decision — manager for
      // routine CRs, sponsor+manager panel above the major-cost threshold.
      if (data.status === 'APPROVED' && existing.status !== 'APPROVED') {
        const costImpact = data.costImpact ?? existing.costImpact;
        const held = await maybeHold(
          { tenantId: req.tenantId, userId: req.user.id, email: req.user.email },
          {
            decisionKey:
              costImpact > CHANGE_REQUEST_MAJOR_THRESHOLD
                ? 'portfolio.change-request.approve-major'
                : 'portfolio.change-request.approve',
            entityType: 'ChangeRequest',
            entityId: existing.id,
            action: 'CR_APPROVE',
            summary: `Approve change request "${existing.title}" ($${Math.round(costImpact).toLocaleString('en-US')} impact)`,
            payload: { cid: existing.id, data },
            subjectAttrs: {
              orgUnitId: existing.initiative.orgUnitId,
              valueStreamNodeId: existing.initiative.valueStreamNodeId,
              sponsorRoleId: existing.initiative.sponsorRoleId,
            },
          },
        );
        if (held) return res.status(202).json(held);
      }
      const updated = await applyChangeRequestUpdate(
        req.tenantId,
        req.params.cid,
        data,
        req.user.email,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  router.delete(
    '/change-requests/:cid',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await prisma.changeRequest.findUnique({
          where: { id: req.params.cid },
          include: { initiative: { select: { tenantId: true } } },
        });
        if (!existing || existing.initiative.tenantId !== req.tenantId)
          return res.status(404).json({ error: 'Not found' });
        await prisma.changeRequest.delete({ where: { id: req.params.cid } });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PortfolioInitiative',
          entityId: existing.initiativeId,
          action: 'CHANGE_REQUEST_DELETED',
          diff: { changeRequest: existing.title },
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );
}
