/**
 * Regulations auxiliary feeds — the jurisdiction/system integrations matrix,
 * the regulatory bulletins feed, and the cross-jurisdiction compliance-rule /
 * monitored-source aggregates behind the drillable overview cards.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId, str, list, lensRegulatorTypes } from './helpers.js';

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
      const ruleTypes = lensRegulatorTypes(req.query.lens);
      const rows = await prisma.complianceRule.findMany({
        where: {
          companyId,
          active: true,
          ...(ruleTypes ? { jurisdiction: { regulatorType: { in: ruleTypes } } } : {}),
        },
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
      const srcTypes = lensRegulatorTypes(req.query.lens);
      const rows = await prisma.regulatorySource.findMany({
        where: {
          companyId,
          ...(srcTypes ? { jurisdiction: { regulatorType: { in: srcTypes } } } : {}),
        },
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

  // ── Process options tree ──────────────────────────────────────────────────────
  // L2 value streams with their L3 areas and L4 sub-processes — the option tree
  // behind the requirement link editor, which can attach a requirement at any of
  // those grains (the write materializes to the tasks under the chosen node).
  router.get('/process-options', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const nodes = await prisma.processNode.findMany({
        where: { companyId, processLevelType: { levelNumber: { in: [2, 3, 4] } } },
        select: {
          id: true,
          displayValue: true,
          parentId: true,
          processLevelType: { select: { levelNumber: true } },
        },
        orderBy: { displayValue: 'asc' },
      });
      type Opt = { id: string; name: string; children: Opt[] };
      const byId = new Map<string, Opt>(
        nodes.map((n) => [n.id, { id: n.id, name: n.displayValue, children: [] }]),
      );
      const roots: Opt[] = [];
      for (const n of nodes) {
        const opt = byId.get(n.id)!;
        if (n.processLevelType.levelNumber === 2) roots.push(opt);
        else if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.children.push(opt);
      }
      res.json(roots);
    } catch (e) {
      next(e);
    }
  });
}
