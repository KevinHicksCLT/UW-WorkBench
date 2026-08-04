// boardApi.ts — the Products board's server contract. The board no longer
// downloads the spine and derives comparisons in the browser (that collapsed
// at 381 versions / 5,789 elements): GET /product-spine/board returns
// render-ready aggregates, GET /product-spine/review returns one drill's rows,
// GET /product-spine/compare returns full elements for at most 12 versions
// (the detail face). This module holds those payload types plus the adapters
// back into the existing client vocabulary (spine.ts / gridModel.ts).

import { versionPlaceLabel } from '../../../lib/usStates';
import type { HeatCell, HeatCounts, Rag, ReviewRow } from './gridModel';
import type {
  ComponentElement,
  LobOption,
  ProductDecision,
  SpineLevel,
  VersionColumn,
} from './spine';
import type { SpineFilters } from './SpineFilterBar';

/** One grid column — a version, or a whole product once the server folds the
 *  axis (past 48 scoped versions). Scalar-compatible with VersionColumn. */
export interface BoardColumn {
  id: string;
  name: string;
  status: string | null;
  productName: string;
  lobId: string;
  lobName: string;
  segmentName: string;
  /** Versions folded into this column (1 in version mode). */
  members: number;
}

/** Cells arrive SPARSE — only non-empty columns, keyed by column index; the
 *  dense matrix (mostly `na`) put 6 MB on a 300 KB board. denseCells()
 *  re-expands against the column axis for the grid renderer. */
export interface SparseCell extends HeatCounts {
  i: number;
}

export function denseCells(sparse: SparseCell[], columns: BoardColumn[]): HeatCell[] {
  const cells: HeatCell[] = columns.map((c) => ({
    na: true,
    versionId: c.id,
    lobId: c.lobId,
    total: 0,
    auto: 0,
    need: 0,
    decided: 0,
    common: 0,
    similar: 0,
    unique: 0,
  }));
  for (const s of sparse) {
    const cell = cells[s.i];
    if (!cell) continue;
    cells[s.i] = {
      ...cell,
      na: false,
      ...{
        total: s.total,
        auto: s.auto,
        need: s.need,
        decided: s.decided,
        common: s.common,
        similar: s.similar,
        unique: s.unique,
      },
    };
  }
  return cells;
}

export interface BoardHeatRow extends HeatCounts {
  component: string;
  rag: Rag;
  pct: number;
  note: string | null;
  cells: SparseCell[];
}

export type FormLayer = 'core' | 'state' | 'product';

export interface BoardFormRow extends HeatCounts {
  key: string;
  label: string;
  sub: string | null;
  rag: Rag;
  pct: number;
  cells: SparseCell[];
  lobId: string;
  lobName: string;
  layer: FormLayer;
  state: string | null;
  isBase: boolean;
  /** Latest reviewer comment among the row's decisions (server-computed). */
  note: string | null;
}

export interface BoardForms {
  sections: { layer: FormLayer; rows: BoardFormRow[] }[];
  counts: Record<FormLayer, number>;
}

export interface LeanVersion {
  id: string;
  name: string;
  status: string | null;
  productName: string;
  lobId: string;
  lobName: string;
  segmentName: string;
  /** Jurisdictions this version covers — drives the state filter. */
  states: string[];
}

export interface LeanLob {
  id: string;
  name: string;
  segmentName: string;
  versions: LeanVersion[];
}

export interface BoardPayload {
  levels: SpineLevel[];
  spine: LeanLob[];
  columnMode: 'version' | 'product';
  columns: BoardColumn[];
  heat: { rows: BoardHeatRow[]; totals: HeatCounts & { pct: number } };
  forms: BoardForms | null;
  /** Components that fold into the forms register (Forms + rolled-up). */
  rolledUp: string[];
  scopedVersions: number;
}

/** The actual state mandate behind a state-required row, with its regulatory
 *  source (mirrors backend lib/resolvers/productMandates). */
export interface StateMandate {
  state: string;
  stateName: string;
  mandate: string;
  citation: string | null;
  citationUrl: string | null;
  regulator: string | null;
}

export interface ReviewPayload {
  columns: BoardColumn[];
  columnMode: 'version' | 'product';
  rows: ReviewRow[];
  total: number;
  truncated: number;
  pct: number;
  /** Forms drills only: the drilled form's own review row — rendered as the
   *  list's TITLE header (with its decision controls), never as a table row. */
  self?: ReviewRow | null;
  groupOf?: Record<string, string>;
  groupOrder: string[];
  /** Row key (`lobId:groupKey`) → the state mandate the row exists to satisfy. */
  mandates?: Record<string, StateMandate>;
}

export interface ComparePayload {
  versions: {
    id: string;
    name: string;
    status: string | null;
    productName: string;
    lobId: string;
    lobName: string;
    segmentName: string;
    components: { name: string; sortOrder: number; elements: ComponentElement[] }[];
  }[];
}

/** The scope filters as the server's query params ('|'-joined multi-selects,
 *  plus a nonce that busts refetches after a decision is written). */
export function scopeQuery(filters: SpineFilters, nonce: number): string {
  const p = new URLSearchParams();
  const put = (key: string, values: string[]) => {
    if (values.length) p.set(key, values.join('|'));
  };
  put('segments', filters.segments);
  put('lobs', filters.lobIds);
  put('offerings', filters.offerings);
  put('states', filters.states);
  put('tokens', filters.versionTokens);
  put('versions', filters.versionIds);
  p.set('d', String(nonce));
  return p.toString();
}

/** Lean spine → the LobOption shape the filter bar and scoping helpers use
 *  (components deliberately empty — nothing on this path reads elements). */
export function leanLobOptions(spine: LeanLob[]): LobOption[] {
  return spine.map((l) => ({
    id: l.id,
    name: l.name,
    segmentName: l.segmentName,
    versions: l.versions.map((v) => ({ ...v, components: new Map() })),
  }));
}

/** /compare payload → full VersionColumns for the client-side detail build. */
export function compareVersions(payload: ComparePayload): VersionColumn[] {
  return payload.versions.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    productName: v.productName,
    lobId: v.lobId,
    lobName: v.lobName,
    segmentName: v.segmentName,
    components: new Map(
      [...v.components]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => [
          c.name,
          {
            node: {
              id: `${v.id}:${c.name}`,
              name: c.name,
              levelNumber: 5,
              description: null,
              status: null,
              sortOrder: c.sortOrder,
              attributes: null,
              rollup: {},
              children: [],
            },
            elements: c.elements,
          },
        ]),
    ),
  }));
}

/** Column label helper shared by grid + review list (works for both column
 *  modes: folded product columns have an empty version name). Version names
 *  render in place vocabulary — "v2 · California", never "v2 — US-CA". */
export function columnLabel(c: BoardColumn, abbr: boolean): string {
  if (!abbr) return c.name ? `${c.productName} · ${versionPlaceLabel(c.name)}` : c.productName;
  const initials = c.productName
    .split(/[\s/–—-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  const ver =
    c.name
      .split(/[\s—–]+/)
      .filter(Boolean)[0]
      ?.replace(/[^\w.-]/g, '') ?? '';
  return ver ? `${initials}·${ver}` : initials;
}

/** Server review rows carry decisions in the client's ProductDecision shape. */
export function decisionOf(row: ReviewRow): ProductDecision | null {
  return row.decision;
}
