// productForms.ts — server-side forms register (port of the frontend
// formsModel with one deliberate change for scale: STATE-required variations
// aggregate to one row per LOB. The v2 portfolio carries a form row per
// state-form version (47 per workers' compensation product); listing each as
// its own register row is unusable and unrenderable, while one "State-required
// forms — N states" row per LOB keeps the buckets summing exactly (element =
// countable per version; buckets must sum) and the drill still opens every
// member. Core and product-specific layers stay row-per-form.

import {
  addCounts,
  EMPTY_COUNTS,
  pctOf,
  ragOf,
  type HeatCell,
  type HeatCounts,
  type Heatmap,
  type HeatRow,
  type ReviewRow,
  type SpineComponent,
  type SpineElement,
  type SpineLob,
} from './productBoard.js';

export type FormLayer = 'core' | 'state' | 'product';
export const FORM_LAYER_ORDER: FormLayer[] = ['core', 'state', 'product'];

export type ContentKind = 'coverage' | 'covpart' | 'endorsement' | 'clause';
export const CONTENT_LABEL: Record<ContentKind, string> = {
  coverage: 'Coverages',
  covpart: 'Coverage parts',
  endorsement: 'Endorsements',
  clause: 'Clauses',
};

export const FORMS_COMPONENT = 'Forms';
export const ROLLED_UP_COMPONENTS = ['Coverages', 'Terms'];

export interface FormRowData extends HeatCounts {
  key: string;
  label: string;
  sub: string | null;
  rag: 'green' | 'amber' | 'red';
  pct: number;
  cells: HeatCell[];
}

export interface FormRow extends FormRowData {
  lobId: string;
  lobName: string;
  layer: FormLayer;
  state: string | null;
  isBase: boolean;
  /** Latest reviewer comment among the row's decisions. */
  note: string | null;
  /** Register payload ships no inline contents — the drill carries them. */
  contents: [];
}

export interface FormsDrill extends FormRowData {
  reviewRows: ReviewRow[];
  groupOf: Record<string, string>;
  /** The drilled form's own review row — the drill's TITLE, never a list row.
   *  Null for aggregate drills (state register) where there is no single form. */
  self: ReviewRow | null;
}

export interface FormsModel {
  sections: { layer: FormLayer; rows: FormRow[] }[];
  counts: Record<FormLayer, number>;
  /** Drill key → review rows + banding, resolved by GET /product-spine/review. */
  byKey: Map<string, FormsDrill>;
}

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

interface FormClass {
  layer: FormLayer;
  state: string | null;
  coverage: string | null;
}

/** Naming-convention classification (design-doc rule): a state token marks a
 *  state-required variation; none marks a countrywide form; a form carried by
 *  only 1–2 PRODUCTS (not versions — a countrywide form carried by one
 *  product across its 47 state versions is still that product's core form)
 *  is a product-specific variation. The caller computes `unique` from
 *  product carriage. */
export function classifyForm(name: string, rep: SpineElement | null, unique: boolean): FormClass {
  const livesIn = rep?.livesIn ?? '';
  const coverage = /attach with ([a-z0-9_/-]+) coverage/i.exec(livesIn)?.[1]?.toUpperCase() ?? null;
  const stateToken = /STATE=([A-Z]{2})/.exec(livesIn)?.[1] ?? null;
  let state = stateToken && STATE_NAMES[stateToken] ? stateToken : null;
  if (!state) {
    // A LEADING code counts too ("CA state-mandated endorsement set").
    const lead = /^([A-Z]{2})\s/.exec(name)?.[1] ?? null;
    if (lead && STATE_NAMES[lead]) state = lead;
  }
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

function rowKeyOf(r: ReviewRow): string {
  return `${r.lobId}:${r.group.key}`;
}

function rowFor(r: ReviewRow, template: HeatCell[], sub: string | null): FormRowData {
  const mix: 'common' | 'similar' | 'unique' =
    r.group.status === 'PARTIAL' ? 'similar' : r.group.status === 'UNIQUE' ? 'unique' : 'common';
  const counts: HeatCounts = { ...EMPTY_COUNTS };
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
    const cell: HeatCell = {
      na: !present,
      versionId: c.versionId,
      lobId: c.lobId,
      ...EMPTY_COUNTS,
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
    key: rowKeyOf(r),
    label: r.group.name,
    sub,
    ...counts,
    rag: ragOf(counts),
    pct: pctOf(counts),
    cells,
  };
}

function baseScore(r: ReviewRow): number {
  return r.group.presentIn * 10 + (/policy|coverage form|wording|slip/i.test(r.group.name) ? 5 : 0);
}

function mergeInto(target: FormRowData, from: FormRowData): void {
  addCounts(target, from);
  from.cells.forEach((cell, i) => {
    const t = target.cells[i];
    if (!t) return;
    if (!cell.na) t.na = false;
    addCounts(t, cell);
  });
}

export function buildFormsModel(heat: Heatmap, lobs: SpineLob[]): FormsModel | null {
  const formsRow = heat.rows.find((r) => r.component === FORMS_COMPONENT);
  if (!formsRow) return null;
  const template = formsRow.cells;
  const byComponent = new Map<string, HeatRow>(heat.rows.map((r) => [r.component, r]));
  const coveragesRow = byComponent.get('Coverages') ?? null;
  const termsRow = byComponent.get('Terms') ?? null;

  // Product carriage: which PRODUCT owns each version, and how many products
  // each LOB has in scope. "Product-specific" is a product-count judgement —
  // a version-count one misclassifies every countrywide form the moment a
  // product carries per-state versions.
  const productOfVersion = new Map<string, string>();
  const productsInLob = new Map<string, Set<string>>();
  for (const l of lobs) {
    for (const v of l.versions) {
      productOfVersion.set(v.id, v.productName);
      const set = productsInLob.get(l.id) ?? new Set<string>();
      set.add(v.productName);
      productsInLob.set(l.id, set);
    }
  }
  const productsCarrying = (r: ReviewRow): number => {
    const set = new Set<string>();
    for (const vid of Object.keys(r.group.perVersion)) {
      const p = productOfVersion.get(vid);
      if (p) set.add(p);
    }
    return set.size;
  };

  const classified = formsRow.reviewRows.map((r) => {
    const rep = Object.values(r.group.perVersion)[0] ?? null;
    const carrying = productsCarrying(r);
    const inLob = productsInLob.get(r.lobId)?.size ?? 1;
    const unique = inLob > 2 && carrying <= 2;
    return { r, cls: classifyForm(r.group.name, rep, unique), carrying };
  });

  // One base (containment anchor) per LOB, from its core-layer forms.
  const baseByLob = new Map<string, string>();
  const scoreByKey = new Map<string, number>();
  for (const { r, cls } of classified) {
    if (cls.layer !== 'core') continue;
    scoreByKey.set(r.group.key, baseScore(r));
    const cur = baseByLob.get(r.lobId);
    if (!cur || baseScore(r) > (scoreByKey.get(cur) ?? -1)) baseByLob.set(r.lobId, r.group.key);
  }

  const byKey = new Map<string, FormsDrill>();
  const sections: FormsModel['sections'] = FORM_LAYER_ORDER.map((layer) => ({ layer, rows: [] }));
  const counts: Record<FormLayer, number> = { core: 0, state: 0, product: 0 };
  /** lobId → the LOB's aggregated state-variation register row. */
  const stateAgg = new Map<string, { row: FormRow; drill: FormsDrill; states: Set<string> }>();

  const contentRowsFor = (
    r: ReviewRow,
    cls: FormClass,
    isBase: boolean,
  ): { kind: ContentKind; rows: { data: FormRowData; review: ReviewRow }[] }[] => {
    const out: { kind: ContentKind; rows: { data: FormRowData; review: ReviewRow }[] }[] = [];
    const push = (kind: ContentKind, rows: { data: FormRowData; review: ReviewRow }[]) => {
      if (rows.length) out.push({ kind, rows });
    };
    if (isBase) {
      push(
        'coverage',
        (coveragesRow?.reviewRows ?? [])
          .filter((c) => c.lobId === r.lobId)
          .map((c) => ({ data: rowFor(c, template, 'Coverage'), review: c })),
      );
      push(
        'clause',
        (termsRow?.reviewRows ?? [])
          .filter((c) => c.lobId === r.lobId)
          .map((c) => ({ data: rowFor(c, template, 'Clause'), review: c })),
      );
      push(
        'endorsement',
        classified
          .filter((c) => c.r.lobId === r.lobId && c.r.group.key !== r.group.key)
          .map((c) => ({
            data: rowFor(
              c.r,
              template,
              c.cls.layer === 'state'
                ? `State endorsement — ${STATE_NAMES[c.cls.state ?? ''] ?? c.cls.state}`
                : c.cls.coverage
                  ? `Attaches with ${c.cls.coverage} coverage`
                  : 'Endorsement',
            ),
            review: c.r,
          })),
      );
    } else if (cls.coverage) {
      const token = cls.coverage;
      push(
        'coverage',
        (coveragesRow?.reviewRows ?? [])
          .filter(
            (c) =>
              c.lobId === r.lobId &&
              (c.group.name.toUpperCase().includes(token) ||
                Object.values(c.group.perVersion).some((el) =>
                  el.livesIn?.toUpperCase().includes(token),
                )),
          )
          .map((c) => ({ data: rowFor(c, template, 'Coverage'), review: c })),
      );
    }
    return out;
  };

  for (const { r, cls } of classified) {
    const isBase = baseByLob.get(r.lobId) === r.group.key;
    const sub =
      cls.layer === 'state'
        ? `State variation — ${STATE_NAMES[cls.state ?? ''] ?? cls.state} · ${r.lobName}`
        : cls.layer === 'product'
          ? `Product-specific · ${r.lobName}`
          : `${isBase ? 'Core policy form' : cls.coverage ? `Attaches with ${cls.coverage} coverage` : 'Countrywide form'} · ${r.lobName}`;
    const own = rowFor(r, template, sub);

    if (cls.layer === 'state') {
      // Aggregate: one register row per LOB for all its state-required forms.
      counts.state += 1;
      let agg = stateAgg.get(r.lobId);
      if (!agg) {
        const aggKey = `${r.lobId}:stateagg`;
        const row: FormRow = {
          ...rowFor(r, template, ''),
          key: aggKey,
          label: '',
          sub: null,
          lobId: r.lobId,
          lobName: r.lobName,
          layer: 'state',
          state: null,
          isBase: false,
          note: r.decision?.comment ?? null,
          contents: [],
        };
        const drill: FormsDrill = {
          ...row,
          cells: row.cells.map((c) => ({ ...c })),
          reviewRows: [r],
          groupOf: { [rowKeyOf(r)]: 'Form' },
          self: null,
        };
        agg = { row, drill, states: new Set() };
        stateAgg.set(r.lobId, agg);
        sections[FORM_LAYER_ORDER.indexOf('state')].rows.push(row);
        byKey.set(aggKey, drill);
      } else {
        mergeInto(agg.row, own);
        mergeInto(agg.drill, own);
        agg.drill.reviewRows.push(r);
        agg.drill.groupOf[rowKeyOf(r)] = 'Form';
        if (!agg.row.note && r.decision?.comment) agg.row.note = r.decision.comment;
      }
      if (cls.state) agg.states.add(cls.state);
      continue;
    }

    const contents = contentRowsFor(r, cls, isBase);
    const formRow: FormRow = {
      ...own,
      lobId: r.lobId,
      lobName: r.lobName,
      layer: cls.layer,
      state: cls.state,
      isBase,
      note: r.decision?.comment ?? null,
      contents: [],
    };
    sections[FORM_LAYER_ORDER.indexOf(cls.layer)].rows.push(formRow);
    counts[cls.layer] += 1;

    // Drill payload = the form as the TITLE (self) + everything it contains
    // as the list rows — the form never repeats inside its own table.
    const drill: FormsDrill = {
      ...own,
      cells: own.cells.map((c) => ({ ...c })),
      reviewRows: [],
      groupOf: {},
      self: r,
    };
    const seen = new Set([rowKeyOf(r)]);
    for (const g of contents)
      for (const { data, review } of g.rows) {
        const k = rowKeyOf(review);
        if (seen.has(k)) continue;
        seen.add(k);
        drill.reviewRows.push(review);
        addCounts(drill, data);
        drill.groupOf[k] = CONTENT_LABEL[g.kind];
        if (!byKey.has(data.key))
          byKey.set(data.key, {
            ...data,
            reviewRows: [review],
            groupOf: { [k]: CONTENT_LABEL[g.kind] },
            self: null,
          });
      }
    drill.rag = ragOf(drill);
    drill.pct = pctOf(drill);
    byKey.set(own.key, drill);
  }

  // Finalize the per-LOB state aggregates (label carries the state count).
  for (const agg of stateAgg.values()) {
    const n = agg.states.size || agg.drill.reviewRows.length;
    agg.row.label = `State-required forms — ${n} state${n === 1 ? '' : 's'}`;
    agg.row.sub = `${agg.drill.reviewRows.length} state form${agg.drill.reviewRows.length === 1 ? '' : 's'} · ${agg.row.lobName}`;
    agg.row.rag = ragOf(agg.row);
    agg.row.pct = pctOf(agg.row);
    agg.drill.label = agg.row.label;
    agg.drill.sub = agg.row.sub;
    agg.drill.rag = ragOf(agg.drill);
    agg.drill.pct = pctOf(agg.drill);
  }

  for (const s of sections)
    s.rows.sort(
      (a, b) =>
        Number(b.isBase) - Number(a.isBase) ||
        a.lobName.localeCompare(b.lobName) ||
        (a.state ?? '').localeCompare(b.state ?? '') ||
        a.label.localeCompare(b.label),
    );

  return { sections, counts, byKey };
}

// ── Product model view (Product Models TOC → product page) ─────────────────
// The TOC's product page presents the model the way the rationalization
// document reads it: FORMS decomposed into coverages / terms / endorsements /
// clauses, then Rating · Pricing · Underwriting Rules · Filings · Lifecycle
// Behavior. This splitter is pure so the grouping is testable.

export interface ProductModelSections {
  forms: {
    /** The policy wordings themselves (base form first). */
    base: SpineElement[];
    coverages: SpineElement[];
    terms: SpineElement[];
    endorsements: SpineElement[];
    clauses: SpineElement[];
  };
  rating: SpineElement[];
  pricing: SpineElement[];
  underwriting: SpineElement[];
  filings: SpineElement[];
  lifecycle: SpineElement[];
}

const BASE_FORM = /\b(policy|coverage form|wording|base form|slip)\b/i;
const CLAUSE =
  /\b(clause|condition|provision|dut(?:y|ies)|settlement|appraisal|cancellation|assignment|subrogation|notice|suit against)\b/i;

/** Group one version's components into the document's reading order. A Terms
 *  element that reads like a policy condition surfaces under Clauses (and only
 *  there — no element is double-counted). */
export function splitProductModel(components: Map<string, SpineComponent>): ProductModelSections {
  const els = (name: string): SpineElement[] => components.get(name)?.elements ?? [];
  const formEls = els(FORMS_COMPONENT);
  const base: SpineElement[] = [];
  const endorsements: SpineElement[] = [];
  for (const e of formEls) {
    const cls = classifyForm(e.element, e, false);
    if (cls.layer === 'core' && BASE_FORM.test(e.element) && base.length === 0) base.push(e);
    else endorsements.push(e);
  }
  const terms: SpineElement[] = [];
  const clauses: SpineElement[] = [];
  for (const e of els('Terms')) (CLAUSE.test(e.element) ? clauses : terms).push(e);
  return {
    forms: { base, coverages: els('Coverages'), terms, endorsements, clauses },
    rating: els('Rating'),
    pricing: els('Pricing'),
    underwriting: els('Underwriting Rules'),
    filings: els('Filings'),
    lifecycle: els('Lifecycle Behavior'),
  };
}
