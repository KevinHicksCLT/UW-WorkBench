/**
 * Vocabulary-derived lookups for the workspace boards (3-A). All vocabulary —
 * the row axis, classification chips, lifecycle statuses, lens modes, anatomy
 * views, match statuses and the legend — comes from
 * `GET /rationalization/vocabulary` rows (seeded per the frozen §6.4
 * contract); nothing here hardcodes vocabulary arrays. The only
 * presentation-side data is the color palette that maps a vocabulary row's
 * `color` token to chip classes / dot hexes.
 */
import type { Classification, Layer, VocabularyRow } from './types';

// ── Presentation palette ────────────────────────────────────────────────────
// Maps a vocabulary row's `color` token (e.g. "emerald", "tan") to chip
// classes and a solid dot hex. Presentation defaults live with the data
// (the DB stores the token); the pixel values live here, like cellGeometry.

export type ColorMeta = { chip: string; dot: string };

const NEUTRAL: ColorMeta = { chip: 'bg-[#fafafa] text-[#525252] border-[#e5e5e5]', dot: '#d4d4d4' };
const PALETTE: Record<string, ColorMeta> = {
  emerald: { chip: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]', dot: '#10b981' },
  blue: { chip: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]', dot: '#2563eb' },
  sky: { chip: 'bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]', dot: '#0ea5e9' },
  indigo: { chip: 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]', dot: '#6366f1' },
  violet: { chip: 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]', dot: '#7c3aed' },
  rose: { chip: 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]', dot: '#e11d48' },
  amber: { chip: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]', dot: '#f59e0b' },
  teal: { chip: 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]', dot: '#14b8a6' },
  slate: { chip: 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]', dot: '#64748b' },
};
// Vocabulary color aliases (the seed may say "green", "tan", "grey", "red").
const COLOR_ALIAS: Record<string, string> = {
  green: 'emerald',
  red: 'rose',
  tan: 'amber',
  orange: 'amber',
  grey: 'slate',
  gray: 'slate',
  purple: 'violet',
};

/** Chip classes + dot hex for a vocabulary color token (neutral fallback). */
export const colorMeta = (color: string | null | undefined): ColorMeta => {
  if (!color) return NEUTRAL;
  const key = COLOR_ALIAS[color] ?? color;
  return PALETTE[key] ?? NEUTRAL;
};

// ── Vocabulary → derived lookups ────────────────────────────────────────────

/** Rows of one kind, sorted by sortOrder then token (stable). */
export function vocabOf(rows: VocabularyRow[], kind: string): VocabularyRow[] {
  return rows
    .filter((r) => r.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.token.localeCompare(b.token));
}

/** LAYER tokens in axis order — the board's row axis. */
export const layersFrom = (rows: VocabularyRow[]): Layer[] =>
  vocabOf(rows, 'LAYER').map((r) => r.token);

/** LAYER token → short hint ("what screens capture") from row meta. */
export function layerHintsFrom(rows: VocabularyRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of vocabOf(rows, 'LAYER')) {
    const hint = r.meta?.descriptor ?? r.meta?.hint;
    if (typeof hint === 'string') out[r.token] = hint;
  }
  return out;
}

export type LayerMeta = { descriptor: string | null; dot: string };

/** LAYER token → section-header meta (subtitle + dot color) for the v3 panel. */
export function layerMetaFrom(rows: VocabularyRow[]): Record<string, LayerMeta> {
  const out: Record<string, LayerMeta> = {};
  for (const r of vocabOf(rows, 'LAYER')) {
    const descriptor = r.meta?.descriptor ?? r.meta?.hint;
    out[r.token] = {
      descriptor: typeof descriptor === 'string' ? descriptor : null,
      dot: typeof r.meta?.dot === 'string' ? r.meta.dot : colorMeta(r.color).dot,
    };
  }
  return out;
}

/** Generic `{ value, label }` options of a kind (modes, views, dispositions). */
export const optionsFrom = (
  rows: VocabularyRow[],
  kind: string,
): { value: string; label: string }[] =>
  vocabOf(rows, kind).map((r) => ({ value: r.token, label: r.label }));

export type ClassMeta = {
  label: string;
  chip: string;
  dot: string;
  /** True when a finding of this class is correct where it sits (green ✓). */
  stays: boolean;
  legend: string | null;
};
export type ClassificationMeta = { order: Classification[]; byToken: Record<string, ClassMeta> };

// §6.4 frozen contract tokens that mean "does not belong here" when the row
// meta carries no explicit `stays` flag.
const DEFAULT_NON_STAYING = new Set(['Relocate', 'Eliminate']);
export const defaultStays = (token: Classification): boolean => !DEFAULT_NON_STAYING.has(token);

/** Build the classification lookup (chip colors, stay/move, legend) from rows. */
export function classificationFrom(rows: VocabularyRow[]): ClassificationMeta {
  const byToken: Record<string, ClassMeta> = {};
  const order: Classification[] = [];
  for (const r of vocabOf(rows, 'CLASSIFICATION')) {
    order.push(r.token);
    const c = colorMeta(r.color);
    byToken[r.token] = {
      label: r.label,
      chip: c.chip,
      dot: c.dot,
      stays: typeof r.meta?.stays === 'boolean' ? r.meta.stays : defaultStays(r.token),
      legend: typeof r.meta?.legend === 'string' ? r.meta.legend : null,
    };
  }
  return { order, byToken };
}

/** Does a finding of this classification belong where it sits? */
export const staysHere = (token: Classification, meta?: ClassificationMeta): boolean =>
  meta?.byToken[token]?.stays ?? defaultStays(token);

export type StatusMeta = Record<string, { label: string; dot: string }>;

/** Migration lifecycle rows → status dot/label lookup. */
export function statusesFrom(rows: VocabularyRow[]): StatusMeta {
  const out: StatusMeta = {};
  for (const r of vocabOf(rows, 'STATUS'))
    out[r.token] = { label: r.label, dot: colorMeta(r.color).dot };
  return out;
}

export const statusDot = (status: string, meta: StatusMeta): string =>
  meta[status]?.dot ?? NEUTRAL.dot;

export type MatchMeta = Record<
  string,
  { label: string; chip: string; dot: string; legend: string | null }
>;

/** MATCH_STATUS rows (AUTO / REVIEW / HELD) → pill/legend lookup. */
export function matchMetaFrom(rows: VocabularyRow[]): MatchMeta {
  const out: MatchMeta = {};
  for (const r of vocabOf(rows, 'MATCH_STATUS')) {
    const c = colorMeta(r.color);
    out[r.token] = {
      label: r.label,
      chip: c.chip,
      dot: c.dot,
      legend: typeof r.meta?.legend === 'string' ? r.meta.legend : null,
    };
  }
  return out;
}

export type LegendItem = { dot: string; text: string };

/** Legend chips — every vocabulary row carrying a `meta.legend` string. */
export function legendFrom(rows: VocabularyRow[]): LegendItem[] {
  const out: LegendItem[] = [];
  for (const r of rows)
    if (typeof r.meta?.legend === 'string')
      out.push({ dot: colorMeta(r.color).dot, text: r.meta.legend });
  return out;
}

/**
 * Map a MODE vocabulary token to the lens behavior key the workspace
 * implements. Tokens are label-like ("Value streams", "Legacy Product
 * Models") — matching is tolerant of spacing/casing.
 */
export type LensModeKey =
  'applications' | 'valueStreams' | 'roles' | 'models' | 'segment' | 'geography';

export function lensModeOf(token: string): LensModeKey {
  const t = token.toLowerCase();
  if (t.includes('role')) return 'roles';
  if (t.includes('stream') || t.includes('value')) return 'valueStreams';
  if (t.includes('segment')) return 'segment';
  if (t.includes('geograph')) return 'geography';
  if (t.includes('product') || t.includes('model')) return 'models';
  return 'applications';
}
