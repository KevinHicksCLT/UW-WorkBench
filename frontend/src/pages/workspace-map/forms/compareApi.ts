// Payload contracts + shared vocabulary for the Form Comparison lens
// (mirrors backend routes/forms/compare.ts and lib/forms/alignClauses.ts).

export type AlignStatus = 'identical' | 'near' | 'divergent' | 'unique';

export interface CompareClause {
  id: string;
  ordinal: number;
  heading: string | null;
  text: string;
}

export interface CompareRow {
  a: CompareClause | null;
  b: CompareClause | null;
  status: AlignStatus;
  similarity: number;
}

export interface VersionMeta {
  id: string;
  versionNo: number;
  status: string;
}

export interface CompareSide {
  formId: string;
  formNumber: string;
  title: string;
  lob: string | null;
  states: string[] | null;
  editionDate: string | null;
  filingStatus: string;
  versionId: string;
  versionNo: number;
  versionStatus: string;
  clauseCount: number;
  /** Every ingested version of this form (latest first) — the version picker. */
  versions: VersionMeta[];
}

export interface ComparePayload {
  a: CompareSide;
  b: CompareSide;
  rows: CompareRow[];
  summary: {
    identical: number;
    near: number;
    divergent: number;
    uniqueA: number;
    uniqueB: number;
    total: number;
    overallSimilarity: number;
  };
}

/** The /forms library list projection the pickers need. */
export interface FormOption {
  id: string;
  formNumber: string;
  title: string;
  lob: string | null;
  states: string[] | null;
  editionDate: string | null;
  filingStatus: string;
  versions: VersionMeta[];
}

/** Side label: form number + version (edition only when it disambiguates). */
export function sideLabel(s: CompareSide, otherFormId: string): string {
  return s.formId === otherFormId
    ? `${s.formNumber} v${s.versionNo}`
    : `${s.formNumber}${s.editionDate ? ` (${s.editionDate})` : ''}`;
}

/** Status → gutter/summary color, matching the board's heat vocabulary. */
export const STATUS_META: Record<AlignStatus, { label: string; fg: string; bg: string }> = {
  identical: { label: 'Identical', fg: '#15803d', bg: '#f0fdf4' },
  near: { label: 'Near-identical', fg: '#0f766e', bg: '#f0fdfa' },
  divergent: { label: 'Divergent', fg: '#b45309', bg: '#fffbeb' },
  unique: { label: 'One side only', fg: '#b91c1c', bg: '#fef2f2' },
};

/** Deep link into the Workspace's Form Comparison lens. */
export function compareHref(formA?: string | null, formB?: string | null): string {
  const p = new URLSearchParams({ domain: 'form-compare' });
  if (formA) p.set('formA', formA);
  if (formB) p.set('formB', formB);
  return `/portfolio?${p.toString()}`;
}

/** Picker label: number, title, edition — and the edition history, so forms
 *  comparable version-vs-version stand out in the list. */
export function formLabel(f: FormOption): string {
  const base = `${f.formNumber} — ${f.title}${f.editionDate ? ` (${f.editionDate})` : ''}`;
  return f.versions.length > 1 ? `${base} · ${f.versions.length} versions` : base;
}
