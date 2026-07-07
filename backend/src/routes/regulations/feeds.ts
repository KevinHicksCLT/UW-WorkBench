/**
 * Regulations auxiliary feeds — the jurisdiction/system integrations matrix,
 * the regulatory bulletins feed, and the cross-jurisdiction compliance-rule /
 * monitored-source aggregates behind the drillable overview cards.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId, str, list } from './helpers.js';

/** Registers the integrations + bulletins GET routes on the shared regulations router. */
export function registerFeedRoutes(router: Router): void {
  // ── Integrations matrix ───────────────────────────────────────────────────────
  router.get('/integrations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const [systems, usages] = await Promise.all([
        prisma.integrationSystem.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
        prisma.jurisdictionIntegration.findMany({
          where: { jurisdiction: { companyId } },
          include: { jurisdiction: { select: { code: true, name: true } } },
        }),
      ]);
      res.json({
        systems,
        usages: usages.map((u) => ({
          systemId: u.systemId,
          jurisdictionCode: u.jurisdiction.code,
          jurisdictionName: u.jurisdiction.name,
          usage: u.usage,
          scope: u.scope,
          notes: u.notes,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Bulletins feed ────────────────────────────────────────────────────────────
  router.get('/bulletins', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const q = req.query;
      const where: Record<string, unknown> = { companyId };
      const states = list(q.state);
      if (states) where.jurisdiction = { code: { in: states.map((s) => s.toUpperCase()) } };
      if (str(q.discoveredVia)) where.discoveredVia = String(q.discoveredVia);
      if (str(q.from) || str(q.to)) {
        where.issuedDate = {
          ...(str(q.from) ? { gte: new Date(String(q.from)) } : {}),
          ...(str(q.to) ? { lte: new Date(String(q.to)) } : {}),
        };
      }
      const rows = await prisma.regulatoryBulletin.findMany({
        where,
        orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
        include: { jurisdiction: { select: { code: true, name: true } } },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  // ── Compliance rules aggregate ────────────────────────────────────────────────
  // All active machine-readable rules across jurisdictions — the drill-down behind
  // the overview "Compliance rules" card (per-state lists stay on the state detail).
  router.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.complianceRule.findMany({
        where: { companyId, active: true },
        orderBy: [{ ruleCode: 'asc' }],
        select: {
          id: true,
          ruleCode: true,
          category: true,
          description: true,
          origin: true,
          ruleJson: true,
          jurisdiction: { select: { code: true, name: true } },
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  // ── Monitored sources aggregate ───────────────────────────────────────────────
  // Every regulator source the Phase-2 pipeline watches, across jurisdictions —
  // the drill-down behind the overview "Monitored sources" card.
  router.get('/sources', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const rows = await prisma.regulatorySource.findMany({
        where: { companyId },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          url: true,
          sourceType: true,
          authority: true,
          monitor: true,
          checkTier: true,
          lastCheckedAt: true,
          healthStatus: true,
          jurisdiction: { select: { code: true, name: true } },
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });
}
