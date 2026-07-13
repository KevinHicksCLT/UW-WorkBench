// model.ts — payload types + attribute coercion helpers for the Product Model
// list view (ProductListExplorer). The `/product-spine/table` endpoint returns
// each node's level-specific facts as an untyped `attributes` JSON blob; the
// helpers below narrow it defensively (every field is optional — missing or
// mis-typed values coerce to null / []) so the UI never trusts the shape.

import type { PillTone } from '../ui';

/** One row of the user-editable level naming (1..5). */
export type ProductLevel = { levelNumber: number; dbValue: string; name: string };

/** One node of the product hierarchy tree. */
export type ProductNode = {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  /** L4 versions only: Active | Bound | Renewal only | Runoff. */
  status: string | null;
  sortOrder: number;
  /** Level-specific facts — narrow via the *Facts helpers below. */
  attributes: unknown;
  /** Descendant counts by levelNumber. */
  rollup: Record<number, number>;
  children: ProductNode[];
};

/** Response of GET /product-spine/table. */
export type ProductTableData = {
  company: { id: string; name: string };
  levels: ProductLevel[];
  totals: Record<number, number>;
  roots: ProductNode[];
};

// ── Defensive narrowing primitives ───────────────────────────────────────────

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** String (or string[] joined with ", ") → display text; anything else → null. */
export const asText = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const parts = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    return parts.length ? parts.join(', ') : null;
  }
  return null;
};

/** string[] with non-strings dropped; anything else → []. */
export const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

// ── Level-specific facts ──────────────────────────────────────────────────────

export type SegmentPattern = { name: string; components: string[] };
export type SegmentFacts = {
  canonicalName: string | null;
  systems: string | null;
  legacyVariants: string | null;
  distribution: string | null;
  placement: string | null;
  reinsurance: string | null;
  regulatory: string | null;
  patterns: SegmentPattern[];
};

/** L1 segment attributes. */
export function segmentFacts(attributes: unknown): SegmentFacts {
  const a = rec(attributes);
  const patterns: SegmentPattern[] = Array.isArray(a.patterns)
    ? a.patterns
        .map((p) => {
          const pr = rec(p);
          return { name: asText(pr.name) ?? '', components: asStrings(pr.components) };
        })
        .filter((p) => p.name !== '' || p.components.length > 0)
    : [];
  return {
    canonicalName: asText(a.canonicalName),
    systems: asText(a.systems),
    legacyVariants: asText(a.legacyVariants),
    distribution: asText(a.distribution),
    placement: asText(a.placement),
    reinsurance: asText(a.reinsurance),
    regulatory: asText(a.regulatory),
    patterns,
  };
}

/** L2 LOB / product-family attributes. */
export function lobFacts(attributes: unknown): { componentsExtended: string | null } {
  return { componentsExtended: asText(rec(attributes).componentsExtended) };
}

/** L3 product attributes. */
export function productFacts(attributes: unknown): { runsIn: string | null } {
  return { runsIn: asText(rec(attributes).runsIn) };
}

/** L4 version / jurisdiction attributes. */
export function versionFacts(attributes: unknown): {
  version: string | null;
  jurisdiction: string | null;
  effective: string | null;
} {
  const a = rec(attributes);
  return {
    version: asText(a.version),
    jurisdiction: asText(a.jurisdiction),
    effective: asText(a.effective),
  };
}

export type ComponentElement = {
  element: string;
  description: string | null; // what the item IS (coverage / factor / rule …)
  livesIn: string;
  format: string;
};
export type ComponentFacts = {
  owner: string | null;
  currentExpression: string | null;
  formats: string[];
  elements: ComponentElement[];
};

/** L5 model-component attributes. */
export function componentFacts(attributes: unknown): ComponentFacts {
  const a = rec(attributes);
  const elements: ComponentElement[] = Array.isArray(a.elements)
    ? a.elements
        .map((e) => {
          const er = rec(e);
          return {
            element: asText(er.element) ?? '',
            description: asText(er.description),
            livesIn: asText(er.livesIn) ?? '',
            format: asText(er.format) ?? '',
          };
        })
        .filter((e) => e.element !== '' || e.livesIn !== '' || e.format !== '')
    : [];
  return {
    owner: asText(a.owner),
    currentExpression: asText(a.currentExpression),
    formats: asStrings(a.formats),
    elements,
  };
}

/** L4 status → StatusPill tone (Active/Bound green, Renewal only amber, Runoff/Expired slate). */
export function statusTone(status: string | null): PillTone {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'active' || s === 'bound') return 'green';
  if (s === 'renewal only') return 'amber';
  return 'slate';
}

// ── Flat version rows ─────────────────────────────────────────────────────────

/**
 * One row of the flat Product Model list — an L4 version with its ancestry
 * (segment › LOB › product) denormalized for display/filtering, the `runsIn`
 * fact inherited from the L3 parent, and the L5 model components kept for the
 * detail sidebar.
 */
export type VersionRow = {
  /** The L4 node id (row key + detail-page deep link). */
  id: string;
  segment: string;
  lob: string;
  product: string;
  /** L4 name, falling back to `attributes.version`. */
  version: string;
  jurisdiction: string | null;
  status: string | null;
  effective: string | null;
  /** From the L3 parent's `attributes.runsIn`. */
  runsIn: string | null;
  /** The version's L5 children (model components), sort-ordered. */
  components: ProductNode[];
};

const byOrder = (a: ProductNode, b: ProductNode) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** Flatten the L1→L4 tree to one row per L4 version (sort-ordered at every level). */
export function flattenVersions(roots: ProductNode[]): VersionRow[] {
  const out: VersionRow[] = [];
  for (const seg of [...roots].sort(byOrder)) {
    for (const lob of [...seg.children].sort(byOrder)) {
      for (const product of [...lob.children].sort(byOrder)) {
        const { runsIn } = productFacts(product.attributes);
        for (const ver of [...product.children].sort(byOrder)) {
          const v = versionFacts(ver.attributes);
          out.push({
            id: ver.id,
            segment: seg.name,
            lob: lob.name,
            product: product.name,
            version: ver.name.trim() !== '' ? ver.name : (v.version ?? ''),
            jurisdiction: v.jurisdiction,
            status: ver.status,
            effective: v.effective,
            runsIn,
            components: [...ver.children].sort(byOrder),
          });
        }
      }
    }
  }
  return out;
}
