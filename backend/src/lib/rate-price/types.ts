// RATE-PRICE — shared types for the deterministic rating core.
// The spec grammar is deliberately small: a base-rate anchor plus
// multiplicative table/formula/flag factors. It is the same grammar for a
// published RpModelVersion.spec and an extracted RpCanonicalSpec.spec, which
// is what makes replay-vs-legacy divergence computable at the factor grain.

export type Confidence = 'high' | 'medium' | 'low';

export type SpecInput = {
  name: string;
  type: 'number' | 'string' | 'boolean';
  domain?: string; // human note, e.g. "class code" / "USD payroll"
};

export type BaseRateFactor = {
  name: string;
  kind: 'base_rate';
  rate: number; // rate per `per` units of the exposure input
  exposureInput: string;
  per?: number; // default 1 — e.g. 100 for rate-per-$100-payroll
  confidence?: Confidence;
};

export type TableFactor = {
  name: string;
  kind: 'table';
  input: string;
  rows: { match: string | number; factor: number }[];
  defaultFactor?: number; // applied when no row matches; omit = 1.0 pass-through
  confidence?: Confidence;
};

export type FormulaFactor = {
  name: string;
  kind: 'formula';
  input: string;
  slope: number;
  intercept: number;
  min?: number; // clamp bounds, e.g. experience mod 0.75..1.40
  max?: number;
  confidence?: Confidence;
};

export type FlagFactor = {
  name: string;
  kind: 'flag';
  input: string;
  factor: number; // applied when the boolean input is true
  confidence?: Confidence;
};

export type SpecFactor = BaseRateFactor | TableFactor | FormulaFactor | FlagFactor;

export type RatingSpec = {
  inputs: SpecInput[];
  factors: SpecFactor[]; // base_rate anchors premium; the rest multiply in order
  minPremium?: number;
  rounding?: 'none' | 'nearest_1' | 'nearest_10';
  unextracted?: UnextractedEntry[]; // present on migration-extract specs (LLR-18.1)
};

export type FactorBreakdownRow = {
  name: string;
  kind: SpecFactor['kind'];
  value: number; // the factor applied (base_rate rows carry the base premium)
  note: string;
};

export type QuoteResult = {
  premium: number;
  factorBreakdown: FactorBreakdownRow[];
  missingInputs: string[]; // inputs the risk payload did not supply
};

export type ParallelRunDelta = {
  delta: number; // reference − legacy
  deltaPct: number; // signed, relative to legacy
  materiality: 'immaterial' | 'watch' | 'material';
};

export type DisruptionBucket = { label: string; count: number; pctOfBook: number };

// ── Legacy extraction (CAP-19) ─────────────────────────────────────────────
// The inventoried raw structure of a legacy rater. Extraction is deterministic:
// well-formed entries become spec factors; opaque entries land in `unextracted`
// verbatim — never approximated (LLR-18.1).
export type LegacyDefinition = {
  inputs?: SpecInput[];
  factors?: (SpecFactor & { opaque?: boolean })[];
  macros?: { ref: string; reason: string }[];
  minPremium?: number;
  rounding?: RatingSpec['rounding'];
};

export type UnextractedEntry = { ref: string; reason: string };

export type ExtractionResult = {
  spec: RatingSpec;
  extractionConfidence: Confidence; // min confidence across extracted factors
  unextractedCount: number;
};

// ── Divergence (LLR-18.2) ──────────────────────────────────────────────────
export type DivergenceClass = 'identical' | 'parametric-delta' | 'structural-delta' | 'unique';

export type DivergenceCell = {
  factor: string;
  class: DivergenceClass;
  side?: 'legacy' | 'target'; // set on `unique` cells — where the factor exists
  deltaPct?: number; // max relative factor delta, parametric cells only
};

export type DivergenceSummary = {
  cells: DivergenceCell[];
  maxDivergencePct: number;
  counts: Record<DivergenceClass, number>;
  recommendation: 'merge' | 're-baseline' | 'rebuild' | 'retire';
};

// ── Governance gates ───────────────────────────────────────────────────────
export type OptimizationGate = {
  blocked: boolean;
  restrictedCodes: string[]; // jurisdictions requiring a P6 acknowledgment
};

export type WaveMemberFacts = {
  raterRef: string;
  humanConfirmed: boolean;
  maxDivergencePct: number | null; // null = no divergence matrix computed yet
};

export type CutoverEligibility = {
  eligible: boolean;
  blockers: string[]; // one line per violating member (INV-04: list every offender)
};
