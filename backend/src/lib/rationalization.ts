// Shared vocabulary + progress math for the "Evergreen" Portfolio
// Rationalization workspace. IT layers are a fixed ordered set; migration status
// is an ordered lifecycle whose weight (0..1) drives every progress rollup.

export const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'] as const;
export type Layer = (typeof LAYERS)[number];

// Ordered migration lifecycle. A kept capability ends at "Migrated"; an
// eliminated anti-pattern ends at "Retired" — both count as 100% done.
export const STATUS_WEIGHT: Record<string, number> = {
  Identified: 0,
  'In Analysis': 0.25,
  Normalized: 0.55,
  'In Migration': 0.8,
  Migrated: 1,
  Retired: 1,
};

export const statusWeight = (s: string | null | undefined): number =>
  s && s in STATUS_WEIGHT ? STATUS_WEIGHT[s] : 0;

// Mean completion (0..1) over a set of migration statuses. Empty set = 0.
export function progressOf(statuses: (string | null | undefined)[]): number {
  if (statuses.length === 0) return 0;
  const sum = statuses.reduce((a, s) => a + statusWeight(s), 0);
  return sum / statuses.length;
}

// ── v3 board roll-up math (shared by both rationalization domains) ──

export interface ColumnStat {
  sourceId: string;
  rawSteps: number;
  correct: number;
  move: number;
  deadCode: number;
}

/** Per-legacy-source column header roll-up (…12 screens · 43 correct · 17 move). */
export function columnStatsOf(
  rows: { sourceId: string; moves: boolean; dead: boolean }[],
): ColumnStat[] {
  const bySource = new Map<string, ColumnStat>();
  for (const r of rows) {
    let s = bySource.get(r.sourceId);
    if (!s) {
      s = { sourceId: r.sourceId, rawSteps: 0, correct: 0, move: 0, deadCode: 0 };
      bySource.set(r.sourceId, s);
    }
    s.rawSteps++;
    if (r.dead) s.deadCode++;
    else if (r.moves) s.move++;
    else s.correct++;
  }
  return [...bySource.values()];
}

export interface NormalizeStats {
  raw: number;
  normalized: number;
  awaitingReview: number;
}

/** Normalize column header roll-up (…102 raw steps · 58 normalized · 5 awaiting review). */
export function normalizeStatsOf(rawCount: number, entryStatuses: string[]): NormalizeStats {
  return {
    raw: rawCount,
    normalized: entryStatuses.length,
    awaitingReview: entryStatuses.filter((s) => s === 'REVIEW' || s === 'HELD').length,
  };
}

/**
 * Canonical product model status chip, computed on read from its linked
 * components' migrationStatus — never denormalized (PM-08).
 */
export function canonicalStatusOf(statuses: string[]): 'Planned' | 'Building' | 'Live' {
  if (statuses.length === 0) return 'Planned';
  if (statuses.every((s) => s === 'Migrated' || s === 'Retired')) return 'Live';
  if (statuses.some((s) => s !== 'Identified')) return 'Building';
  return 'Planned';
}

/**
 * Default non-technical explanation of a finding (WR-10). Used by the seeders
 * and the plain-summary backfill so every finding reads for a business
 * audience by default; hand-authored plainSummary always wins.
 */
export function plainSummaryFor(f: {
  name: string;
  capdan: string;
  layer: string;
  targetLayer?: string | null;
}): string {
  switch (f.capdan) {
    case 'Different':
      return `“${f.name}” works differently in each legacy system — the versions need to be reconciled into one way of working before it moves.`;
    case 'Relocate':
      return `“${f.name}” sits in the ${f.layer} layer today but really belongs in ${f.targetLayer ?? 'another layer'} — the new build moves it there.`;
    case 'Eliminate':
      return `“${f.name}” is no longer needed in the new build and will be retired rather than rebuilt.`;
    default: // Common
      return `“${f.name}” belongs in this layer and carries straight over to the new build.`;
  }
}
