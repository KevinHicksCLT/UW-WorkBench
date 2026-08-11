// clustering.ts — the module's load-bearing wall (ADR-001): equivalent
// clauses must group, distinct clauses must not, and matrix cell states must
// derive per the FORMS-LLR-006 tokens.
import { describe, expect, it } from 'vitest';
import { clauseTextHash } from '../../../src/lib/forms/similarity.js';
import {
  clusterClauses,
  deriveCellState,
  type ClusterableClause,
} from '../../../src/lib/forms/clustering.js';

function clause(
  id: string,
  formVersionId: string,
  text: string,
  heading?: string,
): ClusterableClause {
  return { id, formVersionId, text, textHash: clauseTextHash(text), heading: heading ?? null };
}

const INSURED_A =
  'Who Is An Insured is amended to include as an additional insured the person or organization shown in the Schedule.';
const INSURED_B =
  'Who Is An Insured is amended to include as an additional insured the person or organization shown in the Schedule of endorsements.';
const CANCELLATION =
  'This policy may be cancelled by the first named insured by mailing written notice to the company stating a future date of cancellation.';

describe('clusterClauses', () => {
  it('groups equivalent clauses and separates unrelated ones', () => {
    const clusters = clusterClauses(
      [
        clause('c1', 'v1', INSURED_A),
        clause('c2', 'v2', INSURED_B),
        clause('c3', 'v3', CANCELLATION),
      ],
      0.55,
    );
    const sizes = clusters.map((c) => c.memberIds.length).sort();
    expect(sizes).toEqual([1, 2]);
    const pair = clusters.find((c) => c.memberIds.length === 2);
    expect(pair?.memberIds.sort()).toEqual(['c1', 'c2']);
  });

  it('gives hash-identical members similarity 1 and zero divergence', () => {
    const clusters = clusterClauses(
      [clause('c1', 'v1', INSURED_A), clause('c2', 'v2', INSURED_A.toUpperCase())],
      0.55,
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].divergenceScore).toBe(0);
    expect(Object.values(clusters[0].similarities)).toEqual([1, 1]);
  });

  it('elects a representative (medoid) that is a cluster member', () => {
    const clusters = clusterClauses(
      [clause('c1', 'v1', INSURED_A), clause('c2', 'v2', INSURED_B)],
      0.55,
    );
    expect(clusters[0].memberIds).toContain(clusters[0].representativeId);
  });

  it('labels clusters from the representative heading when present', () => {
    const clusters = clusterClauses([clause('c1', 'v1', CANCELLATION, 'A. Cancellation')], 0.55);
    expect(clusters[0].label).toBe('A. Cancellation');
  });

  it('respects θ: a higher threshold splits borderline pairs', () => {
    const loose = clusterClauses(
      [clause('c1', 'v1', INSURED_A), clause('c2', 'v2', INSURED_B)],
      0.55,
    );
    const strict = clusterClauses(
      [clause('c1', 'v1', INSURED_A), clause('c2', 'v2', INSURED_B)],
      0.99,
    );
    expect(loose).toHaveLength(1);
    expect(strict).toHaveLength(2);
  });

  it('returns [] for no clauses', () => {
    expect(clusterClauses([], 0.55)).toEqual([]);
  });
});

describe('deriveCellState', () => {
  const base = {
    hasClause: true,
    hashEqualToRep: false,
    similarity: 0.8,
    clusterSize: 3,
    theta: 0.55,
  };

  it('derives all five FORMS-LLR-006 states', () => {
    expect(deriveCellState({ ...base, hasClause: false })).toBe('absent');
    expect(deriveCellState({ ...base, clusterSize: 1 })).toBe('unique');
    expect(deriveCellState({ ...base, hashEqualToRep: true })).toBe('identical');
    expect(deriveCellState({ ...base, similarity: 0.96 })).toBe('near');
    expect(deriveCellState(base)).toBe('divergent');
  });
});
