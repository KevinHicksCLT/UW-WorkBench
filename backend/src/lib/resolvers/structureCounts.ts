// structureCounts — THE canonical structural-count function for erd_v5. Every
// screen that shows a "value streams / roles / steps / divisions" headline figure
// reads this, so one entity has exactly one count app-wide.
//
// Fixed level semantics (decided — do not change):
//   ProcessNode tree (processLevelType.levelNumber):
//     L1 = Segment   → UI "domain"          (3 rows)
//     L2 = Division  → UI "value stream"     (17 rows)
//     L3 = Process area (L3)
//     L4 = Sub-process (L4)
//     L5 = Task (isTask=true)                (3811 rows) → UI "steps"
//   OrgUnit tree (orgLevelType.levelNumber):
//     L1 = Segment, L2 = Division, L3 = Department (restored from develop).
//
// Implementation: ONE processNode.groupBy + ONE orgUnit.groupBy, plus small
// scalar counts. Memoized per companyId with a short in-process TTL.
import { prisma } from '../../db/prisma.js';

export interface StructureCounts {
  // ── Back-compat keys (same shape the old lib/orgCounts.ts returned) ──
  segments: number; // = process L1 (UI "domains")
  divisions: number; // = OrgUnit L2 divisions
  departments: number; // = OrgUnit L3 (Department tier, restored from develop)
  roles: number;
  valueStreams: number; // = process L2
  subProcesses: number; // = process L4
  steps: number; // = process L5 tasks
  ioItems: number; // legacy tile — deliverables stand in (1/task)
  externalParties: number;
  // ── New keys for the reworked dashboard/explorer ──
  domains: number; // alias of segments (process L1)
  processAreas: number; // = process L3
  applications: number;
  initiatives: number; // PortfolioInitiative count
  programs: number;
  standards: number;
  deliverables: number;
  metrics: number;
  scenarios: number;
}

type CacheEntry = { value: StructureCounts; at: number };
const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/** Drop a memoized count (call after any write that changes structural cardinality). */
export function invalidateStructureCounts(companyId?: string): void {
  if (companyId) cache.delete(companyId);
  else cache.clear();
}

export async function structureCounts(companyId: string): Promise<StructureCounts> {
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [
    processGroups,
    orgGroups,
    processLevelTypes,
    orgLevelTypes,
    roles,
    applications,
    initiatives,
    programs,
    standards,
    deliverables,
    metrics,
    scenarios,
    externalParties,
  ] = await Promise.all([
    prisma.processNode.groupBy({ by: ['processLevelTypeId'], where: { companyId }, _count: { _all: true } }),
    prisma.orgUnit.groupBy({ by: ['orgLevelTypeId'], where: { companyId }, _count: { _all: true } }),
    prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
    prisma.orgLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
    prisma.role.count({ where: { companyId } }),
    prisma.application.count({ where: { companyId } }),
    prisma.portfolioInitiative.count({ where: { companyId } }),
    prisma.program.count({ where: { companyId } }),
    prisma.standard.count({ where: { companyId } }),
    prisma.deliverable.count({ where: { companyId } }),
    prisma.metric.count({ where: { companyId } }),
    prisma.scenario.count({ where: { companyId } }),
    prisma.externalParty.count({ where: { companyId } }),
  ]);

  // level-type id → levelNumber, then sum the groupBy counts per level.
  const pLevelOf = new Map(processLevelTypes.map((t) => [t.id, t.levelNumber] as const));
  const oLevelOf = new Map(orgLevelTypes.map((t) => [t.id, t.levelNumber] as const));
  const pByLevel = new Map<number, number>();
  for (const g of processGroups) {
    const lvl = pLevelOf.get(g.processLevelTypeId);
    if (lvl != null) pByLevel.set(lvl, (pByLevel.get(lvl) ?? 0) + g._count._all);
  }
  const oByLevel = new Map<number, number>();
  for (const g of orgGroups) {
    const lvl = oLevelOf.get(g.orgLevelTypeId);
    if (lvl != null) oByLevel.set(lvl, (oByLevel.get(lvl) ?? 0) + g._count._all);
  }

  const segments = pByLevel.get(1) ?? 0;
  const valueStreams = pByLevel.get(2) ?? 0;
  const processAreas = pByLevel.get(3) ?? 0;
  const subProcesses = pByLevel.get(4) ?? 0;
  const steps = pByLevel.get(5) ?? 0;

  const value: StructureCounts = {
    segments,
    domains: segments,
    valueStreams,
    processAreas,
    subProcesses,
    steps,
    divisions: oByLevel.get(2) ?? 0,
    departments: oByLevel.get(3) ?? 0, // OrgUnit L3 (Department tier)
    roles,
    applications,
    initiatives,
    programs,
    standards,
    deliverables,
    // Deliverables are ~1/task and stand in for the dropped IoItem tile.
    ioItems: deliverables,
    metrics,
    scenarios,
    externalParties,
  };

  cache.set(companyId, { value, at: Date.now() });
  return value;
}
