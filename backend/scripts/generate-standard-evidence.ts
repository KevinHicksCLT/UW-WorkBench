import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// FB-58 — every leaf standard must be an independently testable, evidenceable
// rule. A leaf = a non-area Standard with no children (the granular unit). This
// script derives, for each leaf, a concrete VERIFICATION procedure (how an
// auditor independently confirms the rule is met) and the EVIDENCE artifact that
// confirmation leaves behind. The text is derived deterministically from the
// standard's own name/category/SDLC phase, so it is specific, varied, idempotent,
// and replayable on prod. Stored on Standard.testProcedure / Standard.evidence.

type Bucket = { test: string; evidence: string };

// Keyword → (verification method, evidence artifact). First match wins; order
// matters (most specific first). Keyed on the standard name + category.
const BUCKETS: { match: RegExp; test: (n: string) => string; evidence: (n: string) => string }[] = [
  { match: /encrypt|key management|certificate|cryptograph|tls|at rest|in transit/i,
    test: (n) => `Inspect the live configuration for "${n}" and confirm only approved algorithms, key lengths, and rotation schedules are in use; attempt a non-compliant cipher and confirm it is rejected.`,
    evidence: (n) => `Cryptographic configuration export (algorithms, key lengths, rotation cadence) and a key-management/cert inventory for "${n}".` },
  { match: /\bmfa\b|multi-factor|rbac|role-based|privileged|\bpam\b|access (request|privileg|control)|provisioning|service account|break-glass|identity/i,
    test: (n) => `Pull a current access report for "${n}" and reconcile entitlements to approvals; confirm least-privilege, MFA enforcement, and timely deprovisioning on a sampled set of accounts.`,
    evidence: (n) => `Access-review report + IAM/PAM policy export and approval records for "${n}".` },
  { match: /audit (log|trail)|logging|siem|monitor|event log|alert|log retention/i,
    test: (n) => `Sample the audit log for the review period and confirm "${n}" produces complete, tamper-evident records that are retained for the required duration and feed monitoring/alerting.`,
    evidence: (n) => `Audit-log export + retention-policy screenshot and SIEM/alert configuration for "${n}".` },
  { match: /\bsast\b|\bdast\b|\bsca\b|dependency scan|penetration|vulnerab|patch|scan|secure sdlc|application security|api security|container security|secrets management/i,
    test: (n) => `Re-run the "${n}" scan/test against a representative target and confirm it executes on the required cadence, gates the pipeline on policy breaches, and tracks findings to closure within SLA.`,
    evidence: (n) => `Scan/test report for "${n}" with findings, severity, and remediation tickets showing closure within SLA.` },
  { match: /incident|breach|ransomware|extortion|notification|forensic|escalation|severity|tabletop|playbook|response plan/i,
    test: (n) => `Walk the "${n}" runbook in a tabletop or live drill and confirm detection, escalation, and required external notifications fire within the mandated window.`,
    evidence: (n) => `Incident/runbook for "${n}" plus the most recent drill or post-incident report and notification log.` },
  { match: /continuity|disaster recovery|\bbcp\b|\bdr\b|backup|resilien|rto|rpo/i,
    test: (n) => `Review the most recent "${n}" test and confirm recovery met the documented RTO/RPO objectives for the in-scope systems.`,
    evidence: (n) => `DR/BCP test results for "${n}" with RTO/RPO outcomes and an executive sign-off.` },
  { match: /training|awareness/i,
    test: (n) => `Confirm "${n}" completion rates meet the required threshold for all in-scope staff for the current period, and that overdue users are escalated.`,
    evidence: (n) => `Training completion records for "${n}" (roster, completion %, and exception/escalation list).` },
  { match: /consent|notice at collection|privacy (policy|notice)|dsar|right to (know|delete|correct|erasure|access|opt|limit|data portability)|opt-out|preference signal|verifiable consumer|restriction & objection|transparency/i,
    test: (n) => `Submit a test request exercising "${n}" and confirm it is authenticated, honored, and closed within the statutory timeline, with the outcome logged.`,
    evidence: (n) => `Request-fulfillment log for "${n}" (intake, identity verification, action taken, timestamp) and the published notice/policy text.` },
  { match: /data (classification|retention|minim|masking|tokeniz|flow|transfer)|pii|phi|nonpublic information|sensitive pi|personal data|ropa|records of processing|storage limitation|purpose limitation|disposal/i,
    test: (n) => `Trace a sample record through "${n}" and confirm it is classified, retained no longer than the schedule, protected in transit/at rest, and disposed of on expiry.`,
    evidence: (n) => `Data inventory/RoPA + classification and retention schedule for "${n}", with a disposal/sample-trace record.` },
  { match: /vendor|third-party|processor|\bdpa\b|service provider|contractor|supply/i,
    test: (n) => `Select an in-scope vendor and confirm "${n}" is satisfied by an executed contract/DPA with the required clauses and a current risk assessment on file.`,
    evidence: (n) => `Executed contract/DPA for "${n}" plus the vendor risk assessment and approval.` },
  { match: /model|actuarial|pricing|reserv|ibnr|capital|\bcat\b|reinsurance|valuation|rating|assumption|triangle/i,
    test: (n) => `Re-run a historical calculation governed by "${n}" using its recorded model version, assumption set, and input snapshot, and confirm it reproduces the recorded output exactly with independent-validation sign-off on file.`,
    evidence: (n) => `Reproducibility proof for "${n}" (versioned model + assumptions + input snapshot) and the validation report with sign-off.` },
  { match: /risk (assessment|register)|controls matrix|exception|threat model|stride|security architecture|reference architecture|defense in depth|zero trust|posture|hardening|segmentation/i,
    test: (n) => `Review the "${n}" artifact and confirm it is current, covers the in-scope assets, and that identified gaps have owned, dated remediation actions.`,
    evidence: (n) => `Current "${n}" document/register with coverage, risk ratings, and tracked remediation owners and dates.` },
  { match: /policy|charter|governance|standard|program|certification|oversight|accountability|compliance/i,
    test: (n) => `Confirm "${n}" exists, is formally approved, version-controlled, communicated to in-scope staff, and reviewed within its required cadence.`,
    evidence: (n) => `Approved, version-controlled "${n}" document with sign-off, distribution record, and last-review date.` },
];

const DEFAULT_BUCKET = (n: string): Bucket => ({
  test: `Review the implementation evidence for "${n}" and confirm it meets the standard's acceptance criteria for the in-scope systems, with an owner accountable for the control.`,
  evidence: `Documented control implementation for "${n}" with a reviewer sign-off and the date it was last verified.`,
});

// Department-flavored fallback when no keyword bucket matches — keeps each area's
// test/evidence specific to how that function actually proves its work.
const DEPARTMENT_BUCKETS: Record<string, (n: string) => Bucket> = {
  'Enterprise & Solution Architecture': (n) => ({
    test: `Review a recent design against "${n}" and confirm the architecture decision record cites it, a design review approved it, and any deviation has a logged exception.`,
    evidence: `Architecture decision record + design-review minutes referencing "${n}", plus the exception log for any deviations.`,
  }),
  'PMO & Agile Delivery': (n) => ({
    test: `Sample a delivery for "${n}" and confirm the required artifact exists at the right gate (e.g. RAID log, status, gate sign-off) and that exceptions were escalated.`,
    evidence: `Delivery artifacts for "${n}" (gate review record / RAID log / status report) with sign-off.`,
  }),
  'Finance & Accounting': (n) => ({
    test: `Re-perform "${n}" for a sampled period and confirm it reconciles to source, is reviewed by a second person, and the control operated on schedule (SOX-style).`,
    evidence: `Reconciliation / control-test worksheet for "${n}" with preparer + independent-reviewer sign-off and date.`,
  }),
  'Engineering & Development': (n) => ({
    test: `Inspect the CI pipeline and repo for "${n}" and confirm it is enforced automatically (review gate, check, or test) and blocks merges/deploys on failure.`,
    evidence: `Pipeline run + pull-request records showing "${n}" enforced (required check, code-review approval, test result).`,
  }),
  'Human Resources': (n) => ({
    test: `Confirm "${n}" is a published, acknowledged policy/process and sample records to verify it was followed and exceptions approved.`,
    evidence: `Acknowledged policy for "${n}" plus sampled HR records (approvals, completion, case file) evidencing it operated.`,
  }),
  'Data & Analytics': (n) => ({
    test: `Trace a dataset/report through "${n}" and confirm data quality, lineage, and validation checks ran and that outputs reconcile to source.`,
    evidence: `Data-quality / lineage and validation report for "${n}" with reconciliation to source control totals.`,
  }),
  'Operations & Customer Service': (n) => ({
    test: `Review the period's metrics and a sampled case for "${n}" and confirm the SLA/quality target was met and breaches were actioned.`,
    evidence: `SLA / QA report for "${n}" (queue metrics, sampled case review) with breach actions.`,
  }),
  'Legal & Governance': (n) => ({
    test: `Confirm "${n}" is governed by an approved, current document and that the corresponding register/record is complete for the period.`,
    evidence: `Executed/approved document for "${n}" plus the governance register entry and approval record.`,
  }),
  'Compliance & Risk Management': (n) => ({
    test: `Perform a control test for "${n}": confirm it is designed, operating, owned, and that residual risk is tracked in the risk register with attestation.`,
    evidence: `Control-test result + risk-register entry and management attestation for "${n}".`,
  }),
  'Claims Operations': (n) => ({
    test: `Pull a sample of claim files and confirm "${n}" was followed at the right step (coverage, reserving, adjudication, payment) within SLA.`,
    evidence: `Claim-file review for "${n}" (sampled files, decision rationale, timestamps) with QA sign-off.`,
  }),
  'Underwriting': (n) => ({
    test: `Sample bound policies and confirm "${n}" was applied — guidelines/authority/referrals followed and documented in the underwriting file.`,
    evidence: `Underwriting-file review for "${n}" (rule/authority conformance, referral records) with QA sign-off.`,
  }),
};

// The model/actuarial bucket — used as the fallback for the Actuarial area, whose
// leaf names ("Loss Development", "Loss Ratio Benchmarking") and generic categories
// ("Analysis", "Standards") otherwise miss the keyword buckets.
const ACTUARIAL_BUCKET = BUCKETS.find((b) => b.match.test('model actuarial'))!;

function derive(name: string, category: string | null, department: string | null): Bucket {
  const hay = `${name} ${category ?? ''}`;
  for (const b of BUCKETS) if (b.match.test(hay)) return { test: b.test(name), evidence: b.evidence(name) };
  if (department === 'Actuarial') return { test: ACTUARIAL_BUCKET.test(name), evidence: ACTUARIAL_BUCKET.evidence(name) };
  if (department && DEPARTMENT_BUCKETS[department]) return DEPARTMENT_BUCKETS[department](name);
  return DEFAULT_BUCKET(name);
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  // Leaves = non-area standards with no children.
  const nonAreas = await prisma.standard.findMany({
    where: { companyId, isArea: false },
    select: { id: true, name: true, category: true, department: true, parentId: true },
  });
  const hasChildren = new Set(nonAreas.map((n) => n.parentId).filter((p): p is string => !!p));
  const leaves = nonAreas.filter((n) => !hasChildren.has(n.id));
  console.log(`${company.name}: ${leaves.length} leaf standards to make testable/evidenceable.`);

  let updated = 0;
  for (const leaf of leaves) {
    const { test, evidence } = derive(leaf.name, leaf.category, leaf.department);
    await prisma.standard.update({ where: { id: leaf.id }, data: { testProcedure: test, evidence } });
    updated++;
  }
  console.log(`Updated ${updated} leaf standards with testProcedure + evidence.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
