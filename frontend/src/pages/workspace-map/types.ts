// Response shapes for the /rationalization board API (backend
// routes/rationalization/boards.ts). The Workspace map renders these verbatim —
// it never hard-codes application or finding text, so any seeded board
// (FNOL/ClaimsLegacy demo, or the Transformation Bridge self-anatomy) draws the
// same way. Fields the map doesn't read are omitted.

export const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'] as const;
export type Layer = (typeof LAYERS)[number];

/** One row in the board list (GET /rationalization). */
export interface BoardSummary {
  id: string;
  name: string;
  application: string;
  applicationId: string | null;
  businessProcess: string | null;
  status: string;
  domain: string;
  findings: number;
  byCapdan: Record<string, number>;
  progress: number;
}

export interface ColumnStat {
  sourceId: string;
  rawSteps: number;
  correct: number;
  move: number;
  deadCode: number;
}

export interface NormalizeStats {
  raw: number;
  normalized: number;
  awaitingReview: number;
}

export interface LayerRollup {
  layer: Layer;
  findings: number;
  progress: number;
  byCapdan: Record<string, number>;
  relocateOut: number;
}

export interface BoardApp {
  id: string;
  name: string;
  kind: string; // LEGACY | SHARED_SERVICE
  techStack: string | null;
  disposition: string | null;
  position: number;
}

export interface BoardComponent {
  id: string;
  layer: Layer;
  name: string;
  destination: string | null;
  microserviceId: string | null;
  migrationStatus: string;
  targetDate: string | null;
}

export interface BoardMicroservice {
  id: string;
  name: string;
  kind: string;
  status: string; // Planned | Building | Live
  techStack: string | null;
  ownerRole: string | null;
  targetDate: string | null;
}

export interface BoardScreen {
  id: string;
  appId: string;
  name: string;
  kind: string;
  url: string | null;
  processNodeId: string | null;
}

/** One normalized item (#N-101 …) — the middle T-chart cards. */
export interface NormalizationEntry {
  id: string;
  layer: Layer;
  notation: string | null;
  name: string;
  matchStatus: string; // AUTO | REVIEW | HELD
  matchBasis: string | null;
  differenceNote: string | null;
  proposedResolution: string | null;
  sourceCards: unknown;
  componentId: string | null;
  findingIds: string[];
}

/** One decomposed step of a legacy app, in one IT layer. */
export interface Finding {
  id: string;
  appId: string;
  layer: Layer;
  category: string | null;
  view: string | null;
  screenRef: string | null;
  plainSummary: string | null;
  recommendedLayer: string | null;
  capdan: string; // Common | Different | Relocate | Eliminate | Add
  targetLayer: string | null;
  sharedServiceId: string | null;
  name: string;
  codeRef: string | null;
  migrationApproach: string | null;
  rationale: string | null;
  effort: string | null;
  complexity: string | null;
  migrationStatus: string;
  deadCode: boolean;
  normalizationEntryId: string | null;
  whyThisMoves: {
    captured?: string;
    sent?: string;
    processed?: string;
    validation?: string;
    location?: string;
    landsIn?: string;
  } | null;
}

export interface BoardDetail {
  id: string;
  name: string;
  application: string;
  businessProcess: string | null;
  description: string | null;
  status: string;
  domain: string;
  progress: number;
  counts: { findings: number } & Record<string, number>;
  byLayer: LayerRollup[];
  columnStats: ColumnStat[];
  normalizeStats: NormalizeStats;
  normalizationEntries: NormalizationEntry[];
  apps: BoardApp[];
  components: BoardComponent[];
  microservices: BoardMicroservice[];
  screens: BoardScreen[];
  findings: Finding[];
}

/** Short, locale-stable date label for a target date (e.g. "Jul 1, 2026"). */
export function formatTargetDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Format in UTC so a date-only target (stored at UTC midnight) never shifts a
  // day backward for viewers west of UTC.
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A CAPDAN capdan is "correct/stays" only when it's Common and not dead code. */
export function findingMoves(f: Finding): boolean {
  return (
    f.deadCode || f.capdan === 'Relocate' || f.capdan === 'Eliminate' || f.capdan === 'Different'
  );
}

/**
 * Per-layer accent — deliberately neutral (one slate tone for every layer) so
 * colour is reserved for semantics: green = stays/same, red = moves, amber =
 * needs review, indigo = the normalized model.
 */
const NEUTRAL = { line: '#64748b', bg: '#f8fafc', border: '#e2e8f0', soft: '#f8fafc' };
export const LAYER_ACCENT: Record<
  Layer,
  { line: string; bg: string; border: string; soft: string }
> = {
  UI: NEUTRAL,
  Integration: NEUTRAL,
  'Business Service': NEUTRAL,
  Data: NEUTRAL,
  Infrastructure: NEUTRAL,
};

// Fit-to-frame never scales below this zoom — card text stays legible; a board
// too big to fit at this scale scrolls instead of shrinking further.
export const READABLE_FIT_MIN = 0.65;

export const GREEN = '#16a34a';
export const RED = '#dc2626';
export const AMBER = '#b45309';
export const INDIGO = '#4f46e5';

/** Migration lifecycle weight (mirrors backend lib/rationalization STATUS_WEIGHT). */
export const STATUS_WEIGHT: Record<string, number> = {
  Identified: 0,
  'In Analysis': 0.25,
  Normalized: 0.55,
  'In Migration': 0.8,
  Migrated: 1,
  Retired: 1,
};
