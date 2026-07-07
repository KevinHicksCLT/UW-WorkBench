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
