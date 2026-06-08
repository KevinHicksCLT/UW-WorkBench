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
      select: { id: true, name: true, dashboardConfig: true },
    });
    if (!active) return res.status(404).json({ error: 'No company found' });
    const companyId = active.id;

    // Most tables carry companyId directly.
    const w = { tenantId, companyId };

    const [
      divisions, departments, roles, valueStreams, domains, people,
      initiatives, risks, applications, metrics, scenarios, processSteps,
      deliverables, tasks,
      divisionGroups, empGroups, regionGroups, statusGroups,
      severityGroups, kindGroups,
      scenarioSum, tcoSum,
      topVsRaw, topDivRaw, companies,
    ] = await Promise.all([
      prisma.division.count({ where: w }),
      prisma.department.count({ where: w }),
      prisma.role.count({ where: w }),
      // Value streams rendered by the value-stream view = the L3 nodes of the Level
      // tree (Data Admin), not the legacy ValueStream table.
      prisma.level.count({ where: { ...w, levelNumber: 3 } }),
      // Domains rendered by the value-stream view = the L1 nodes of the Level tree
      // (Data Admin), not the legacy ValueStreamDomain table.
      prisma.level.count({ where: { ...w, levelNumber: 1 } }),
      prisma.person.count({ where: w }),
      // Initiatives = the strategic-portfolio model the /portfolio (Initiatives)
      // screen renders and Data Admin edits (PortfolioInitiative), NOT the
      // operating-model Initiative table.
      prisma.portfolioInitiative.count({ where: w }),
      // Risks = the operating-model Risk register (Data Admin → Change & Risk).
      // The portfolio screen's RAID items are a separate per-initiative log edited
      // via in-app grids (RaidItem has no tenantId, so it isn't a Data Admin entity).
      prisma.risk.count({ where: w }),
      prisma.application.count({ where: w }),
      prisma.metric.count({ where: w }),
      prisma.scenario.count({ where: w }),
      // Process steps rendered by the value-stream view = the L5 nodes of the Level
      // tree (Data Admin), not the legacy ProcessStep table.
      prisma.level.count({ where: { ...w, levelNumber: 5 } }),
      prisma.deliverable.count({ where: w }),
      prisma.task.count({ where: w }),
      prisma.division.groupBy({ by: ['higherCategory'], where: w, _count: { _all: true } }),
      prisma.person.groupBy({ by: ['employmentType'], where: w, _count: { _all: true } }),
      prisma.person.groupBy({ by: ['region'], where: w, _count: { _all: true } }),
      prisma.portfolioInitiative.groupBy({ by: ['status'], where: w, _count: { _all: true } }),
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

    // Portfolio status (ON_TRACK | AT_RISK | OFF_TRACK) → friendly label + RAG health.
    const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const STATUS_LABEL: [string, string][] = [['ON_TRACK', 'On track'], ['AT_RISK', 'At risk'], ['OFF_TRACK', 'Off track']];
    const STATUS_HEALTH: [string, string][] = [['Green', 'ON_TRACK'], ['Amber', 'AT_RISK'], ['Red', 'OFF_TRACK']];
    const initiativesByStatus = STATUS_LABEL.map(([s, label]) => ({ key: label, count: statusCount(s) }));
    const initiativesByHealth = STATUS_HEALTH.map(([health, s]) => ({ key: health, count: statusCount(s) }));

    res.json({
      company: { id: active.id, name: active.name, count: companies },
      // The chosen Home layout (ordered widget ids); null → the frontend default.
      layout: (active.dashboardConfig as { widgets?: string[] } | null)?.widgets ?? null,
      totals: {
        divisions, departments, roles, valueStreams, domains, people,
        initiatives, risks, applications, metrics, scenarios, processSteps,
        deliverables, tasks,
      },
      divisionsByCategory: ordered(divisionGroups, 'higherCategory', ['Core Business', 'IT', 'Corporate Function']),
      workforce: {
        byType: ordered(empGroups, 'employmentType', ['badged', 'contractor', 'si_partner']),
        byRegion: ordered(regionGroups, 'region', ['Onshore', 'Nearshore', 'Offshore']),
      },
      initiativesByStatus,
      initiativesByHealth,
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
