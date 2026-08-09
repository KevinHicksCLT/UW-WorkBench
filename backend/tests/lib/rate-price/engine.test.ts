import { describe, expect, it } from 'vitest';
import {
  classifyFactorPair,
  computeDivergence,
  computeQuote,
  disruptionBuckets,
  extractCanonicalSpec,
  optimizationGate,
  parallelRunDelta,
  waveCutoverEligible,
} from '../../../src/lib/rate-price/engine.js';
import type {
  LegacyDefinition,
  RatingSpec,
  SpecFactor,
} from '../../../src/lib/rate-price/types.js';

const glSpec: RatingSpec = {
  inputs: [
    { name: 'payroll', type: 'number' },
    { name: 'classCode', type: 'string' },
    { name: 'lossRatio3yr', type: 'number' },
    { name: 'safetyProgram', type: 'boolean' },
  ],
  factors: [
    { name: 'base rate', kind: 'base_rate', rate: 3.42, exposureInput: 'payroll', per: 100 },
    {
      name: 'class factor',
      kind: 'table',
      input: 'classCode',
      rows: [
        { match: '91560', factor: 1.0 },
        { match: '91580', factor: 1.25 },
      ],
      defaultFactor: 1.15,
    },
    {
      name: 'experience mod',
      kind: 'formula',
      input: 'lossRatio3yr',
      slope: 0.45,
      intercept: 0.78,
      min: 0.75,
      max: 1.4,
    },
    { name: 'schedule credit', kind: 'flag', input: 'safetyProgram', factor: 0.95 },
  ],
  minPremium: 750,
  rounding: 'nearest_1',
};

describe('computeQuote', () => {
  it('anchors on the base rate and multiplies factors in order with a full breakdown', () => {
    const result = computeQuote(glSpec, {
      payroll: 1_000_000,
      classCode: '91580',
      lossRatio3yr: 0.6,
      safetyProgram: true,
    });
    // base 34_200 × 1.25 × (0.45*0.6+0.78=1.05) × 0.95 = 42_643.13 → nearest_1
    expect(result.premium).toBe(42_643);
    expect(result.factorBreakdown.map((r) => r.name)).toEqual([
      'base rate',
      'class factor',
      'experience mod',
      'schedule credit',
    ]);
    expect(result.missingInputs).toEqual([]);
  });

  it('clamps formula factors at their bounds', () => {
    const result = computeQuote(glSpec, {
      payroll: 100_000,
      classCode: '91560',
      lossRatio3yr: 9, // raw 4.83 → clamped to max 1.4
      safetyProgram: false,
    });
    const mod = result.factorBreakdown.find((r) => r.name === 'experience mod');
    expect(mod?.value).toBeCloseTo(1.4, 5);
  });

  it('passes missing inputs through at 1.0 and reports them — never guesses', () => {
    const result = computeQuote(glSpec, { payroll: 500_000 });
    expect(result.missingInputs).toEqual(
      expect.arrayContaining(['classCode', 'lossRatio3yr', 'safetyProgram']),
    );
    expect(result.premium).toBe(17_100); // base only, all factors pass through
  });

  it('applies the minimum-premium floor and unknown table rows fall to the default factor', () => {
    const result = computeQuote(glSpec, {
      payroll: 10_000,
      classCode: '99999',
      lossRatio3yr: 0,
      safetyProgram: false,
    });
    // base 342 × default 1.15 × min-clamped 0.78 → 306.79 → floor 750
    expect(result.premium).toBe(750);
    expect(result.factorBreakdown.at(-1)?.name).toBe('minimum premium');
  });
});

describe('parallelRunDelta', () => {
  it('bands materiality at 1% / 5%', () => {
    expect(parallelRunDelta(100_500, 100_000).materiality).toBe('immaterial');
    expect(parallelRunDelta(103_000, 100_000).materiality).toBe('watch');
    expect(parallelRunDelta(110_000, 100_000)).toEqual({
      delta: 10_000,
      deltaPct: 10,
      materiality: 'material',
    });
  });

  it('handles a zero legacy premium without dividing by zero', () => {
    expect(parallelRunDelta(500, 0).deltaPct).toBe(100);
    expect(parallelRunDelta(0, 0).deltaPct).toBe(0);
  });
});

describe('disruptionBuckets', () => {
  it('distributes premium-change deltas across the four book-impact bands', () => {
    const buckets = disruptionBuckets([-8, -2, 0, 3, 6, 11, 15, 20]);
    expect(buckets.map((b) => b.count)).toEqual([1, 3, 2, 2]);
    expect(buckets[1]).toEqual({ label: '-5% … +5%', count: 3, pctOfBook: 37.5 });
  });

  it('returns zero percentages on an empty book', () => {
    expect(disruptionBuckets([]).every((b) => b.pctOfBook === 0)).toBe(true);
  });
});

describe('extractCanonicalSpec (LLR-18.1)', () => {
  const definition: LegacyDefinition = {
    inputs: [{ name: 'payroll', type: 'number' }],
    factors: [
      {
        name: 'base rate',
        kind: 'base_rate',
        rate: 3.1,
        exposureInput: 'payroll',
        per: 100,
        confidence: 'high',
      },
      {
        name: 'experience mod',
        kind: 'formula',
        input: 'lossRatio3yr',
        slope: 0.5,
        intercept: 0.75,
        confidence: 'medium',
        opaque: true,
      },
    ],
    macros: [{ ref: 'Macro ADJ_OVERRIDE', reason: 'opaque VBA — human review' }],
  };

  it('flags opaque factors and macros as unextracted — exactly, never approximated', () => {
    const result = extractCanonicalSpec(definition);
    expect(result.spec.factors.map((f) => f.name)).toEqual(['base rate']);
    expect(result.spec.unextracted).toEqual([
      { ref: 'Macro ADJ_OVERRIDE', reason: 'opaque VBA — human review' },
      { ref: 'experience mod', reason: 'opaque definition — human review required' },
    ]);
    expect(result.unextractedCount).toBe(2);
    expect(result.extractionConfidence).toBe('low'); // unextracted entries demote confidence
  });

  it('reports full confidence when everything extracts cleanly', () => {
    const clean = extractCanonicalSpec({
      factors: [
        { name: 'base rate', kind: 'base_rate', rate: 1, exposureInput: 'tiv', confidence: 'high' },
      ],
    });
    expect(clean.extractionConfidence).toBe('high');
    expect(clean.spec.unextracted).toEqual([]);
  });
});

describe('classifyFactorPair / computeDivergence (LLR-18.2)', () => {
  const base = (rate: number): SpecFactor => ({
    name: 'base rate',
    kind: 'base_rate',
    rate,
    exposureInput: 'payroll',
  });

  it('classifies the four divergence classes', () => {
    expect(classifyFactorPair(base(3.42), base(3.42)).class).toBe('identical');
    const parametric = classifyFactorPair(base(3.42), base(3.76));
    expect(parametric.class).toBe('parametric-delta');
    expect(parametric.deltaPct).toBeCloseTo(9.94, 1);
    expect(
      classifyFactorPair(base(3.42), {
        name: 'base rate',
        kind: 'formula',
        input: 'payroll',
        slope: 1,
        intercept: 0,
      }).class,
    ).toBe('structural-delta');
    expect(classifyFactorPair(base(3.42), null)).toEqual({
      factor: 'base rate',
      class: 'unique',
      side: 'legacy',
    });
  });

  it('summarizes counts, max delta, and a recommendation across the factor set', () => {
    const legacy: SpecFactor[] = [
      base(3.42),
      {
        name: 'class factor',
        kind: 'table',
        input: 'classCode',
        rows: [{ match: '91560', factor: 1.0 }],
      },
      { name: 'judgment load', kind: 'flag', input: 'judgment', factor: 1.2 },
    ];
    const target: SpecFactor[] = [
      base(3.42),
      {
        name: 'class factor',
        kind: 'table',
        input: 'classCode',
        rows: [{ match: '91560', factor: 1.05 }],
      },
      { name: 'schedule credit', kind: 'flag', input: 'safetyProgram', factor: 0.95 },
    ];
    const summary = computeDivergence(legacy, target);
    expect(summary.counts).toEqual({
      identical: 1,
      'parametric-delta': 1,
      'structural-delta': 0,
      unique: 2,
    });
    expect(summary.maxDivergencePct).toBe(5);
    expect(summary.recommendation).toBe('re-baseline');
  });

  it('recommends retire when every factor is identical', () => {
    expect(computeDivergence([base(3.42)], [base(3.42)]).recommendation).toBe('retire');
  });
});

describe('optimizationGate (ADR-006)', () => {
  const ruleSets = [
    { code: 'CW', optimizationRestricted: false },
    { code: 'CA', optimizationRestricted: true },
  ];

  it('blocks restricted jurisdictions and falls back to the CW row', () => {
    const gate = optimizationGate(ruleSets, ['NC', 'CA']);
    expect(gate.blocked).toBe(true);
    expect(gate.restrictedCodes).toEqual(['CA']); // NC resolves via CW (permitted)
  });

  it('blocks jurisdictions with NO rule-set row when no CW default exists — the table is authoritative', () => {
    const gate = optimizationGate([{ code: 'CA', optimizationRestricted: true }], ['TX']);
    expect(gate.blocked).toBe(true);
    expect(gate.restrictedCodes).toEqual(['TX']);
  });

  it('passes when every target is permitted', () => {
    expect(optimizationGate(ruleSets, ['NC', 'TX']).blocked).toBe(false);
  });
});

describe('waveCutoverEligible (INV-04)', () => {
  it('lists EVERY blocking member, not just the first', () => {
    const result = waveCutoverEligible(
      [
        { raterRef: 'LR-001', humanConfirmed: false, maxDivergencePct: 12 },
        { raterRef: 'LR-002', humanConfirmed: true, maxDivergencePct: null },
      ],
      5,
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      'LR-001: canonical spec not human-confirmed',
      'LR-001: divergence 12% exceeds tolerance 5%',
      'LR-002: no divergence matrix computed',
    ]);
  });

  it('is eligible only when every member is confirmed and within tolerance', () => {
    const result = waveCutoverEligible(
      [{ raterRef: 'LR-002', humanConfirmed: true, maxDivergencePct: 4.2 }],
      5,
    );
    expect(result).toEqual({ eligible: true, blockers: [] });
  });

  it('refuses an empty wave', () => {
    expect(waveCutoverEligible([], 5).eligible).toBe(false);
  });
});
