// Shared client types + tiny pure helpers for the UW Workbench module.
// Shapes mirror the /uw API responses (backend/src/routes/uw/*): submissions,
// clearance, appetite, authority, quotes, governance. Only the fields the UI
// actually renders are typed — the API may return more.
import type { PillTone } from '../../components/ui';

export const UW_LOBS = ['CP', 'EB', 'GL', 'BOP', 'OM', 'XS', 'WC'] as const;

/** Statuses that mean a submission is no longer actionable in the pipeline. */
export const CLOSED_STATUSES = ['BOUND', 'DECLINED', 'WITHDRAWN'];

export type AppetiteCitation = { ref: string; version: number; stance: string };

export type TriageScore = {
  id: string;
  appetiteFit: number;
  winnability: number;
  expectedValue: number;
  effort: number;
  composite: number;
  weightsVersion: string;
  rationale: Record<string, string> | null;
  scoredAt: string;
};

export type ClearanceCheck = {
  id: string;
  checkType: string; // DUPLICATE | BLOCKED | WATCHLIST
  verdict: string; // CLEAR | HIT | RELEASED
  matchEvidence: Record<string, unknown> | null;
  firstReleaseBy: string | null;
  firstReleaseRole: string | null;
  firstReleaseAt: string | null;
  secondReleaseBy: string | null;
  createdAt: string;
};

export type ExtractedField = {
  field: string;
  value: string;
  confidence: number;
  provenance: { docId: string; page?: number; extractorVersion: string };
};

export type EnrichmentRecord = {
  id: string;
  payload: Record<string, unknown>;
  cost: number | null;
  fetchedAt: string;
  expiresAt: string | null;
  source: { name: string; kind: string };
};

export type RiskObject = {
  id: string;
  kind: string;
  name: string;
  situs: string | null;
  tiv: number | null;
  enrichmentRecords: EnrichmentRecord[];
};

export type CoverageRequest = {
  id: string;
  lob: string;
  limitAmount: number | null;
  deductible: number | null;
};

export type ReferralCase = {
  id: string;
  reason: string;
  status: string; // OPEN | APPROVED | DECLINED | RETURNED | EXPIRED
  slaDueAt: string;
  slaBreached: boolean;
  resolvedBy: string | null;
  resolutionNote: string | null;
  openedAt: string;
  escalatedToRole: { displayValue: string } | null;
  submission?: { ref: string } | null;
};

export type AuthorityCheck = { limit: string; bound: string; actual: string; pass: boolean };
export type AuthorityDetail = { pass: boolean; checks: AuthorityCheck[] };

export type Decision = {
  id: string;
  outcome: string; // QUOTE | DECLINE | REFER
  premium: number | null;
  rationale: string;
  authorityResult: string; // PASS | BREACH_REFERRED
  authorityDetail: AuthorityDetail | null;
  dispositionedBy: string;
  decidedAt: string;
  authorityGrant: { ref: string; version: number } | null;
};

export type BindEvent = {
  id: string;
  pasPolicyRef: string;
  correlationId: string;
  executedBy: string;
  executedAt: string;
};

export type QuoteProposal = {
  id: string;
  premium: number;
  modelRef: string | null;
  formSetRef: string | null;
  pricedResolved: boolean;
  documentedResolved: boolean;
  status: string; // DRAFT | PROPOSED | ACCEPTED | BOUND | EXPIRED
  createdAt: string;
  bindEvent: BindEvent | null;
};

export type AgentAction = {
  id: string;
  agentId: string;
  kind: string;
  modelRef: string;
  confidence: number | null;
  proposal: Record<string, unknown> | null;
  disposition: string; // PENDING | ACCEPTED | MODIFIED | REJECTED | AUTO_STP
  dispositionedBy: string | null;
  createdAt: string;
  submission?: { ref: string } | null;
};

export type PasBinding = {
  id: string;
  applicationId: string;
  status: string;
  application: { name: string };
};

export type SubmissionCore = {
  id: string;
  ref: string;
  channel: string;
  status: string;
  lob: string;
  brokerName: string | null;
  receivedAt: string;
  effectiveDate: string | null;
  slaDueAt: string | null;
  tivTotal: number | null;
  description: string | null;
  appetiteVerdict: string | null; // IN | EDGE | OUT | null
  appetiteCitations: AppetiteCitation[] | null;
};

/** One row of GET /uw/submissions (pipeline projection). */
export type PipelineRow = SubmissionCore & {
  accountName: string;
  triage: TriageScore | null;
  clearance: 'CLEAR' | 'HELD';
  openReferrals: number;
};

/** GET /uw/submissions/:id — the full risk-workspace projection. */
export type SubmissionDetail = SubmissionCore & {
  account: { name: string; domicile: string | null; industry: string | null };
  extractedFields: ExtractedField[] | null;
  extractionExceptions: number;
  riskObjects: RiskObject[];
  coverageRequests: CoverageRequest[];
  clearanceChecks: ClearanceCheck[];
  triageScores: TriageScore[];
  referralCases: ReferralCase[];
  decisions: Decision[];
  quoteProposals: QuoteProposal[];
  pasBindings: PasBinding[];
  agentActions: AgentAction[];
};

export type AppetiteStatement = {
  id: string;
  ref: string;
  version: number;
  stance: string; // TARGET | ACCEPTABLE | REFER | DECLINE
  lob: string;
  segment: string | null;
  naicsCodes: string | null;
  geographies: string | null;
  tivMax: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  rationale: string;
  status: string; // ACTIVE | SUPERSEDED | RETIRED
  publishedBy: string | null;
};

export type AuthorityGrant = {
  id: string;
  ref: string;
  version: number;
  role: { id: string; displayValue: string };
  premiumMax: number;
  tivMax: number;
  lineSize: number | null;
  lobs: string;
  territories: string;
  delegable: boolean;
  bordereauxAttached: boolean;
  status: string; // ACTIVE | SUPERSEDED | RETIRED
  breachCount90d: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type DivergencePair = {
  id: string;
  ref: string;
  kind: string; // APPETITE | RULE | AUTHORITY
  leftRef: string;
  leftEstate: string | null;
  rightRef: string;
  rightEstate: string | null;
  weight: number;
  proposal: string | null;
  status: string; // OPEN | MERGED | RETIRED | KEEP_BOTH
  actionedBy: string | null;
  actionNote: string | null;
};

export type ImpactPreview = {
  submissionsAffected: number;
  rolesAffected: number;
  pasBindingsAffected: number;
  computedAt: string;
};

export type GovernanceEvent = {
  id: string;
  eventType: string;
  actorKind: 'HUMAN' | 'AGENT' | 'SYSTEM';
  actorId: string;
  actorRole: string | null;
  correlationId: string;
  submissionId: string | null;
  at: string;
};

// ── Pure display helpers ─────────────────────────────────────────────────────

/** Pill tone for an appetite verdict — IN green, EDGE amber, OUT red. */
export function verdictTone(v: string | null | undefined): PillTone {
  if (v === 'IN') return 'green';
  if (v === 'EDGE') return 'amber';
  if (v === 'OUT') return 'red';
  return 'slate';
}

/** Pill tone for an appetite stance — TARGET/ACCEPTABLE green, REFER amber, DECLINE red. */
export function stanceTone(stance: string): PillTone {
  if (stance === 'TARGET' || stance === 'ACCEPTABLE') return 'green';
  if (stance === 'REFER') return 'amber';
  if (stance === 'DECLINE') return 'red';
  return 'slate';
}

/** Pill tone for a submission status token. */
export function statusTone(status: string): PillTone {
  if (status === 'BOUND') return 'green';
  if (status === 'REFERRED') return 'amber';
  if (status === 'QUOTED') return 'blue';
  return 'slate';
}

/** Pill tone for an actor kind on the governance spine. */
export function actorTone(kind: string): PillTone {
  if (kind === 'HUMAN') return 'blue';
  if (kind === 'AGENT') return 'amber';
  return 'slate';
}

/** Short "Mar 4, 3:05 PM"-style timestamp; em dash when absent. */
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Hours from now until the given timestamp (negative = overdue); null when absent. */
export function hoursUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  return (new Date(d).getTime() - Date.now()) / 3_600_000;
}

/** Surface a caught error's message for a dialog. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
