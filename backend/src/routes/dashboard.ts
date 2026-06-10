import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { structureCounts } from '../lib/orgCounts.js';

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

    // Structural counts/groupings read the unified Node tree (operating-model
    // rework): segments/divisions/departments/roles + value streams/steps are all
    // typed nodes; the segment grouping comes from the tree, not a string column.
    const [
      nodes, partLinks, counts,
      initiatives, risks, applications, metrics, scenarios,
      deliverables, tasks,
      empGroups, regionGroups, statusGroups,
      severityGroups, kindGroups,
      scenarioSum, tcoSum, companies,
    ] = await Promise.all([
      prisma.node.findMany({ where: { companyId, typeKey: { not: 'io_item' } }, select: { id: true, typeKey: true, name: true, parentId: true, sortOrder: true } }),
      prisma.nodeLink.groupBy({ by: ['toId'], where: { companyId, relationType: 'PARTICIPATES_IN' }, _count: { _all: true } }),
      structureCounts(tenantId, companyId),
      // Initiatives = the strategic-portfolio model the /portfolio (Initiatives)
      // screen renders and Data Admin edits (PortfolioInitiative).
      prisma.portfolioInitiative.count({ where: w }),
      prisma.risk.count({ where: w }),
      prisma.application.count({ where: w }),
      prisma.metric.count({ where: w }),
      prisma.scenario.count({ where: w }),
      prisma.deliverable.count({ where: w }),
      prisma.task.count({ where: w }),
      prisma.person.groupBy({ by: ['employmentType'], where: w, _count: { _all: true } }),
      prisma.person.groupBy({ by: ['region'], where: w, _count: { _all: true } }),
      prisma.portfolioInitiative.groupBy({ by: ['status'], where: w, _count: { _all: true } }),
      prisma.risk.groupBy({ by: ['severity'], where: w, _count: { _all: true } }),
      prisma.application.groupBy({ by: ['kind'], where: w, _count: { _all: true } }),
      prisma.scenario.aggregate({ where: w, _sum: { annualNetImpact: true, annualBenefit: true, annualAddedCost: true, oneTimeCost: true } }),
      prisma.application.aggregate({ where: { tenantId, companyId, illustrative: false, totalTco: { not: null } }, _sum: { totalTco: true } }),
      prisma.company.count({ where: { tenantId } }),
    ]);

    const byType = (k: string) => nodes.filter((n) => n.typeKey === k);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const segments = byType('segment').sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const divisionNodes = byType('division');
    const departmentNodes = byType('department');
    const roleNodes = byType('role');
    const vsNodes = byType('value_stream');
    const ioCount = await prisma.node.count({ where: { companyId, typeKey: 'io_item' } });
    void ioCount; // reserved for a future tile

    // Headline counts come from the ONE shared canonical function (X1/X2).
    const { divisions, departments, roles, valueStreams, steps: processSteps, people } = counts;
    const domains = counts.segments;

    // Divisions grouped by their parent Segment node (the ONE shared grouping).
    const segName = (n: { parentId: string | null }) => (n.parentId ? nodeById.get(n.parentId)?.name ?? '—' : '—');
    const divisionsByCategory = segments.map((s) => ({
      key: s.name,
      count: divisionNodes.filter((d) => d.parentId === s.id).length,
    }));

    // Role count per division: role → department → division, or role → division.
    const rolesPerDivision = new Map<string, number>();
    for (const r of roleNodes) {
      const p = r.parentId ? nodeById.get(r.parentId) : null;
      const divId = p?.typeKey === 'division' ? p.id : p?.parentId && nodeById.get(p.parentId)?.typeKey === 'division' ? p.parentId : null;
      if (divId) rolesPerDivision.set(divId, (rolesPerDivision.get(divId) ?? 0) + 1);
    }

    const partCount = new Map(partLinks.map((l) => [l.toId, l._count._all]));
    const topValueStreams = vsNodes
      .map((v) => ({ id: v.id, name: v.name, domain: v.parentId ? nodeById.get(v.parentId)?.name ?? null : null, roles: partCount.get(v.id) ?? 0 }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 8);

    const topDivisions = divisionNodes
      .map((d) => ({ id: d.id, name: d.name, higherCategory: segName(d), roles: rolesPerDivision.get(d.id) ?? 0 }))
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
      // Which stats the Model footprint card lists; null → the frontend default.
      footprintStats: (active.dashboardConfig as { footprintStats?: string[] } | null)?.footprintStats ?? null,
      totals: {
        divisions, departments, roles, valueStreams, domains, people,
        initiatives, risks, applications, metrics, scenarios, processSteps,
        deliverables, tasks,
      },
      divisionsByCategory,
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
