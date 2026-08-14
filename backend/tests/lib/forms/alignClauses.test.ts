import { describe, expect, it } from 'vitest';
import {
  alignClauses,
  summarizeAlignment,
  type ClauseLite,
} from '../../../src/lib/forms/alignClauses.js';
import { clauseTextHash } from '../../../src/lib/forms/similarity.js';

// Prisma-free: the aligner is pure. Clauses are built from raw text so the
// hash pass exercises the same normalization the ingest path uses.

let seq = 0;
function clause(text: string, heading: string | null = null): ClauseLite {
  seq += 1;
  return { id: `c${seq}`, ordinal: seq, heading, text, textHash: clauseTextHash(text) };
}

describe('alignClauses', () => {
  it('pairs hash-equal clauses as identical regardless of punctuation', () => {
    const a = [clause('We will pay those sums the insured becomes legally obligated to pay.')];
    const b = [clause('We will pay, those sums the insured becomes legally obligated to pay')];
    const rows = alignClauses(a, b);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('identical');
    expect(rows[0].similarity).toBe(1);
  });

  it('pairs reworded clauses as divergent and leaves unrelated ones unique', () => {
    const a = [
      clause('Coverage applies to bodily injury and property damage caused by an occurrence.'),
      clause('Duties in the event of occurrence claim or suit notify us promptly.'),
    ];
    const b = [
      clause(
        'Coverage applies to bodily injury and property damage arising out of a covered occurrence during the policy period.',
      ),
      clause(
        'Arbitration disputes shall be resolved by binding arbitration in the state of filing.',
      ),
    ];
    const rows = alignClauses(a, b);
    const divergent = rows.find((r) => r.status === 'divergent');
    expect(divergent?.a?.text).toContain('caused by an occurrence');
    expect(divergent?.b?.text).toContain('covered occurrence');
    expect(rows.filter((r) => r.status === 'unique')).toHaveLength(2);
  });

  it('interleaves unique-B clauses after their preceding paired B clause', () => {
    const shared1 = 'Insuring agreement we will pay covered damages as described in this policy.';
    const shared2 = 'Cancellation we may cancel this policy by mailing written notice.';
    const a = [clause(shared1), clause(shared2)];
    const b = [
      clause(shared1),
      clause('Endorsement lead paint exclusion applies to all residential premises.'),
      clause(shared2),
    ];
    const rows = alignClauses(a, b);
    expect(rows.map((r) => r.status)).toEqual(['identical', 'unique', 'identical']);
    expect(rows[1].a).toBeNull();
    expect(rows[1].b?.text).toContain('lead paint');
  });

  it('does not force a pairing below the minimum similarity floor', () => {
    const a = [clause('Premium audit we may examine your books and records.')];
    const b = [clause('Nuclear energy liability exclusion broad form.')];
    const rows = alignClauses(a, b);
    expect(rows.every((r) => r.status === 'unique')).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

describe('summarizeAlignment', () => {
  it('counts each status bucket and averages similarity across all rows', () => {
    const shared = 'Definitions bodily injury means bodily injury sickness or disease.';
    const a = [clause(shared), clause('Unique to a side only clause about flood coverage limits.')];
    const b = [clause(shared)];
    const rows = alignClauses(a, b);
    const s = summarizeAlignment(rows);
    expect(s).toMatchObject({
      identical: 1,
      near: 0,
      divergent: 0,
      uniqueA: 1,
      uniqueB: 0,
      total: 2,
    });
    expect(s.overallSimilarity).toBe(0.5);
  });

  it('returns full similarity for two empty clause lists', () => {
    const s = summarizeAlignment(alignClauses([], []));
    expect(s.total).toBe(0);
    expect(s.overallSimilarity).toBe(1);
  });
});
