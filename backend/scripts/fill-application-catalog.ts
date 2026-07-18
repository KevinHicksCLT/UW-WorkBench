// fill-application-catalog.ts — complete the estate catalog so every
// application's drill page reads fully populated:
//   • a one-line description for every Application (curated per app),
//   • vendor/category where missing,
//   • an illustrative TCO (deterministic from the name) where missing,
//   • merge the three near-duplicate "Internal Reg*" rows into one,
//   • reset scanStatus to NOT_SCANNED everywhere ("no scanned apps for now" —
//     repo/app URLs are kept; a scan re-marks them from the app page).
// Idempotent: descriptions only fill when empty (FORCE_DESC=1 overwrites).
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const FORCE = process.env.FORCE_DESC === '1';

type Meta = { d: string; vendor?: string; category?: string };
const CATALOG: Record<string, Meta> = {
  'ADP Payroll': { d: 'Cloud payroll processing and tax filing for employee compensation.' },
  'API gateway (Apigee/Kong/Azure API Management)': {
    d: 'Managed API gateway — routing, authentication, throttling and versioning for internal and partner APIs.',
    vendor: 'Apigee / Kong / Microsoft',
  },
  'Actuarial modeling platform (Prophet/MoSes/Axis/ResQ/Igloo)': {
    d: 'Actuarial modeling suite for pricing, reserving and capital projections.',
  },
  'Anaplan (Planning)': {
    d: 'Connected planning platform for FP&A budgeting, forecasting and scenario modeling.',
  },
  'Apache JMeter / k6 Performance Testing': {
    d: 'Load and performance testing tooling for API and UI capacity validation.',
    vendor: 'Apache / Grafana Labs',
    category: 'Infra',
  },
  'Archer GRC': {
    d: 'Governance, risk and compliance platform — risk registers, controls and attestations.',
  },
  AuditBoard: { d: 'Audit management and SOX compliance platform for internal audit workflows.' },
  'Azure DevOps': {
    d: 'CI/CD pipelines, boards and artifact management for engineering delivery.',
  },
  'Azure ML / MLflow': {
    d: 'Machine-learning platform for model training, tracking and deployment.',
  },
  'BI/reporting platform': {
    d: 'In-house business-intelligence layer serving operational dashboards and scheduled reports.',
  },
  Backstage: {
    d: 'Developer portal cataloging services, ownership and golden-path templates.',
    vendor: 'Spotify OSS',
    category: 'Infra',
  },
  'BlackLine (Close)': {
    d: 'Financial close automation — reconciliations, journal entries and close checklists.',
  },
  'BlackRock Aladdin': {
    d: 'Investment management platform for portfolio analytics, trading and risk.',
  },
  'Bloomberg Terminal': {
    d: 'Market data, analytics and trading workstation for the investments desk.',
  },
  'Broker & Agent Portal': {
    d: 'Self-service portal where brokers and agents quote, submit and track business.',
  },
  'CCC / Mitchell Estimating': {
    d: 'Auto physical-damage estimating and total-loss valuation for claims.',
  },
  CMDB: { d: 'Configuration management database tracking IT assets, services and dependencies.' },
  'CRM (Salesforce/Dynamics)': {
    d: 'Customer relationship management for producer, account and opportunity tracking.',
  },
  'Catastrophe Data Provider': {
    d: 'External catastrophe event and exposure data feeds for cat modeling.',
  },
  'Claims Platform': {
    d: 'Core claims system of record for intake, adjudication and settlement.',
    vendor: 'In-house',
  },
  'Claims management platform (Guidewire ClaimCenter/Duck Creek Claims)': {
    d: 'Core claims administration — FNOL intake, adjudication, reserves and payments.',
  },
  Confluence: {
    d: 'Team documentation and knowledge-base wiki.',
    vendor: 'Atlassian',
    category: 'Infra',
  },
  'Cornerstone LMS': {
    d: 'Learning management system for training assignment and compliance tracking.',
  },
  'Coupa / SAP Ariba (Procurement)': {
    d: 'Source-to-pay procurement — requisitions, POs, supplier management and invoicing.',
  },
  'Credit Bureau & Data Services': {
    d: 'External credit and consumer-report data for underwriting and claims.',
  },
  'CrowdStrike Falcon': { d: 'Endpoint detection and response platform for threat protection.' },
  'Customer Self-Service Portal': {
    d: 'Policyholder portal for payments, ID cards, claims status and policy changes.',
  },
  'CyberArk (PAM)': {
    d: 'Privileged access management — credential vaulting and session control.',
  },
  'Data pipeline orchestrator (Airflow/Dagster/Prefect)': {
    d: 'Workflow orchestration for scheduled data pipelines and dependencies.',
    vendor: 'Apache / OSS',
  },
  'Databricks Lakehouse': {
    d: 'Unified lakehouse for data engineering, analytics and ML workloads.',
  },
  DocuSign: { d: 'Electronic signature and agreement workflow platform.' },
  'Duck Creek Distribution': {
    d: 'Distribution management — producer onboarding, licensing and compensation.',
  },
  'ERP/General ledger (SAP/Oracle/Workday Financials)': {
    d: 'Enterprise resource planning and general ledger — the financial book of record.',
  },
  'Earnix Rating & Pricing': {
    d: 'Rating and pricing engine for real-time, analytics-driven premium calculation.',
  },
  'Enterprise Reference Data (MDM/RDM)': {
    d: 'Shared master/reference data service — canonical codes and entities.',
    category: 'Data',
  },
  'Enterprise data warehouse/lakehouse': {
    d: 'Central warehouse/lakehouse consolidating finance and operational data marts.',
  },
  'Event streaming platform (Kafka/Confluent)': {
    d: 'Event backbone for real-time data streaming between systems.',
    vendor: 'Confluent',
  },
  'FIS Prophet': { d: 'Actuarial projection system for liability modeling and capital reporting.' },
  'FRISS Fraud Detection': {
    d: 'AI fraud scoring at underwriting and claims — risk signals and alerts.',
  },
  'GRC platform (Archer/ServiceNow GRC)': {
    d: 'Enterprise GRC — policies, risks, controls and issue management.',
  },
  'Genesys Cloud (Contact Center)': {
    d: 'Cloud contact center — routing, IVR and workforce engagement.',
  },
  'GitHub Actions': {
    d: 'CI workflow automation building, testing and deploying code.',
    vendor: 'GitHub',
    category: 'Infra',
  },
  'GitHub Enterprise': {
    d: 'Source code hosting and review platform.',
    vendor: 'GitHub',
    category: 'Infra',
  },
  Grafana: {
    d: 'Metrics dashboards and alerting over operational telemetry.',
    vendor: 'Grafana Labs',
    category: 'Infra',
  },
  'Greenhouse (Recruiting)': { d: 'Applicant tracking and structured hiring platform.' },
  'Guidewire BillingCenter': {
    d: 'Policy billing — invoicing, payment plans, delinquency and disbursements.',
  },
  'Guidewire ClaimCenter': { d: 'Claims administration system — FNOL through settlement.' },
  'Guidewire PolicyCenter': {
    d: 'Policy administration — quoting, issuance, endorsements and renewals.',
  },
  'HRIS (Workday/SuccessFactors)': {
    d: 'HR system of record — employee data, compensation, benefits and org structure.',
  },
  'IAM platform (SailPoint/Okta/Azure AD)': {
    d: 'Identity and access management — SSO, provisioning and access certification.',
  },
  'ITSM platform (ServiceNow/Jira)': {
    d: 'IT service management — incidents, changes, requests and problem tracking.',
  },
  'ITSM/security ticketing system': {
    d: 'In-house ticketing for security incidents and IT requests.',
  },
  'Icertis CLM (Contracts)': {
    d: 'Contract lifecycle management — authoring, negotiation and obligation tracking.',
  },
  'Identity & Access (shared authorization)': {
    d: 'Shared authorization service — authentication, roles and permissions.',
    category: 'Security',
  },
  'Internal Regulatory System': {
    d: 'In-house tracker for regulatory obligations, filings and remediation.',
    vendor: 'In-house',
    category: 'Risk & Compliance',
  },
  Jenkins: {
    d: 'Legacy CI server for build and deployment automation.',
    vendor: 'Jenkins OSS',
    category: 'Infra',
  },
  Jira: { d: 'Agile work tracking — epics, sprints and issue workflows.', vendor: 'Atlassian' },
  'Jira Align / Rally': {
    d: 'Enterprise agile portfolio planning connecting strategy to team delivery.',
  },
  'Legal matter management/e-billing system': {
    d: 'Legal matter tracking and outside-counsel e-billing.',
  },
  'LexisNexis Risk': {
    d: 'Risk data and analytics — identity, claims history and public records.',
  },
  'Marketo (Marketing)': { d: 'Marketing automation — campaigns, nurture and lead scoring.' },
  'Medical Bill Review (Coventry)': {
    d: 'Workers-comp medical bill review and repricing network.',
  },
  'Microsoft 365 / SharePoint': {
    d: 'Productivity and document collaboration suite; SharePoint document repositories.',
  },
  'Microsoft Excel': {
    d: 'Spreadsheet workhorse for analysis, reconciliations and ad-hoc models.',
  },
  'Microsoft Teams / Email': { d: 'Messaging, meetings and email communication backbone.' },
  'Milliman Arius (Reserving)': {
    d: 'Reserve analysis platform for loss development and IBNR estimation.',
  },
  "Moody's RMS (Cat Model)": {
    d: 'Catastrophe modeling for portfolio accumulation and event loss estimates.',
  },
  'NICE Actimize (AML)': {
    d: 'Financial-crime platform — AML monitoring, sanctions and case management.',
  },
  'NIPR (Producer Licensing)': {
    d: 'National producer licensing data and appointment processing.',
  },
  'Okta / IAM Platform': { d: 'Cloud identity — SSO, MFA and lifecycle provisioning.' },
  'OneStream (FP&A)': {
    d: 'Corporate performance management — consolidation, planning and reporting.',
  },
  'OpenMRS Insurance Claims': {
    d: 'OpenMRS module that captures clinical encounters and packages them as insurance claims for adjudication.',
    category: 'Claims',
  },
  'OpenText Document Mgmt': {
    d: 'Enterprise content management — document capture, storage and retention.',
  },
  'Oracle EPM': { d: 'Enterprise performance management — consolidation, close and planning.' },
  'PPM tool (Clarity/Planview/Jira Align)': {
    d: 'Project portfolio management — demand, capacity and delivery tracking.',
  },
  'Pact Broker': {
    d: 'Contract-testing broker verifying consumer/provider API compatibility.',
    vendor: 'Pactflow',
    category: 'Infra',
  },
  'Payment Gateway': {
    d: 'Payment processing gateway for premium collection and claim disbursements.',
  },
  'Policy Administration Platform': {
    d: 'In-house policy administration for niche products — issuance and endorsements.',
  },
  'Policy administration system (Guidewire PolicyCenter/Duck Creek/ALIP)': {
    d: 'Core policy administration — rating, issuance, endorsements and renewals.',
  },
  'Power BI': { d: 'Self-service analytics and dashboarding over governed datasets.' },
  'Qualys / Tenable (Vuln)': {
    d: 'Vulnerability scanning and risk-based remediation tracking.',
  },
  'Regulatory Filing Portal (SERFF)': {
    d: 'NAIC SERFF portal for rate, rule and form filings.',
  },
  'Reinsurance administration system': {
    d: 'Treaty and facultative reinsurance administration — cessions and recoveries.',
  },
  'Reinsurer Exchange': {
    d: 'External exchange for placing and settling reinsurance business.',
  },
  'SAP S/4HANA (GL)': { d: 'General ledger and financial accounting core.' },
  'SAS Actuarial Platform': {
    d: 'Statistical modeling environment for actuarial and risk analytics.',
  },
  'SIEM/SOAR': { d: 'Security monitoring and automated response over event telemetry.' },
  'SailPoint IGA': {
    d: 'Identity governance — access requests, certifications and role mining.',
  },
  'Salesforce FSC': {
    d: 'Financial Services Cloud CRM for client and household management.',
  },
  'Sanctions screening system (LexisNexis Bridger/FircoSoft)': {
    d: 'Sanctions and watchlist screening for payments and parties.',
    vendor: 'LexisNexis / FircoSoft',
    category: 'Security',
  },
  'Sapiens ReinsurancePro': {
    d: 'Reinsurance management — treaties, cessions, claims and technical accounting.',
  },
  'ServiceNow ITSM': {
    d: 'IT service management suite — incident, change and CMDB workflows.',
  },
  'Snowflake Data Cloud': {
    d: 'Cloud data platform for warehousing, sharing and analytics.',
  },
  SonarQube: {
    d: 'Static code analysis for quality gates and security hotspots.',
    vendor: 'Sonar',
    category: 'Infra',
  },
  'Splunk SIEM': {
    d: 'Security information and event management — log analytics and detection.',
  },
  'Statutory Reporting (NAIC)': {
    d: 'Statutory financial statement preparation and NAIC filings.',
  },
  'Surplus Lines / SLIP Portal': {
    d: 'Surplus lines filing portal for state stamping-office compliance.',
  },
  'Terraform Cloud': {
    d: 'Infrastructure-as-code state management and plan/apply automation.',
    vendor: 'HashiCorp',
    category: 'Infra',
  },
  'Transformation Bridge': {
    d: 'Operating-model intelligence platform — value streams, roles, applications and transformation workspaces over a typed graph.',
    vendor: 'Capgemini',
  },
  'Underwriting Platform': {
    d: 'Core underwriting system of record for risk assessment and account decisioning.',
    vendor: 'In-house',
  },
  'Workday HCM': {
    d: 'Human capital management — HR core, compensation, talent and payroll integration.',
  },
  'agency/producer management system': {
    d: 'In-house producer and agency management — appointments, hierarchies and commissions.',
  },
  'billing/commission platform': {
    d: 'In-house billing and commission engine for premium and producer payments.',
  },
  'board portal': { d: 'Secure board-meeting portal for materials, minutes and votes.' },
  'ceded accounting platform': {
    d: 'Ceded reinsurance accounting — bordereaux, statements and settlements.',
  },
  'claim file/document repository': {
    d: 'Claims document repository — correspondence, evidence and file notes.',
  },
  'close/consolidation tool': { d: 'Financial close and consolidation workflow tool.' },
  'compliance evidence repository': {
    d: 'Central store of compliance evidence artifacts and attestations.',
  },
  'contract lifecycle management repository': {
    d: 'Contract repository with clause library and obligation tracking.',
  },
  'data catalog/quality tool': { d: 'Data catalog with lineage, glossary and quality rules.' },
  'data warehouse/lake': {
    d: 'Operational data warehouse/lake feeding analytics and reporting.',
  },
  'document management repository': {
    d: 'General document management repository with retention policies.',
  },
  'enterprise data warehouse': {
    d: 'Enterprise warehouse for governed finance and regulatory reporting data.',
  },
  'financial reporting repository': {
    d: 'Repository of financial reports, disclosures and supporting schedules.',
  },
  'iManage (Legal Docs)': { d: 'Legal document and email management for matter files.' },
  'k6 / Gatling Streaming Load Testing': {
    d: 'Streaming load-test tooling for event pipeline capacity.',
    vendor: 'Grafana Labs / Gatling',
    category: 'Infra',
  },
  'learning management system': {
    d: 'In-house LMS for course delivery and certification tracking.',
  },
  'marketing automation platform': {
    d: 'In-house campaign automation and lead-nurture platform.',
  },
  'model governance repository': {
    d: 'Inventory of models with validation status and governance artifacts.',
  },
  openIMIS: {
    d: 'Open-source insurance management information system — policies, insurees, claims and contributions for social health protection schemes.',
    category: 'Claims',
  },
  'payment/subrogation system': {
    d: 'Claims payment and subrogation recovery processing.',
  },
  'payroll/benefits platform': { d: 'In-house payroll and benefits administration.' },
  'product roadmap/backlog tool': { d: 'Product roadmap and backlog management.' },
  'regulatory filing/issue tracker': {
    d: 'Tracker for regulatory filings, exams and issue remediation.',
  },
  'requirements repository': {
    d: 'Repository of business and system requirements with traceability.',
  },
  'source code/CI-CD repository': {
    d: 'Source control and CI/CD pipelines for in-house software.',
  },
  'treaty repository': { d: 'Repository of reinsurance treaty documents and terms.' },
  'underwriting workstation': {
    d: 'Underwriter desktop — submission triage, risk scoring and referrals.',
  },
  'workflow/case management tool': {
    d: 'Configurable workflow and case management for operations.',
  },
};

// Deterministic illustrative TCO from the app name — SoR/dev tooling runs
// cheaper than business platforms; rounded to $1K like the seeded estate.
function tcoFor(name: string, kind: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  const [min, max] = kind === 'SystemOfRecord' ? [120_000, 420_000] : [250_000, 1_250_000];
  return Math.round((min + (h % (max - min))) / 1000) * 1000;
}

// ── 1. Merge the near-duplicate Internal Reg* rows.
const regRows = await prisma.application.findMany({
  where: {
    name: {
      in: ['Internal Reglatory System', 'Internal Regulation System', 'Internal Regulatory System'],
    },
  },
  select: { id: true, name: true },
});
const keep = regRows.find((r) => r.name === 'Internal Regulatory System') ?? regRows[0];
for (const r of regRows) {
  if (!keep || r.id === keep.id) continue;
  await prisma.nodeAppUsage
    .updateMany({ where: { applicationId: r.id }, data: { applicationId: keep.id } })
    .catch(() => {});
  await prisma.regulationApplication
    .updateMany({ where: { applicationId: r.id }, data: { applicationId: keep.id } })
    .catch(() => {});
  await prisma.nodeTemplateAnswer.updateMany({
    where: { applicationId: r.id },
    data: { applicationId: keep.id },
  });
  await prisma.standardTemplateAnswer.updateMany({
    where: { applicationId: r.id },
    data: { applicationId: keep.id },
  });
  await prisma.regulationTemplateAnswer.updateMany({
    where: { applicationId: r.id },
    data: { applicationId: keep.id },
  });
  await prisma.application.delete({ where: { id: r.id } });
  console.log(`merged duplicate "${r.name}" -> "${keep.name}"`);
}

// ── 2. Fill descriptions / vendor / category / TCO.
const apps = await prisma.application.findMany({
  select: {
    id: true,
    name: true,
    kind: true,
    vendor: true,
    category: true,
    totalTco: true,
    description: true,
  },
});
let filled = 0;
let noMeta = 0;
for (const a of apps) {
  const meta = CATALOG[a.name];
  if (!meta) {
    noMeta++;
    console.warn(`no catalog entry for "${a.name}"`);
  }
  const data: Record<string, unknown> = {};
  if (meta && (FORCE || !a.description)) data.description = meta.d;
  if (meta?.vendor && !a.vendor) data.vendor = meta.vendor;
  if (meta?.category && !a.category) data.category = meta.category;
  if (a.totalTco == null) data.totalTco = tcoFor(a.name, a.kind);
  if (Object.keys(data).length) {
    await prisma.application.update({ where: { id: a.id }, data });
    filled++;
  }
}

// ── 3. No scanned apps for the time being — reset the gate, keep the URLs.
const unscanned = await prisma.application.updateMany({
  where: { scanStatus: 'SCANNED' },
  data: { scanStatus: 'NOT_SCANNED', scannedAt: null, scanSummary: Prisma.DbNull },
});

const after = await prisma.application.findMany({
  select: { description: true, totalTco: true, vendor: true, category: true, scanStatus: true },
});
console.log(
  `updated=${filled} noCatalogEntry=${noMeta} unscanned=${unscanned.count}\n` +
    `after: total=${after.length} noDesc=${after.filter((a) => !a.description).length} noTco=${after.filter((a) => a.totalTco == null).length} ` +
    `noVendor=${after.filter((a) => !a.vendor).length} noCat=${after.filter((a) => !a.category).length} scanned=${after.filter((a) => a.scanStatus === 'SCANNED').length}`,
);
await prisma.$disconnect();
