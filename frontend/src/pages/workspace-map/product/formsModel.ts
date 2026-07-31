// Forms-first derivation for the Products grid (Form rationalization design).
// FORMS are the main piece: the heat map lists every form down the side
// (products across the top), broken into the three rationalization layers —
// CORE NATIONAL FORMS · STATE-REQUIRED VARIATIONS · PRODUCT-SPECIFIC
// VARIATIONS — so "what can become a national form vs what truly stays
// state-specific" reads straight off the section a form sits in and its cell
// colors. Drilling into a form reveals what the form CONTAINS — coverages,
// coverage parts, endorsements, clauses — sourced from the components that
// roll up under forms (Coverages, Terms) and the attach-with wiring on the
// form elements themselves. Rows keep the exact HeatCounts / HeatCell /
// ReviewRow shapes the grid and review list already render. Classification is
// name/livesIn-based on the real spine elements today; richer form metadata
// can replace it later without touching the layout.

import { pctOf, ragOf } from './gridModel';
import type { HeatCell, HeatCounts, Heatmap, HeatRow, Rag, ReviewRow } from './gridModel';
import type { ComponentElement } from './spine';

/** The heatmap component the forms register is built from. */
export const FORMS_COMPONENT = 'Forms';

/** Components whose elements roll up INSIDE a form's drill-down (they leave
 *  the "everything else" section below the forms register). */
export const ROLLED_UP_COMPONENTS = ['Coverages', 'Terms'];

// ── The three rationalization layers ────────────────────────────────────────

export type FormLayer = 'core' | 'state' | 'product';

export const FORM_LAYER_ORDER: FormLayer[] = ['core', 'state', 'product'];

export const FORM_LAYER_META: Record<FormLayer, { label: string; hint: string }> = {
  core: {
    label: 'Core national forms',
    hint: 'countrywide forms — the reusable enterprise base',
  },
  state: {
    label: 'State-required variations',
    hint: 'state-mandated forms — decide what absorbs into the core vs truly stays state-specific',
  },
  product: {
    label: 'Product-specific variations',
    hint: 'forms carried by only one or two products',
  },
};

// ── What rolls up beneath a form ────────────────────────────────────────────

export type ContentKind = 'coverage' | 'covpart' | 'endorsement' | 'clause';

export const CONTENT_KIND_ORDER: ContentKind[] = ['coverage', 'covpart', 'endorsement', 'clause'];

export const CONTENT_META: Record<ContentKind, { label: string; hint: string }> = {
  coverage: { label: 'Coverages', hint: 'coverages the form grants or modifies' },
  covpart: { label: 'Coverage parts', hint: 'coverage sub-parts and options' },
  endorsement: { label: 'Endorsements', hint: 'endorsement forms that attach to this form' },
  clause: { label: 'Clauses', hint: 'policy terms and clauses the form carries' },
};

/** One renderable row — same counting/cell shapes as a HeatRow. */
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

export interface FormContentGroup {
  kind: ContentKind;
  rows: FormRowData[];
}

/** One form in the register: its OWN presence row (the heat-map semantics —
 *  which products carry this form) plus what it contains for the drill. */
export interface FormRow extends FormRowData {
  lobId: string;
  lobName: string;
  layer: FormLayer;
  state: string | null;
  /** The LOB's base policy form — the containment anchor. */
  isBase: boolean;
  contents: FormContentGroup[];
}

export interface FormsModel {
  sections: { layer: FormLayer; rows: FormRow[] }[];
  /** Drill resolution: key → aggregated row (form + its contents). */
  byKey: Map<string, FormRowData>;
  counts: Record<FormLayer, number>;
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
  layer: FormLayer;
  state: string | null;
  /** Coverage token from an "attach with X coverage" rule. */
  coverage: string | null;
}

/** Classify one form element group by its name + representative livesIn —
 *  the design doc's naming-convention rule: a state token marks a
 *  state-required variation; none marks a countrywide form; a form carried by
 *  only 1–2 products is a product-specific variation. */
export function classifyForm(
  name: string,
  rep: ComponentElement | null,
  unique: boolean,
): FormClass {
  const livesIn = rep?.livesIn ?? '';
  const coverage = /attach with ([a-z0-9_/-]+) coverage/i.exec(livesIn)?.[1]?.toUpperCase() ?? null;
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
  if (state) return { layer: 'state', state, coverage };
  if (unique) return { layer: 'product', state: null, coverage };
  return { layer: 'core', state: null, coverage };
}

// ── Row building ────────────────────────────────────────────────────────────

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

function rowKeyOf(r: ReviewRow): string {
  return `${r.lobId}:${r.group.key}`;
}

/** Counts + per-column presence cells for ONE element group. */
function rowFor(r: ReviewRow, template: HeatCell[], sub: string | null): FormRowData {
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
  const cells: HeatCell[] = template.map((c, i) => {
    const present = r.presence[i];
    const cell: HeatCell = { na: !present, versionId: c.versionId, lobId: c.lobId, ...EMPTY };
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
    key: rowKeyOf(r),
    label: r.group.name,
    sub,
    ...counts,
    rag: ragOf(counts),
    pct: pctOf(counts),
    cells,
    reviewRows: [r],
  };
}

/** The LOB's base policy form: widest-carried core form; a name that reads
 *  like a base policy/wording wins ties. */
function baseScore(r: ReviewRow): number {
  return r.group.presentIn * 10 + (/policy|coverage form|wording|slip/i.test(r.group.name) ? 5 : 0);
}

/** Aggregate a form + its contents into the drill payload (review list scope
 *  + stats band numbers). */
function aggregate(form: FormRowData, contents: FormContentGroup[]): FormRowData {
  const agg: FormRowData = {
    ...form,
    cells: form.cells.map((c) => ({ ...c })),
    reviewRows: [...form.reviewRows],
  };
  const seen = new Set(agg.reviewRows.map(rowKeyOf));
  for (const g of contents)
    for (const row of g.rows)
      for (const r of row.reviewRows) {
        const k = rowKeyOf(r);
        if (seen.has(k)) continue;
        seen.add(k);
        agg.reviewRows.push(r);
        addCounts(agg, row);
      }
  agg.rag = ragOf(agg);
  agg.pct = pctOf(agg);
  return agg;
}

// ── Model build ─────────────────────────────────────────────────────────────

/**
 * Build the forms register from the heatmap: every Forms element group becomes
 * a row in one of the three layer sections; each row's drill-down carries the
 * form's contents (coverages / coverage parts / endorsements / clauses),
 * derived from the rolled-up components and the attach-with wiring.
 */
export function buildFormsModel(heat: Heatmap): FormsModel | null {
  const formsRow = heat.rows.find((r) => r.component === FORMS_COMPONENT);
  if (!formsRow) return null;
  const template = formsRow.cells;
  const byComponent = new Map<string, HeatRow>(heat.rows.map((r) => [r.component, r]));
  const coveragesRow = byComponent.get('Coverages') ?? null;
  const termsRow = byComponent.get('Terms') ?? null;

  interface Classified {
    r: ReviewRow;
    cls: FormClass;
  }
  const classified: Classified[] = formsRow.reviewRows.map((r) => {
    const rep = Object.values(r.group.perVersion).find((el) => el != null) ?? null;
    return { r, cls: classifyForm(r.group.name, rep, r.group.status === 'UNIQUE') };
  });

  // One base (containment anchor) per LOB, from its core-layer forms.
  const baseByLob = new Map<string, string>(); // lobId → group key
  for (const { r, cls } of classified) {
    if (cls.layer !== 'core') continue;
    const cur = baseByLob.get(r.lobId);
    const curRow = classified.find((c) => c.r.lobId === r.lobId && c.r.group.key === cur);
    if (!cur || (curRow && baseScore(r) > baseScore(curRow.r))) baseByLob.set(r.lobId, r.group.key);
  }

  const byKey = new Map<string, FormRowData>();
  const sections: FormsModel['sections'] = FORM_LAYER_ORDER.map((layer) => ({ layer, rows: [] }));
  const counts: Record<FormLayer, number> = { core: 0, state: 0, product: 0 };

  for (const { r, cls } of classified) {
    const isBase = baseByLob.get(r.lobId) === r.group.key;
    const sub =
      cls.layer === 'state'
        ? `State variation — ${STATE_NAMES[cls.state ?? ''] ?? cls.state} · ${r.lobName}`
        : cls.layer === 'product'
          ? `Product-specific — in ${r.group.presentIn} product${r.group.presentIn === 1 ? '' : 's'} · ${r.lobName}`
          : `${isBase ? 'Core policy form' : cls.coverage ? `Attaches with ${cls.coverage} coverage` : 'Countrywide form'} · ${r.lobName}`;
    const own = rowFor(r, template, sub);

    // What the form CONTAINS.
    const contents: FormContentGroup[] = [];
    const push = (kind: ContentKind, rows: FormRowData[]) => {
      if (rows.length)
        contents.push({ kind, rows: rows.sort((a, b) => a.label.localeCompare(b.label)) });
    };
    if (isBase) {
      // The base policy form contains the LOB's coverages, clauses and the
      // endorsement/variation forms that attach to it.
      push(
        'coverage',
        (coveragesRow?.reviewRows ?? [])
          .filter((c) => c.lobId === r.lobId)
          .map((c) => rowFor(c, template, 'Coverage')),
      );
      push(
        'clause',
        (termsRow?.reviewRows ?? [])
          .filter((c) => c.lobId === r.lobId)
          .map((c) => rowFor(c, template, 'Clause')),
      );
      push(
        'endorsement',
        classified
          .filter((c) => c.r.lobId === r.lobId && c.r.group.key !== r.group.key)
          .map((c) =>
            rowFor(
              c.r,
              template,
              c.cls.layer === 'state'
                ? `State endorsement — ${STATE_NAMES[c.cls.state ?? ''] ?? c.cls.state}`
                : c.cls.coverage
                  ? `Attaches with ${c.cls.coverage} coverage`
                  : 'Endorsement',
            ),
          ),
      );
    } else if (cls.coverage) {
      // A coverage-attach endorsement contains the coverage(s) it wires in.
      const token = cls.coverage;
      push(
        'coverage',
        (coveragesRow?.reviewRows ?? [])
          .filter(
            (c) =>
              c.lobId === r.lobId &&
              (c.group.name.toUpperCase().includes(token) ||
                Object.values(c.group.perVersion).some((el) =>
                  el?.livesIn?.toUpperCase().includes(token),
                )),
          )
          .map((c) => rowFor(c, template, 'Coverage')),
      );
    }

    const formRow: FormRow = {
      ...own,
      lobId: r.lobId,
      lobName: r.lobName,
      layer: cls.layer,
      state: cls.state,
      isBase,
      contents,
    };
    sections[FORM_LAYER_ORDER.indexOf(cls.layer)].rows.push(formRow);
    counts[cls.layer] += 1;
    // Drill payload = the form + everything it contains.
    byKey.set(own.key, aggregate(own, contents));
    for (const g of contents)
      for (const row of g.rows) if (!byKey.has(row.key)) byKey.set(row.key, row);
  }

  for (const s of sections)
    s.rows.sort(
      (a, b) =>
        Number(b.isBase) - Number(a.isBase) ||
        a.lobName.localeCompare(b.lobName) ||
        (a.state ?? '').localeCompare(b.state ?? '') ||
        a.label.localeCompare(b.label),
    );

  return { sections, byKey, counts };
}
