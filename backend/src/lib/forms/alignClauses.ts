// Ad-hoc clause alignment for the two-form verbiage comparison (no working
// set required). Pairing runs in three passes: normalized-hash equality first
// (free), then greedy best-Jaccard over the remainder, and whatever stays
// unpaired surfaces as unique to its side. Unique-B clauses interleave after
// the row of their nearest preceding paired B clause so the merged list reads
// in document order on both sides, the way a two-pane diff tool lays it out.
import { clauseSimilarity, tokenSet, jaccard } from './similarity.js';

/** The clause fields the aligner needs — a projection of FormClause. */
export interface ClauseLite {
  id: string;
  ordinal: number;
  heading: string | null;
  text: string;
  textHash: string;
}

export type AlignStatus = 'identical' | 'near' | 'divergent' | 'unique';

export interface AlignedRow {
  a: ClauseLite | null;
  b: ClauseLite | null;
  status: AlignStatus;
  similarity: number;
}

export interface AlignSummary {
  identical: number;
  near: number;
  divergent: number;
  uniqueA: number;
  uniqueB: number;
  total: number;
  /** Mean pair similarity over ALL rows (uniques count 0) — the headline %. */
  overallSimilarity: number;
}

// Same classification thresholds as the working-set compare
// (routes/forms/workingSets.ts); pairs below MIN_PAIR are not a match at all.
const NEAR_MIN = 0.95;
const MIN_PAIR = 0.3;

function classify(similarity: number): AlignStatus {
  if (similarity === 1) return 'identical';
  return similarity >= NEAR_MIN ? 'near' : 'divergent';
}

/**
 * Align two clause sequences (each in ordinal order) into merged diff rows.
 */
export function alignClauses(clausesA: ClauseLite[], clausesB: ClauseLite[]): AlignedRow[] {
  const pairedB = new Set<string>();
  const pairOf = new Map<string, { b: ClauseLite; similarity: number }>();

  // Pass 1 — normalized-hash equality (identical wording, punctuation aside).
  const bByHash = new Map<string, ClauseLite[]>();
  for (const cb of clausesB) {
    const list = bByHash.get(cb.textHash) ?? [];
    list.push(cb);
    bByHash.set(cb.textHash, list);
  }
  for (const ca of clausesA) {
    const match = (bByHash.get(ca.textHash) ?? []).find((c) => !pairedB.has(c.id));
    if (match) {
      pairedB.add(match.id);
      pairOf.set(ca.id, { b: match, similarity: 1 });
    }
  }

  // Pass 2 — greedy best-Jaccard over the unpaired remainder.
  const restA = clausesA.filter((c) => !pairOf.has(c.id));
  const restB = clausesB.filter((c) => !pairedB.has(c.id));
  const tokens = new Map<string, Set<string>>();
  for (const c of [...restA, ...restB]) tokens.set(c.id, tokenSet(c.text));
  const candidates: { a: ClauseLite; b: ClauseLite; similarity: number }[] = [];
  for (const ca of restA) {
    const ta = tokens.get(ca.id) as Set<string>;
    for (const cb of restB) {
      const sim = jaccard(ta, tokens.get(cb.id) as Set<string>);
      if (sim >= MIN_PAIR) candidates.push({ a: ca, b: cb, similarity: sim });
    }
  }
  candidates.sort((x, y) => y.similarity - x.similarity || x.a.ordinal - y.a.ordinal);
  for (const c of candidates) {
    if (pairOf.has(c.a.id) || pairedB.has(c.b.id)) continue;
    pairedB.add(c.b.id);
    // Hash pass missed but texts may still normalize equal via similarity 1.
    const similarity = c.similarity === 1 ? 1 : clauseSimilarity(c.a.text, c.b.text);
    pairOf.set(c.a.id, { b: c.b, similarity });
  }

  // Emit A-side rows in A document order.
  const rows: AlignedRow[] = clausesA.map((ca) => {
    const pair = pairOf.get(ca.id);
    if (!pair) return { a: ca, b: null, status: 'unique', similarity: 0 };
    return {
      a: ca,
      b: pair.b,
      status: classify(pair.similarity),
      similarity: Number(pair.similarity.toFixed(4)),
    };
  });

  // Interleave unique-B rows after their nearest preceding paired B clause.
  const rowIndexOfB = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.b) rowIndexOfB.set(r.b.id, i);
  });
  const inserts: { after: number; row: AlignedRow }[] = [];
  let lastPairedRow = -1;
  for (const cb of clausesB) {
    if (pairedB.has(cb.id)) {
      lastPairedRow = rowIndexOfB.get(cb.id) ?? lastPairedRow;
      continue;
    }
    inserts.push({
      after: lastPairedRow,
      row: { a: null, b: cb, status: 'unique', similarity: 0 },
    });
  }
  // Insert back-to-front so earlier indices stay valid.
  for (let i = inserts.length - 1; i >= 0; i--) {
    rows.splice(inserts[i].after + 1, 0, inserts[i].row);
  }
  return rows;
}

/** Roll the aligned rows up into the counts the summary band renders. */
export function summarizeAlignment(rows: AlignedRow[]): AlignSummary {
  const summary: AlignSummary = {
    identical: 0,
    near: 0,
    divergent: 0,
    uniqueA: 0,
    uniqueB: 0,
    total: rows.length,
    overallSimilarity: 0,
  };
  let simSum = 0;
  for (const r of rows) {
    if (r.status === 'unique') {
      if (r.a) summary.uniqueA++;
      else summary.uniqueB++;
    } else summary[r.status]++;
    simSum += r.similarity;
  }
  summary.overallSimilarity = rows.length ? Number((simSum / rows.length).toFixed(4)) : 1;
  return summary;
}
