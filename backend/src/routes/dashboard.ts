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

// ── Transformation command center (D1) ──────────────────────────────────────
// How far through the stage-gate funnel an initiative is, as a fraction. Drives
// the rolled-up % complete on programs and the objective achievement bars.
const STAGE_PROGRESS: Record<string, number> = { IDEA: 0, PLAN: 0.25, EXECUTE: 0.55, REALIZE: 0.8, COMPLETE: 1 };
// A parent's effective health is its WORST child's (mirrors /portfolio I13).
const STATUS_SEV: Record<string, number> = { ON_TRACK: 0, AT_RISK: 1, OFF_TRACK: 2 };
const worstStatus = (statuses: string[], fallback: string) =>
  statuses.length ? statuses.reduce((a, s) => ((STATUS_SEV[s] ?? 0) > (STATUS_SEV[a] ?? 0) ? s : a), 'ON_TRACK') : fallback;

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
      statusGroups,
      severityGroups, kindGroups,
      scenarioSum, tcoSum, companies,
    ] = await Promise.all([
      prisma.node.findMany({ where: { companyId, typeKey: { not: 'io_item' } }, select: { id: true, typeKey: true, name: true, parentId: true, sortOrder: true, attributes: true } }),
      prisma.nodeLink.groupBy({ by: ['toId'], where: { companyId, relationType: 'PARTICIPATES_IN' }, _count: { _all: true } }),
      structureCounts(tenantId, companyId),
      // Initiatives = the strategic-portfolio model the /portfolio (Initiatives)
      // screen renders and Data Admin edits (PortfolioInitiative).
      prisma.portfolioInitiative.count({ where: w }),
      // Open only — the Risks tile and severity card are labeled "open risks".
      prisma.risk.count({ where: { ...w, status: 'Open' } }),
      prisma.application.count({ where: w }),
      prisma.metric.count({ where: w }),
      prisma.scenario.count({ where: w }),
      prisma.deliverable.count({ where: w }),
      prisma.task.count({ where: w }),
      prisma.portfolioInitiative.groupBy({ by: ['status'], where: w, _count: { _all: true } }),
      prisma.risk.groupBy({ by: ['severity'], where: { ...w, status: 'Open' }, _count: { _all: true } }),
      prisma.application.groupBy({ by: ['kind'], where: w, _count: { _all: true } }),
      prisma.scenario.aggregate({ where: w, _sum: { annualNetImpact: true, annualBenefit: true, annualAddedCost: true, oneTimeCost: true } }),
      prisma.application.aggregate({ where: { tenantId, companyId, illustrative: false, totalTco: { not: null } }, _sum: { totalTco: true } }),
      prisma.company.count({ where: { tenantId } }),
    ]);

    // Deeper-model counts for the (configurable) Model footprint card — data
    // that is NOT already a headline tile: the model's connective tissue.
    const [standardsCount, programsCount, objectivesCount, openRaidCount, connectionsCount, signalsCount, externalInteractionsCount] = await Promise.all([
      // Leaf standards only — decomposed group rows are containers, not standards.
      prisma.standardItem.count({ where: { ...w, children: { none: {} } } }),
      prisma.program.count({ where: w }),
      prisma.strategicObjective.count({ where: { tenantId, companyId } }),
      prisma.raidItem.count({ where: { status: 'OPEN', initiative: { companyId } } }),
      prisma.nodeLink.count({ where: { companyId } }),
      // Match the Metrics tab's Trackable Metrics catalog: live signals + DB
      // metrics + reference rows, minus non-live rows shadowed by a live one
      // (same dedupe the catalog assembly in explorer.ts applies).
      (async () => {
        const [ts, mCount] = await Promise.all([
          prisma.telemetrySignal.findMany({ where: { companyId }, select: { name: true, isLive: true } }),
          prisma.metric.count({ where: w }),
        ]);
        const liveNames = new Set(ts.filter((s) => s.isLive).map((s) => s.name.toLowerCase()));
        return mCount + ts.filter((s) => s.isLive || (s.name && !liveNames.has(s.name.toLowerCase()))).length;
      })(),
      prisma.externalInteraction.count({ where: w }),
    ]);

    const byType = (k: string) => nodes.filter((n) => n.typeKey === k);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const segments = byType('segment').sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const divisionNodes = byType('division');
    const departmentNodes = byType('department');
    // Hidden nodes (attributes.hidden) are kept in the DB but not rendered.
    const notHidden = (n: { attributes: unknown }) => (n.attributes as Record<string, unknown> | null)?.hidden !== true;
    const roleNodes = byType('role').filter(notHidden);
    const vsNodes = byType('value_stream').filter(notHidden);
    const ioCount = await prisma.node.count({ where: { companyId, typeKey: 'io_item' } });
    void ioCount; // reserved for a future tile

    // Headline counts come from the ONE shared canonical function (X1/X2).
    const { divisions, departments, roles, valueStreams, steps: processSteps } = counts;
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

    // ── Transformation command-center rollups (D1 Home widgets) ──────────────
    const [programs, topRisksRaw, openRaidRaw] = await Promise.all([
      // Programs → workstreams → initiatives (+ their milestones): one query
      // feeds both the portfolio rollup widget and the Gantt timeline.
      prisma.program.findMany({
        where: w,
        orderBy: { startDate: 'asc' },
        select: {
          id: true, name: true, status: true, startDate: true, endDate: true,
          workstreams: {
            select: {
              initiatives: {
                select: {
                  id: true, name: true, stage: true, status: true, cumulativeNetBenefit: true,
                  milestones: { select: { id: true, name: true, dueDate: true, status: true }, orderBy: { dueDate: 'asc' } },
                },
              },
            },
          },
        },
      }),
      prisma.raidItem.findMany({
        where: { type: 'RISK', status: 'OPEN', initiative: { companyId } },
        orderBy: { severity: 'desc' },
        take: 5,
        select: { id: true, title: true, severity: true, status: true, initiative: { select: { id: true, name: true } } },
      }),
      // Open RAID items with their program — feeds both the portfolio-wide
      // open counts and the per-program RAID summary widget.
      prisma.raidItem.findMany({
        where: { status: 'OPEN', initiative: { companyId } },
        select: { type: true, initiative: { select: { workstream: { select: { programId: true } } } } },
      }),
    ]);

    const raidOpen: Record<string, number> = {};
    const raidOpenByProgram = new Map<string, Record<string, number>>();
    for (const r of openRaidRaw) {
      raidOpen[r.type] = (raidOpen[r.type] ?? 0) + 1;
      const programId = r.initiative.workstream.programId;
      const counts = raidOpenByProgram.get(programId) ?? {};
      counts[r.type] = (counts[r.type] ?? 0) + 1;
      raidOpenByProgram.set(programId, counts);
    }

    const transformation = {
      programs: programs.map((p) => {
        const inits = p.workstreams.flatMap((ws) => ws.initiatives);
        return {
          id: p.id, name: p.name, status: p.status,
          computedStatus: worstStatus(inits.map((i) => i.status), p.status),
          startDate: p.startDate, endDate: p.endDate,
          pctComplete: inits.length
            ? Math.round((inits.reduce((a, i) => a + (STAGE_PROGRESS[i.stage] ?? 0), 0) / inits.length) * 100)
            : 0,
          netBenefit: inits.reduce((a, i) => a + i.cumulativeNetBenefit, 0),
          initiatives: inits.map((i) => ({
            id: i.id, name: i.name, stage: i.stage, status: i.status,
            netBenefit: i.cumulativeNetBenefit,
            pctComplete: Math.round((STAGE_PROGRESS[i.stage] ?? 0) * 100),
          })),
          milestones: inits.flatMap((i) =>
            i.milestones.map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate, status: m.status, initiativeName: i.name })),
          ),
          raidOpen: raidOpenByProgram.get(p.id) ?? {},
        };
      }),
      topRisks: topRisksRaw.map((r) => ({
        id: r.id, title: r.title, severity: r.severity, status: r.status,
        initiativeId: r.initiative.id, initiativeName: r.initiative.name,
      })),
      raidOpen,
    };

    // Portfolio status (ON_TRACK | AT_RISK | OFF_TRACK) → friendly label + RAG health.
    const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const STATUS_LABEL: [string, string][] = [['ON_TRACK', 'On track'], ['AT_RISK', 'At risk'], ['OFF_TRACK', 'Off track']];
    const STATUS_HEALTH: [string, string][] = [['Green', 'ON_TRACK'], ['Amber', 'AT_RISK'], ['Red', 'OFF_TRACK']];
    const initiativesByStatus = STATUS_LABEL.map(([s, label]) => ({ key: label, count: statusCount(s) }));
    const initiativesByHealth = STATUS_HEALTH.map(([health, s]) => ({ key: health, count: statusCount(s) }));

    // The chosen Home layout (ordered widget ids); null → the frontend default
    // (which carries the RAID log). Every company gets a RAID log on Home, so a
    // saved layout missing card:raidSummary gets it appended at read time.
    const savedWidgets = (active.dashboardConfig as { widgets?: string[] } | null)?.widgets ?? null;
    const layout = savedWidgets && !savedWidgets.includes('card:raidSummary')
      ? [...savedWidgets, 'card:raidSummary']
      : savedWidgets;

    res.json({
      company: { id: active.id, name: active.name, count: companies },
      layout,
      // Which stats the Model footprint card lists; null → the frontend default.
      footprintStats: (active.dashboardConfig as { footprintStats?: string[] } | null)?.footprintStats ?? null,
      // Per-widget custom display titles; missing ids use the catalog default.
      widgetTitles: (active.dashboardConfig as { widgetTitles?: Record<string, string> } | null)?.widgetTitles ?? null,
      totals: {
        divisions, departments, roles, valueStreams, domains,
        initiatives, risks, applications, metrics, scenarios, processSteps,
        deliverables, tasks,
        // Footprint-card extras (not headline tiles)
        subProcesses: counts.subProcesses, ioItems: counts.ioItems, externalParties: counts.externalParties,
        standards: standardsCount, programs: programsCount, objectives: objectivesCount,
        openRaid: openRaidCount, connections: connectionsCount, signals: signalsCount,
        externalInteractions: externalInteractionsCount,
      },
      divisionsByCategory,
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
      transformation,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
