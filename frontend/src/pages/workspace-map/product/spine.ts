// The Products lens data model — built on the REAL product spine
// (/product-spine/table: L1 segment → L2 LOB → L3 product → L4 version →
// L5 model component), not the illustrative rationalization tables. Comparison
// is derived here on read: elements are matched across the picked versions by
// a jurisdiction-blind name signature, so what is common to every version,
// what only some versions carry, and what is unique stands out.

export interface SpineLevel {
  levelNumber: number;
  dbValue: string;
  name: string;
}

export interface SpineNode {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  status: string | null;
  sortOrder: number;
  attributes: unknown;
  rollup: Record<number, number>;
  children: SpineNode[];
}

export interface SpineTable {
  levels: SpineLevel[];
  totals: Record<number, number>;
  roots: SpineNode[];
}

/** One atomic element of a model component (attributes.elements[]). */
export interface ComponentElement {
  element: string;
  description: string | null;
  livesIn: string | null;
  format: string | null;
}

/** A version column: one L4 node with its product/LOB ancestry flattened. */
export interface VersionColumn {
  id: string;
  name: string;
  status: string | null;
  productName: string;
  /** The owning LOB (L2) and segment (L1) — so versions can be compared across
   *  LOBs (e.g. a Home policy vs an Auto policy) and still show their origin. */
  lobId: string;
  lobName: string;
  segmentName: string;
  /** component name → that component node (with its parsed elements). */
  components: Map<string, { node: SpineNode; elements: ComponentElement[] }>;
}

export interface LobOption {
  id: string;
  name: string;
  segmentName: string;
  versions: VersionColumn[];
}

export type MatchStatus = 'COMMON' | 'PARTIAL' | 'UNIQUE' | 'SINGLE';

/** Reviewer sign-off for a varies/unique element group (GET /product-spine/decisions). */
export type ProductDecisionStatus = 'APPROVED' | 'HELD';
export interface ProductDecision {
  groupKey: string;
  component: string;
  status: ProductDecisionStatus;
}

/** One normalized element — the same concern matched across versions. */
export interface ElementGroup {
  key: string;
  component: string;
  /** Representative label (from the first version that carries it). */
  name: string;
  status: MatchStatus;
  perVersion: Record<string, ComponentElement | null>;
  presentIn: number;
}

export interface ComponentRow {
  component: string;
  /** Versions that have this component at all. */
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

export const MATCH_META: Record<
  MatchStatus,
  { label: string; fg: string; bg: string; border: string; hint: string }
> = {
  COMMON: {
    label: 'Common',
    fg: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    hint: 'in every compared version',
  },
  PARTIAL: {
    label: 'Varies',
    fg: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    hint: 'in some versions — review',
  },
  UNIQUE: {
    label: 'Unique',
    fg: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
    hint: 'one version only',
  },
  SINGLE: {
    label: 'Element',
    fg: '#475569',
    bg: '#f8fafc',
    border: '#e2e8f0',
    hint: 'single-version decomposition',
  },
};

/** Parse a node's attributes.elements[] defensively (attributes is Json). */
export function elementsOf(node: SpineNode): ComponentElement[] {
  const attrs = node.attributes as { elements?: unknown } | null;
  if (!attrs || !Array.isArray(attrs.elements)) return [];
  return attrs.elements
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      element: typeof e.element === 'string' ? e.element : '',
      description: typeof e.description === 'string' ? e.description : null,
      livesIn: typeof e.livesIn === 'string' ? e.livesIn : null,
      format: typeof e.format === 'string' ? e.format : null,
    }))
    .filter((e) => e.element.length > 0);
}

/** Every LOB (L2) that has at least one version with model components. */
export function lobOptions(table: SpineTable): LobOption[] {
  const out: LobOption[] = [];
  for (const segment of table.roots) {
    for (const lob of segment.children) {
      if (lob.levelNumber !== 2) continue;
      const versions: VersionColumn[] = [];
      for (const product of lob.children) {
        for (const version of product.children) {
          if (version.levelNumber !== 4) continue;
          const components = new Map<string, { node: SpineNode; elements: ComponentElement[] }>();
          for (const comp of version.children) {
            components.set(comp.name, { node: comp, elements: elementsOf(comp) });
          }
          if (components.size === 0) continue;
          versions.push({
            id: version.id,
            name: version.name,
            status: version.status,
            productName: product.name,
            lobId: lob.id,
            lobName: lob.name,
            segmentName: segment.name,
            components,
          });
        }
      }
      if (versions.length > 0) {
        out.push({ id: lob.id, name: lob.name, segmentName: segment.name, versions });
      }
    }
  }
  return out;
}

/** Every comparable version across every LOB, spine order preserved. */
export function allVersions(lobs: LobOption[]): VersionColumn[] {
  return lobs.flatMap((l) => l.versions);
}

/**
 * Jurisdiction-blind signature: lowercase, digits and punctuation collapse,
 * plus every token that appears in a compared version's own name (v9, US-CA,
 * Ohio…) is dropped — so "Product code PPA6-CA" and "Product code PPA6-OH"
 * meet on the same signature while genuinely different elements do not.
 */
export function elementSignature(name: string, versionTokens: Set<string>): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0 && !versionTokens.has(w))
    .join(' ');
}

/** Tokens the compared versions carry in their own names/statuses — never
 *  allowed to keep two elements apart (they encode the version, not the concern). */
export function versionTokensOf(versions: VersionColumn[]): Set<string> {
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

/** The component row axis: spine order of first appearance across versions. */
function componentAxis(versions: VersionColumn[]): string[] {
  const seen = new Set<string>();
  const axis: string[] = [];
  // Sort each version's components by the spine's sortOrder before merging.
  for (const v of versions) {
    const ordered = [...v.components.entries()].sort(
      (a, b) => a[1].node.sortOrder - b[1].node.sortOrder,
    );
    for (const [name] of ordered) {
      if (!seen.has(name)) {
        seen.add(name);
        axis.push(name);
      }
    }
  }
  return axis;
}

/** Build the whole comparison for the picked versions — pure, derived on read. */
export function buildComparison(versions: VersionColumn[]): Comparison {
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
        const key = `${component}::${sig}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            key,
            component,
            name: el.element,
            status: 'SINGLE',
            perVersion: Object.fromEntries(versions.map((x) => [x.id, null])),
            presentIn: 0,
          };
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
      if (single) g.status = 'SINGLE';
      else if (g.presentIn === versions.length) g.status = 'COMMON';
      else if (g.presentIn > 1) g.status = 'PARTIAL';
      else g.status = 'UNIQUE';
      if (g.status === 'PARTIAL' || g.status === 'UNIQUE') reviewCount += 1;
    }
    normalizedCount += list.length;
    rows.push({ component, presentIn, groups: list });
  }

  return { axis, rows, rawCount, normalizedCount, reviewCount };
}
