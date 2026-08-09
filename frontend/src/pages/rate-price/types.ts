// Rate-Price module — API row shapes (mirrors backend/src/routes/rate-price).

export type SpecFactor = {
  name: string;
  kind: 'base_rate' | 'table' | 'formula' | 'flag';
  rate?: number;
  exposureInput?: string;
  per?: number;
  input?: string;
  rows?: { match: string | number; factor: number }[];
  defaultFactor?: number;
  slope?: number;
  intercept?: number;
  min?: number;
  max?: number;
  factor?: number;
  confidence?: 'high' | 'medium' | 'low';
};

export type RatingSpec = {
  inputs: { name: string; type: 'number' | 'string' | 'boolean'; domain?: string }[];
  factors: SpecFactor[];
  minPremium?: number;
  rounding?: string;
  unextracted?: { ref: string; reason: string }[];
};

export type ModelVersion = {
  id: string;
  semver: string;
  status: string;
  provenance: string;
  bundleHash: string;
  spec?: RatingSpec;
  publishedBy?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
};

export type RatingModel = {
  id: string;
  ref: string;
  name: string;
  lob: string;
  jurisdictions: string;
  engineOfRecord: string;
  lifecycle: string;
  currentVersionId: string | null;
  ownerRole?: { id: string; displayValue: string | null } | null;
  valueStreamNode?: { id: string; displayValue: string | null } | null;
  versions: ModelVersion[];
  publishedVersions?: number;
  runCount?: number;
  programLinks?: { program: RateProgram }[];
};

export type QuoteResult = {
  premium: number;
  factorBreakdown: { name: string; kind: string; value: number; note: string }[];
  missingInputs: string[];
  runId?: string;
  traceId?: string | null;
  latencyMs?: number;
  delta?: number;
  deltaPct?: number;
  materiality?: string;
};

export type RuleSet = {
  id: string;
  code: string;
  version: number;
  optimizationRestricted: boolean;
  constraints: { kind: string; value: string | number; note?: string }[];
  jurisdiction?: { id: string; name: string; filingPortal: string } | null;
};

export type OptimizationJob = {
  id: string;
  objective: string;
  status: string;
  scenarioCount: number;
  complianceAckBy: string | null;
  constraints?: {
    targetJurisdictions?: string[];
    perRiskCapPct?: number;
    restrictedCodes?: string[];
  } | null;
  resultSummary?: {
    rateChangePct: number;
    perRiskCapPct: number;
    portfolioSize: number;
    scenarios: { scale: number; buckets: { label: string; count: number; pctOfBook: number }[] }[];
  } | null;
  version?: { semver: string; model: { ref: string; name: string } };
  ruleSet?: { code: string; version: number; optimizationRestricted: boolean };
};

export type FilingPacket = {
  id: string;
  status: string;
  serffTrackingNo: string | null;
  sections: { name: string; status: string; detail?: string; boundComplianceRef?: string }[];
  submittedBy: string | null;
  submittedAt: string | null;
  complianceLinks?: { complianceItem: { id: string; itemCode: string; name: string } }[];
};

export type RateProgram = {
  id: string;
  ref: string;
  product: string;
  lob: string;
  jurisdiction: string;
  effectiveDate: string | null;
  filingStatus: string;
  modelLinks?: { model: { id: string; ref: string; name: string; lifecycle: string } }[];
  filingPackets?: FilingPacket[];
};

export type DivergenceMatrix = {
  id: string;
  portfolioRef: string;
  maxDivergencePct: number;
  recommendation: string | null;
  cells: { factor: string; class: string; side?: string; deltaPct?: number }[];
  targetVersion?: { id: string; semver: string; model: { ref: string; name: string } };
  createdAt?: string;
};

export type CanonicalSpec = {
  id: string;
  specVersion: number;
  extractionConfidence: string;
  humanConfirmed: boolean;
  confirmedBy: string | null;
  spec: RatingSpec;
  divergenceMatrices: DivergenceMatrix[];
};

export type LegacyRater = {
  id: string;
  ref: string;
  name: string;
  lob: string;
  artifactType: string;
  discoveredVia: string | null;
  complexityScore: number | null;
  status: string;
  specs: CanonicalSpec[];
  waveMembers: { waveId: string; status: string }[];
};

export type MigrationWave = {
  id: string;
  ref: string;
  name: string;
  sequence: number;
  status: string;
  tolerancePct: number;
  cutoverDate: string | null;
  rollbackPlan: string | null;
  targetModel?: { id: string; ref: string; name: string } | null;
  members: { id: string; status: string; legacyRater: { id: string; ref: string; name: string } }[];
};

export type Estate = { raters: LegacyRater[]; waves: MigrationWave[] };

/** Surface a caught error's message for a dialog. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const lifecycleTone = (lifecycle: string): 'green' | 'amber' | 'red' | 'slate' | 'blue' => {
  switch (lifecycle) {
    case 'deployed':
      return 'green';
    case 'approved':
    case 'review':
      return 'blue';
    case 'draft':
      return 'slate';
    case 'deprecated':
      return 'amber';
    case 'retired':
      return 'red';
    default:
      return 'slate';
  }
};
