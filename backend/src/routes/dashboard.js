import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Portfolio-wide executive snapshot:
 *   - Counts by stage / status
 *   - Total benefits / costs / net benefit
 *   - Monthly time series of actual vs target benefits
 *   - Top RAID items by severity
 */
router.get('/portfolio', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const initiatives = await prisma.initiative.findMany({
      where: { workstream: { program: { tenantId } } },
    });

    const totals = initiatives.reduce(
      (a, i) => ({
        benefit: a.benefit + i.cumulativeBenefit,
        cost: a.cost + i.cumulativeCost,
        net: a.net + i.cumulativeNetBenefit,
      }),
      { benefit: 0, cost: 0, net: 0 }
    );

    const byStage = initiatives.reduce((acc, i) => {
      acc[i.stage] = (acc[i.stage] || 0) + 1;
      return acc;
    }, {});
    const byStatus = initiatives.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {});

    // Monthly Actual vs Target across all benefits
    const benefitValues = await prisma.metricValue.findMany({
      where: {
        benefitLine: { initiative: { workstream: { program: { tenantId } } } },
      },
    });
    const monthly = {};
    for (const v of benefitValues) {
      const key = v.periodStart.toISOString().slice(0, 7); // YYYY-MM
      if (!monthly[key]) monthly[key] = { period: key, ACTUAL: 0, TARGET: 0, FORECAST: 0 };
      monthly[key][v.dataset] = (monthly[key][v.dataset] || 0) + v.amount;
    }
    const monthlyArray = Object.values(monthly).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    const topRisks = await prisma.raidItem.findMany({
      where: {
        type: 'RISK',
        status: 'OPEN',
        initiative: { workstream: { program: { tenantId } } },
      },
      include: { initiative: { select: { id: true, name: true } } },
      orderBy: { severity: 'desc' },
      take: 5,
    });

    const programCount = await prisma.program.count({ where: { tenantId } });
    const initiativeCount = initiatives.length;

    res.json({
      totals,
      counts: {
        programs: programCount,
        initiatives: initiativeCount,
      },
      byStage,
      byStatus,
      monthlyBenefits: monthlyArray,
      topRisks,
    });
  } catch (e) { next(e); }
});

export default router;
