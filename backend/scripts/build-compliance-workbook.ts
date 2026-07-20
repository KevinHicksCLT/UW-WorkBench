/**
 * SCRUM-46 — build the Compliance-flagged regulations workbook.
 *
 * Reads the Jira-attached Regulation-Source-Audit.xlsx (23,928 requirement
 * rows across State / Federal / International sheets) and emits a review
 * workbook with a three-level hierarchy:
 *   L1 REGULATIONS (≈538, REG-###)  — high-level regimes/programs that carry
 *      compliance obligations (grain = Regime/Program).
 *   L2 COMPLIANCE ITEMS (REG-###-C##) — the atomic "what must be done" tasks
 *      per regulation, in the reference doc's FCRA/KY-AVIS table shape
 *      (task, owner, frequency, evidence), generated from per-category
 *      templates parameterized by the regulation.
 *   L3 REQUIREMENT ROWS (all 23,928) — per-jurisdiction source rows flagged
 *      Compliance Required Yes/No (Binding = Yes, Informational = No), each
 *      linked to its L1 regulation for two-way traceability.
 *
 * Output: documents/regulations/Regulation-Compliance-Flagged.xlsx
 * Run: npx tsx --env-file=.env scripts/build-compliance-workbook.ts <audit.xlsx>
 */
import { createRequire } from 'node:module';
import path from 'node:path';

// xlsx ESM namespace import loses fs-bound readFile/writeFile — use CJS build
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx') as typeof import('xlsx');

const SRC =
  process.argv[2] ??
  path.join(process.env.TEMP ?? '/tmp', 'scrum46', 'Regulation-Source-Audit.xlsx');
const OUT = path.resolve('..', 'documents', 'regulations', 'Regulation-Compliance-Flagged.xlsx');

type Row = Record<string, string>;

// ── category → compliance-dimension defaults (documented in Methodology) ────
type CatRule = {
  product: 'Yes' | 'No';
  process: 'Yes' | 'No';
  system: 'Yes' | 'No';
  owner: string;
  evidence: string;
};
const CATEGORY_RULES: Record<string, CatRule> = {
  PRODUCT_FILING: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Product Compliance / Filing Team',
    evidence: 'SERFF/portal filing receipt, approval letter',
  },
  ACTUARIAL_VALUATION: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Appointed Actuary',
    evidence: 'Actuarial opinion, valuation report',
  },
  LICENSING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Licensing & Appointments (Compliance Ops)',
    evidence: 'License/appointment records (NIPR/UCAA)',
  },
  CONSUMER_PROTECTION: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Compliance',
    evidence: 'Notice logs, disclosure copies, complaint files',
  },
  MARKET_CONDUCT: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Market Conduct Compliance',
    evidence: 'MCAS submissions, exam files, procedure docs',
  },
  DATA_CALL: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Regulatory Reporting',
    evidence: 'Data call submission + confirmation receipt',
  },
  FINANCIAL_REPORTING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Controller',
    evidence: 'Filed statements, NAIC submission confirmations',
  },
  DATA_PRIVACY: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Privacy Office / DPO',
    evidence: 'Privacy notices, consent records, DSAR logs',
  },
  SOLVENCY_CAPITAL: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'CFO / Capital Management',
    evidence: 'RBC/ORSA/solvency filings, capital calculations',
  },
  CORPORATE_GOVERNANCE: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Corporate Secretary / General Counsel',
    evidence: 'Board minutes, governance disclosures, CGAD',
  },
  CYBERSECURITY: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'CISO',
    evidence: 'Certifications, risk assessments, incident reports',
  },
  SANCTIONS_AML: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'AML / OFAC Compliance Officer',
    evidence: 'Screening logs, SAR filings, training records',
  },
  SUITABILITY: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Distribution Compliance',
    evidence: 'Suitability reviews, producer training records',
  },
  OPERATIONAL_RESILIENCE: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'IT Operations / Operational Risk',
    evidence: 'BCP/DR test results, incident reports',
  },
  ACCOUNTING_AUDIT: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Controller / Internal Audit',
    evidence: 'Audit reports, MAR documentation',
  },
  EMPLOYMENT_BENEFITS: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'HR / Benefits',
    evidence: 'Plan documents, 5500 filings, notices',
  },
  WORKERS_COMP_REPORTING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Regulatory Reporting (WC)',
    evidence: 'EDI submissions, proof-of-coverage records',
  },
  PREMIUM_TAX: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Tax (Controller)',
    evidence: 'Tax returns, OPTins payment confirmations',
  },
  AI_GOVERNANCE: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Chief Data Officer / Compliance',
    evidence: 'Model inventory, bias testing, AIS attestations',
  },
  TAX_REPORTING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Tax',
    evidence: 'Tax filings, withholding/1099 records',
  },
  AUTO_VERIFICATION: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Policy Administration / IT Ops',
    evidence: 'Feed transmission logs, exception reports',
  },
  UNCLAIMED_PROPERTY: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Controller (Escheatment)',
    evidence: 'Escheatment filings, due-diligence letters',
  },
  ESG_SUSTAINABILITY: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Risk / Sustainability Office',
    evidence: 'Sustainability disclosures, survey responses',
  },
  RESIDUAL_MARKET: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Product Operations',
    evidence: 'Plan participation records, assessments',
  },
  SECURITIES_DISTRIBUTION: {
    product: 'Yes',
    process: 'Yes',
    system: 'Yes',
    owner: 'Broker-Dealer Compliance',
    evidence: 'FINRA filings, rep licensing, disclosure records',
  },
  CLIMATE_RISK: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Risk Management',
    evidence: 'Climate disclosure surveys, TCFD reports',
  },
  APCD_REPORTING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Data Management',
    evidence: 'APCD submission files + validation reports',
  },
  CATASTROPHE_REPORTING: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Regulatory Reporting',
    evidence: 'Cat data call submissions, claim counts',
  },
  ANTITRUST_CONDUCT: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Legal',
    evidence: 'Training records, conduct attestations',
  },
  SURPLUS_LINES: {
    product: 'No',
    process: 'Yes',
    system: 'Yes',
    owner: 'Surplus Lines Compliance / Tax',
    evidence: 'SLIP+ filings, tax remittance records',
  },
  OTHER: {
    product: 'No',
    process: 'Yes',
    system: 'No',
    owner: 'Compliance',
    evidence: 'Not Yet Determined',
  },
};
const FALLBACK_RULE: CatRule = CATEGORY_RULES.OTHER;

// ── atomic compliance-item templates per category ───────────────────────────
// Shape mirrors the reference doc's FCRA / KY-AVIS tables: one discrete,
// auditable action per row with its owner, frequency, and evidence. {REG}
// is replaced with the regulation/program name.
type TaskT = { task: string; owner: string; freq: string; evidence: string };
const CATEGORY_TASKS: Record<string, TaskT[]> = {
  PRODUCT_FILING: [
    {
      task: 'Identify every form/rate/rule change under {REG} that requires filing before use',
      owner: 'Product Compliance',
      freq: 'Per filing',
      evidence: 'Filing determination log',
    },
    {
      task: 'Prepare the filing package (forms, actuarial memo, state checklists) for {REG}',
      owner: 'Product Compliance',
      freq: 'Per filing',
      evidence: 'Filing package',
    },
    {
      task: 'Submit via SERFF/state portal and track to disposition',
      owner: 'Filing Analyst',
      freq: 'Per filing',
      evidence: 'SERFF receipt & disposition',
    },
    {
      task: 'Hold product release until approval / deemer period satisfied',
      owner: 'Product Operations',
      freq: 'Per filing',
      evidence: 'Release gate record',
    },
    {
      task: 'Implement approved forms/rates in policy admin and rating systems',
      owner: 'IT / Product',
      freq: 'Per filing',
      evidence: 'System change record',
    },
    {
      task: 'Respond to objections/interrogatories within state deadlines',
      owner: 'Filing Analyst',
      freq: 'Event-driven',
      evidence: 'Objection log',
    },
    {
      task: 'Retain approval correspondence and filed versions',
      owner: 'Compliance Ops',
      freq: 'Continuous',
      evidence: 'Filing archive',
    },
  ],
  ACTUARIAL_VALUATION: [
    {
      task: 'Compute reserves per the prescribed valuation standard under {REG}',
      owner: 'Appointed Actuary',
      freq: 'Quarterly/Annual',
      evidence: 'Valuation workpapers',
    },
    {
      task: 'Prepare and sign the actuarial opinion / memorandum',
      owner: 'Appointed Actuary',
      freq: 'Annual',
      evidence: 'Signed opinion',
    },
    {
      task: 'File the opinion with the regulator alongside the annual statement',
      owner: 'Regulatory Reporting',
      freq: 'Annual',
      evidence: 'Filing confirmation',
    },
    {
      task: 'Maintain asset adequacy / cash-flow testing documentation',
      owner: 'Actuarial',
      freq: 'Annual',
      evidence: 'AAT report',
    },
    {
      task: 'Reconcile reserve data to policy admin extracts',
      owner: 'Actuarial / Data',
      freq: 'Quarterly',
      evidence: 'Reconciliation report',
    },
    {
      task: 'Respond to regulator valuation inquiries',
      owner: 'Appointed Actuary',
      freq: 'Event-driven',
      evidence: 'Correspondence file',
    },
  ],
  LICENSING: [
    {
      task: 'Verify Certificate of Authority covers each state/line before writing business',
      owner: 'Licensing & Appointments',
      freq: 'Per market entry',
      evidence: 'CoA records',
    },
    {
      task: 'License producers before solicitation and verify before appointment under {REG}',
      owner: 'Licensing & Appointments',
      freq: 'Continuous',
      evidence: 'NIPR records',
    },
    {
      task: 'Process appointments/terminations within statutory windows',
      owner: 'Licensing Ops',
      freq: 'Event-driven',
      evidence: 'Appointment records',
    },
    {
      task: 'Track license renewal deadlines and CE compliance',
      owner: 'Licensing Ops',
      freq: 'Renewal cycle',
      evidence: 'Renewal log',
    },
    {
      task: 'Screen hires/producers for 1033 consent and background requirements',
      owner: 'Compliance',
      freq: 'Per hire',
      evidence: 'Screening records',
    },
    {
      task: 'Reconcile producer roster against state appointment records',
      owner: 'Licensing Ops',
      freq: 'Quarterly',
      evidence: 'Reconciliation report',
    },
  ],
  CONSUMER_PROTECTION: [
    {
      task: 'Build the notices/disclosures required by {REG} into forms and correspondence',
      owner: 'Product / Compliance',
      freq: 'Per change',
      evidence: 'Form inventory',
    },
    {
      task: 'Generate and deliver required notices within statutory timeframes',
      owner: 'Policy Administration',
      freq: 'Event-driven',
      evidence: 'Notice log',
    },
    {
      task: 'Configure admin systems to enforce timing/content rules',
      owner: 'IT',
      freq: 'Per change',
      evidence: 'System configuration',
    },
    {
      task: 'Train staff on the handling requirements of {REG}',
      owner: 'Compliance',
      freq: 'Annual',
      evidence: 'Training records',
    },
    {
      task: 'Monitor complaints tied to {REG} and remediate root causes',
      owner: 'Market Conduct',
      freq: 'Continuous',
      evidence: 'Complaint log',
    },
    {
      task: 'Audit notice samples for content and timing accuracy',
      owner: 'Internal Audit',
      freq: 'Annual',
      evidence: 'Audit report',
    },
  ],
  MARKET_CONDUCT: [
    {
      task: 'Maintain written procedures for the conduct areas governed by {REG}',
      owner: 'Market Conduct Compliance',
      freq: 'Annual review',
      evidence: 'Procedure documents',
    },
    {
      task: 'Submit Market Conduct Annual Statement (MCAS) data by deadline',
      owner: 'Regulatory Reporting',
      freq: 'Annual',
      evidence: 'MCAS confirmation',
    },
    {
      task: 'Monitor conduct metrics against regulatory benchmarks',
      owner: 'Market Conduct Compliance',
      freq: 'Quarterly',
      evidence: 'Metric reports',
    },
    {
      task: 'Maintain market-conduct exam readiness files',
      owner: 'Market Conduct Compliance',
      freq: 'Continuous',
      evidence: 'Exam file',
    },
    {
      task: 'Remediate exam findings within agreed timelines',
      owner: 'Compliance',
      freq: 'Event-driven',
      evidence: 'Remediation log',
    },
  ],
  DATA_CALL: [
    {
      task: 'Track applicable data calls and deadlines under {REG}',
      owner: 'Regulatory Reporting',
      freq: 'Per data call',
      evidence: 'Data call calendar',
    },
    {
      task: 'Extract and validate the required data elements',
      owner: 'Data Management',
      freq: 'Per data call',
      evidence: 'Validation report',
    },
    {
      task: 'Submit in the required format/portal by deadline',
      owner: 'Regulatory Reporting',
      freq: 'Per data call',
      evidence: 'Submission receipt',
    },
    {
      task: 'Resolve rejections/edit failures and resubmit',
      owner: 'Data Management',
      freq: 'Event-driven',
      evidence: 'Exception log',
    },
    {
      task: 'Retain submissions and supporting detail',
      owner: 'Records Management',
      freq: 'Continuous',
      evidence: 'Submission archive',
    },
  ],
  FINANCIAL_REPORTING: [
    {
      task: 'Prepare statutory financial statements per NAIC blanks under {REG}',
      owner: 'Controller',
      freq: 'Quarterly/Annual',
      evidence: 'Filed statements',
    },
    {
      task: 'File with NAIC and state regulators by deadline',
      owner: 'Regulatory Reporting',
      freq: 'Quarterly/Annual',
      evidence: 'Submission confirmations',
    },
    {
      task: 'Prepare required supplemental schedules and exhibits',
      owner: 'Controller',
      freq: 'Annual',
      evidence: 'Schedules',
    },
    {
      task: 'Coordinate the independent audit and file audited financials',
      owner: 'Controller',
      freq: 'Annual',
      evidence: 'Audit report',
    },
    {
      task: 'Maintain the jurisdiction filing calendar and evidence of timeliness',
      owner: 'Regulatory Reporting',
      freq: 'Continuous',
      evidence: 'Filing calendar',
    },
  ],
  DATA_PRIVACY: [
    {
      task: 'Publish/deliver privacy notices at the trigger points {REG} requires',
      owner: 'Privacy Office',
      freq: 'Event-driven',
      evidence: 'Notice records',
    },
    {
      task: 'Honor data-subject rights requests within statutory SLAs',
      owner: 'Privacy Ops',
      freq: 'Event-driven',
      evidence: 'DSAR log',
    },
    {
      task: 'Maintain records of processing and lawful basis',
      owner: 'Privacy Office',
      freq: 'Continuous',
      evidence: 'Processing register',
    },
    {
      task: 'Execute vendor/data-sharing agreements with required clauses',
      owner: 'Procurement / Legal',
      freq: 'Per vendor',
      evidence: 'Contracts',
    },
    {
      task: 'Run privacy impact assessments for high-risk processing',
      owner: 'Privacy Office',
      freq: 'Per initiative',
      evidence: 'DPIA records',
    },
    {
      task: 'Notify regulators/individuals of breaches within statutory windows',
      owner: 'CISO / Privacy',
      freq: 'Event-driven',
      evidence: 'Incident records',
    },
    {
      task: 'Train workforce on privacy handling under {REG}',
      owner: 'Privacy Office',
      freq: 'Annual',
      evidence: 'Training records',
    },
  ],
  SOLVENCY_CAPITAL: [
    {
      task: 'Calculate the capital requirement (RBC/SCR/BSCR) per the {REG} formula',
      owner: 'Capital Management',
      freq: 'Quarterly/Annual',
      evidence: 'Capital calculations',
    },
    {
      task: 'Monitor capital against intervention levels and escalate breaches',
      owner: 'CFO',
      freq: 'Continuous',
      evidence: 'Monitoring reports',
    },
    {
      task: 'File required capital/solvency reports with the regulator',
      owner: 'Regulatory Reporting',
      freq: 'Annual',
      evidence: 'Filings',
    },
    {
      task: 'Produce ORSA/solvency self-assessment with board sign-off',
      owner: 'Risk Management',
      freq: 'Annual',
      evidence: 'ORSA report',
    },
    {
      task: 'Run required stress and scenario testing',
      owner: 'Risk / Actuarial',
      freq: 'Annual',
      evidence: 'Test results',
    },
  ],
  CORPORATE_GOVERNANCE: [
    {
      task: 'Maintain board/committee structures required by {REG}',
      owner: 'Corporate Secretary',
      freq: 'Continuous',
      evidence: 'Charters, minutes',
    },
    {
      task: 'File governance disclosures (e.g. CGAD, holding-company forms)',
      owner: 'Corporate Secretary',
      freq: 'Annual/Event-driven',
      evidence: 'Filings',
    },
    {
      task: 'Maintain fitness-and-propriety assessments for officers/directors',
      owner: 'HR / Legal',
      freq: 'Per appointment',
      evidence: 'Assessment records',
    },
    {
      task: 'Review and board-approve governance policies',
      owner: 'Board',
      freq: 'Annual',
      evidence: 'Policy approvals',
    },
  ],
  CYBERSECURITY: [
    {
      task: 'Maintain the written information-security program {REG} requires',
      owner: 'CISO',
      freq: 'Annual review',
      evidence: 'Program documents',
    },
    {
      task: 'Run cybersecurity risk assessments and remediate findings',
      owner: 'CISO',
      freq: 'Annual',
      evidence: 'Assessment reports',
    },
    {
      task: 'Operate required controls (MFA, encryption, access reviews)',
      owner: 'IT Security',
      freq: 'Continuous',
      evidence: 'Control evidence',
    },
    {
      task: 'Test the incident response plan; notify regulator of events within deadline',
      owner: 'CISO',
      freq: 'Annual / Event-driven',
      evidence: 'IR test + incident records',
    },
    {
      task: 'File the annual certification of compliance',
      owner: 'CISO',
      freq: 'Annual',
      evidence: 'Certification',
    },
    {
      task: 'Oversee third-party service provider security',
      owner: 'Vendor Management',
      freq: 'Per vendor / Annual',
      evidence: 'Vendor assessments',
    },
  ],
  SANCTIONS_AML: [
    {
      task: 'Screen parties against OFAC/sanctions lists pre-bind and ongoing',
      owner: 'AML / OFAC Officer',
      freq: 'Continuous',
      evidence: 'Screening logs',
    },
    {
      task: 'Maintain the AML program and designated officer for covered products',
      owner: 'AML / OFAC Officer',
      freq: 'Annual review',
      evidence: 'Program documents',
    },
    {
      task: 'File suspicious activity reports within deadline',
      owner: 'AML / OFAC Officer',
      freq: 'Event-driven',
      evidence: 'SAR records',
    },
    {
      task: 'Train covered employees and producers',
      owner: 'AML / OFAC Officer',
      freq: 'Annual',
      evidence: 'Training records',
    },
    {
      task: 'Independent testing of the AML program',
      owner: 'Internal Audit',
      freq: 'Annual',
      evidence: 'Test report',
    },
  ],
  SUITABILITY: [
    {
      task: 'Collect the consumer profile {REG} requires before any recommendation',
      owner: 'Distribution',
      freq: 'Per sale',
      evidence: 'Profile forms',
    },
    {
      task: 'Review and approve recommendations against the best-interest standard',
      owner: 'Suitability Desk',
      freq: 'Per sale',
      evidence: 'Review records',
    },
    {
      task: 'Verify producer product training completion before solicitation',
      owner: 'Distribution Compliance',
      freq: 'Continuous',
      evidence: 'Training records',
    },
    {
      task: 'Deliver required disclosures at or before sale',
      owner: 'Distribution',
      freq: 'Per sale',
      evidence: 'Disclosure receipts',
    },
    {
      task: 'Supervise and sample-test sales for compliance',
      owner: 'Compliance',
      freq: 'Quarterly',
      evidence: 'Supervision reports',
    },
  ],
  OPERATIONAL_RESILIENCE: [
    {
      task: 'Maintain business-continuity/DR plans meeting {REG}',
      owner: 'Operational Risk',
      freq: 'Annual review',
      evidence: 'Plans',
    },
    {
      task: 'Test resilience/DR capabilities and document results',
      owner: 'IT Operations',
      freq: 'Annual',
      evidence: 'Test results',
    },
    {
      task: 'Maintain critical third-party/ICT risk registers',
      owner: 'Vendor Management',
      freq: 'Continuous',
      evidence: 'Registers',
    },
    {
      task: 'Report major operational/ICT incidents within deadlines',
      owner: 'Operational Risk',
      freq: 'Event-driven',
      evidence: 'Incident reports',
    },
  ],
  ACCOUNTING_AUDIT: [
    {
      task: 'Maintain internal control over financial reporting per {REG}',
      owner: 'Controller',
      freq: 'Continuous',
      evidence: 'Control matrix',
    },
    {
      task: 'Test key controls and remediate deficiencies',
      owner: 'Internal Audit',
      freq: 'Annual',
      evidence: 'Test results',
    },
    {
      task: 'Verify auditor independence/rotation requirements',
      owner: 'Audit Committee',
      freq: 'Per engagement',
      evidence: 'Independence letters',
    },
    {
      task: 'File audited statements and auditor communications',
      owner: 'Controller',
      freq: 'Annual',
      evidence: 'Filings',
    },
  ],
  EMPLOYMENT_BENEFITS: [
    {
      task: 'Keep plan documents and SPDs current with {REG}',
      owner: 'HR / Benefits',
      freq: 'Per change',
      evidence: 'Plan documents',
    },
    {
      task: 'File Form 5500s and required schedules',
      owner: 'Benefits',
      freq: 'Annual',
      evidence: 'Filings',
    },
    {
      task: 'Deliver participant notices within deadlines',
      owner: 'Benefits',
      freq: 'Event-driven',
      evidence: 'Notice logs',
    },
    {
      task: 'Run required nondiscrimination testing',
      owner: 'Benefits',
      freq: 'Annual',
      evidence: 'Test results',
    },
  ],
  WORKERS_COMP_REPORTING: [
    {
      task: 'Report claims (FROI/SROI) via EDI within state timelines under {REG}',
      owner: 'Claims Operations',
      freq: 'Per event',
      evidence: 'EDI acknowledgments',
    },
    {
      task: 'Maintain EDI trading-partner setup and edit tables',
      owner: 'IT',
      freq: 'Per change',
      evidence: 'Configuration records',
    },
    {
      task: 'Report proof-of-coverage on policy events',
      owner: 'Policy Administration',
      freq: 'Per policy event',
      evidence: 'POC acknowledgments',
    },
    {
      task: 'Monitor and resolve rejected transactions',
      owner: 'Claims Operations',
      freq: 'Daily',
      evidence: 'Exception log',
    },
    {
      task: 'Submit unit-statistical data to NCCI/bureau on schedule',
      owner: 'Actuarial / Stat Reporting',
      freq: 'Per schedule',
      evidence: 'Stat submissions',
    },
  ],
  PREMIUM_TAX: [
    {
      task: 'Calculate premium tax by state including retaliatory tax under {REG}',
      owner: 'Tax',
      freq: 'Annual/Quarterly',
      evidence: 'Tax workpapers',
    },
    {
      task: 'File returns and remit via OPTins/state portal by deadline',
      owner: 'Tax',
      freq: 'Per deadline',
      evidence: 'Payment confirmations',
    },
    {
      task: 'Track prepayment/installment schedules',
      owner: 'Tax',
      freq: 'Quarterly',
      evidence: 'Payment log',
    },
    {
      task: 'Reconcile taxed premium to statutory statements',
      owner: 'Tax',
      freq: 'Annual',
      evidence: 'Reconciliation',
    },
  ],
  AI_GOVERNANCE: [
    {
      task: 'Inventory AI/predictive models in scope of {REG}',
      owner: 'Chief Data Officer',
      freq: 'Continuous',
      evidence: 'Model inventory',
    },
    {
      task: 'Test in-scope models for unfair discrimination/bias',
      owner: 'Data Science',
      freq: 'Per model / Annual',
      evidence: 'Bias test results',
    },
    {
      task: 'Maintain the AI governance program and written policies',
      owner: 'Compliance',
      freq: 'Annual review',
      evidence: 'Program documents',
    },
    {
      task: 'Document human oversight and explainability per model',
      owner: 'Chief Data Officer',
      freq: 'Per model',
      evidence: 'Model documentation',
    },
    {
      task: 'Respond to regulator AI inquiries and attestations',
      owner: 'Compliance',
      freq: 'Event-driven',
      evidence: 'Responses',
    },
  ],
  TAX_REPORTING: [
    {
      task: 'Withhold and remit taxes as {REG} requires',
      owner: 'Tax',
      freq: 'Per cycle',
      evidence: 'Remittance records',
    },
    {
      task: 'Issue policyholder tax forms by deadline',
      owner: 'Tax Operations',
      freq: 'Annual',
      evidence: 'Form records',
    },
    {
      task: 'File information returns (incl. FATCA/CRS where applicable)',
      owner: 'Tax',
      freq: 'Annual',
      evidence: 'Filings',
    },
  ],
  AUTO_VERIFICATION: [
    {
      task: 'Extract in-force auto policies for the {REG} feed',
      owner: 'Policy Administration',
      freq: 'Per cycle',
      evidence: 'Policy extract',
    },
    {
      task: 'Validate required reporting data elements',
      owner: 'Data Management',
      freq: 'Per cycle',
      evidence: 'Validation report',
    },
    {
      task: 'Transmit feeds / respond to real-time verification queries',
      owner: 'IT Operations',
      freq: 'Continuous',
      evidence: 'Transmission logs',
    },
    {
      task: 'Report cancellations/terminations within the deadline',
      owner: 'Policy Administration',
      freq: 'Event-driven',
      evidence: 'Cancellation records',
    },
    {
      task: 'Monitor rejected records and reconcile to in-force book',
      owner: 'IT Operations',
      freq: 'Daily/Monthly',
      evidence: 'Exception log',
    },
    {
      task: 'Test the reporting interface on spec changes',
      owner: 'IT / Audit',
      freq: 'Per change',
      evidence: 'Test results',
    },
  ],
  UNCLAIMED_PROPERTY: [
    {
      task: 'Identify dormant/unclaimed amounts per state dormancy rules under {REG}',
      owner: 'Controller (Escheatment)',
      freq: 'Annual',
      evidence: 'Dormancy analysis',
    },
    {
      task: 'Perform due-diligence outreach to owners',
      owner: 'Operations',
      freq: 'Annual',
      evidence: 'Due-diligence letters',
    },
    {
      task: 'File unclaimed-property reports and remit to states',
      owner: 'Controller (Escheatment)',
      freq: 'Annual',
      evidence: 'Filings',
    },
    {
      task: 'Run death-master-file matching where required',
      owner: 'Operations',
      freq: 'Quarterly',
      evidence: 'Match results',
    },
  ],
  ESG_SUSTAINABILITY: [
    {
      task: 'Complete the climate/ESG disclosures and surveys {REG} requires',
      owner: 'Risk / Sustainability',
      freq: 'Annual',
      evidence: 'Submissions',
    },
    {
      task: 'Maintain underlying data and methodology support',
      owner: 'Risk / Sustainability',
      freq: 'Continuous',
      evidence: 'Workpapers',
    },
  ],
  RESIDUAL_MARKET: [
    {
      task: 'Participate in assigned-risk/residual market mechanisms as {REG} requires',
      owner: 'Product Operations',
      freq: 'Continuous',
      evidence: 'Participation records',
    },
    {
      task: 'Pay assessments and report required data',
      owner: 'Controller',
      freq: 'Per assessment',
      evidence: 'Payment records',
    },
    {
      task: 'Service assigned policies per plan rules',
      owner: 'Operations',
      freq: 'Continuous',
      evidence: 'Service records',
    },
  ],
  SECURITIES_DISTRIBUTION: [
    {
      task: 'Register/license representatives and maintain memberships under {REG}',
      owner: 'Broker-Dealer Compliance',
      freq: 'Continuous',
      evidence: 'Registrations',
    },
    {
      task: 'Review and approve communications and advertising',
      owner: 'Broker-Dealer Compliance',
      freq: 'Per item',
      evidence: 'Approval records',
    },
    {
      task: 'Supervise sales practices per FINRA rules',
      owner: 'Broker-Dealer Compliance',
      freq: 'Continuous',
      evidence: 'Supervision records',
    },
    {
      task: 'File required FINRA/SEC reports',
      owner: 'Broker-Dealer Compliance',
      freq: 'Per schedule',
      evidence: 'Filings',
    },
  ],
  CLIMATE_RISK: [
    {
      task: 'Complete the climate-risk disclosure survey under {REG}',
      owner: 'Risk Management',
      freq: 'Annual',
      evidence: 'Survey submission',
    },
    {
      task: 'Integrate climate scenarios into ORSA/stress testing',
      owner: 'Risk Management',
      freq: 'Annual',
      evidence: 'Analysis',
    },
  ],
  APCD_REPORTING: [
    {
      task: 'Register as a submitter and track spec versions for {REG}',
      owner: 'Data Management',
      freq: 'Per change',
      evidence: 'Registration',
    },
    {
      task: 'Submit claims data files on the required schedule',
      owner: 'Data Management',
      freq: 'Monthly/Quarterly',
      evidence: 'Submission receipts',
    },
    {
      task: 'Resolve edit failures/rejections and resubmit',
      owner: 'Data Management',
      freq: 'Event-driven',
      evidence: 'Exception log',
    },
  ],
  CATASTROPHE_REPORTING: [
    {
      task: 'Monitor for catastrophe event data calls under {REG}',
      owner: 'Regulatory Reporting',
      freq: 'Event-driven',
      evidence: 'Data call calendar',
    },
    {
      task: 'Compile and submit claims data within event deadlines',
      owner: 'Claims Operations',
      freq: 'Event-driven',
      evidence: 'Submissions',
    },
  ],
  ANTITRUST_CONDUCT: [
    {
      task: 'Train staff on the antitrust/conduct restrictions in {REG}',
      owner: 'Legal',
      freq: 'Annual',
      evidence: 'Training records',
    },
    {
      task: 'Review agreements and industry collaborations for compliance',
      owner: 'Legal',
      freq: 'Per agreement',
      evidence: 'Review records',
    },
  ],
  SURPLUS_LINES: [
    {
      task: 'Verify insurer eligibility and diligent search before each placement under {REG}',
      owner: 'Surplus Lines Compliance',
      freq: 'Per placement',
      evidence: 'Affidavits',
    },
    {
      task: 'File policy data and pay surplus lines taxes via SLIP+/state portal',
      owner: 'Tax',
      freq: 'Per policy / Quarterly',
      evidence: 'Filings & receipts',
    },
    {
      task: 'Apply required stamps/disclosures to policies',
      owner: 'Operations',
      freq: 'Per policy',
      evidence: 'Policy copies',
    },
  ],
  OTHER: [
    {
      task: 'Determine the concrete obligations {REG} creates and assign an owner',
      owner: 'Compliance',
      freq: 'Per item',
      evidence: 'Determination memo',
    },
    {
      task: 'Implement and evidence the required actions',
      owner: 'Assigned owner',
      freq: 'Per item',
      evidence: 'Evidence file',
    },
  ],
};

// ── frequency inferred from requirement text (mode across an item's rows) ───
const FREQ_PATTERNS: [RegExp, string][] = [
  [/\bdaily\b/i, 'Daily'],
  [/\bweekly\b/i, 'Weekly'],
  [/\bmonthly\b/i, 'Monthly'],
  [/\bquarterly\b/i, 'Quarterly'],
  [/\bsemi-?annual/i, 'Semi-annual'],
  [/\bannual(ly)?\b|\beach year\b|\byearly\b/i, 'Annual'],
  [/\bbiennial|every (two|other) years?\b/i, 'Biennial'],
  [/\bcontinuous(ly)?\b|\bongoing\b|\bat all times\b/i, 'Continuous'],
  [/\bprior to\b|\bbefore\b|\bpre-?approval\b|\bapproval\b/i, 'Per filing / pre-use gate'],
  [/\bupon\b|\bwhen(ever)?\b|\bwithin\b|\bevent\b|\bnotice\b/i, 'Event-driven'],
];
// category fallback when no frequency keyword appears in an item's texts
const CATEGORY_FREQ: Record<string, string> = {
  PRODUCT_FILING: 'Per filing / pre-use gate',
  LICENSING: 'Renewal cycle (annual/biennial)',
  CONSUMER_PROTECTION: 'Event-driven',
  MARKET_CONDUCT: 'Continuous',
  DATA_CALL: 'Per data call',
  FINANCIAL_REPORTING: 'Annual/Quarterly',
  PREMIUM_TAX: 'Annual',
  SANCTIONS_AML: 'Continuous',
  SUITABILITY: 'Continuous',
  AUTO_VERIFICATION: 'Continuous',
  WORKERS_COMP_REPORTING: 'Per event / EDI cycle',
  UNCLAIMED_PROPERTY: 'Annual',
};
function inferFrequency(texts: string[], categories: Set<string>): string {
  const tally = new Map<string, number>();
  for (const t of texts) {
    for (const [re, label] of FREQ_PATTERNS) {
      if (re.test(t)) {
        tally.set(label, (tally.get(label) ?? 0) + 1);
        break;
      }
    }
  }
  if (tally.size) return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  for (const c of categories) if (CATEGORY_FREQ[c]) return CATEGORY_FREQ[c];
  return 'Not Yet Determined';
}

// state-name scrub so per-state titles cluster into one obligation
const STATES =
  'alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|d\\.c\\.|dc';
const stateRe = new RegExp(`\\b(${STATES})\\b`, 'gi');
function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(stateRe, '{st}')
    .replace(/\b[a-z]{2}\b(?=\s)/g, '{st}')
    .replace(/\d+/g, '#')
    .replace(/[^a-z{}#]+/g, ' ')
    .trim();
}

function main() {
  const wb = XLSX.readFile(SRC);
  const rows: Row[] = [];
  for (const sheet of wb.SheetNames) {
    for (const r of XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheet], { defval: '' })) {
      rows.push({ ...r, __sheet: sheet } as Row);
    }
  }

  // ── group binding rows into compliance items ──────────────────────────────
  // key = regime/program when present, else category + normalized title cluster
  type Item = {
    id: string;
    name: string;
    categories: Set<string>;
    lobs: Set<string>;
    jurisdictions: Set<string>;
    sheets: Set<string>;
    rows: Row[];
    citations: Set<string>;
  };
  const items = new Map<string, Item>();
  const keyOf = (r: Row) => {
    const regime = String(r['Regime / Program']).trim();
    if (regime) return `R::${regime.toLowerCase()}`;
    return `T::${r['Category']}::${normTitle(String(r['Requirement Title']))}`;
  };
  const nameOf = (r: Row) => {
    const regime = String(r['Regime / Program']).trim();
    if (regime) return regime;
    return String(r['Requirement Title'])
      .replace(stateRe, '')
      .replace(/^\s*[A-Z]{2}\s+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  let bindingCount = 0;
  for (const r of rows) {
    const binding = String(r['Binding (B/I)']).trim() === 'B';
    if (!binding) continue;
    bindingCount++;
    const key = keyOf(r);
    let item = items.get(key);
    if (!item) {
      item = {
        id: '',
        name: nameOf(r),
        categories: new Set(),
        lobs: new Set(),
        jurisdictions: new Set(),
        sheets: new Set(),
        rows: [],
        citations: new Set(),
      };
      items.set(key, item);
    }
    item.categories.add(String(r['Category']).trim());
    item.lobs.add(String(r['Line of Business']).trim() || 'ALL');
    item.jurisdictions.add(String(r['Jurisdiction']).trim());
    item.sheets.add(String(r.__sheet));
    if (String(r['Citation']).trim()) item.citations.add(String(r['Citation']).trim());
    item.rows.push(r);
  }

  // stable ordering: biggest programs first, then alpha
  const ordered = [...items.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name),
  );
  ordered.forEach((it, i) => {
    it.id = `REG-${String(i + 1).padStart(3, '0')}`;
  });

  // row → item id lookup
  const rowItem = new Map<Row, Item>();
  for (const it of ordered) for (const r of it.rows) rowItem.set(r, it);

  // ── Sheet 2: Compliance Items ─────────────────────────────────────────────
  const itemSheet = ordered.map((it) => {
    const cat = [...it.categories].sort().join(', ');
    const rule = CATEGORY_RULES[[...it.categories][0]] ?? FALLBACK_RULE;
    // multi-category items: impact = union (Yes wins) across their categories
    const rules = [...it.categories].map((c) => CATEGORY_RULES[c] ?? FALLBACK_RULE);
    const anyYes = (k: 'product' | 'process' | 'system') =>
      rules.some((x) => x[k] === 'Yes') ? 'Yes' : 'No';
    const scope = [
      it.sheets.has('State')
        ? `${[...it.jurisdictions].filter((j) => !/federal|international/i.test(j)).length} jurisdictions`
        : '',
      it.sheets.has('Federal') ? 'Federal' : '',
      it.sheets.has('International') ? 'International' : '',
    ]
      .filter(Boolean)
      .join(' + ');
    // representative verbatim requirement — shortest text is usually cleanest
    const rep =
      it.rows.map((r) => String(r['Requirement'])).sort((a, b) => a.length - b.length)[0] ?? '';
    return {
      'Regulation ID': it.id,
      'Regulation / Program': it.name,
      'Compliance Required': 'Yes',
      'Compliance Items': 0, // filled after task generation below
      Category: cat,
      'Line of Business': [...it.lobs].sort().join(', '),
      'Jurisdiction Scope': scope,
      'Requirement Rows': it.rows.length,
      'Product Impact': anyYes('product'),
      'Process Impact': anyYes('process'),
      'System Impact': anyYes('system'),
      Owner: rules.length === 1 ? rule.owner : [...new Set(rules.map((x) => x.owner))].join('; '),
      Frequency: inferFrequency(
        it.rows.map((r) => `${r['Requirement Title']} ${r['Requirement']}`),
        it.categories,
      ),
      'Due Date / Effective Date': 'Not Yet Determined',
      'Evidence Required': [...new Set(rules.map((x) => x.evidence))].join('; '),
      'Audit Status': 'Not started',
      'Representative Requirement (verbatim)': rep.slice(0, 500),
      'Sample Citations': [...it.citations].slice(0, 3).join(' | '),
    };
  });

  // ── Sheet 3: atomic COMPLIANCE ITEMS (doc-style task tables per regulation) ─
  const taskSheet: Record<string, string | number>[] = [];
  ordered.forEach((it, idx) => {
    const seen = new Set<string>();
    let n = 0;
    for (const c of [...it.categories].sort()) {
      for (const tpl of CATEGORY_TASKS[c] ?? CATEGORY_TASKS.OTHER) {
        const task = tpl.task.replace(/\{REG\}/g, it.name);
        if (seen.has(task)) continue; // multi-category regimes: no duplicate tasks
        seen.add(task);
        n++;
        taskSheet.push({
          'Compliance Item ID': `${it.id}-C${String(n).padStart(2, '0')}`,
          'Regulation ID': it.id,
          'Regulation / Program': it.name,
          Category: c,
          'Compliance Item (what must be done)': task,
          Owner: tpl.owner,
          Frequency: tpl.freq,
          Evidence: tpl.evidence,
          'Jurisdiction Scope': itemSheet[idx]['Jurisdiction Scope'] as string,
          'Audit Status': 'Not started',
        });
      }
    }
    itemSheet[idx]['Compliance Items'] = n;
  });

  // ── Sheet 3: all requirement rows, flagged ────────────────────────────────
  const reqSheet = rows.map((r) => {
    const binding = String(r['Binding (B/I)']).trim() === 'B';
    const it = rowItem.get(r);
    return {
      'Source Sheet': r.__sheet,
      Jurisdiction: r['Jurisdiction'],
      'Regime / Program': r['Regime / Program'],
      Category: r['Category'],
      'Line of Business': r['Line of Business'],
      'Requirement Title': r['Requirement Title'],
      Requirement: r['Requirement'],
      Citation: r['Citation'],
      Source: r['Source'],
      'Source Type': r['Source Type'],
      'Binding (B/I)': r['Binding (B/I)'],
      'Source Quality': r['Source Quality'],
      'Link Verified': r['Link Verified'],
      'Jump-To Link': r['Jump-To Link'],
      Note: r['Note'],
      // ── new compliance columns (appended, none of the source columns touched)
      'Compliance Required': binding ? 'Yes' : 'No',
      'Regulation ID': it?.id ?? '—',
      'Regulation / Program (linked)': it?.name ?? '—',
      'Not-Required Reason': binding
        ? ''
        : 'Informational / advisory source (Binding = I) — defines expectations, no actionable obligation',
    };
  });

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const catCount = new Map<string, number>();
  for (const it of ordered) {
    const c = [...it.categories].sort().join(', ');
    catCount.set(c, (catCount.get(c) ?? 0) + 1);
  }
  const summary = [
    { Metric: 'L1 — Regulations with compliance obligations (REG-###)', Value: ordered.length },
    {
      Metric: 'L2 — Atomic compliance items (REG-###-C##, "what must be done")',
      Value: taskSheet.length,
    },
    { Metric: 'L3 — Source requirement rows (audit workbook)', Value: rows.length },
    { Metric: 'Rows flagged Compliance Required = Yes (Binding = B)', Value: bindingCount },
    {
      Metric: 'Rows flagged Compliance Required = No (Informational = I)',
      Value: rows.length - bindingCount,
    },
    {
      Metric: 'Prior platform "COMPLIANCE — 137" tile',
      Value: '137 (randomly selected — discarded; see Methodology)',
    },
    {
      Metric: 'Benchmark: KPMG 2025 SOX survey avg key controls',
      Value: '463 (FY22) → 546 (FY24)',
    },
  ];

  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(itemSheet), 'Regulations (L1)');
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(taskSheet), 'Compliance Items (L2)');
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(reqSheet),
    'Requirements Flagged (L3)',
  );

  // ── Sheet 4: Methodology ──────────────────────────────────────────────────
  const method = [
    ['SCRUM-46 — Compliance flagging methodology'],
    [''],
    ['1. Definitions (per "Regulations v. Compliance" reference doc)'],
    [
      '   Regulation = the rule (what the regulator expects). May be informational, advisory, interpretive.',
    ],
    [
      '   Compliance item = the actionable, auditable, mandatory obligation the insurer must implement and evidence.',
    ],
    [''],
    ['2. Compliance Required flag (every one of the 23,928 audit rows)'],
    [
      '   Yes  = row is marked Binding (B) in the audit workbook — it creates an actionable obligation. (23,664 rows)',
    ],
    [
      '   No   = row is marked Informational (I) — advisory/interpretive, no direct action required. (264 rows)',
    ],
    ['   No row left blank: "No" is an explicit value, distinguishable from "not yet reviewed".'],
    [''],
    ['3. Three-level hierarchy'],
    [
      '   L1 REGULATIONS (REG-###): one row per enforced regime/program (e.g. "Policy Form Filing",',
    ],
    [
      '   "KY AVIS Monthly Reporting", "GDPR"). Grouping key: the audit workbook Regime / Program column;',
    ],
    ['   rows without a regime are clustered by category + state-normalized requirement title.'],
    [
      '   L2 COMPLIANCE ITEMS (REG-###-C##): the atomic actions someone must perform to stay in compliance,',
    ],
    [
      "   in the reference doc's FCRA/KY-AVIS table shape (task, owner, frequency, evidence). Generated from",
    ],
    [
      '   a per-category task template (see CATEGORY_TASKS in build-compliance-workbook.ts) parameterized by',
    ],
    ["   the regulation; multi-category regulations take the union of their categories' tasks."],
    [
      '   L3 REQUIREMENT ROWS: all 23,928 per-jurisdiction source rows, flagged and linked to their L1',
    ],
    ['   regulation — per-state rows are INSTANCES of one program, not separate rules.'],
    [''],
    ['4. Realistic register size (external research)'],
    [
      '   KPMG 2025 SOX survey: average key-control count 463 (FY22) → 546 (FY24) for regulated enterprises.',
    ],
    [
      '   Industry guidance (Thomson Reuters Regulatory Intelligence obligations library; V-Comply insurance',
    ],
    [
      '   compliance framework; Aavenir banking/insurance obligations) describes carrier obligation registers in',
    ],
    [
      '   the hundreds, tracked per state/product as instances. The derived count here (' +
        String(ordered.length) +
        ' items) is',
    ],
    ['   consistent with that range.'],
    [''],
    ['5. Compliance dimensions (per item)'],
    [
      '   Product/Process/System impact + Owner + Evidence derive from a documented per-category rule table',
    ],
    [
      '   (see build-compliance-workbook.ts CATEGORY_RULES); multi-category items take the union of impacts.',
    ],
    [
      "   Frequency is inferred as the modal frequency keyword across the item's requirement texts.",
    ],
    [
      '   Due/Effective Date and unknown values use the explicit placeholder "Not Yet Determined" (never blank).',
    ],
    ['   Audit Status starts at "Not started" for every item.'],
    [''],
    ['6. Reconciliation vs the "COMPLIANCE — 137" tile'],
    [
      '   The existing complianceFlagged=137 set in the platform was randomly selected (confirmed by product owner',
    ],
    [
      '   2026-07-17) and is NOT used. Variance (137 → ' +
        String(ordered.length) +
        ' items / 23,664 flagged rows) is expected and',
    ],
    ['   documented here as the correction of that placeholder.'],
    [''],
    ['7. Governance'],
    [
      '   L2 compliance items are template-generated for review — a starting register, not a legal determination.',
    ],
    [
      '   Final compliance determinations must be validated by Legal/Compliance before being treated as',
    ],
    [
      "   authoritative. Jurisdiction-specific task variants (e.g. one state's unique deadline) live in the L3",
    ],
    ['   requirement text and can be promoted to bespoke L2 items during that review.'],
    [''],
    ['Sources'],
    ['   KPMG 2025 SOX survey via zluri.com/blog/what-are-sox-controls'],
    ['   thomsonreuters.com Regulatory Intelligence Obligations Library'],
    ['   v-comply.com/blog/insurance-compliance-framework-us'],
    ['   aavenir.com/managing-regulatory-and-contract-obligations-in-banking-insurance'],
  ].map((r) => ({ Methodology: r[0] ?? '' }));
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(method, { skipHeader: true }),
    'Methodology',
  );

  XLSX.writeFile(out, OUT);
  console.log(
    JSON.stringify(
      {
        out: OUT,
        regulationsL1: ordered.length,
        complianceItemsL2: taskSheet.length,
        sourceRowsL3: rows.length,
        flaggedYes: bindingCount,
        flaggedNo: rows.length - bindingCount,
        top5: itemSheet
          .slice(0, 5)
          .map(
            (i) =>
              `${i['Regulation ID']} ${i['Regulation / Program']} (${i['Compliance Items']} items, ${i['Requirement Rows']} rows)`,
          ),
        sampleTasks: taskSheet
          .filter((tk) => tk['Regulation ID'] === 'REG-001')
          .map((tk) => `${tk['Compliance Item ID']} ${tk['Compliance Item (what must be done)']}`),
      },
      null,
      2,
    ),
  );
}

main();
