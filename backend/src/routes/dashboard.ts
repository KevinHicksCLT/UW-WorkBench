import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { structureCounts } from '../lib/resolvers/index.js';

// Executive overview — one tenant-wide rollup across every part of the operating
// model. Read-only; the landing page consumes this single endpoint.
// erd_v5: structural counts come from the memoized structureCounts resolver
// (ProcessNode/OrgUnit groupBy); topValueStreams/topDivisions from NodeRole +
// OrgUnitClosure groupings — no whole-tree load, no JS tree walks.

const router = Router();
router.use(requireAuth);

type Group = { key: string; count: number };

function ordered(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], field: string, order?: string[]): Group[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set((r[field] as string | null | undefined) ?? '—', r._count._all);
  const keys = order ?? [...map.keys()];
  return keys.map((key) => ({ key, count: map.get(key) ?? 0 }));
}

// ── Transformation command center (D1) ──────────────────────────────────────
const STAGE_PROGRESS: Record<string, number> = { IDEA: 0, PLAN: 0.33, EXECUTE: 0.66, COMPLETE: 1 };
const STATUS_SEV: Record<string, number> = { ON_TRACK: 0, AT_RISK: 1, OFF_TRACK: 2 };
const worstStatus = (statuses: string[], fallback: string) =>
  statuses.length ? statuses.reduce((a, s) => ((STATUS_SEV[s] ?? 0) > (STATUS_SEV[a] ?? 0) ? s : a), 'ON_TRACK') : fallback;

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const active = await prisma.company.findFirst({
      where: requested ? { id: requested, tenantId } : { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, dashboardConfig: true },
    });
    if (!active) return res.status(404).json({ error: 'No company found' });
    const companyId = active.id;
    const w = { companyId };

    const [
      counts,
      initiatives, applications, metrics, scenarios,
      statusGroups, kindGroups,
      scenarioSum, tcoSum, companies,
      // process L1/L2 type ids for the division/value-stream groupings
      processLevelTypes, orgLevelTypes,
    ] = await Promise.all([
      structureCounts(companyId),
      prisma.portfolioInitiative.count({ where: w }),
      prisma.application.count({ where: w }),
      prisma.metric.count({ where: w }),
      prisma.scenario.count({ where: w }),
      prisma.portfolioInitiative.groupBy({ by: ['status'], where: w, _count: { _all: true } }),
      prisma.application.groupBy({ by: ['kind'], where: w, _count: { _all: true } }),
      prisma.scenario.aggregate({ where: w, _sum: { annualNetImpact: true, annualBenefit: true, annualAddedCost: true, oneTimeCost: true } }),
      prisma.application.aggregate({ where: { companyId, illustrative: false, totalTco: { not: null } }, _sum: { totalTco: true } }),
      prisma.company.count({ where: { tenantId } }),
      prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
      prisma.orgLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
    ]);

    const pL2 = processLevelTypes.find((t) => t.levelNumber === 2)?.id;
    const oL2 = orgLevelTypes.find((t) => t.levelNumber === 2)?.id;

    // Open RAID (RISK) counts + footprint extras.
    const [openRaidByType, programsCount, objectivesCount, externalInteractionsCount, signalsCount, standardsCount] = await Promise.all([
      prisma.raidItem.groupBy({ by: ['type'], where: { status: 'OPEN', initiative: { companyId } }, _count: { _all: true } }),
      prisma.program.count({ where: w }),
      prisma.strategicObjective.count({ where: { companyId } }),
      prisma.externalInteraction.count({ where: { externalParty: { companyId } } }),
      (async () => {
        const [ts, mCount] = await Promise.all([
          prisma.telemetrySignal.findMany({ where: { companyId }, select: { name: true, isLive: true } }),
          prisma.metric.count({ where: w }),
        ]);
        const liveNames = new Set(ts.filter((s) => s.isLive).map((s) => s.name.toLowerCase()));
        return mCount + ts.filter((s) => s.isLive || (s.name && !liveNames.has(s.name.toLowerCase()))).length;
      })(),
      prisma.standard.count({ where: w }),
    ]);
    const openRaidCount = openRaidByType.reduce((a, g) => a + g._count._all, 0);

    // ── Value-stream / division rollups via groupBy (no full-tree load) ───────
    const [vsNodes, divUnits, nodeRoleGroups, divisionRoleCounts] = await Promise.all([
      // value-stream (L2) nodes with their parent segment.
      pL2 ? prisma.processNode.findMany({ where: { companyId, processLevelTypeId: pL2 }, select: { id: true, displayValue: true, parent: { select: { id: true, displayValue: true } } } }) : Promise.resolve([]),
      // division (L2) org units with their parent segment.
      oL2 ? prisma.orgUnit.findMany({ where: { companyId, orgLevelTypeId: oL2 }, select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } }) : Promise.resolve([]),
      // role degree per value-stream node (Owner+Participant) — drives topValueStreams.
      prisma.nodeRole.groupBy({ by: ['processNodeId'], where: { companyId }, _count: { _all: true } }),
      // roles homed per division org unit.
      oL2 ? prisma.role.groupBy({ by: ['orgUnitId'], where: { companyId, orgUnitId: { not: null } }, _count: { _all: true } }) : Promise.resolve([]),
    ]);

    // Roles homed under each value-stream node come from NodeRole at L2 nodes only.
    const vsRoleDegree = new Map(nodeRoleGroups.map((g) => [g.processNodeId, g._count._all]));
    const topValueStreams = vsNodes
      .map((v) => ({ id: v.id, name: v.displayValue, domain: v.parent?.displayValue ?? null, roles: vsRoleDegree.get(v.id) ?? 0 }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 8);

    // divisionsByCategory — divisions grouped by their parent segment.
    const divByCat = new Map<string, number>();
    for (const d of divUnits) {
      const seg = d.parent?.displayValue ?? '—';
      divByCat.set(seg, (divByCat.get(seg) ?? 0) + 1);
    }
    const divisionsByCategory = [...divByCat.entries()].map(([key, count]) => ({ key, count }));

    // topDivisions — by role count (roles homed at the division org unit).
    const rolesPerUnit = new Map(divisionRoleCounts.map((g) => [g.orgUnitId, g._count._all]));
    const topDivisions = divUnits
      .map((d) => ({ id: d.id, name: d.displayValue, higherCategory: d.parent?.displayValue ?? null, roles: rolesPerUnit.get(d.id) ?? 0 }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 8);

    // ── Transformation command-center rollups (D1 Home widgets) ──────────────
    const [programs, topRisksRaw, openRaidRaw] = await Promise.all([
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
                  costs: { select: { values: { select: { dataset: true, amount: true } } } },
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
      prisma.raidItem.findMany({
        where: { status: 'OPEN', initiative: { companyId } },
        select: { type: true, createdAt: true, initiative: { select: { workstream: { select: { programId: true } } } } },
      }),
    ]);

    // "New" = open RAID raised in the last 24 hours (FB-31).
    const NEW_THRESHOLD = Date.now() - 86400000;
    const raidOpen: Record<string, number> = {};
    const raidNew: Record<string, number> = {};
    const raidOpenByProgram = new Map<string, Record<string, number>>();
    const raidNewByProgram = new Map<string, Record<string, number>>();
    for (const r of openRaidRaw) {
      const isNew = r.createdAt.getTime() >= NEW_THRESHOLD;
      const programId = r.initiative.workstream.programId;
      raidOpen[r.type] = (raidOpen[r.type] ?? 0) + 1;
      const c = raidOpenByProgram.get(programId) ?? {};
      c[r.type] = (c[r.type] ?? 0) + 1;
      raidOpenByProgram.set(programId, c);
      if (isNew) {
        raidNew[r.type] = (raidNew[r.type] ?? 0) + 1;
        const n = raidNewByProgram.get(programId) ?? {};
        n[r.type] = (n[r.type] ?? 0) + 1;
        raidNewByProgram.set(programId, n);
      }
    }

    // Cost spend by dataset for one initiative (budget = TARGET, forecast =
    // FORECAST, actual spend-to-date = ACTUAL) — FB-03 program-card metrics.
    const costSpend = (i: (typeof programs)[number]['workstreams'][number]['initiatives'][number]) => {
      const sum = (ds: string) =>
        i.costs.reduce((a, l) => a + l.values.filter((v) => v.dataset === ds).reduce((x, v) => x + v.amount, 0), 0);
      return { budget: sum('TARGET'), forecastSpend: sum('FORECAST'), actualSpend: sum('ACTUAL') };
    };

    const transformation = {
      programs: programs.map((p) => {
        const inits = p.workstreams.flatMap((ws) => ws.initiatives);
        const spend = inits.map(costSpend);
        return {
          id: p.id, name: p.name, status: p.status,
          computedStatus: worstStatus(inits.map((i) => i.status), p.status),
          startDate: p.startDate, endDate: p.endDate,
          pctComplete: inits.length
            ? Math.round((inits.reduce((a, i) => a + (STAGE_PROGRESS[i.stage] ?? 0), 0) / inits.length) * 100)
            : 0,
          netBenefit: inits.reduce((a, i) => a + i.cumulativeNetBenefit, 0),
          budget: spend.reduce((a, s) => a + s.budget, 0),
          forecastSpend: spend.reduce((a, s) => a + s.forecastSpend, 0),
          actualSpend: spend.reduce((a, s) => a + s.actualSpend, 0),
          initiatives: inits.map((i) => ({
            id: i.id, name: i.name, stage: i.stage, status: i.status,
            netBenefit: i.cumulativeNetBenefit,
            ...costSpend(i),
            pctComplete: Math.round((STAGE_PROGRESS[i.stage] ?? 0) * 100),
          })),
          milestones: inits.flatMap((i) =>
            i.milestones.map((m) => ({ id: m.id, name: m.name, dueDate: m.dueDate, status: m.status, initiativeName: i.name })),
          ),
          raidOpen: raidOpenByProgram.get(p.id) ?? {},
          raidNew: raidNewByProgram.get(p.id) ?? {},
        };
      }),
      topRisks: topRisksRaw.map((r) => ({
        id: r.id, title: r.title, severity: r.severity, status: r.status,
        initiativeId: r.initiative.id, initiativeName: r.initiative.name,
      })),
      raidOpen,
      raidNew,
    };

    // Portfolio status → friendly label + RAG health.
    const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const STATUS_LABEL: [string, string][] = [['ON_TRACK', 'On track'], ['AT_RISK', 'At risk'], ['OFF_TRACK', 'Off track']];
    const STATUS_HEALTH: [string, string][] = [['Green', 'ON_TRACK'], ['Amber', 'AT_RISK'], ['Red', 'OFF_TRACK']];
    const initiativesByStatus = STATUS_LABEL.map(([s, label]) => ({ key: label, count: statusCount(s) }));
    const initiativesByHealth = STATUS_HEALTH.map(([health, s]) => ({ key: health, count: statusCount(s) }));

    const savedWidgets = (active.dashboardConfig as { widgets?: string[] } | null)?.widgets ?? null;
    const layout = savedWidgets && !savedWidgets.includes('card:raidSummary')
      ? [...savedWidgets, 'card:raidSummary']
      : savedWidgets;

    const { divisions, departments, roles, valueStreams, steps, domains, subProcesses, deliverables } = counts;

    res.json({
      company: { id: active.id, name: active.name, count: companies },
      layout,
      footprintStats: (active.dashboardConfig as { footprintStats?: string[] } | null)?.footprintStats ?? null,
      widgetTitles: (active.dashboardConfig as { widgetTitles?: Record<string, string> } | null)?.widgetTitles ?? null,
      totals: {
        divisions, departments, roles, valueStreams, domains,
        initiatives, risks: openRaidByType.find((g) => g.type === 'RISK')?._count._all ?? 0,
        applications, metrics, scenarios, processSteps: steps,
        // Each L5 task carries ~one deliverable; deliverables and tasks both = steps grain.
        deliverables, tasks: steps,
        subProcesses, ioItems: counts.ioItems, externalParties: counts.externalParties,
        standards: standardsCount, programs: programsCount, objectives: objectivesCount,
        openRaid: openRaidCount, connections: 0, signals: signalsCount,
        externalInteractions: externalInteractionsCount,
      },
      divisionsByCategory,
      initiativesByStatus,
      initiativesByHealth,
      risksBySeverity: [], // legacy Risk severity model dropped; RAID severity is numeric
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
  } catch (e) { next(e); }
});

export default router;
