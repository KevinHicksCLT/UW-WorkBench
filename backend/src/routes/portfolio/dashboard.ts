/**
 * Portfolio dashboard reads — link options, risk bands, and the rollup dashboard.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId } from './helpers.js';

/** Registers this feature's routes on the shared /portfolio router (order preserved). */
export function registerDashboardRoutes(router: Router): void {
router.get('/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    // Value streams = ProcessNode at level 2; divisions = OrgUnit at level 2; roles
    // = Role. Each spine entity's editable displayValue is exposed as `name` to
    // keep the dropdown option shape ({ id, name }) the frontend consumes.
    const [vsNodes, orgUnits, roles] = await Promise.all([
      prisma.processNode.findMany({ where: { companyId, processLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.orgUnit.findMany({ where: { companyId, orgLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
    ]);
    const toOpt = (rows: { id: string; displayValue: string }[]) => rows.map((r) => ({ id: r.id, name: r.displayValue }));
    res.json({ valueStreams: toOpt(vsNodes), divisions: toOpt(orgUnits), roles: toOpt(roles) });
  } catch (e) { next(e); }
});

// ─── Risk scoring bands ──────────────────────────────────────────────────────
// How a 5×5 probability×impact score (1–25) reads as a rating. Company-scoped
// data (Data Admin → Initiatives → Risk scoring bands), consumed by every
// severity cell in the tracker.
router.get('/risk-bands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const bands = await prisma.riskScoringBand.findMany({
      where: { companyId },
      orderBy: { minScore: 'asc' },
      select: { id: true, label: true, minScore: true, maxScore: true, color: true, description: true },
    });
    res.json({ bands });
  } catch (e) { next(e); }
});

// ─── Portfolio dashboard ───────────────────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const tenantId = req.tenantId;

    const initiatives = await prisma.portfolioInitiative.findMany({ where: { tenantId, companyId } });

    const totals = initiatives.reduce(
      (a, i) => ({
        benefit: a.benefit + i.cumulativeBenefit,
        cost: a.cost + i.cumulativeCost,
        net: a.net + i.cumulativeNetBenefit,
      }),
      { benefit: 0, cost: 0, net: 0 },
    );

    const tally = (key: 'stage' | 'status') =>
      initiatives.reduce<Record<string, number>>((acc, i) => {
        acc[i[key]] = (acc[i[key]] || 0) + 1;
        return acc;
      }, {});

    // Monthly Actual/Target/Forecast across all benefit lines in this company.
    const benefitValues = await prisma.metricValue.findMany({
      where: { benefitLine: { initiative: { companyId } } },
      select: { dataset: true, periodStart: true, amount: true },
    });
    const monthly: Record<string, { period: string; ACTUAL: number; TARGET: number; FORECAST: number }> = {};
    for (const v of benefitValues) {
      const key = v.periodStart.toISOString().slice(0, 7);
      if (!monthly[key]) monthly[key] = { period: key, ACTUAL: 0, TARGET: 0, FORECAST: 0 };
      monthly[key][v.dataset as 'ACTUAL' | 'TARGET' | 'FORECAST'] += v.amount;
    }
    const monthlyBenefits = Object.values(monthly).sort((a, b) => a.period.localeCompare(b.period));

    const topRisksRaw = await prisma.raidItem.findMany({
      where: { type: 'RISK', status: 'OPEN', initiative: { companyId } },
      include: { initiative: { select: { id: true, name: true } } },
      orderBy: { severity: 'desc' },
      take: 5,
    });

    const [programCount, raidOpenGroups] = await Promise.all([
      prisma.program.count({ where: { tenantId, companyId } }),
      prisma.raidItem.groupBy({ by: ['type'], where: { status: 'OPEN', initiative: { companyId } }, _count: { _all: true } }),
    ]);
    const raidOpen = Object.fromEntries(raidOpenGroups.map((g) => [g.type, g._count._all]));

    res.json({
      totals,
      counts: { programs: programCount, initiatives: initiatives.length },
      byStage: tally('stage'),
      byStatus: tally('status'),
      raidOpen,
      monthlyBenefits,
      topRisks: topRisksRaw,
    });
  } catch (e) { next(e); }
});

// ─── Programs ──────────────────────────────────────────────────────────────
}
