import { describe, expect, it } from 'vitest';
import {
  computeTriageScore,
  divergenceWeight,
  evaluateAppetite,
  evaluateRule,
  sha256,
  validateAuthority,
} from '../../../src/lib/uw/engine.js';
import type {
  AppetiteStatementInput,
  AuthorityGrantInput,
  DecisionTableRow,
} from '../../../src/lib/uw/types.js';

const asOf = new Date('2026-08-03T00:00:00Z');

const statement = (over: Partial<AppetiteStatementInput> = {}): AppetiteStatementInput => ({
  ref: 'AS-114',
  version: 9,
  stance: 'TARGET',
  lob: 'CP',
  naicsCodes: '4931',
  geographies: 'SC,NC,GA,FL',
  tivMax: 75_000_000,
  effectiveFrom: new Date('2026-07-01T00:00:00Z'),
  effectiveTo: null,
  ...over,
});

describe('evaluateAppetite', () => {
  it('returns IN with cited statement refs for a matching TARGET statement', () => {
    const v = evaluateAppetite([statement()], {
      lob: 'CP',
      naics: '4931',
      geography: 'SC',
      tivTotal: 48_000_000,
      asOf,
    });
    expect(v.verdict).toBe('IN');
    expect(v.citedStatements).toEqual([{ ref: 'AS-114', version: 9, stance: 'TARGET' }]);
  });

  it('any matching DECLINE statement forces OUT even when a TARGET also matches', () => {
    const v = evaluateAppetite(
      [
        statement(),
        statement({
          ref: 'AS-090',
          version: 5,
          stance: 'DECLINE',
          naicsCodes: null,
          geographies: null,
        }),
      ],
      { lob: 'CP', naics: '4931', geography: 'SC', tivTotal: 1_000_000, asOf },
    );
    expect(v.verdict).toBe('OUT');
    expect(v.citedStatements.map((c) => c.ref)).toContain('AS-090');
  });

  it('REFER stance match yields EDGE; TIV within 110% of the cap also yields EDGE', () => {
    const refer = evaluateAppetite([statement({ stance: 'REFER' })], {
      lob: 'CP',
      naics: '4931',
      geography: 'SC',
      tivTotal: 1,
      asOf,
    });
    expect(refer.verdict).toBe('EDGE');
    const nearCap = evaluateAppetite([statement()], {
      lob: 'CP',
      naics: '4931',
      geography: 'SC',
      tivTotal: 80_000_000,
      asOf,
    });
    expect(nearCap.verdict).toBe('EDGE');
  });

  it('no matching statement returns NO_STATEMENT with zero citations (LLR-04 precondition)', () => {
    const v = evaluateAppetite([statement()], {
      lob: 'WC',
      naics: '4931',
      geography: 'SC',
      tivTotal: 1,
      asOf,
    });
    expect(v.verdict).toBe('NO_STATEMENT');
    expect(v.citedStatements).toHaveLength(0);
  });

  it('ignores statements outside their effective window (versioned, effective-dated)', () => {
    const expired = statement({ effectiveTo: new Date('2026-07-31T00:00:00Z') });
    const v = evaluateAppetite([expired], {
      lob: 'CP',
      naics: '4931',
      geography: 'SC',
      tivTotal: 1,
      asOf,
    });
    expect(v.verdict).toBe('NO_STATEMENT');
  });
});

const grant = (over: Partial<AuthorityGrantInput> = {}): AuthorityGrantInput => ({
  ref: 'AG-31',
  version: 1,
  premiumMax: 500_000,
  tivMax: 40_000_000,
  lineSize: null,
  lobs: 'CP,EB',
  territories: 'SC,NC,GA',
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  effectiveTo: null,
  ...over,
});

describe('validateAuthority (pure function, INV-1)', () => {
  it('passes when every limit holds and reports each check row', () => {
    const r = validateAuthority(grant(), {
      premium: 412_000,
      tivTotal: 38_000_000,
      lob: 'CP',
      territory: 'SC',
      asOf,
    });
    expect(r.pass).toBe(true);
    expect(r.checks.every((c) => c.pass)).toBe(true);
    expect(r.checks.map((c) => c.limit)).toEqual(
      expect.arrayContaining(['premiumMax', 'tivMax', 'lob', 'territory']),
    );
  });

  it('flags a TIV breach explicitly while premium passes (wireframe AG-31 case)', () => {
    const r = validateAuthority(grant(), {
      premium: 412_000,
      tivTotal: 48_000_000,
      lob: 'CP',
      territory: 'SC',
      asOf,
    });
    expect(r.pass).toBe(false);
    const tiv = r.checks.find((c) => c.limit === 'tivMax');
    expect(tiv?.pass).toBe(false);
    expect(r.checks.find((c) => c.limit === 'premiumMax')?.pass).toBe(true);
  });

  it('fails on LOB outside the grant and on an expired window', () => {
    expect(validateAuthority(grant(), { premium: 1, tivTotal: 1, lob: 'WC', asOf }).pass).toBe(
      false,
    );
    expect(
      validateAuthority(grant({ effectiveTo: new Date('2026-06-30T00:00:00Z') }), {
        premium: 1,
        tivTotal: 1,
        lob: 'CP',
        asOf,
      }).pass,
    ).toBe(false);
  });

  it('is deterministic: same inputs produce identical results (NFR-02)', () => {
    const a = validateAuthority(grant(), {
      premium: 250_000,
      tivTotal: 10_000_000,
      lob: 'EB',
      territory: 'NC',
      asOf,
    });
    const b = validateAuthority(grant(), {
      premium: 250_000,
      tivTotal: 10_000_000,
      lob: 'EB',
      territory: 'NC',
      asOf,
    });
    expect(a).toEqual(b);
  });
});

describe('computeTriageScore (explainable lenses, LLR-05)', () => {
  it('scores IN-appetite known-broker submissions above OUT-appetite unknown ones', () => {
    const high = computeTriageScore({
      appetiteVerdict: 'IN',
      brokerKnown: true,
      tivTotal: 48_000_000,
      extractionGaps: 0,
      enrichmentCount: 3,
    });
    const low = computeTriageScore({
      appetiteVerdict: 'OUT',
      brokerKnown: false,
      tivTotal: 100_000,
      extractionGaps: 3,
      enrichmentCount: 0,
    });
    expect(high.composite).toBeGreaterThan(low.composite);
    expect(high.weightsVersion).toBe('w1');
    expect(high.rationale.appetiteFit).toContain('IN');
  });

  it('penalizes extraction gaps on the effort lens only', () => {
    const clean = computeTriageScore({
      appetiteVerdict: 'IN',
      brokerKnown: true,
      tivTotal: 1_000_000,
      extractionGaps: 0,
      enrichmentCount: 0,
    });
    const gappy = computeTriageScore({
      appetiteVerdict: 'IN',
      brokerKnown: true,
      tivTotal: 1_000_000,
      extractionGaps: 4,
      enrichmentCount: 0,
    });
    expect(gappy.effort).toBeLessThan(clean.effort);
    expect(gappy.appetiteFit).toBe(clean.appetiteFit);
  });
});

describe('evaluateRule (deterministic decision tables, HLR-09)', () => {
  const rows: DecisionTableRow[] = [
    {
      when: { floodZone: 'AE', sublimit: { op: 'lt', value: 250_000 } },
      outcome: 'REFER',
      note: 'flood sublimit floor',
    },
    { when: { floodZone: 'AE' }, outcome: 'PASS', note: 'AE with adequate sublimit' },
    { when: { roofingPct: { op: 'gt', value: 40 } }, outcome: 'DECLINE' },
  ];

  it('first-match-wins with the matched row index and note', () => {
    const r = evaluateRule(rows, { floodZone: 'AE', sublimit: 100_000 });
    expect(r.outcome).toBe('REFER');
    expect(r.matchedRow).toBe(0);
    expect(r.note).toBe('flood sublimit floor');
  });

  it('returns NO_MATCH when no row matches, still with an inputsHash', () => {
    const r = evaluateRule(rows, { floodZone: 'X', sublimit: 1 });
    expect(r.outcome).toBe('NO_MATCH');
    expect(r.inputsHash).toHaveLength(64);
  });

  it('inputsHash is reproducible bit-for-bit for identical inputs (NFR-02)', () => {
    const a = evaluateRule(rows, { floodZone: 'AE', sublimit: 100_000 });
    const b = evaluateRule(rows, { floodZone: 'AE', sublimit: 100_000 });
    expect(a.inputsHash).toBe(b.inputsHash);
    expect(a.inputsHash).toBe(sha256({ floodZone: 'AE', sublimit: 100_000 }));
  });
});

describe('divergenceWeight (1 - similarity, LLR-14)', () => {
  it('identical artifacts diverge at 0 and disjoint artifacts near 1', () => {
    const same = { stance: 'TARGET', naics: '4931', geo: 'SC,NC' };
    expect(divergenceWeight(same, { ...same })).toBe(0);
    expect(divergenceWeight(same, { totally: 'different', shape: 12345 })).toBeGreaterThan(0.7);
  });

  it('near-duplicates land between 0 and the merge threshold', () => {
    const w = divergenceWeight(
      { stance: 'TARGET', naics: '4931', geo: 'SC,NC,GA', tiv: 75_000_000 },
      { stance: 'TARGET', naics: '4931', geo: 'SC,NC,FL', tiv: 75_000_000 },
    );
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.6);
  });
});
