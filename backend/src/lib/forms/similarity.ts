// Clause text normalization + lexical similarity (FORMS-LLR-002, LLD §2.2).
// v1 is deterministic and dependency-free: normalized-hash equality
// short-circuits to 1.0; otherwise token-set Jaccard. The embedding upgrade
// path (pinned model per cluster run) slots in behind the same signature.
import { createHash } from 'node:crypto';

/** Lowercase, strip punctuation, collapse whitespace — hash/compare basis. */
export function normalizeClauseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** sha256 of the normalized text — hash-equal clauses are `identical`. */
export function clauseTextHash(text: string): string {
  return createHash('sha256').update(normalizeClauseText(text)).digest('hex');
}

/** Unique token set of the normalized text. */
export function tokenSet(text: string): Set<string> {
  const norm = normalizeClauseText(text);
  return new Set(norm.length === 0 ? [] : norm.split(' '));
}

/** Jaccard similarity of two token sets (0..1; two empty sets = 1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Clause similarity: 1.0 on normalized-hash equality (no token cost),
 * else token-set Jaccard.
 */
export function clauseSimilarity(textA: string, textB: string): number {
  const normA = normalizeClauseText(textA);
  const normB = normalizeClauseText(textB);
  if (normA === normB) return 1;
  return jaccard(tokenSet(textA), tokenSet(textB));
}

/** Character-bigram set — string similarity basis for short field names. */
export function bigramSet(text: string): Set<string> {
  const norm = normalizeClauseText(text).replace(/\s/g, '');
  const grams = new Set<string>();
  if (norm.length <= 1) {
    if (norm.length === 1) grams.add(norm);
    return grams;
  }
  for (let i = 0; i < norm.length - 1; i++) grams.add(norm.slice(i, i + 2));
  return grams;
}

/** Dice coefficient over character bigrams (0..1) — robust for short names. */
export function bigramSimilarity(a: string, b: string): number {
  const ga = bigramSet(a);
  const gb = bigramSet(b);
  if (ga.size === 0 && gb.size === 0) return 1;
  if (ga.size === 0 || gb.size === 0) return 0;
  let intersection = 0;
  for (const g of ga) if (gb.has(g)) intersection++;
  return (2 * intersection) / (ga.size + gb.size);
}
