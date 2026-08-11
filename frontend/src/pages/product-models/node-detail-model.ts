// node-detail-model.ts — payload types + attribute-narrowing helpers for the
// Product Model node detail page (ProductNodeDetail). GET /product-spine/node/:id
// returns each node's level-specific facts as an untyped `attributes` JSON blob;
// the helpers below narrow it defensively (every field is optional — missing or
// mis-typed values coerce to null / []) so the UI never trusts the shape.
//
// Deliberately self-contained: the sibling components/product-list/ module has
// look-alike helpers, but it is being rewritten concurrently — this page must
// not depend on its exports.

import type { ChipVariant, PillTone } from '../../components/ui';

/** One row of the user-editable level naming (L1..L5). */
export type ProductLevel = { levelNumber: number; dbValue: string; name: string };

/** The requested node (and the shape its children share). */
export type DetailNode = {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  /** L4 versions only: Active | Bound | Renewal only | Runoff. */
  status: string | null;
  sortOrder: number;
  /** Level-specific facts — narrow via the *Facts helpers below. */
  attributes: unknown;
};

/** A direct child row — same shape plus its own child count. */
export type ChildNode = DetailNode & { childCount: number };

/** Response of GET /product-spine/node/:id. */
export type NodeDetailData = {
  node: DetailNode;
  /** Ancestor chain, root first. */
  ancestors: { id: string; name: string; levelNumber: number }[];
  children: ChildNode[];
  levels: ProductLevel[];
};

// ── Defensive narrowing primitives ───────────────────────────────────────────

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** String (or string[] joined with ", ") → display text; anything else → null. */
const asText = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const parts = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    return parts.length ? parts.join(', ') : null;
  }
  return null;
};

/** string[] with non-strings dropped; anything else → []. */
const asStrings = (v: unknown): string[] =>
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
export type VersionFacts = {
  version: string | null;
  jurisdiction: string | null;
  effective: string | null;
};

export function versionFacts(attributes: unknown): VersionFacts {
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
  /** PolicyForm library identity (Forms components only) — opens the actual
   *  form document. */
  formId: string | null;
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
            formId: asText(er.formId),
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

// ── Display helpers ───────────────────────────────────────────────────────────

/** L4 status → StatusPill tone (Active/Bound green, Renewal only amber, else slate). */
export function statusTone(status: string | null): PillTone {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'active' || s === 'bound') return 'green';
  if (s === 'renewal only') return 'amber';
  return 'slate';
}

/** User-editable caption for a level number; falls back to "Level N". */
export function levelCaption(levels: ProductLevel[], levelNumber: number): string {
  return levels.find((l) => l.levelNumber === levelNumber)?.name ?? `Level ${levelNumber}`;
}

/** "3 Products" / "1 Product" — naive pluralisation of a level caption. */
export function countCaption(count: number, caption: string): string {
  const plural = count === 1 || /s$/i.test(caption) ? caption : `${caption}s`;
  return `${count} ${plural}`;
}

// Stable Chip tone per format bucket: the same format string always hashes to
// the same variant, so e.g. every "XML" chip on the page shares one colour.
const FORMAT_VARIANTS: readonly ChipVariant[] = ['soft', 'domain-core', 'domain-it', 'domain-corp'];

/** Deterministic Chip variant for a format bucket. */
export function formatChipVariant(format: string): ChipVariant {
  const key = format.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FORMAT_VARIANTS[hash % FORMAT_VARIANTS.length];
}
