// Clause clustering (FORMS-LLR-005, LLD §2.2): agglomerative, average
// linkage, configurable threshold θ. The cluster — not the pairwise diff —
// is the portfolio-scale analysis primitive (ADR-001). Also derives the
// matrix cell states (FORMS-LLR-006).
import { clauseSimilarity } from './similarity.js';

export type ClusterableClause = {
  id: string;
  formVersionId: string;
  text: string;
  textHash: string;
  heading: string | null;
};

export type ClusterResult = {
  /** Medoid — the member with the highest mean similarity to the others. */
  representativeId: string;
  memberIds: string[];
  /** similarity(member, representative) per member id. */
  similarities: Record<string, number>;
  /** 1 − min pairwise similarity within the cluster. */
  divergenceScore: number;
  /** Members whose similarity to the representative falls below θ + margin. */
  outlierIds: string[];
  label: string;
};

const OUTLIER_MARGIN = 0.1;

/**
 * Agglomerative average-linkage clustering over clauses. O(n²) pairwise
 * similarity with hash-equality short-circuit; merges the closest pair of
 * clusters until no pair's average linkage clears θ.
 */
export function clusterClauses(clauses: ClusterableClause[], theta: number): ClusterResult[] {
  const n = clauses.length;
  if (n === 0) return [];

  // Pairwise similarity matrix (hash-equal ⇒ 1.0 without token cost).
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s =
        clauses[i].textHash === clauses[j].textHash
          ? 1
          : clauseSimilarity(clauses[i].text, clauses[j].text);
      sim[i][j] = s;
      sim[j][i] = s;
    }
  }

  // Agglomerative merge loop over index groups.
  let groups: number[][] = clauses.map((_, i) => [i]);
  const avgLinkage = (a: number[], b: number[]): number => {
    let total = 0;
    for (const i of a) for (const j of b) total += sim[i][j];
    return total / (a.length * b.length);
  };
  for (;;) {
    let bestA = -1;
    let bestB = -1;
    let bestSim = theta;
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        const link = avgLinkage(groups[a], groups[b]);
        if (link >= bestSim) {
          bestSim = link;
          bestA = a;
          bestB = b;
        }
      }
    }
    if (bestA === -1) break;
    groups[bestA] = [...groups[bestA], ...groups[bestB]];
    groups = groups.filter((_, idx) => idx !== bestB);
  }

  return groups.map((group) => {
    // Medoid: highest mean similarity to the rest of the group.
    let repIdx = group[0];
    let repScore = -1;
    for (const i of group) {
      const mean =
        group.length === 1
          ? 1
          : group.filter((j) => j !== i).reduce((sum, j) => sum + sim[i][j], 0) /
            (group.length - 1);
      if (mean > repScore) {
        repScore = mean;
        repIdx = i;
      }
    }
    let minPairwise = 1;
    for (const i of group)
      for (const j of group) if (j > i) minPairwise = Math.min(minPairwise, sim[i][j]);
    const similarities: Record<string, number> = {};
    const outlierIds: string[] = [];
    for (const i of group) {
      const s = i === repIdx ? 1 : sim[i][repIdx];
      similarities[clauses[i].id] = s;
      if (s < theta + OUTLIER_MARGIN && group.length > 1 && i !== repIdx) {
        outlierIds.push(clauses[i].id);
      }
    }
    const rep = clauses[repIdx];
    const label = rep.heading ?? (rep.text.length > 60 ? `${rep.text.slice(0, 57)}…` : rep.text);
    return {
      representativeId: rep.id,
      memberIds: group.map((i) => clauses[i].id),
      similarities,
      divergenceScore: Number((1 - minPairwise).toFixed(4)),
      outlierIds,
      label,
    };
  });
}

export type CellState = 'identical' | 'near' | 'divergent' | 'unique' | 'absent';

/**
 * Matrix cell state for one (cluster, form) pair (FORMS-LLR-006 tokens):
 * identical (hash-equal to representative) · near (sim ≥ 0.95) · divergent
 * (θ ≤ sim < 0.95) · unique (single-member cluster) · absent (no clause).
 */
export function deriveCellState(input: {
  hasClause: boolean;
  hashEqualToRep: boolean;
  similarity: number;
  clusterSize: number;
  theta: number;
}): CellState {
  if (!input.hasClause) return 'absent';
  if (input.clusterSize <= 1) return 'unique';
  if (input.hashEqualToRep) return 'identical';
  if (input.similarity >= 0.95) return 'near';
  return 'divergent';
}
