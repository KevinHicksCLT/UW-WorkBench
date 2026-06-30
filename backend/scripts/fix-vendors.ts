// E-01 / E-03 / E-04 — vendor coverage.
//   E-04: replace placeholder "(example)" Application.vendor strings with a
//         single canonical, researched market-leader vendor.
//   E-01: add the ~5 most common application vendors per value stream as
//         third-party ExternalInteraction rows (partyType "Application Vendor").
//   E-03: because every one of the 36 streams gets vendor rows, no stream is
//         left with zero external parties.
// Vendors are researched market leaders (Gartner MQ / Celent / Datos Insights /
// vendor sites — see the tracker 'Vendor Catalog' sheet), tagged as assumed
// pending ABC's real installed-application inventory.
//
// Idempotent: E-01 rows (sourceSheet='E-01') are deleted+rebuilt; E-04 sets the
// vendor field deterministically. Re-runnable.  Run from backend/:
//   npx tsx scripts/fix-vendors.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// E-04 — canonical vendor per application (by app name). One real, deduped
// market leader (drops the "A / B (example)" placeholder dual-naming).
const APP_VENDOR: Record<string, string> = {
  'Actuarial Reserving Platform': 'FIS Prophet',
  'BI / Reporting': 'Microsoft Power BI',
  'Billing & Receivables System': 'Sapiens BillingPro',
  'Broker / Distribution Portal': 'Salesforce Experience Cloud',
  'CI/CD Pipeline': 'GitHub Actions',
  'CRM': 'Salesforce Financial Services Cloud',
  'Catastrophe Modeling': "Moody's RMS",
  'Claims Management Platform': 'Guidewire ClaimCenter',
  'Collaboration / Chat': 'Microsoft Teams',
  'Data & Analytics Platform': 'Snowflake',
  'Document & Forms Management': 'OpenText Exstream',
  'E-Signature': 'DocuSign',
  'FP&A Planning Tool': 'Anaplan',
  'Finance ERP / General Ledger': 'SAP S/4HANA Finance',
  'GRC / Risk & Compliance': 'Archer',
  'HCM / HR System': 'Workday HCM',
  'IT Service Management': 'ServiceNow ITSM',
  'Identity & Access Management': 'Microsoft Entra ID',
  'LMS (Training)': 'Cornerstone OnDemand',
  'Legal / Contract Lifecycle': 'Ironclad',
  'Microsoft 365 (Office, SharePoint)': 'Microsoft',
  'Policy Administration Platform': 'Guidewire PolicyCenter',
  'Procurement / Vendor Mgmt': 'Coupa',
  'Rating & Pricing Engine': 'Earnix',
  'Reinsurance Management System': 'Sapiens ReinsuranceMaster',
  'Source Control': 'GitHub',
  'Treasury Management': 'Kyriba',
  'Underwriting Workbench': 'hyperexponential',
  'Viva Insights (Capacity Signals)': 'Microsoft Viva',
  'Work / Issue Tracking': 'Atlassian Jira',
};

// E-01 — top ~5 application vendors per value stream (exact ValueStream names).
const VENDORS_BY_STREAM: Record<string, string[]> = {
  'New Business Underwriting (Submission-to-Bind)': ['hyperexponential', 'Earnix', 'Guidewire PolicyCenter', 'Akur8', 'Zywave'],
  'Policy Administration & Servicing': ['Guidewire PolicyCenter', 'Duck Creek', 'Sapiens', 'Majesco', 'EIS'],
  'Claims Intake-to-Settlement': ['Guidewire ClaimCenter', 'Duck Creek Claims', 'Snapsheet', 'Sapiens', 'CCC Intelligent Solutions'],
  'Claims Recoveries & Subrogation': ['Verisk', 'Guidewire ClaimCenter', 'Sapiens', 'Snapsheet', 'CCC Intelligent Solutions'],
  'Billing, Collections & Receivables': ['Guidewire BillingCenter', 'Duck Creek Billing', 'Sapiens Billing', 'FINEOS Billing', 'EIS'],
  'Reinsurance & Retrocession Management': ['SAP FS-RI', 'Sapiens ReinsuranceMaster', 'Sapiens ReinsurancePro', 'Verisk Touchstone', 'Web Connectivity (WCL)'],
  'Delegated Authority Management': ['Guidewire', 'Duck Creek', 'Sapiens', 'Whitespace', 'Novidea'],
  'Actuarial Pricing': ['Earnix', 'hyperexponential', 'Akur8', "Moody's AXIS", 'WTW Radar'],
  'Actuarial Reserving': ['FIS Prophet', "Moody's AXIS", 'Milliman MG-ALFA', 'WTW RiskAgility FM', 'SLOPE'],
  'Actuarial Capital Modeling': ["Moody's RMS", 'Verisk Touchstone', 'FIS Prophet', 'Milliman Integrate', 'Conning GEMS'],
  'Finance & Accounting': ['SAP S/4HANA Finance', 'Oracle Fusion ERP', 'Workday Financials', 'BlackLine', 'SAP FPSL'],
  'Treasury & Liquidity': ['Kyriba', 'FIS Quantum', 'ION Treasury', 'SAP Treasury', 'GTreasury'],
  'Capital Management': ['SAP FPSL', "Moody's RiskIntegrity", 'WTW RiskAgility', 'SS&C Algorithmics', 'Oracle'],
  'Investment & Asset Management': ['BlackRock Aladdin', 'SimCorp', 'Clearwater Analytics', 'SS&C', 'Bloomberg AIM'],
  'Life New Business & Underwriting': ['FINEOS', 'Vitech V3locity', 'Equisoft', 'iPipeline', 'Munich Re MIRA'],
  'Life Policy Administration & Inforce Servicing': ['FINEOS', 'Vitech V3locity', 'Equisoft', 'Sapiens', 'Oracle'],
  'Life, Annuity & Retirement Billing': ['FINEOS Billing', 'Vitech V3locity', 'Equisoft', 'Sapiens', 'EIS'],
  'Life & Annuity Claims': ['FINEOS Claims', 'Vitech V3locity', 'LexisNexis', 'Equisoft', 'Sapiens'],
  'Disability & Absence Management': ['FINEOS', 'ClaimVantage', 'Workday', 'Origami Risk', 'Sun Life Connect'],
  'Retirement Plan Administration': ['SS&C', 'FIS Relius', 'Vitech V3locity', 'Empower', 'Fiserv'],
  'Annuity New Business & Servicing': ['FIS', 'Vitech V3locity', 'Equisoft', 'iPipeline', 'Infosys McCamish'],
  'Distribution & Channel Management': ['Salesforce Financial Services Cloud', 'Vertafore', 'Applied Systems', 'Microsoft Dynamics 365', 'Novidea'],
  'Marketing, Growth & Customer Insights': ['Salesforce Marketing Cloud', 'Adobe Experience Cloud', 'HubSpot', 'Google Analytics', 'Segment'],
  'Product & Proposition Management': ['Aha!', 'Productboard', 'Jira Product Discovery', 'Guidewire', 'Duck Creek'],
  'Customer Service & Experience': ['Salesforce Service Cloud', 'Genesys', 'Zendesk', 'NICE', 'Qualtrics'],
  'Complaints Management': ['Salesforce Service Cloud', 'Pega', 'NICE', 'Verint', 'Aptean Respond'],
  'Enterprise Strategy & Portfolio Management': ['Planview', 'Apptio Targetprocess', 'ServiceNow SPM', 'Anaplan', 'Jira Align'],
  'Legal & Governance': ['Diligent', 'Ironclad', 'DocuSign CLM', 'Relativity', 'BoardEffect'],
  'Privacy & Data Protection': ['OneTrust', 'BigID', 'TrustArc', 'Securiti', 'Collibra'],
  'Talent & Workforce Management': ['Workday HCM', 'SAP SuccessFactors', 'Cornerstone OnDemand', 'LinkedIn Talent Solutions', 'ServiceNow HRSD'],
  'Change Management & Adoption': ['WalkMe', 'Whatfix', 'ServiceNow', 'Prosci', 'Microsoft Viva'],
  'Compliance & Regulatory': ['Archer', 'ServiceNow GRC', 'Wolters Kluwer', 'NAVEX', 'MetricStream'],
  'Risk Management': ['Archer', 'MetricStream', 'LogicGate', 'ServiceNow IRM', 'SAS Risk Management'],
  'Audit & Assurance': ['AuditBoard', 'Workiva', 'TeamMate+', 'ServiceNow IRM', 'Diligent'],
  'Third-Party & Vendor Management': ['ServiceNow VRM', 'ProcessUnity', 'Coupa', 'OneTrust', 'Prevalent'],
  'Technology Strategy & Architecture': ['LeanIX', 'Ardoq', 'BiZZdesign', 'ServiceNow APM', 'Microsoft Azure'],
  'Technology Delivery & Change': ['GitHub', 'Atlassian Jira', 'Azure DevOps', 'GitLab', 'ServiceNow'],
  'Data Management & Governance': ['Collibra', 'Informatica', 'Alation', 'Microsoft Purview', 'Snowflake'],
  'Analytics & AI': ['Databricks', 'Snowflake', 'Microsoft Power BI', 'DataRobot', 'Tableau'],
  'MLOps (ML Lifecycle Management)': ['Databricks', 'AWS SageMaker', 'MLflow', 'Azure Machine Learning', 'Weights & Biases'],
  'AIOps & Intelligent Operations': ['Dynatrace', 'Datadog', 'Moogsoft', 'BigPanda', 'ServiceNow ITOM'],
  'Service Operations, Incident & Production Support': ['ServiceNow ITSM', 'PagerDuty', 'Datadog', 'Splunk', 'Atlassian Opsgenie'],
  'Cybersecurity, Identity & Resilience': ['Microsoft Entra ID', 'Okta', 'CrowdStrike', 'Palo Alto Networks', 'Zscaler'],
  'FinOps (Cloud Financial Management)': ['Apptio Cloudability', 'VMware CloudHealth', 'AWS Cost Explorer', 'Microsoft Cost Management', 'Flexera'],
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name}`);

  // ── E-04 ──────────────────────────────────────────────────────────────────
  let e04 = 0;
  for (const [name, vendor] of Object.entries(APP_VENDOR)) {
    const r = await prisma.application.updateMany({ where: { companyId, name }, data: { vendor } });
    e04 += r.count;
  }
  const remaining = await prisma.application.count({ where: { companyId, vendor: { contains: '(example)' } } });
  console.log(`E-04: set ${e04} canonical vendors; ${remaining} placeholders remain.`);

  // ── E-01 / E-03 ─────────────────────────────────────────────────────────────
  const vsRows = await prisma.valueStream.findMany({ where: { companyId }, select: { name: true } });
  const vsNames = new Set(vsRows.map((v) => v.name));
  await prisma.externalInteraction.deleteMany({ where: { companyId, sourceSheet: 'E-01' } });

  let e01 = 0;
  const missing: string[] = [];
  for (const [stream, vendors] of Object.entries(VENDORS_BY_STREAM)) {
    if (!vsNames.has(stream)) { missing.push(stream); continue; }
    for (const vendor of vendors) {
      await prisma.externalInteraction.create({
        data: {
          tenantId, companyId,
          partyType: 'Application Vendor',
          externalRole: vendor,
          interactionType: 'Software / SaaS provider',
          relatedValueStream: stream,
          dependencyType: 'Operational',
          frequency: 'Continuous',
          notes: 'E-01 researched market-leader application vendor (assumed — reconcile with ABC installed-application inventory).',
          sourceSheet: 'E-01',
        },
      });
      e01++;
    }
  }
  console.log(`E-01/E-03: added ${e01} application-vendor third parties across ${Object.keys(VENDORS_BY_STREAM).length - missing.length} streams.`);
  if (missing.length) console.log('MISSING streams (skipped):', missing.join(', '));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
