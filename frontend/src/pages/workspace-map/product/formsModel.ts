// Forms-first derivation for the Products grid (Form rationalization design):
// the heatmap's "Forms" component row decomposes into the three-layer form
// hierarchy — core (countrywide/base) forms with their state variations,
// coverage-linked endorsements and product exceptions rolled up BENEATH them —
// while every other model component stays a plain component row. Rows keep the
// exact HeatCounts / HeatCell / ReviewRow shapes the grid and the review list
// already render, so no cell, RAG or decision code changes. Derivation is
// name/livesIn-based on the real spine elements today; richer form metadata
// can replace `classifyForm` later without touching the layout.

import { pctOf, ragOf } from './gridModel';
import type { HeatCell, HeatCounts, HeatRow, Rag, ReviewRow } from './gridModel';
import type { ComponentElement } from './spine';

/** The heatmap component name the forms hierarchy is built from. */
export const FORMS_COMPONENT = 'Forms';

export type FormLayerKind = 'state' | 'coverage' | 'program' | 'product';

export const FORM_LAYER_META: Record<FormLayerKind, { label: string; hint: string }> = {
  state: {
    label: 'State variations',
    hint: 'state-mandated amendatory forms — candidates for multistate consolidation',
  },
  coverage: {
    label: 'Coverage endorsements',
    hint: 'forms that attach with a coverage — they roll up beneath the core form',
  },
  program: {
    label: 'Program forms',
    hint: 'other base forms attached alongside the core form',
  },
  product: {
    label: 'Product exceptions',
    hint: 'forms carried by only one or two products',
  },
};

/** One renderable forms row — same counting/cell shapes as a HeatRow. */
export interface FormRowData extends HeatCounts {
  /** Drill id, stable across renders (prefixed `forms:` in the URL). */
  key: string;
  label: string;
  /** Secondary line, e.g. "State variation — California". */
  sub: string | null;
  rag: Rag;
  pct: number;
  cells: HeatCell[];
  reviewRows: ReviewRow[];
}

export interface FormChildGroup {
  kind: FormLayerKind;
  rows: FormRowData[];
}

export interface CoreFormRow extends FormRowData {
  lobName: string;
  /** The roll-up beneath the core form, in state → coverage → product order. */
  children: FormChildGroup[];
}

export interface FormsHierarchy {
  cores: CoreFormRow[];
  /** Every row (cores + children) keyed for drill resolution. */
  byKey: Map<string, FormRowData>;
  totals: HeatCounts & { pct: number };
  counts: { cores: number; state: number; coverage: number; program: number; product: number };
}

// ── Classification ──────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export interface FormClass {
  layer: 'core' | FormLayerKind;
  /** State code for state variations. */
  state: string | null;
  /** Coverage token for coverage-linked endorsements. */
  coverage: string | null;
}

/** Classify one form element group by its name + representative livesIn.
 *  Name/livesIn heuristics on purpose — the naming-convention rule from the
 *  design doc (state token → state variation; none → countrywide). */
export function classifyForm(
  name: string,
  rep: ComponentElement | null,
  unique: boolean,
): FormClass {
  const livesIn = rep?.livesIn ?? '';
  const stateToken = /STATE=([A-Z]{2})/.exec(livesIn)?.[1] ?? null;
  let state = stateToken && STATE_NAMES[stateToken] ? stateToken : null;
  if (!state) {
    for (const [code, full] of Object.entries(STATE_NAMES)) {
      if (name.includes(full) || new RegExp(`(?:—|–|-)\\s*${code}\\b`).test(name)) {
        state = code;
        break;
      }
    }
  }
  if (state) return { layer: 'state', state, coverage: null };
  const coverage = /attach with ([a-z0-9_/-]+) coverage/i.exec(livesIn)?.[1] ?? null;
  if (coverage) return { layer: 'coverage', state: null, coverage: coverage.toUpperCase() };
  if (unique) return { layer: 'product', state: null, coverage: null };
  return { layer: 'core', state: null, coverage: null };
}

// ── Hierarchy build ─────────────────────────────────────────────────────────

const EMPTY: HeatCounts = {
  total: 0,
  auto: 0,
  need: 0,
  decided: 0,
  common: 0,
  similar: 0,
  unique: 0,
};

function addCounts(into: HeatCounts, from: HeatCounts): void {
  into.total += from.total;
  into.auto += from.auto;
  into.need += from.need;
  into.decided += from.decided;
  into.common += from.common;
  into.similar += from.similar;
  into.unique += from.unique;
}

/** Counts + per-column cells for ONE element group (one form). */
function rowFor(r: ReviewRow, formsRow: HeatRow, sub: string | null): FormRowData {
  const mix: 'common' | 'similar' | 'unique' =
    r.group.status === 'PARTIAL' ? 'similar' : r.group.status === 'UNIQUE' ? 'unique' : 'common';
  const counts: HeatCounts = { ...EMPTY };
  counts.total = 1;
  counts[mix] = 1;
  if (r.needsDecision) {
    counts.need = 1;
    if (r.decision) counts.decided = 1;
  } else {
    counts.auto = 1;
  }
  const cells: HeatCell[] = formsRow.cells.map((c, i) => {
    const present = r.presence[i];
    const cell: HeatCell = {
      na: !present,
      versionId: c.versionId,
      lobId: c.lobId,
      ...EMPTY,
    };
    if (present) {
      cell.total = 1;
      cell[mix] = 1;
      if (r.needsDecision) {
        cell.need = 1;
        if (r.decision) cell.decided = 1;
      } else {
        cell.auto = 1;
      }
    }
    return cell;
  });
  return {
    key: `${r.lobId}:${r.group.key}`,
    label: r.group.name,
    sub,
    ...counts,
    rag: ragOf(counts),
    pct: pctOf(counts),
    cells,
    reviewRows: [r],
  };
}

/** Merge child cells into the core row's cells (roll-up numbers). */
function mergeCells(into: HeatCell[], from: HeatCell[]): void {
  from.forEach((c, i) => {
    const target = into[i];
    if (!target) return;
    if (!c.na) target.na = false;
    addCounts(target, c);
  });
}

const KIND_ORDER: FormLayerKind[] = ['state', 'coverage', 'program', 'product'];

/** Anchor score: the LOB's core form is its widest-carried base form; a name
 *  that reads like a base policy form wins ties. */
function anchorScore(r: ReviewRow): number {
  return r.group.presentIn * 10 + (/policy|coverage form/i.test(r.group.name) ? 5 : 0);
}

/**
 * Decompose the heatmap's Forms row into the forms-first hierarchy: one core
 * row per LOB base-form family (aggregating its whole family — collapsed it
 * reads like today's component row), children grouped state → coverage →
 * product beneath it.
 */
export function buildFormsHierarchy(formsRow: HeatRow): FormsHierarchy {
  interface LobBucket {
    lobId: string;
    lobName: string;
    coreRows: ReviewRow[];
    children: Record<FormLayerKind, { row: ReviewRow; sub: string }[]>;
  }
  const lobs = new Map<string, LobBucket>();

  for (const r of formsRow.reviewRows) {
    let bucket = lobs.get(r.lobId);
    if (!bucket) {
      bucket = {
        lobId: r.lobId,
        lobName: r.lobName,
        coreRows: [],
        children: { state: [], coverage: [], program: [], product: [] },
      };
      lobs.set(r.lobId, bucket);
    }
    const rep = Object.values(r.group.perVersion).find((el) => el != null) ?? null;
    const cls = classifyForm(r.group.name, rep, r.group.status === 'UNIQUE');
    if (cls.layer === 'core') bucket.coreRows.push(r);
    else
      bucket.children[cls.layer].push({
        row: r,
        sub:
          cls.layer === 'state'
            ? `State variation — ${STATE_NAMES[cls.state ?? ''] ?? cls.state}`
            : cls.layer === 'coverage'
              ? `Attaches with ${cls.coverage} coverage`
              : `Product exception — in ${r.group.presentIn} product${r.group.presentIn === 1 ? '' : 's'}`,
      });
  }

  const cores: CoreFormRow[] = [];
  const byKey = new Map<string, FormRowData>();
  const counts = { cores: 0, state: 0, coverage: 0, program: 0, product: 0 };

  for (const bucket of lobs.values()) {
    // The family anchor: the LOB's widest-carried base form (ONE core row per
    // LOB — every other base form rolls up beneath it as a "program form", so
    // a 15-form commercial program reads as one family, not 15 rows). A LOB
    // whose forms are all variations still gets a synthetic anchor so nothing
    // is dropped.
    bucket.coreRows.sort((a, b) => anchorScore(b) - anchorScore(a));
    const [anchor, ...programForms] = bucket.coreRows;
    for (const r of programForms)
      bucket.children.program.push({ row: r, sub: 'Program form — attaches with the core form' });
    const anchorRow: FormRowData = anchor
      ? rowFor(anchor, formsRow, null)
      : {
          key: `${bucket.lobId}:__synthetic-core__`,
          label: `${bucket.lobName} program forms`,
          sub: null,
          ...EMPTY,
          rag: 'green',
          pct: 100,
          cells: formsRow.cells.map((c) => ({
            na: true,
            versionId: c.versionId,
            lobId: c.lobId,
            ...EMPTY,
          })),
          reviewRows: [],
        };

    const children: FormChildGroup[] = [];
    for (const kind of KIND_ORDER) {
      const rows = bucket.children[kind].map(({ row, sub }) => rowFor(row, formsRow, sub));
      if (rows.length === 0) continue;
      rows.sort((a, b) => a.label.localeCompare(b.label));
      children.push({ kind, rows });
      counts[kind] += rows.length;
      for (const row of rows) byKey.set(row.key, row);
    }
    // Core row aggregates its whole family so the collapsed row reads like a
    // component row (roll-up), and its review drill covers the family.
    const core: CoreFormRow = {
      ...anchorRow,
      lobName: bucket.lobName,
      children,
      cells: anchorRow.cells.map((c) => ({ ...c })),
      reviewRows: [...anchorRow.reviewRows],
    };
    for (const g of children)
      for (const row of g.rows) {
        addCounts(core, row);
        mergeCells(core.cells, row.cells);
        core.reviewRows.push(...row.reviewRows);
      }
    core.rag = ragOf(core);
    core.pct = pctOf(core);
    byKey.set(core.key, core);
    cores.push(core);
    counts.cores += 1;
  }

  cores.sort((a, b) => a.lobName.localeCompare(b.lobName) || a.label.localeCompare(b.label));

  // byKey holds cores (aggregated) AND children — summing them double-counts.
  // The heatmap Forms row's own totals are exact; reuse them.
  const exact: HeatCounts = {
    total: formsRow.total,
    auto: formsRow.auto,
    need: formsRow.need,
    decided: formsRow.decided,
    common: formsRow.common,
    similar: formsRow.similar,
    unique: formsRow.unique,
  };

  return { cores, byKey, totals: { ...exact, pct: pctOf(exact) }, counts };
}
