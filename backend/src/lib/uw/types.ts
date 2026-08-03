// UW Workbench — shared types for the deterministic core (pure functions).
// These types deliberately mirror the Prisma models' shapes but stay
// storage-agnostic so the evaluators are unit-testable without I/O (ADR-02).

export type AppetiteStance = 'TARGET' | 'ACCEPTABLE' | 'REFER' | 'DECLINE';

export type AppetiteStatementInput = {
  ref: string;
  version: number;
  stance: AppetiteStance;
  lob: string;
  naicsCodes: string | null;
  geographies: string | null;
  tivMax: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type SubmissionFacts = {
  lob: string;
  naics?: string | null;
  geography?: string | null;
  tivTotal?: number | null;
  asOf: Date;
};

export type AppetiteVerdict = {
  verdict: 'IN' | 'EDGE' | 'OUT' | 'NO_STATEMENT';
  citedStatements: { ref: string; version: number; stance: AppetiteStance }[];
};

export type AuthorityGrantInput = {
  ref: string;
  version: number;
  premiumMax: number;
  tivMax: number;
  lineSize: number | null;
  lobs: string; // comma list
  territories: string; // comma list
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type DecisionFacts = {
  premium: number;
  tivTotal: number;
  lob: string;
  territory?: string | null;
  asOf: Date;
};

export type AuthorityCheck = { limit: string; bound: string; actual: string; pass: boolean };

export type AuthorityResult = {
  pass: boolean;
  checks: AuthorityCheck[];
};

export type TriageWeights = {
  version: string;
  appetiteFit: number;
  winnability: number;
  expectedValue: number;
  effort: number;
};

export type TriageInputs = {
  appetiteVerdict: 'IN' | 'EDGE' | 'OUT' | 'NO_STATEMENT';
  brokerKnown: boolean;
  tivTotal: number | null;
  premiumIndicated?: number | null;
  extractionGaps: number; // count of below-threshold extracted fields
  enrichmentCount: number;
};

export type TriageResult = {
  appetiteFit: number;
  winnability: number;
  expectedValue: number;
  effort: number;
  composite: number;
  weightsVersion: string;
  rationale: Record<string, string>;
};

export type DecisionTableRow = {
  when: Record<
    string,
    string | number | boolean | { op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'in'; value: unknown }
  >;
  outcome: 'PASS' | 'REFER' | 'DECLINE';
  note?: string;
};

export type RuleEvaluation = {
  outcome: 'PASS' | 'REFER' | 'DECLINE' | 'NO_MATCH';
  matchedRow: number | null;
  inputsHash: string;
  note?: string;
};
