// UW Workbench — deterministic evaluation core (ADR-02 enforcement).
// Every function here is PURE: same inputs → same outputs, replayable forever.
// The agent plane may CALL these but writes only ProposalEnvelopes; state
// transitions happen in the route layer after these gates pass (INV-1..7).
import { createHash } from 'node:crypto';
import type {
  AppetiteStatementInput,
  AppetiteVerdict,
  AuthorityCheck,
  AuthorityGrantInput,
  AuthorityResult,
  DecisionFacts,
  DecisionTableRow,
  RuleEvaluation,
  SubmissionFacts,
  TriageInputs,
  TriageResult,
  TriageWeights,
} from './types.js';

export function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value) ?? 'null')
    .digest('hex');
}

const csv = (s: string | null | undefined): string[] =>
  (s ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

const inWindow = (from: Date, to: Date | null, asOf: Date): boolean =>
  from.getTime() <= asOf.getTime() && (!to || to.getTime() >= asOf.getTime());

// ── Appetite evaluation (CAP-03, HLR-05) ──────────────────────────────────
// A submission is matched against every active, effective statement. Verdict:
// any DECLINE match → OUT; any REFER match (or TIV within 10% of a cap) → EDGE;
// TARGET/ACCEPTABLE match → IN. Every verdict cites its statement refs (LLR-04).
export function evaluateAppetite(
  statements: AppetiteStatementInput[],
  facts: SubmissionFacts,
): AppetiteVerdict {
  const cited: AppetiteVerdict['citedStatements'] = [];
  let sawDecline = false;
  let sawRefer = false;
  let sawIn = false;
  for (const s of statements) {
    if (!inWindow(s.effectiveFrom, s.effectiveTo, facts.asOf)) continue;
    if (s.lob.toUpperCase() !== facts.lob.toUpperCase()) continue;
    const naicsList = csv(s.naicsCodes);
    if (naicsList.length && facts.naics && !naicsList.includes(facts.naics.toUpperCase())) continue;
    const geoList = csv(s.geographies);
    if (geoList.length && facts.geography && !geoList.includes(facts.geography.toUpperCase()))
      continue;
    cited.push({ ref: s.ref, version: s.version, stance: s.stance });
    if (s.stance === 'DECLINE') sawDecline = true;
    else if (s.stance === 'REFER') sawRefer = true;
    else {
      // TIV within the cap is IN; within 110% of the cap is EDGE; above is OUT-of-statement.
      const tiv = facts.tivTotal ?? 0;
      if (s.tivMax != null && tiv > s.tivMax) {
        if (tiv <= s.tivMax * 1.1) sawRefer = true;
      } else {
        sawIn = true;
      }
    }
  }
  if (!cited.length) return { verdict: 'NO_STATEMENT', citedStatements: [] };
  if (sawDecline) return { verdict: 'OUT', citedStatements: cited };
  if (sawRefer || !sawIn) return { verdict: 'EDGE', citedStatements: cited };
  return { verdict: 'IN', citedStatements: cited };
}

// ── Authority validation (CAP-08, INV-1, LLR-10) ──────────────────────────
// Pure function over grant × decision facts. Every limit produces an explicit
// check row so breaches are explainable, not just boolean.
export function validateAuthority(
  grant: AuthorityGrantInput,
  facts: DecisionFacts,
): AuthorityResult {
  const checks: AuthorityCheck[] = [];
  const push = (limit: string, bound: string, actual: string, pass: boolean) =>
    checks.push({ limit, bound, actual, pass });

  push(
    'effective-window',
    `${grant.effectiveFrom.toISOString().slice(0, 10)}..${grant.effectiveTo ? grant.effectiveTo.toISOString().slice(0, 10) : 'open'}`,
    facts.asOf.toISOString().slice(0, 10),
    inWindow(grant.effectiveFrom, grant.effectiveTo, facts.asOf),
  );
  push(
    'premiumMax',
    String(grant.premiumMax),
    String(facts.premium),
    facts.premium <= grant.premiumMax,
  );
  push('tivMax', String(grant.tivMax), String(facts.tivTotal), facts.tivTotal <= grant.tivMax);
  if (grant.lineSize != null)
    push(
      'lineSize',
      String(grant.lineSize),
      String(facts.premium),
      facts.premium <= grant.lineSize,
    );
  const lobs = csv(grant.lobs);
  push('lob', grant.lobs, facts.lob, lobs.includes(facts.lob.toUpperCase()));
  const territories = csv(grant.territories);
  if (facts.territory)
    push(
      'territory',
      grant.territories,
      facts.territory,
      !territories.length || territories.includes(facts.territory.toUpperCase()),
    );

  return { pass: checks.every((c) => c.pass), checks };
}

// ── Triage scoring (CAP-04, HLR-06, LLR-05) ───────────────────────────────
// Four explainable lenses on 0..100, composited by a versioned weight set.
export const TRIAGE_WEIGHTS_V1: TriageWeights = {
  version: 'w1',
  appetiteFit: 0.34,
  winnability: 0.28,
  expectedValue: 0.22,
  effort: 0.16,
};

export function computeTriageScore(
  inputs: TriageInputs,
  weights: TriageWeights = TRIAGE_WEIGHTS_V1,
): TriageResult {
  const fitByVerdict: Record<TriageInputs['appetiteVerdict'], number> = {
    IN: 95,
    EDGE: 55,
    OUT: 10,
    NO_STATEMENT: 40,
  };
  const appetiteFit = fitByVerdict[inputs.appetiteVerdict];
  const winnability = Math.max(
    0,
    Math.min(100, (inputs.brokerKnown ? 70 : 45) + Math.min(20, inputs.enrichmentCount * 5)),
  );
  const tiv = inputs.tivTotal ?? 0;
  const expectedValue = Math.max(5, Math.min(100, Math.round(Math.log10(Math.max(10, tiv)) * 12)));
  const effort = Math.max(0, Math.min(100, 90 - inputs.extractionGaps * 15));
  const composite = Math.round(
    appetiteFit * weights.appetiteFit +
      winnability * weights.winnability +
      expectedValue * weights.expectedValue +
      effort * weights.effort,
  );
  return {
    appetiteFit,
    winnability,
    expectedValue,
    effort,
    composite,
    weightsVersion: weights.version,
    rationale: {
      appetiteFit: `appetite verdict ${inputs.appetiteVerdict}`,
      winnability: inputs.brokerKnown ? 'known broker relationship' : 'unknown broker',
      expectedValue: `TIV ${tiv.toLocaleString('en-US')}`,
      effort: inputs.extractionGaps
        ? `${inputs.extractionGaps} extraction gap(s) need chasing`
        : 'complete extraction',
    },
  };
}

// ── Guideline rule evaluation (CAP-07, HLR-09, LLR-08) ────────────────────
// Decision-table rows evaluated first-match-wins; the inputsHash makes every
// evaluation replayable (same inputs + version → same verdict, bit-for-bit).
function condPass(actual: unknown, cond: DecisionTableRow['when'][string]): boolean {
  if (cond !== null && typeof cond === 'object' && 'op' in cond) {
    const a = actual as number;
    const v = cond.value as number;
    switch (cond.op) {
      case 'lt':
        return a < v;
      case 'lte':
        return a <= v;
      case 'gt':
        return a > v;
      case 'gte':
        return a >= v;
      case 'eq':
        return actual === cond.value;
      case 'in':
        return Array.isArray(cond.value) && (cond.value as unknown[]).includes(actual);
      default:
        return false;
    }
  }
  return actual === cond;
}

export function evaluateRule(
  rows: DecisionTableRow[],
  inputs: Record<string, unknown>,
): RuleEvaluation {
  const inputsHash = sha256(inputs);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pass = Object.entries(row.when).every(([k, cond]) => condPass(inputs[k], cond));
    if (pass) return { outcome: row.outcome, matchedRow: i, inputsHash, note: row.note };
  }
  return { outcome: 'NO_MATCH', matchedRow: null, inputsHash };
}

// ── Divergence similarity (CAP-14, LLR-14) ────────────────────────────────
// Canonicalize → token-set Jaccard similarity; weight = 1 - similarity.
// (Embedding-based similarity is a documented follow-on; structural tokens
// keep this deterministic and dependency-free.)
export function divergenceWeight(left: unknown, right: unknown): number {
  const tokens = (v: unknown): Set<string> => {
    const flat = JSON.stringify(v ?? {})
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, ' ')
      .split(' ')
      .filter(Boolean);
    return new Set(flat);
  };
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  const similarity = union === 0 ? 1 : inter / union;
  return Math.round((1 - similarity) * 100) / 100;
}
