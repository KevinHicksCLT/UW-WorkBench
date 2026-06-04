import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

// Executive overview — one tenant-wide rollup across every part of the operating
// model. Read-only; the landing page consumes this single endpoint. Every table
// carries `tenantId`, so scoping is a direct filter on each query.

const router = Router();
router.use(requireAuth);

type Group = { key: string; count: number };

// Normalize a Prisma groupBy result into ordered { key, count } rows, filling
// any missing keys from `order` with 0 so charts render a stable set of bars.
function ordered(rows: { _count: { _all: number } }[], field: string, order?: string[]): Group[] {
  const map = new Map<string, number>();
  for (const r of rows as any[]) map.set(r[field] ?? '—', r._count._all);
  const keys = order ?? [...map.keys()];
  return keys.map((key) => ({ key, count: map.get(key) ?? 0 }));
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    // Scope the whole overview to one company. When omitted, fall back to the
    // tenant's first company so the landing page always has a company in view.
    const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const active = await prisma.company.findFirst({
      where: requested ? { id: requested, tenantId } : { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (!active) return res.status(404).json({ error: 'No company found' });
    const companyId = active.id;

    // Most tables carry companyId directly; processStep reaches it via valueStream.
    const w = { tenantId, companyId };
    const wVs = { valueStream: { companyId } };

    const [
      divisions, departments, roles, valueStreams, domains, people,
      initiatives, risks, applications, metrics, scenarios, processSteps,
      divisionGroups, empGroups, regionGroups, statusGroups, healthGroups,
      severityGroups, kindGroups, scenarioSum, tcoSum,
      topVsRaw, topDivRaw, companies,
    ] = await Promise.all([
      prisma.division.count({ where: w }),
      prisma.department.count({ where: w }),
      prisma.role.count({ where: w }),
      prisma.valueStream.count({ where: w }),
      prisma.valueStreamDomain.count({ where: w }),
      prisma.person.count({ where: w }),
      prisma.initiative.count({ where: w }),
      prisma.risk.count({ where: w }),
      prisma.application.count({ where: w }),
      prisma.metric.count({ where: w }),
      prisma.scenario.count({ where: w }),
      prisma.processStep.count({ where: wVs }),
      prisma.division.groupBy({ by: ['higherCategory'], where: w, _count: { _all: true } }),
      prisma.person.groupBy({ by: ['employmentType'], where: w, _count: { _all: true } }),
      prisma.person.groupBy({ by: ['region'], where: w, _count: { _all: true } }),
      prisma.initiative.groupBy({ by: ['status'], where: w, _count: { _all: true } }),
      prisma.initiative.groupBy({ by: ['health'], where: w, _count: { _all: true } }),
      prisma.risk.groupBy({ by: ['severity'], where: w, _count: { _all: true } }),
      prisma.application.groupBy({ by: ['kind'], where: w, _count: { _all: true } }),
      prisma.scenario.aggregate({ where: w, _sum: { annualNetImpact: true, annualBenefit: true, annualAddedCost: true, oneTimeCost: true } }),
      prisma.application.aggregate({ where: { tenantId, companyId, illustrative: false, totalTco: { not: null } }, _sum: { totalTco: true } }),
      prisma.valueStream.findMany({ where: w, select: { id: true, name: true, domain: true, _count: { select: { roleLinks: true } } } }),
      prisma.division.findMany({ where: w, select: { id: true, name: true, higherCategory: true, _count: { select: { roles: true } } } }),
      prisma.company.count({ where: { tenantId } }),
    ]);

    const topValueStreams = topVsRaw
      .map((v) => ({ id: v.id, name: v.name, domain: v.domain, roles: v._count.roleLinks }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 8);

    const topDivisions = topDivRaw
      .map((d) => ({ id: d.id, name: d.name, higherCategory: d.higherCategory, roles: d._count.roles }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 8);

    res.json({
      company: { id: active.id, name: active.name, count: companies },
      totals: {
        divisions, departments, roles, valueStreams, domains, people,
        initiatives, risks, applications, metrics, scenarios, processSteps,
      },
      divisionsByCategory: ordered(divisionGroups, 'higherCategory', ['Core Business', 'IT', 'Corporate Function']),
      workforce: {
        byType: ordered(empGroups, 'employmentType', ['badged', 'contractor', 'si_partner']),
        byRegion: ordered(regionGroups, 'region', ['Onshore', 'Nearshore', 'Offshore']),
      },
      initiativesByStatus: ordered(statusGroups, 'status'),
      initiativesByHealth: ordered(healthGroups, 'health', ['Green', 'Amber', 'Red']),
      risksBySeverity: ordered(severityGroups, 'severity', ['Critical', 'High', 'Medium', 'Low']),
      applicationsByKind: ordered(kindGroups, 'kind'),
      financials: {
        annualNetImpact: scenarioSum._sum.annualNetImpact ?? 0,
        annualBenefit: scenarioSum._sum.annualBenefit ?? 0,
        annualAddedCost: scenarioSum._sum.annualAddedCost ?? 0,
        oneTimeCost: scenarioSum._sum.oneTimeCost ?? 0,
        appRunCost: tcoSum._sum.totalTco ?? 0,
      },
      topValueStreams,
      topDivisions,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
