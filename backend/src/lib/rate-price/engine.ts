// RATE-PRICE — deterministic rating core (ADR-002 enforcement).
// Every function here is PURE: same inputs → same outputs, replayable forever.
// The route layer persists runs and emits governance events AFTER these
// evaluate; nothing in this file touches I/O. TB executes reference quotes and
// parallel-run evidence only — production execution stays in the client's
// engine of record.
import type {
  CutoverEligibility,
  DisruptionBucket,
  DivergenceCell,
  DivergenceClass,
  DivergenceSummary,
  ExtractionResult,
  FactorBreakdownRow,
  LegacyDefinition,
  OptimizationGate,
  ParallelRunDelta,
  QuoteResult,
  RatingSpec,
  SpecFactor,
  WaveMemberFacts,
} from './types.js';

export { sha256 } from '../uw/engine.js';

const round2 = (n: number): number => Math.round(n * 100) / 100;

function applyRounding(premium: number, rounding: RatingSpec['rounding']): number {
  switch (rounding) {
    case 'nearest_1':
      return Math.round(premium);
    case 'nearest_10':
      return Math.round(premium / 10) * 10;
    default:
      return round2(premium);
  }
}

// ── Reference quote (CAP-07, LLR-07.1) ─────────────────────────────────────
// base_rate anchors the premium (rate × exposure ÷ per); table/formula/flag
// factors multiply in declared order; then min premium and rounding. Missing
// inputs never guess — the factor passes through at 1.0 and is reported.
export function computeQuote(spec: RatingSpec, riskInput: Record<string, unknown>): QuoteResult {
  const breakdown: FactorBreakdownRow[] = [];
  const missing: string[] = [];
  let premium = 0;

  const num = (name: string): number | null => {
    const v = riskInput[name];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  for (const f of spec.factors) {
    if (f.kind === 'base_rate') {
      const exposure = num(f.exposureInput);
      if (exposure == null) {
        missing.push(f.exposureInput);
        breakdown.push({
          name: f.name,
          kind: f.kind,
          value: 0,
          note: `missing ${f.exposureInput}`,
        });
        continue;
      }
      const per = f.per ?? 1;
      const base = round2((exposure / per) * f.rate);
      premium += base;
      breakdown.push({
        name: f.name,
        kind: f.kind,
        value: base,
        note: `${f.rate} per ${per} of ${f.exposureInput}`,
      });
      continue;
    }
    let factor = 1;
    let note: string;
    if (f.kind === 'table') {
      const v = riskInput[f.input];
      const row = f.rows.find((r) => r.match === v);
      if (row) {
        factor = row.factor;
        note = `${f.input}=${String(v)}`;
      } else if (v === undefined) {
        missing.push(f.input);
        note = `missing ${f.input} — pass-through`;
      } else {
        factor = f.defaultFactor ?? 1;
        note = `${f.input}=${String(v)} (no row — default)`;
      }
    } else if (f.kind === 'formula') {
      const v = num(f.input);
      if (v == null) {
        missing.push(f.input);
        note = `missing ${f.input} — pass-through`;
      } else {
        const raw = f.slope * v + f.intercept;
        factor = Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, raw));
        note = `${f.slope}×${f.input}+${f.intercept} clamped [${f.min ?? '−∞'}, ${f.max ?? '∞'}]`;
      }
    } else {
      const v = riskInput[f.input];
      if (v === undefined) {
        missing.push(f.input);
        note = `missing ${f.input} — pass-through`;
      } else if (v === true) {
        factor = f.factor;
        note = `${f.input} set`;
      } else {
        note = `${f.input} not set`;
      }
    }
    factor = round2(factor);
    premium = premium * factor;
    breakdown.push({ name: f.name, kind: f.kind, value: factor, note });
  }

  premium = round2(premium);
  if (spec.minPremium != null && premium < spec.minPremium) {
    breakdown.push({
      name: 'minimum premium',
      kind: 'flag',
      value: spec.minPremium,
      note: `floor applied (computed ${premium})`,
    });
    premium = spec.minPremium;
  }
  premium = applyRounding(premium, spec.rounding);
  return { premium, factorBreakdown: breakdown, missingInputs: [...new Set(missing)] };
}

// ── Parallel-run delta (CAP-07) ────────────────────────────────────────────
// Materiality bands: ≤1% immaterial, ≤5% watch, above material.
export function parallelRunDelta(
  referencePremium: number,
  legacyPremium: number,
): ParallelRunDelta {
  const delta = round2(referencePremium - legacyPremium);
  const deltaPct =
    legacyPremium === 0
      ? referencePremium === 0
        ? 0
        : 100
      : round2((delta / Math.abs(legacyPremium)) * 100);
  const abs = Math.abs(deltaPct);
  return {
    delta,
    deltaPct,
    materiality: abs <= 1 ? 'immaterial' : abs <= 5 ? 'watch' : 'material',
  };
}

// ── Disruption distribution (CAP-05, LLR-05.1) ─────────────────────────────
// Premium-change buckets matching the book-impact lens: big decreases, the
// stable core, moderate increases, and the capped tail.
export function disruptionBuckets(deltasPct: number[]): DisruptionBucket[] {
  const defs: { label: string; test: (d: number) => boolean }[] = [
    { label: '< -5%', test: (d) => d < -5 },
    { label: '-5% … +5%', test: (d) => d >= -5 && d <= 5 },
    { label: '+5% … +12%', test: (d) => d > 5 && d <= 12 },
    { label: '> +12%', test: (d) => d > 12 },
  ];
  const total = deltasPct.length;
  return defs.map(({ label, test }) => {
    const count = deltasPct.filter(test).length;
    return { label, count, pctOfBook: total === 0 ? 0 : round2((count / total) * 100) };
  });
}

// ── Legacy extraction (CAP-19, LLR-18.1) ───────────────────────────────────
// Deterministic walk of the inventoried definition: opaque factors and macros
// land in `unextracted` verbatim — no synthesized formulas, ever.
export function extractCanonicalSpec(definition: LegacyDefinition): ExtractionResult {
  const factors: SpecFactor[] = [];
  const unextracted = (definition.macros ?? []).map((m) => ({ ref: m.ref, reason: m.reason }));
  for (const f of definition.factors ?? []) {
    if (f.opaque) {
      unextracted.push({ ref: f.name, reason: 'opaque definition — human review required' });
      continue;
    }
    const clean = { ...f };
    delete clean.opaque;
    factors.push(clean as SpecFactor);
  }
  const order: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
  let confidence: 'high' | 'medium' | 'low' = 'high';
  for (const f of factors) {
    const c = f.confidence ?? 'high';
    if (order[c] > order[confidence]) confidence = c;
  }
  if (unextracted.length) confidence = 'low';
  return {
    spec: {
      inputs: definition.inputs ?? [],
      factors,
      minPremium: definition.minPremium,
      rounding: definition.rounding,
      unextracted,
    },
    extractionConfidence: confidence,
    unextractedCount: unextracted.length,
  };
}

// ── Divergence classification (CAP-19, LLR-18.2) ───────────────────────────
// Pairwise factor alignment by name → per-factor delta class. Parametric
// deltas carry a max relative factor difference; structural deltas (different
// kinds) and unique factors carry the flag only — no fake percentage.
function maxParametricDeltaPct(left: SpecFactor, right: SpecFactor): number {
  if (left.kind === 'base_rate' && right.kind === 'base_rate') {
    return left.rate === 0
      ? right.rate === 0
        ? 0
        : 100
      : round2((Math.abs(right.rate - left.rate) / Math.abs(left.rate)) * 100);
  }
  if (left.kind === 'table' && right.kind === 'table') {
    let max = 0;
    const rightByMatch = new Map(right.rows.map((r) => [r.match, r.factor]));
    for (const row of left.rows) {
      const other = rightByMatch.get(row.match);
      if (other === undefined) {
        max = Math.max(max, 100);
      } else if (row.factor !== 0) {
        max = Math.max(max, (Math.abs(other - row.factor) / Math.abs(row.factor)) * 100);
      } else if (other !== 0) {
        max = Math.max(max, 100);
      }
    }
    for (const row of right.rows) {
      if (!left.rows.some((l) => l.match === row.match)) max = Math.max(max, 100);
    }
    return round2(max);
  }
  if (left.kind === 'formula' && right.kind === 'formula') {
    const rel = (a: number, b: number) =>
      a === 0 ? (b === 0 ? 0 : 100) : (Math.abs(b - a) / Math.abs(a)) * 100;
    return round2(Math.max(rel(left.slope, right.slope), rel(left.intercept, right.intercept)));
  }
  if (left.kind === 'flag' && right.kind === 'flag') {
    return left.factor === 0
      ? right.factor === 0
        ? 0
        : 100
      : round2((Math.abs(right.factor - left.factor) / Math.abs(left.factor)) * 100);
  }
  return 0;
}

export function classifyFactorPair(
  left: SpecFactor | null,
  right: SpecFactor | null,
): DivergenceCell {
  if (left && !right) return { factor: left.name, class: 'unique', side: 'legacy' };
  if (!left && right) return { factor: right.name, class: 'unique', side: 'target' };
  if (!left || !right) throw new Error('classifyFactorPair requires at least one side');
  if (left.kind !== right.kind) return { factor: left.name, class: 'structural-delta' };
  const deltaPct = maxParametricDeltaPct(left, right);
  if (deltaPct === 0) return { factor: left.name, class: 'identical' };
  return { factor: left.name, class: 'parametric-delta', deltaPct };
}

export function computeDivergence(
  legacyFactors: SpecFactor[],
  targetFactors: SpecFactor[],
): DivergenceSummary {
  const targetByName = new Map(targetFactors.map((f) => [f.name.toLowerCase(), f]));
  const seen = new Set<string>();
  const cells: DivergenceCell[] = [];
  for (const lf of legacyFactors) {
    const key = lf.name.toLowerCase();
    seen.add(key);
    cells.push(classifyFactorPair(lf, targetByName.get(key) ?? null));
  }
  for (const tf of targetFactors) {
    if (!seen.has(tf.name.toLowerCase())) cells.push(classifyFactorPair(null, tf));
  }
  const counts: Record<DivergenceClass, number> = {
    identical: 0,
    'parametric-delta': 0,
    'structural-delta': 0,
    unique: 0,
  };
  let maxDivergencePct = 0;
  for (const c of cells) {
    counts[c.class] += 1;
    if (c.deltaPct != null) maxDivergencePct = Math.max(maxDivergencePct, c.deltaPct);
  }
  const total = cells.length || 1;
  let recommendation: DivergenceSummary['recommendation'];
  if (counts['structural-delta'] / total > 0.25) recommendation = 'rebuild';
  else if (counts.identical === total) recommendation = 'retire';
  else if (counts.identical / total >= 0.6 && maxDivergencePct <= 10) recommendation = 'merge';
  else recommendation = 're-baseline';
  return { cells, maxDivergencePct: round2(maxDivergencePct), counts, recommendation };
}

// ── Optimization jurisdiction gate (CAP-06, LLR-06.1 / ADR-006) ────────────
// The rule-set table is authoritative: a target jurisdiction with no rule set
// row BLOCKS the job (the module never infers state law from general
// knowledge), and restricted rows block until a P6 acknowledgment exists.
export function optimizationGate(
  ruleSets: { code: string; optimizationRestricted: boolean }[],
  targetCodes: string[],
): OptimizationGate {
  const byCode = new Map(ruleSets.map((r) => [r.code.toUpperCase(), r]));
  const restricted: string[] = [];
  for (const raw of targetCodes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    const row = byCode.get(code) ?? byCode.get('CW');
    if (!row || row.optimizationRestricted) restricted.push(code);
  }
  return { blocked: restricted.length > 0, restrictedCodes: [...new Set(restricted)] };
}

// ── Migration-wave cutover gate (CAP-19, INV-04) ───────────────────────────
// A wave may cut over ONLY when every member rater has a human-confirmed spec
// and a divergence matrix within tolerance. Every offender is listed.
export function waveCutoverEligible(
  members: WaveMemberFacts[],
  tolerancePct: number,
): CutoverEligibility {
  const blockers: string[] = [];
  for (const m of members) {
    if (!m.humanConfirmed) blockers.push(`${m.raterRef}: canonical spec not human-confirmed`);
    if (m.maxDivergencePct == null) blockers.push(`${m.raterRef}: no divergence matrix computed`);
    else if (m.maxDivergencePct > tolerancePct)
      blockers.push(
        `${m.raterRef}: divergence ${m.maxDivergencePct}% exceeds tolerance ${tolerancePct}%`,
      );
  }
  if (!members.length) blockers.push('wave has no members');
  return { eligible: blockers.length === 0, blockers };
}
