// Ontology-backed semantic matcher for the Normalize column (workspace board
// v3). Pre-pgvector implementation of the AUTO / REVIEW / HELD verdicts: raw
// findings from multiple legacy sources are normalized by name, clustered
// against each other and against taxonomy concepts (the anatomy catalogs), and
// each cluster gets a match verdict:
//   AUTO   — sources are semantically the same ("2→1 semantically same · auto")
//   REVIEW — same concept, but attribute deltas need a human decision
//   HELD   — sources look related but no concept agreement; held for sign-off
// The comparator is injectable so PM-09 can swap token overlap for cosine
// similarity over embeddings without changing any caller.

export type MatchStatus = 'AUTO' | 'REVIEW' | 'HELD';

/** One raw finding (screen/step/product feature) from a legacy source. */
export interface RawItem {
  id: string;
  /** Legacy app / legacy product model the item came from. */
  sourceId: string;
  name: string;
  /** Comparable facts (field counts, thresholds, formats). Missing = unknown. */
  attributes?: Record<string, string | number | boolean | null>;
}

/** A taxonomy concept (anatomy-catalog row / SKOS concept) to match against. */
export interface Concept {
  slug: string;
  label: string;
  altLabels?: string[];
}

/** PM-09 swap point: replace token overlap with embedding cosine similarity. */
export interface NameComparator {
  /** 0..1 similarity between two raw (un-normalized) names. */
  similarity(a: string, b: string): number;
}

export interface MatchGroup {
  /** Stable cluster key: the agreed concept slug, else the normalized name. */
  key: string;
  conceptSlug: string | null;
  items: RawItem[];
  status: MatchStatus;
  /** Human sentence behind an AUTO verdict ("all 14 attributes match…"). */
  matchBasis: string | null;
  /** Human sentence behind REVIEW/HELD ("attribute values differ: …"). */
  differenceNote: string | null;
}

// Names are compared on their meaningful tokens only. Deliberately small list —
// insurance terms ("form", "rule", "feed") are signal, not noise.
const STOPWORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'per', 'the', 'to']);

/** Singularize one lowercased token with cheap, safe heuristics. */
function singularize(token: string): string {
  if (token.length > 3 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  // Only strip "es" after sibilant stems (boxes, matches) — "rules" keeps its e.
  if (token.length > 4 && /(?:x|ch|sh|z|ss)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/** Casefold, strip punctuation, drop stopwords, singularize. Order preserved. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(singularize)
    .join(' ');
}

/** Default comparator: Jaccard overlap of normalized token sets. */
export const tokenComparator: NameComparator = {
  similarity(a: string, b: string): number {
    const ta = new Set(normalizeName(a).split(' ').filter(Boolean));
    const tb = new Set(normalizeName(b).split(' ').filter(Boolean));
    if (ta.size === 0 || tb.size === 0) return 0;
    let shared = 0;
    for (const t of ta) if (tb.has(t)) shared++;
    return shared / (ta.size + tb.size - shared);
  },
};

// Two names are the same entry above AUTO_SIM; related-but-unresolved above
// HELD_SIM. Between them is the HELD grey zone the wireframe holds for review.
const AUTO_SIM = 0.8;
const HELD_SIM = 0.5;

/** Best concept for a name: exact normalized label match, else best ≥ AUTO_SIM. */
export function matchConcept(
  name: string,
  concepts: Concept[],
  comparator: NameComparator = tokenComparator,
): string | null {
  const norm = normalizeName(name);
  let best: { slug: string; score: number } | null = null;
  for (const c of concepts) {
    for (const label of [c.label, ...(c.altLabels ?? [])]) {
      if (normalizeName(label) === norm) return c.slug;
      const score = comparator.similarity(name, label);
      if (score >= AUTO_SIM && (!best || score > best.score)) best = { slug: c.slug, score };
    }
  }
  return best?.slug ?? null;
}

/** Attribute keys whose values differ across items (only keys both sides set). */
function attributeDeltas(items: RawItem[]): string[] {
  const deltas = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].attributes ?? {};
      const b = items[j].attributes ?? {};
      for (const k of Object.keys(a)) {
        if (k in b && a[k] !== b[k]) deltas.add(k);
      }
    }
  }
  return [...deltas].sort();
}

/** Count of attribute keys shared (and equal) across every item in the group. */
function sharedEqualAttributeCount(items: RawItem[]): number {
  const first = items[0]?.attributes ?? {};
  let count = 0;
  for (const k of Object.keys(first)) {
    if (items.every((it) => it.attributes && k in it.attributes && it.attributes[k] === first[k]))
      count++;
  }
  return count;
}

interface Cluster {
  conceptSlug: string | null;
  /** Concept slugs seen across members — disagreement drives HELD. */
  conceptVotes: Set<string | null>;
  norm: string;
  items: RawItem[];
}

/**
 * Cluster raw items across sources and verdict each cluster. Deterministic:
 * items are processed in input order; an item joins the first cluster whose
 * concept it shares or whose representative name is similar enough
 * (≥ HELD_SIM), else starts its own cluster.
 */
export function matchItems(
  items: RawItem[],
  concepts: Concept[],
  comparator: NameComparator = tokenComparator,
): MatchGroup[] {
  const clusters: Cluster[] = [];

  for (const item of items) {
    const slug = matchConcept(item.name, concepts, comparator);
    const norm = normalizeName(item.name);
    const home = clusters.find((c) => {
      if (slug !== null && c.conceptSlug !== null) return c.conceptSlug === slug;
      if (c.norm === norm) return true;
      return comparator.similarity(c.items[0].name, item.name) >= HELD_SIM;
    });
    if (home) {
      home.items.push(item);
      home.conceptVotes.add(slug);
      if (home.conceptSlug === null && slug !== null) home.conceptSlug = slug;
    } else {
      clusters.push({ conceptSlug: slug, conceptVotes: new Set([slug]), norm, items: [item] });
    }
  }

  return clusters.map((c) => {
    const sources = new Set(c.items.map((i) => i.sourceId));
    let status: MatchStatus;
    let matchBasis: string | null = null;
    let differenceNote: string | null = null;

    if (sources.size < 2) {
      // Single-source item: nothing to reconcile, carries over as normalized.
      status = 'AUTO';
      matchBasis = 'single source — carried over as-is';
    } else {
      const deltas = attributeDeltas(c.items);
      const names = new Set(c.items.map((i) => normalizeName(i.name)));
      const conceptAgreed =
        c.conceptSlug !== null && [...c.conceptVotes].every((v) => v === c.conceptSlug);
      // Names count as "the same" when every pair clears the auto threshold —
      // with the default comparator that's token overlap; with an embedding
      // comparator (PM-09) it becomes semantic equivalence.
      const namesAuto = c.items.every((a, i) =>
        c.items.slice(i + 1).every((b) => comparator.similarity(a.name, b.name) >= AUTO_SIM),
      );
      if (deltas.length === 0 && (conceptAgreed || names.size === 1 || namesAuto)) {
        status = 'AUTO';
        const n = sharedEqualAttributeCount(c.items);
        matchBasis =
          n > 0
            ? `${sources.size}→1 semantically same — all ${n} attribute${n === 1 ? '' : 's'} match`
            : `${sources.size}→1 semantically same — names match`;
      } else if (conceptAgreed) {
        status = 'REVIEW';
        differenceNote = `semantically different — attribute values differ: ${deltas.join(', ')}`;
      } else {
        status = 'HELD';
        differenceNote = 'related sources with no concept agreement — held for sign-off';
      }
    }

    return {
      key: c.conceptSlug ?? c.norm,
      conceptSlug: c.conceptSlug,
      items: c.items,
      status,
      matchBasis,
      differenceNote,
    };
  });
}
