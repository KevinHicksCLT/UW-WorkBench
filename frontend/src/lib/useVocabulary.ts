// Workspace-board vocabulary — the DB (WorkspaceVocabulary, served by
// GET /rationalization/vocabulary) is the source of truth for the board's
// runtime axis order, labels, colors and legend text (plan §3-A). The
// previously hardcoded frontend constants are baked in below as the
// loading/error fallback so the board renders (and never blanks) before the
// fetch lands or when it fails. Server rows replace the fallback per
// (domain, kind) group; a group the server doesn't return keeps its fallback.
import { useMemo } from 'react';
import { useApi } from './useApi';

export type VocabDomain = 'APPLICATION' | 'PRODUCT_MODEL';
export type VocabKind =
  | 'LAYER'
  | 'CLASSIFICATION'
  | 'STATUS'
  | 'MODE'
  | 'VIEW'
  | 'DISPOSITION'
  | 'MATCH_STATUS'
  | 'SCAFFOLD';

/** One WorkspaceVocabulary row as the API serves it. */
export interface VocabRow {
  domain: string;
  kind: string;
  token: string;
  label: string;
  color: string | null;
  sortOrder: number;
  meta: Record<string, unknown> | null;
}

/** Tone name (the `color` column) → hex, for rows whose meta has no dot. */
export const TONE_HEX: Record<string, string> = {
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#e11d48',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  slate: '#64748b',
  blue: '#2563eb',
  violet: '#7c3aed',
  neutral: '#d4d4d4',
};

const row = (
  domain: VocabDomain,
  kind: VocabKind,
  token: string,
  label: string,
  color: string | null,
  sortOrder: number,
  meta: Record<string, unknown> | null = null,
): VocabRow => ({ domain, kind, token, label, color, sortOrder, meta });

// ── Fallback rows ─────────────────────────────────────────────────────────────
// Mirrors backend/src/seed/seedWorkspaceVocabulary.ts for the groups the board
// renders. These were the frontend's hardcoded constants before plan §3-A.

const APP_LAYERS: [string, string, string, string][] = [
  ['UI', 'sky', 'what screens capture', '#0ea5e9'],
  ['Integration', 'violet', 'how data is sent', '#7c3aed'],
  ['Business Service', 'amber', 'processing & validations', '#d97706'],
  ['Data', 'emerald', "what's stored", '#10b981'],
  ['Infrastructure', 'slate', 'security & ops', '#64748b'],
];

const APP_CAPDAN: [string, string, string, string | null][] = [
  ['Common', 'emerald', '#10b981', 'correct — stays'],
  ['Different', 'blue', '#2563eb', null],
  ['Relocate', 'violet', '#7c3aed', 'needs to move'],
  ['Eliminate', 'rose', '#e11d48', 'retire with sign-off'],
];

const STATUSES: [string, string, string][] = [
  ['Identified', 'neutral', '#d4d4d4'],
  ['In Analysis', 'amber', '#f59e0b'],
  ['Normalized', 'indigo', '#6366f1'],
  ['In Migration', 'sky', '#0ea5e9'],
  ['Migrated', 'emerald', '#10b981'],
  ['Retired', 'slate', '#64748b'],
];

const MATCH_STATUSES: [string, string, string][] = [
  ['AUTO', 'emerald', '2→1 semantically same · auto'],
  ['REVIEW', 'amber', 'REVIEW semantically different'],
  ['HELD', 'rose', 'HELD — proposed resolution awaiting sign-off'],
];

/** What each layer's CAPDAN component covers (the Normalize section titles). */
const APP_SCAFFOLD_COMPONENTS: [string, string][] = [
  ['UI', 'UI Components / Fields'],
  ['Integration', 'Integration Logic'],
  ['Business Service', 'Business Service Logic'],
  ['Data', 'Data Schema & Payload'],
  ['Infrastructure', 'Infra Security Rules & Logs'],
];

const PRODUCT_COMPONENTS = [
  'Party & Roles',
  'Product Hierarchy',
  'Coverage & Perils',
  'Limits & Deductibles',
  'Rating & Pricing',
  'Forms & Wordings',
  'Eligibility & UW Rules',
  'Exposures & Schedules',
  'Reinsurance & Layering',
  'Regulatory & Filings',
  'Distribution',
];

const PRODUCT_SCOPES: [string, string, string, string | null][] = [
  ['Common', 'blue', '#2563eb', 'correct — stays'],
  ['Segment', 'amber', '#d97706', null],
  ['Geography', 'slate', '#64748b', null],
  ['Eliminate', 'rose', '#e11d48', 'retire with sign-off'],
];

function fallbackRows(): VocabRow[] {
  const rows: VocabRow[] = [];
  APP_LAYERS.forEach(([t, c, descriptor, dot], i) =>
    rows.push(row('APPLICATION', 'LAYER', t, t, c, i, { descriptor, dot })),
  );
  APP_CAPDAN.forEach(([t, c, dot, legend], i) =>
    rows.push(row('APPLICATION', 'CLASSIFICATION', t, t, c, i, legend ? { dot, legend } : { dot })),
  );
  STATUSES.forEach(([t, c, dot], i) =>
    rows.push(row('APPLICATION', 'STATUS', t, t, c, i, { dot })),
  );
  MATCH_STATUSES.forEach(([t, c, legend], i) =>
    rows.push(row('APPLICATION', 'MATCH_STATUS', t, t, c, i, { legend })),
  );
  APP_SCAFFOLD_COMPONENTS.forEach(([t, component], i) =>
    rows.push(row('APPLICATION', 'SCAFFOLD', t, `${t} scaffold`, null, i, { component })),
  );
  PRODUCT_COMPONENTS.forEach((c, i) => rows.push(row('PRODUCT_MODEL', 'LAYER', c, c, null, i)));
  PRODUCT_SCOPES.forEach(([t, c, dot, legend], i) =>
    rows.push(
      row('PRODUCT_MODEL', 'CLASSIFICATION', t, t, c, i, legend ? { dot, legend } : { dot }),
    ),
  );
  STATUSES.forEach(([t, c, dot], i) =>
    rows.push(row('PRODUCT_MODEL', 'STATUS', t, t, c, i, { dot })),
  );
  return rows;
}

// ── Lookup ────────────────────────────────────────────────────────────────────

export interface Vocabulary {
  /** Rows of one (domain, kind) group, in sortOrder. */
  rows(domain: VocabDomain, kind: VocabKind): VocabRow[];
  /** Ordered tokens of a group — the runtime axis/chip order. */
  tokens(domain: VocabDomain, kind: VocabKind): string[];
  get(domain: VocabDomain, kind: VocabKind, token: string): VocabRow | undefined;
  /** Display label for a token (the token itself when no row exists). */
  labelOf(domain: VocabDomain, kind: VocabKind, token: string): string;
  /** Display hex for a row: meta.dot when present, else its tone name mapped. */
  colorHexOf(domain: VocabDomain, kind: VocabKind, token: string): string | null;
  /** A string field off a row's meta JSON (null when absent or not a string). */
  metaString(domain: VocabDomain, kind: VocabKind, token: string, key: string): string | null;
}

const groupKey = (d: string, k: string) => `${d}§${k}`;

/** Build the lookup: fallback rows overlaid by the server rows per group. */
export function buildVocabulary(server?: VocabRow[] | null): Vocabulary {
  const groups = new Map<string, VocabRow[]>();
  const add = (rows: VocabRow[]) => {
    for (const r of rows) {
      const k = groupKey(r.domain, r.kind);
      const list = groups.get(k);
      if (list) list.push(r);
      else groups.set(k, [r]);
    }
  };
  add(fallbackRows());
  if (server && server.length > 0) {
    // Any group the server covers replaces its fallback rows wholesale.
    for (const r of server) groups.delete(groupKey(r.domain, r.kind));
    add(server);
  }
  const byToken = new Map<string, VocabRow>();
  for (const list of groups.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const r of list) byToken.set(`${groupKey(r.domain, r.kind)}§${r.token}`, r);
  }

  const rows = (d: VocabDomain, k: VocabKind) => groups.get(groupKey(d, k)) ?? [];
  const get = (d: VocabDomain, k: VocabKind, token: string) =>
    byToken.get(`${groupKey(d, k)}§${token}`);
  return {
    rows,
    get,
    tokens: (d, k) => rows(d, k).map((r) => r.token),
    labelOf: (d, k, token) => get(d, k, token)?.label ?? token,
    colorHexOf: (d, k, token) => {
      const r = get(d, k, token);
      if (!r) return null;
      const dot = r.meta?.dot;
      if (typeof dot === 'string') return dot;
      return (r.color && TONE_HEX[r.color]) || r.color || null;
    },
    metaString: (d, k, token, key) => {
      const v = get(d, k, token)?.meta?.[key];
      return typeof v === 'string' ? v : null;
    },
  };
}

/** Fetch both domains once; until (or unless) the server answers, the lookup
 *  serves the baked-in fallback so consumers never render from nothing. */
export function useVocabulary(): { vocab: Vocabulary; loading: boolean; error: string } {
  const { data, loading, error } = useApi<{ vocabulary: VocabRow[] }>(
    '/rationalization/vocabulary',
  );
  const vocab = useMemo(() => buildVocabulary(data?.vocabulary), [data]);
  return { vocab, loading, error };
}
