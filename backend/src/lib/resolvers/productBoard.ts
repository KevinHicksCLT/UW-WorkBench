// productBoard.ts — server-side derivation for the Workspace Products lens.
//
// The board previously shipped the whole product spine (every L5 component's
// attributes.elements[]) to the browser and derived the comparison, heat map
// and forms register client-side. That design collapsed the moment the spine
// carried a real portfolio (381 versions / 5,789 elements): a ~2 MB payload,
// per-render O(versions × groups) work, and one grid column per version.
//
// This resolver is now the single derivation layer (per backend-standards):
// the spine is loaded once per company (short-TTL memo), elements are grouped
// by the SAME jurisdiction-blind signature the client used, and the routes in
// routes/product-spine/board.ts return render-ready aggregates. Element-level
// payloads leave the server only for a bounded drill (review list, ≤12-version
// detail compare) — never for the whole portfolio.

import { prisma } from '../../db/prisma.js';

// ── Shapes (mirrors the frontend's spine.ts vocabulary) ─────────────────────

export interface SpineElement {
  element: string;
  description: string | null;
  livesIn: string | null;
  format: string | null;
  /** Enriched state-mandate detail (scripts/enrich-state-mandates.ts) — the
   *  specific requirements the state imposes, with its statutory citation. */
  mandate?: string | null;
  mandateCitation?: string | null;
  /** Forms-component elements are synthesized from the PolicyForm library via
   *  FormProductNode (the single source of truth for every form the product
   *  surfaces render) — these carry the library identity so the UI can open
   *  the actual form document and the comparison can group by form. */
  formId?: string | null;
  formNumber?: string | null;
  formRole?: string | null; // baseForm | declarations | endorsement | stateAmendatory
  formState?: string | null; // postal code for a stateAmendatory link
}

export interface SpineComponent {
  name: string;
  sortOrder: number;
  elements: SpineElement[];
}

export interface SpineVersion {
  id: string;
  name: string;
  status: string | null;
  sortOrder: number;
  productName: string;
  productCode: string | null;
  lobId: string;
  lobName: string;
  segmentName: string;
  /** Jurisdictions this version covers: attributes.states for a countrywide
   *  version (the states its filings make it live in), the single parsed
   *  state for a state-form version. Drives the state filter — picking CA
   *  must keep every product WRITTEN in CA, not only products whose CA
   *  regulation forces its own form. */
  states: string[];
  components: Map<string, SpineComponent>;
}

export interface SpineLob {
  id: string;
  name: string;
  segmentName: string;
  versions: SpineVersion[];
}

export interface LoadedSpine {
  levels: { levelNumber: number; dbValue: string; name: string }[];
  lobs: SpineLob[];
}

export type MatchStatus = 'COMMON' | 'PARTIAL' | 'UNIQUE' | 'SINGLE';

export interface ElementGroup {
  key: string;
  component: string;
  name: string;
  status: MatchStatus;
  /** versionId → element, PRESENT entries only (absent versions are omitted —
   *  the payload must not scale with the column count). */
  perVersion: Record<string, SpineElement>;
  presentIn: number;
}

export interface ComponentRow {
  component: string;
  presentIn: string[];
  groups: ElementGroup[];
}

export interface Comparison {
  axis: string[];
  rows: ComponentRow[];
  rawCount: number;
  normalizedCount: number;
  reviewCount: number;
}

export interface HeatCounts {
  total: number;
  auto: number;
  need: number;
  decided: number;
  common: number;
  similar: number;
  unique: number;
}

export interface HeatCell extends HeatCounts {
  na: boolean;
  versionId: string;
  lobId: string;
}

export interface ReviewRow {
  lobId: string;
  lobName: string;
  group: ElementGroup;
  needsDecision: boolean;
  decision: {
    component: string;
    groupKey: string;
    status: string;
    comment: string | null;
    decidedBy: string | null;
  } | null;
  presence: boolean[];
}

export interface HeatRow extends HeatCounts {
  component: string;
  rag: 'green' | 'amber' | 'red';
  pct: number;
  note: string | null;
  cells: HeatCell[];
  reviewRows: ReviewRow[];
}

export interface BoardColumn {
  id: string;
  name: string;
  status: string | null;
  productName: string;
  lobId: string;
  lobName: string;
  segmentName: string;
  /** Version count folded into this column (1 in version mode). */
  members: number;
}

export interface Heatmap {
  columns: BoardColumn[];
  columnMode: 'version' | 'product';
  rows: HeatRow[];
  totals: HeatCounts & { pct: number };
}

export interface SpineFilters {
  segments: string[];
  lobIds: string[];
  offerings: string[];
  states: string[];
  versionTokens: string[];
  versionIds: string[];
}

// ── Small helpers (identical semantics to the client versions) ──────────────

export function pctOf(c: HeatCounts): number {
  return c.need === 0 ? 100 : Math.round((c.decided / c.need) * 100);
}

export function ragOf(c: HeatCounts): 'green' | 'amber' | 'red' {
  if (c.need === 0 || c.decided >= c.need) return 'green';
  return c.decided > 0 ? 'amber' : 'red';
}

export const EMPTY_COUNTS: HeatCounts = {
  total: 0,
  auto: 0,
  need: 0,
  decided: 0,
  common: 0,
  similar: 0,
  unique: 0,
};

export function addCounts(into: HeatCounts, from: HeatCounts): void {
  into.total += from.total;
  into.auto += from.auto;
  into.need += from.need;
  into.decided += from.decided;
  into.common += from.common;
  into.similar += from.similar;
  into.unique += from.unique;
}

export const NO_STATE = '__none__';

/** Jurisdiction code from a version name ("v1 — US-CA" → CA). */
export function stateOf(name: string): string {
  return /US-([A-Z]{2})\b/.exec(name)?.[1] ?? NO_STATE;
}

/** Version/edition token from a version name ("v1 — US-CA" → v1). */
export function versionTokenOf(name: string): string {
  return name.split(/[\s—–]+/).filter(Boolean)[0] ?? name;
}

export function decisionKey(lobId: string, groupKey: string): string {
  return `${lobId}::${groupKey}`;
}

export const STATE_NAMES: Record<string, string> = {
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

/** Jurisdiction detected from an ELEMENT name ("CA state-mandated endorsement
 *  set" → CA, "State policy form — Michigan" → MI). Used to keep state-
 *  specific elements grouped PER STATE: the jurisdiction-blind signature
 *  strips state codes (they are version tokens), which would otherwise fold
 *  every state's mandated form set into one cross-state group. */
export function elementStateOf(name: string): string | null {
  const lead = /^([A-Z]{2})\s/.exec(name)?.[1];
  if (lead && STATE_NAMES[lead]) return lead;
  for (const [code, full] of Object.entries(STATE_NAMES)) {
    if (name.includes(full) || new RegExp(`(?:—|–|-)\\s*${code}\\b`).test(name)) return code;
  }
  return null;
}

// The 'Product Taxonomy' model component is hidden from every product view
// (same rule as routes/product-spine/helpers.ts — the rows stay in the DB).
const HIDDEN_COMPONENT = 'Product Taxonomy';

/** The model component whose elements are the PolicyForm library. */
export const FORMS_COMPONENT_NAME = 'Forms';

// ── Signature + comparison (port of frontend spine.ts, same algorithm) ──────

export function elementSignature(name: string, versionTokens: Set<string>): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0 && !versionTokens.has(w))
    .join(' ');
}

export function versionTokensOf(versions: SpineVersion[]): Set<string> {
  const tokens = new Set<string>();
  for (const v of versions) {
    for (const src of [v.name, v.productName]) {
      for (const t of src
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ')
        .split(' ')) {
        if (t.length > 0) tokens.add(t);
      }
    }
  }
  return tokens;
}

function componentAxis(versions: SpineVersion[]): string[] {
  const seen = new Set<string>();
  const axis: string[] = [];
  for (const v of versions) {
    const ordered = [...v.components.values()].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const c of ordered) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        axis.push(c.name);
      }
    }
  }
  return axis;
}

export function buildComparison(versions: SpineVersion[]): Comparison {
  const axis = componentAxis(versions);
  const tokens = versionTokensOf(versions);
  const single = versions.length === 1;
  const rows: ComponentRow[] = [];
  let rawCount = 0;
  let reviewCount = 0;
  let normalizedCount = 0;

  for (const component of axis) {
    const presentIn = versions.filter((v) => v.components.has(component)).map((v) => v.id);
    const groups = new Map<string, ElementGroup>();
    for (const v of versions) {
      const comp = v.components.get(component);
      if (!comp) continue;
      comp.elements.forEach((el, i) => {
        rawCount += 1;
        const sig = elementSignature(el.element, tokens) || `#${i}`;
        // State-specific elements group PER STATE — "CA state-mandated
        // endorsement set" must never fold with Florida's. Stateless keys
        // keep the historic format so persisted decisions still match.
        // Library-backed form elements group by FORM IDENTITY: the same
        // PolicyForm across versions is one row, two different forms never
        // fold even when their titles read alike.
        const st = elementStateOf(el.element);
        const key = el.formId
          ? `${component}::form:${el.formId}`
          : `${component}::${st ? `${st}::` : ''}${sig}`;
        let g = groups.get(key);
        if (!g) {
          g = { key, component, name: el.element, status: 'SINGLE', perVersion: {}, presentIn: 0 };
          groups.set(key, g);
        }
        if (!g.perVersion[v.id]) {
          g.perVersion[v.id] = el;
          g.presentIn += 1;
        }
      });
    }
    const list = [...groups.values()];
    for (const g of list) {
      // One commonality rule at every level: COMMON = carried by all,
      // PARTIAL = carried by more than half, UNIQUE = half or fewer.
      if (single) g.status = 'SINGLE';
      else if (g.presentIn === versions.length) g.status = 'COMMON';
      else if (g.presentIn * 2 > versions.length) g.status = 'PARTIAL';
      else g.status = 'UNIQUE';
      if (g.status === 'PARTIAL' || g.status === 'UNIQUE') reviewCount += 1;
    }
    normalizedCount += list.length;
    rows.push({ component, presentIn, groups: list });
  }

  return { axis, rows, rawCount, normalizedCount, reviewCount };
}

// ── Scoping (port of SpineFilterBar.scopeVersions) ──────────────────────────

const pass = (picked: string[], value: string) => picked.length === 0 || picked.includes(value);

function coversState(v: SpineVersion, picked: string[]): boolean {
  if (picked.length === 0) return true;
  return picked.some((s) => (s === NO_STATE ? stateOf(v.name) === NO_STATE : v.states.includes(s)));
}

export function versionInScope(v: SpineVersion, f: SpineFilters): boolean {
  return (
    pass(f.segments, v.segmentName) &&
    pass(f.lobIds, v.lobId) &&
    pass(f.offerings, v.productName) &&
    coversState(v, f.states) &&
    pass(f.versionTokens, versionTokenOf(v.name)) &&
    pass(f.versionIds, v.id)
  );
}

const generationNo = (token: string) => Number(/^v(\d+)$/.exec(token)?.[1] ?? 0);

/** A product's versions span GENERATIONS (v1, v2, …). The board must never
 *  put two generations of the same product in one comparison — the old
 *  edition would read as a phantom sibling product — so with no explicit
 *  version-token filter only each product's latest generation stays in scope
 *  (older editions are reachable via the version chip filter). */
function latestGenerationOnly(versions: SpineVersion[]): SpineVersion[] {
  const latest = new Map<string, number>();
  for (const v of versions) {
    const n = generationNo(versionTokenOf(v.name));
    const cur = latest.get(v.productName);
    if (cur === undefined || n > cur) latest.set(v.productName, n);
  }
  return versions.filter(
    (v) => generationNo(versionTokenOf(v.name)) === (latest.get(v.productName) ?? 0),
  );
}

export function scopeLobs(lobs: SpineLob[], f: SpineFilters): SpineLob[] {
  return lobs
    .map((l) => {
      const scoped = l.versions.filter((v) => versionInScope(v, f));
      return {
        ...l,
        versions: f.versionTokens.length === 0 ? latestGenerationOnly(scoped) : scoped,
      };
    })
    .filter((l) => l.versions.length > 0);
}

// ── Heat map (port of frontend gridModel.buildHeatmap + column folding) ─────

/** Above this many scoped versions the column axis folds to one per product. */
export const PRODUCT_FOLD_THRESHOLD = 48;

export interface DecisionLite {
  lobNodeId: string;
  component: string;
  groupKey: string;
  status: string;
  comment: string | null;
  decidedBy: string | null;
}

export function buildHeatmap(lobs: SpineLob[], decisions: Map<string, DecisionLite>): Heatmap {
  const versions = lobs.flatMap((l) => l.versions);
  const fold = versions.length > PRODUCT_FOLD_THRESHOLD;

  // Column axis: one per version, or one per product past the fold threshold.
  const columns: BoardColumn[] = [];
  const colOf = new Map<string, number>(); // versionId → column index
  if (!fold) {
    for (const v of versions) {
      colOf.set(v.id, columns.length);
      columns.push({
        id: v.id,
        name: v.name,
        status: v.status,
        productName: v.productName,
        lobId: v.lobId,
        lobName: v.lobName,
        segmentName: v.segmentName,
        members: 1,
      });
    }
  } else {
    const byProduct = new Map<string, number>();
    for (const v of versions) {
      const key = `${v.lobId}:${v.productName}`;
      let idx = byProduct.get(key);
      if (idx === undefined) {
        idx = columns.length;
        byProduct.set(key, idx);
        columns.push({
          id: `prod:${key}`,
          name: '',
          status: null,
          productName: v.productName,
          lobId: v.lobId,
          lobName: v.lobName,
          segmentName: v.segmentName,
          members: 0,
        });
      }
      columns[idx].members += 1;
      colOf.set(v.id, idx);
    }
  }

  const rowBy = new Map<string, HeatRow>();
  const order: string[] = [];

  for (const lob of lobs) {
    const comparison = buildComparison(lob.versions);
    // Match status is judged across PRODUCTS, exactly as the legend states
    // ("common — in every product"). buildComparison grouped by version;
    // with per-state versions in the spine that misreads every countrywide
    // concern (carried by each product's countrywide version but absent from
    // its state-form versions) as unique. Re-judge each group by distinct
    // product carriage before anything is counted.
    const productOf = new Map(lob.versions.map((v) => [v.id, v.productName]));
    const productsInLob = new Set(productOf.values()).size;
    const byId = new Map(lob.versions.map((v) => [v.id, v]));
    // Countrywide carriage COVERS the product's state versions: a concern on a
    // product's countrywide version is the nationwide baseline — state-form
    // versions amend the base policy, they don't drop its coverages — so every
    // sibling version counts as carrying it too (presence + status). (The
    // countrywide version's `states` list names where that filing is the ONLY
    // live form; it deliberately excludes the state-form states, so it must
    // NOT gate this.) Without the extension every countrywide concern reads
    // "in 1 of N columns" and its heat cells render empty.
    const coveredVersionIds = (g: { perVersion: Record<string, unknown> }): Set<string> => {
      const out = new Set(Object.keys(g.perVersion));
      for (const vid of Object.keys(g.perVersion)) {
        const carrier = byId.get(vid);
        if (!carrier || stateOf(carrier.name) !== NO_STATE) continue;
        for (const v of lob.versions) {
          if (v.productName === carrier.productName && v.id !== carrier.id) out.add(v.id);
        }
      }
      return out;
    };
    const coveredByGroup = new Map<object, Set<string>>();
    for (const row of comparison.rows) {
      for (const g of row.groups) {
        const covered = coveredVersionIds(g);
        coveredByGroup.set(g, covered);
        if (productsInLob > 1) {
          const carrying = new Set([...covered].map((vid) => productOf.get(vid) ?? vid)).size;
          if (carrying === productsInLob) g.status = 'COMMON';
          else if (carrying * 2 > productsInLob) g.status = 'PARTIAL';
          else g.status = 'UNIQUE';
        } else if (lob.versions.length === 1) {
          g.status = 'SINGLE';
        } else {
          // Single-product scope: commonality reads across the product's own
          // state/version editions (with countrywide coverage extended).
          if (covered.size === lob.versions.length) g.status = 'COMMON';
          else if (covered.size * 2 > lob.versions.length) g.status = 'PARTIAL';
          else g.status = 'UNIQUE';
        }
      }
    }
    for (const compRow of comparison.rows) {
      let row = rowBy.get(compRow.component);
      if (!row) {
        row = {
          component: compRow.component,
          ...EMPTY_COUNTS,
          rag: 'green',
          pct: 100,
          note: null,
          cells: columns.map((c) => ({
            na: true,
            versionId: c.id,
            lobId: c.lobId,
            ...EMPTY_COUNTS,
          })),
          reviewRows: [],
        };
        rowBy.set(compRow.component, row);
        order.push(compRow.component);
      }
      // A column is n/a for the row only while NO folded member carries the
      // component at all.
      for (const v of lob.versions) {
        if (v.components.has(compRow.component)) {
          const cell = row.cells[colOf.get(v.id) ?? -1];
          if (cell) cell.na = false;
        }
      }
      for (const g of compRow.groups) {
        const needs = g.status === 'PARTIAL' || g.status === 'UNIQUE';
        const mix: 'common' | 'similar' | 'unique' =
          g.status === 'PARTIAL' ? 'similar' : g.status === 'UNIQUE' ? 'unique' : 'common';
        const decision = decisions.get(decisionKey(lob.id, g.key)) ?? null;
        row.total += 1;
        row[mix] += 1;
        if (needs) {
          row.need += 1;
          if (decision) row.decided += 1;
        } else {
          row.auto += 1;
        }
        if (decision?.comment) row.note = decision.comment;
        const presence = columns.map(() => false);
        for (const vid of coveredByGroup.get(g) ?? Object.keys(g.perVersion)) {
          const idx = colOf.get(vid);
          if (idx !== undefined) presence[idx] = true;
        }
        row.reviewRows.push({
          lobId: lob.id,
          lobName: lob.name,
          group: g,
          needsDecision: needs,
          decision: decision
            ? {
                component: decision.component,
                groupKey: decision.groupKey,
                status: decision.status,
                comment: decision.comment,
                decidedBy: decision.decidedBy,
              }
            : null,
          presence,
        });
        // Fold-aware cell counts: each column counts the group once if ANY
        // member version carries it (counts stay sums of distinct concerns,
        // never inflated by the member count).
        presence.forEach((present, idx) => {
          if (!present) return;
          const cell = row.cells[idx];
          cell.total += 1;
          cell[mix] += 1;
          if (needs) {
            cell.need += 1;
            if (decision) cell.decided += 1;
          } else {
            cell.auto += 1;
          }
        });
      }
    }
  }

  const rows: HeatRow[] = [];
  for (const c of order) {
    const row = rowBy.get(c);
    if (!row) continue;
    row.pct = pctOf(row);
    row.rag = ragOf(row);
    rows.push(row);
  }
  const totals = rows.reduce(
    (acc, r) => {
      addCounts(acc, r);
      return acc;
    },
    { ...EMPTY_COUNTS },
  );
  return {
    columns,
    columnMode: fold ? 'product' : 'version',
    rows,
    totals: { ...totals, pct: pctOf(totals) },
  };
}

// ── Spine loader (memoized — the expensive part is parsing 5k+ elements) ────

interface MemoEntry {
  at: number;
  spine: LoadedSpine;
}

const SPINE_TTL_MS = 10_000;
const spineMemo = new Map<string, MemoEntry>();

export function parseStates(attributes: unknown, name: string): string[] {
  const attrs = attributes as { states?: unknown } | null;
  if (attrs && Array.isArray(attrs.states)) {
    const list = attrs.states.filter((x): x is string => typeof x === 'string');
    if (list.length) return list;
  }
  const parsed = stateOf(name);
  return parsed === NO_STATE ? [] : [parsed];
}

export function parseElements(attributes: unknown): SpineElement[] {
  const attrs = attributes as { elements?: unknown } | null;
  if (!attrs || !Array.isArray(attrs.elements)) return [];
  const out: SpineElement[] = [];
  for (const e of attrs.elements) {
    if (!e || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const element = typeof rec.element === 'string' ? rec.element : '';
    if (!element) continue;
    out.push({
      element,
      description: typeof rec.description === 'string' ? rec.description : null,
      livesIn: typeof rec.livesIn === 'string' ? rec.livesIn : null,
      format: typeof rec.format === 'string' ? rec.format : null,
      mandate: typeof rec.mandate === 'string' ? rec.mandate : null,
      mandateCitation: typeof rec.mandateCitation === 'string' ? rec.mandateCitation : null,
    });
  }
  return out;
}

/** Forms-component elements come from the PolicyForm library ONLY: every
 *  FormProductNode link on an L4 version node becomes one SpineElement. The
 *  ProductNode rows carry no form lists — the library is the single source of
 *  truth for every form the board / review / compare / model views render. */
const FORM_ROLE_LABEL: Record<string, string> = {
  baseForm: 'Base policy form',
  declarations: 'Declarations page',
  endorsement: 'Endorsement',
  stateAmendatory: 'State amendatory endorsement',
};

function formElement(link: {
  role_: string;
  form: {
    id: string;
    formNumber: string;
    title: string;
    states: unknown;
    editionDate: string | null;
    filingStatus: string;
  };
}): SpineElement {
  const f = link.form;
  const states = Array.isArray(f.states)
    ? f.states.filter((s): s is string => typeof s === 'string')
    : [];
  const state = link.role_ === 'stateAmendatory' ? (states[0] ?? null) : null;
  return {
    element: `${f.formNumber} — ${f.title}`,
    description: `${FORM_ROLE_LABEL[link.role_] ?? 'Form'} · ${f.filingStatus}${f.editionDate ? ` · ed. ${f.editionDate}` : ''}`,
    livesIn: 'Forms library',
    format: 'PDF',
    formId: f.id,
    formNumber: f.formNumber,
    formRole: link.role_,
    formState: state,
  };
}

/** Batch-load every FormProductNode link for a company as synthesized Forms
 *  elements, grouped by the L4 version node they attach to. Ordered base →
 *  declarations → endorsements → state amendatories, then form number. */
export async function loadFormElementsByVersionNode(
  companyId: string,
): Promise<Map<string, SpineElement[]>> {
  const formLinks = await prisma.formProductNode.findMany({
    where: { companyId },
    orderBy: [{ role_: 'asc' }, { id: 'asc' }],
    select: {
      productNodeId: true,
      role_: true,
      form: {
        select: {
          id: true,
          formNumber: true,
          title: true,
          states: true,
          editionDate: true,
          filingStatus: true,
        },
      },
    },
  });
  const roleOrder: Record<string, number> = {
    baseForm: 0,
    declarations: 1,
    endorsement: 2,
    stateAmendatory: 3,
  };
  const formsByVersionNode = new Map<string, SpineElement[]>();
  for (const link of formLinks) {
    const list = formsByVersionNode.get(link.productNodeId) ?? [];
    list.push(formElement(link));
    formsByVersionNode.set(link.productNodeId, list);
  }
  for (const list of formsByVersionNode.values()) {
    list.sort(
      (a, b) =>
        (roleOrder[a.formRole ?? ''] ?? 9) - (roleOrder[b.formRole ?? ''] ?? 9) ||
        (a.formNumber ?? '').localeCompare(b.formNumber ?? ''),
    );
  }
  return formsByVersionNode;
}

export async function loadSpine(companyId: string): Promise<LoadedSpine> {
  const hit = spineMemo.get(companyId);
  if (hit && Date.now() - hit.at < SPINE_TTL_MS) return hit.spine;

  const [levelTypes, nodes, formsByVersionNode] = await Promise.all([
    prisma.productLevelType.findMany({
      where: { companyId },
      orderBy: { levelNumber: 'asc' },
      select: { id: true, levelNumber: true, dbValue: true, displayValue: true },
    }),
    prisma.productNode.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
      select: {
        id: true,
        parentId: true,
        displayValue: true,
        status: true,
        sortOrder: true,
        code: true,
        attributes: true,
        productLevelTypeId: true,
      },
    }),
    loadFormElementsByVersionNode(companyId),
  ]);

  const levelOf = new Map(levelTypes.map((l) => [l.id, l.levelNumber]));
  type Node = (typeof nodes)[number];
  const byParent = new Map<string | null, Node[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }

  const lobs: SpineLob[] = [];
  for (const segment of byParent.get(null) ?? []) {
    if (levelOf.get(segment.productLevelTypeId) !== 1) continue;
    for (const lob of byParent.get(segment.id) ?? []) {
      if (levelOf.get(lob.productLevelTypeId) !== 2) continue;
      const versions: SpineVersion[] = [];
      for (const product of byParent.get(lob.id) ?? []) {
        for (const version of byParent.get(product.id) ?? []) {
          if (levelOf.get(version.productLevelTypeId) !== 4) continue;
          const components = new Map<string, SpineComponent>();
          for (const comp of byParent.get(version.id) ?? []) {
            if (comp.displayValue === HIDDEN_COMPONENT) continue;
            // The Forms component renders the PolicyForm library, never
            // attribute payloads — single source of truth for forms.
            const elements =
              comp.displayValue === FORMS_COMPONENT_NAME
                ? (formsByVersionNode.get(version.id) ?? [])
                : parseElements(comp.attributes);
            components.set(comp.displayValue, {
              name: comp.displayValue,
              sortOrder: comp.sortOrder,
              elements,
            });
          }
          // A version with linked forms but no Forms component node still
          // surfaces its library forms.
          if (!components.has(FORMS_COMPONENT_NAME) && formsByVersionNode.has(version.id)) {
            components.set(FORMS_COMPONENT_NAME, {
              name: FORMS_COMPONENT_NAME,
              sortOrder: 999,
              elements: formsByVersionNode.get(version.id) ?? [],
            });
          }
          if (components.size === 0) continue;
          versions.push({
            id: version.id,
            name: version.displayValue,
            status: version.status,
            sortOrder: version.sortOrder,
            productName: product.displayValue,
            productCode: product.code,
            lobId: lob.id,
            lobName: lob.displayValue,
            segmentName: segment.displayValue,
            states: parseStates(version.attributes, version.displayValue),
            components,
          });
        }
      }
      if (versions.length > 0) {
        lobs.push({
          id: lob.id,
          name: lob.displayValue,
          segmentName: segment.displayValue,
          versions,
        });
      }
    }
  }

  const spine: LoadedSpine = {
    levels: levelTypes.map((l) => ({
      levelNumber: l.levelNumber,
      dbValue: l.dbValue,
      name: l.displayValue,
    })),
    lobs,
  };
  spineMemo.set(companyId, { at: Date.now(), spine });
  return spine;
}

/** Test seam / data-reload hook: drop the memoized spine for a company. */
export function invalidateSpine(companyId?: string): void {
  if (companyId) spineMemo.delete(companyId);
  else spineMemo.clear();
}

export async function loadDecisions(companyId: string): Promise<Map<string, DecisionLite>> {
  const rows = await prisma.productNormalizationDecision.findMany({
    where: { companyId },
    select: {
      lobNodeId: true,
      component: true,
      groupKey: true,
      status: true,
      comment: true,
      decidedBy: true,
    },
  });
  const map = new Map<string, DecisionLite>();
  for (const d of rows) map.set(decisionKey(d.lobNodeId, d.groupKey), d);
  return map;
}
