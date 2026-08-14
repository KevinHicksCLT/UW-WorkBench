// similarity.ts — normalization, hashing and the lexical similarity floor the
// clustering quality gate stands on (LLD §2.2).
import { describe, expect, it } from 'vitest';
import {
  bigramSimilarity,
  clauseSimilarity,
  clauseTextHash,
  jaccard,
  normalizeClauseText,
  tokenSet,
} from '../../../src/lib/forms/similarity.js';

describe('normalizeClauseText', () => {
  it('collapses case, punctuation and whitespace', () => {
    expect(normalizeClauseText('  We  will PAY those sums;   ')).toBe('we will pay those sums');
    expect(normalizeClauseText('per-occurrence (limit)')).toBe('per occurrence limit');
  });
});

describe('clauseTextHash', () => {
  it('is identical for formatting-only variants (hash dedup pre-clustering)', () => {
    const a = clauseTextHash('We will pay those sums.');
    const b = clauseTextHash('WE WILL PAY   those sums');
    expect(a).toBe(b);
  });

  it('differs on substantive wording changes', () => {
    expect(clauseTextHash('We will pay those sums.')).not.toBe(
      clauseTextHash('We may pay those sums.'),
    );
  });
});

describe('jaccard / tokenSet', () => {
  it('computes intersection-over-union on token sets', () => {
    const a = tokenSet('coverage applies to bodily injury');
    const b = tokenSet('coverage applies to property damage');
    // intersection {coverage, applies, to} = 3; union of 7 distinct tokens → 3/7
    expect(jaccard(a, b)).toBeCloseTo(3 / 7, 5);
  });

  it('handles empty inputs without dividing by zero', () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(tokenSet('x'), new Set())).toBe(0);
  });
});

describe('clauseSimilarity', () => {
  it('short-circuits to 1.0 on normalized equality', () => {
    expect(clauseSimilarity('We will pay.', 'we WILL pay')).toBe(1);
  });

  it('scores related wordings between 0 and 1', () => {
    const s = clauseSimilarity(
      'We will pay those sums that the insured becomes legally obligated to pay as damages.',
      'We shall pay all sums which the insured is legally obligated to pay as damages.',
    );
    expect(s).toBeGreaterThan(0.4);
    expect(s).toBeLessThan(1);
  });
});

describe('bigramSimilarity', () => {
  it('rates near-identical field names highly', () => {
    expect(bigramSimilarity('InsuredFEIN', 'insured fein')).toBeGreaterThan(0.8);
  });

  it('rates unrelated names low', () => {
    expect(bigramSimilarity('PolicyNumber', 'signature')).toBeLessThan(0.3);
  });

  it('handles empty and single-char inputs', () => {
    expect(bigramSimilarity('', '')).toBe(1);
    expect(bigramSimilarity('a', '')).toBe(0);
  });
});
