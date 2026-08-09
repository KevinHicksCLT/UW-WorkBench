// segmentation.ts — rule-pass clause boundaries with citation-grade char
// offsets (FORMS-LLR-001). Offsets must index back into the exact source
// text: a finding's citation depends on it.
import { describe, expect, it } from 'vitest';
import { meanSegConfidence, segmentClauses } from '../../../src/lib/forms/segmentation.js';

const SAMPLE = [
  'COMMERCIAL GENERAL LIABILITY',
  'This endorsement modifies insurance provided under the policy.',
  'A. Who Is An Insured is amended to include the person shown in the Schedule.',
  'But only with respect to liability arising out of your ongoing operations.',
  'B. Exclusions',
  '1. This insurance does not apply to bodily injury occurring after operations are complete.',
  '(a) Except as provided under Section III.',
].join('\n');

describe('segmentClauses', () => {
  it('splits at heading, letter, number and paren boundaries', () => {
    const clauses = segmentClauses(SAMPLE);
    const headings = clauses.map((c) => c.heading);
    expect(headings).toContain('COMMERCIAL GENERAL LIABILITY');
    expect(headings.some((h) => h?.startsWith('A.'))).toBe(true);
    expect(headings).toContain('B. Exclusions');
    // The "1." line exceeds the 80-char heading cap, so it segments as a
    // clause body (level 2) with a null heading.
    expect(clauses.some((c) => c.text.startsWith('1.') && c.level === 2)).toBe(true);
    expect(headings.some((h) => h?.startsWith('(a)'))).toBe(true);
  });

  it('assigns nesting levels by grammar (heading=1, A./1.=2, (a)=3)', () => {
    const clauses = segmentClauses(SAMPLE);
    const byHeading = new Map(clauses.map((c) => [c.heading, c.level]));
    expect(byHeading.get('COMMERCIAL GENERAL LIABILITY')).toBe(1);
    expect(byHeading.get('B. Exclusions')).toBe(2);
    expect(byHeading.get('(a) Except as provided under Section III.')).toBe(3);
  });

  it('emits char offsets that slice back to the clause text', () => {
    for (const c of segmentClauses(SAMPLE)) {
      expect(SAMPLE.slice(c.charStart, c.charEnd).trim()).toBe(c.text);
    }
  });

  it('keeps continuation lines inside the preceding clause', () => {
    const clauses = segmentClauses(SAMPLE);
    const a = clauses.find((c) => c.heading?.startsWith('A.'));
    expect(a?.text).toContain('ongoing operations');
  });

  it('numbers ordinals sequentially from 1', () => {
    const clauses = segmentClauses(SAMPLE);
    expect(clauses.map((c) => c.ordinal)).toEqual(clauses.map((_, i) => i + 1));
  });

  it('treats boundary-free text as one low-confidence clause (quarantine path)', () => {
    const clauses = segmentClauses('just some flat scanned text with no structure');
    expect(clauses).toHaveLength(1);
    expect(clauses[0].segConfidence).toBeLessThan(0.7);
  });

  it('captures preamble text before the first boundary', () => {
    const clauses = segmentClauses(SAMPLE);
    expect(clauses.some((c) => c.text.includes('This endorsement modifies'))).toBe(true);
  });
});

describe('meanSegConfidence', () => {
  it('averages clause confidences and is 0 for no clauses', () => {
    expect(meanSegConfidence([])).toBe(0);
    const clauses = segmentClauses(SAMPLE);
    const mean = meanSegConfidence(clauses);
    expect(mean).toBeGreaterThan(0.7);
    expect(mean).toBeLessThanOrEqual(1);
  });
});
