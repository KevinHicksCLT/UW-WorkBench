/**
 * Named normalized policies (ProductNormalizationTarget) — the consolidated
 * multi-state policy a team assembles on the Products board. A target captures
 * the scope it was created from (filters snapshot, target edition, covered
 * jurisdictions); review decisions carry its id, so its content accumulates and
 * survives across workflows. Registered BEFORE the response cache (live reads).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { activeCompany } from '../explorer/helpers.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  versionToken: z.string().trim().max(40).optional(),
  filters: z.record(z.string(), z.array(z.string())).optional(),
  states: z.array(z.string().trim().min(2).max(2)).max(60).optional(),
});

export function registerProductTargetRoutes(router: Router): void {
  // GET /product-spine/targets — every named normalized policy + progress.
  router.get('/targets', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const rows = await prisma.productNormalizationTarget.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { decisions: true } } },
      });
      res.json(
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          versionToken: t.versionToken,
          filters: t.filters,
          states: t.states,
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          decisionCount: t._count.decisions,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  // POST /product-spine/targets — create a named normalized policy.
  router.post('/targets', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const { name, versionToken, filters, states } = parsed.data;
      const existing = await prisma.productNormalizationTarget.findFirst({
        where: { companyId: company.id, name },
        select: { id: true },
      });
      if (existing) return res.status(409).json({ error: 'A policy with that name exists' });
      const created = await prisma.productNormalizationTarget.create({
        data: {
          tenantId: req.tenantId,
          companyId: company.id,
          name,
          versionToken: versionToken ?? null,
          filters: filters ?? undefined,
          states: states ?? undefined,
          createdBy: req.user.email,
        },
      });
      res.status(201).json({ id: created.id, name: created.name });
    } catch (e) {
      next(e);
    }
  });

  // GET /product-spine/targets/:id — the policy + its accumulated decisions,
  // grouped by model component (the grid's normalized-policy view).
  router.get('/targets/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const target = await prisma.productNormalizationTarget.findFirst({
        where: { id: req.params.id, companyId: company.id },
      });
      if (!target) return res.status(404).json({ error: 'Unknown policy' });
      const decisions = await prisma.productNormalizationDecision.findMany({
        where: { companyId: company.id, targetId: target.id },
        orderBy: [{ component: 'asc' }, { updatedAt: 'desc' }],
        select: {
          lobNodeId: true,
          component: true,
          groupKey: true,
          status: true,
          comment: true,
          decidedBy: true,
          updatedAt: true,
        },
      });
      const lobIds = [...new Set(decisions.map((d) => d.lobNodeId))];
      const lobs = await prisma.productNode.findMany({
        where: { id: { in: lobIds }, companyId: company.id },
        select: { id: true, displayValue: true },
      });
      const lobName = new Map(lobs.map((l) => [l.id, l.displayValue]));
      res.json({
        id: target.id,
        name: target.name,
        versionToken: target.versionToken,
        filters: target.filters,
        states: target.states,
        createdBy: target.createdBy,
        createdAt: target.createdAt,
        decisions: decisions.map((d) => ({
          lobId: d.lobNodeId,
          lobName: lobName.get(d.lobNodeId) ?? '',
          component: d.component,
          groupKey: d.groupKey,
          status: d.status,
          comment: d.comment,
          decidedBy: d.decidedBy,
          decidedAt: d.updatedAt,
        })),
      });
    } catch (e) {
      next(e);
    }
  });
}
