// Connectivity — link every Application to the value stream(s) it serves
// (ApplicationValueStream). ~26 streams had zero apps; this ensures every stream
// has its real toolset tied to it and every app is tied to ≥1 stream.
// systemRole: 'System of Record' for an app's home stream(s) when it is the SoR,
// else 'Supporting' (or 'Analytics'/'Channel' by category).
// Idempotent: unique (applicationId, valueStreamId) — re-runs only add missing.
//   npx tsx scripts/connect-apps-to-streams.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// app name -> { sor: [streams where it is system of record], sup: [supporting streams] }
const MAP: Record<string, { sor?: string[]; sup?: string[] }> = {
  // Core insurance
  'Guidewire PolicyCenter': { sor: ['Policy Administration & Servicing', 'New Business Underwriting'], sup: ['Delegated Authority Management', 'Distribution & Channel Management'] },
  'Guidewire ClaimCenter': { sor: ['Claims Intake-to-Settlement'], sup: ['Claims Recoveries & Subrogation', 'Life & Annuity Claims'] },
  'FRISS Fraud Detection': { sup: ['Claims Intake-to-Settlement', 'Claims Recoveries & Subrogation', 'New Business Underwriting'] },
  'Guidewire BillingCenter': { sor: ['Billing, Collections & Receivables'], sup: ['Policy Administration & Servicing'] },
  'Sapiens BillingPro': { sor: ['Life, Annuity & Retirement Billing'], sup: ['Billing, Collections & Receivables'] },
  'Payment Gateway': { sup: ['Billing, Collections & Receivables', 'Life, Annuity & Retirement Billing', 'Customer Service & Experience'] },
  'hyperexponential hx Renew': { sor: ['New Business Underwriting'], sup: ['Actuarial Pricing'] },
  'Earnix': { sor: ['Actuarial Pricing'], sup: ['New Business Underwriting', 'Product & Proposition Management'] },
  'Sapiens ReinsuranceMaster': { sor: ['Outward (Ceded) Reinsurance Management', 'Assumed (Inward) Reinsurance Underwriting'], sup: ['Retrocession Management'] },
  'Reinsurer Exchange': { sup: ['Outward (Ceded) Reinsurance Management', 'Assumed (Inward) Reinsurance Underwriting', 'Retrocession Management'] },
  'OpenText Exstream': { sup: ['Policy Administration & Servicing', 'Customer Service & Experience', 'Claims Intake-to-Settlement', 'Billing, Collections & Receivables', 'Life Policy Administration & Inforce Servicing'] },
  'E-Signature': { sup: ['New Business Underwriting', 'Distribution & Channel Management', 'Life New Business & Underwriting', 'Annuity New Business & Servicing'] },
  // Distribution & customer
  'Duck Creek Distribution': { sor: ['Distribution & Channel Management'], sup: ['New Business Underwriting'] },
  'Salesforce FSC': { sup: ['Distribution & Channel Management', 'Marketing, Growth & Customer Insights', 'Customer Service & Experience'] },
  'Salesforce Experience Cloud': { sor: ['Customer Service & Experience'], sup: ['Complaints Management', 'Distribution & Channel Management'] },
  'Broker & Agent Portal': { sup: ['Distribution & Channel Management', 'Delegated Authority Management', 'New Business Underwriting'] },
  'Customer Self-Service Portal': { sup: ['Customer Service & Experience', 'Complaints Management', 'Policy Administration & Servicing'] },
  'CRM': { sup: ['Marketing, Growth & Customer Insights', 'Distribution & Channel Management', 'Customer Service & Experience'] },
  // Actuarial & risk modeling
  'FIS Prophet': { sor: ['Actuarial Reserving'], sup: ['Actuarial Pricing', 'Actuarial Capital Modeling'] },
  'SAS Actuarial Platform': { sup: ['Actuarial Pricing', 'Actuarial Reserving', 'Actuarial Capital Modeling'] },
  'Catastrophe Modeling': { sup: ['Actuarial Capital Modeling', 'Risk Management', 'Outward (Ceded) Reinsurance Management'] },
  'Moody’s RMS (Cat Model)': { sup: ['Actuarial Capital Modeling', 'Risk Management', 'Outward (Ceded) Reinsurance Management'] },
  'Catastrophe Data Provider': { sup: ['Actuarial Capital Modeling', 'Risk Management'] },
  'Credit Bureau & Data Services': { sup: ['New Business Underwriting', 'Life New Business & Underwriting', 'Claims Intake-to-Settlement'] },
  // Finance / treasury / investment
  'SAP S/4HANA Finance': { sor: ['Finance & Accounting'], sup: ['Capital Management', 'Enterprise Strategy & Portfolio Management', 'Billing, Collections & Receivables'] },
  'FP&A Planning Tool': { sor: ['Capital Management'], sup: ['Finance & Accounting', 'Enterprise Strategy & Portfolio Management'] },
  'Kyriba': { sor: ['Treasury & Liquidity'], sup: ['Finance & Accounting'] },
  'Bank & Treasury Network': { sup: ['Treasury & Liquidity', 'Billing, Collections & Receivables'] },
  'BlackRock Aladdin': { sor: ['Investment & Asset Management'], sup: ['Treasury & Liquidity', 'Capital Management'] },
  // Technology & data
  'GitHub': { sor: ['Technology Delivery & Change'], sup: ['MLOps (ML Lifecycle Management)', 'Technology Strategy & Architecture', 'AIOps & Intelligent Operations'] },
  'CI/CD Pipeline': { sup: ['Technology Delivery & Change', 'MLOps (ML Lifecycle Management)', 'Service Operations, Incident & Production Support'] },
  'Work / Issue Tracking': { sup: ['Technology Delivery & Change', 'Service Operations, Incident & Production Support', 'Change Management & Adoption', 'AIOps & Intelligent Operations'] },
  'Docker': { sup: ['Technology Delivery & Change', 'MLOps (ML Lifecycle Management)'] },
  'IntelliJ IDEA': { sup: ['Technology Delivery & Change'] },
  'Visual Studio Code': { sup: ['Technology Delivery & Change', 'MLOps (ML Lifecycle Management)'] },
  'Postman': { sup: ['Technology Delivery & Change'] },
  'SonarQube': { sup: ['Technology Delivery & Change'] },
  'ServiceNow ITSM': { sor: ['Service Operations, Incident & Production Support'], sup: ['Technology Delivery & Change', 'Change Management & Adoption', 'Third-Party & Vendor Management', 'AIOps & Intelligent Operations'] },
  'Azure Cloud Platform': { sup: ['Technology Delivery & Change', 'MLOps (ML Lifecycle Management)', 'AIOps & Intelligent Operations', 'Service Operations, Incident & Production Support', 'Cybersecurity & Threat Management', 'FinOps (Cloud Financial Management)', 'Technology Strategy & Architecture'] },
  'Snowflake': { sor: ['Data Management & Governance'], sup: ['Analytics & AI', 'MLOps (ML Lifecycle Management)'] },
  'Databricks Lakehouse': { sup: ['Analytics & AI', 'MLOps (ML Lifecycle Management)', 'Data Management & Governance'] },
  'Data Analytics Platform': { sup: ['Analytics & AI', 'Data Management & Governance'] },
  'BI / Reporting': { sup: ['Analytics & AI', 'Enterprise Strategy & Portfolio Management', 'Marketing, Growth & Customer Insights', 'FinOps (Cloud Financial Management)'] },
  'IAM Platform': { sor: ['Identity & Access Management'], sup: ['Cybersecurity & Threat Management'] },
  'Microsoft Entra ID': { sor: ['Identity & Access Management'], sup: ['Cybersecurity & Threat Management'] },
  'SailPoint IGA': { sup: ['Identity & Access Management', 'Cybersecurity & Threat Management'] },
  'CrowdStrike Falcon': { sor: ['Cybersecurity & Threat Management'], sup: ['Operational Resilience & Continuity'] },
  // GRC / corporate
  'Archer': { sor: ['Risk Management'], sup: ['Compliance & Regulatory', 'Audit & Assurance', 'Third-Party & Vendor Management', 'Operational Resilience & Continuity'] },
  'Regulatory Filing Portal': { sup: ['Compliance & Regulatory', 'Legal & Governance', 'Audit & Assurance', 'Finance & Accounting'] },
  'Ironclad': { sor: ['Legal & Governance'], sup: ['Third-Party & Vendor Management', 'Delegated Authority Management'] },
  'Coupa': { sor: ['Third-Party & Vendor Management'], sup: ['Finance & Accounting'] },
  'Workday HCM': { sor: ['Talent & Workforce Management'], sup: ['Change Management & Adoption'] },
  'Cornerstone OnDemand': { sup: ['Talent & Workforce Management', 'Change Management & Adoption'] },
  'Viva Insights (Capacity Signals)': { sup: ['Talent & Workforce Management', 'Change Management & Adoption', 'Service Operations, Incident & Production Support'] },
  // Productivity / cross-cutting (light touch on streams that would otherwise be thin)
  'Microsoft 365 (Office, SharePoint)': { sup: ['Enterprise Strategy & Portfolio Management', 'Legal & Governance', 'Compliance & Regulatory', 'Audit & Assurance', 'Privacy & Data Protection', 'Product & Proposition Management', 'Risk Management'] },
  'Collaboration / Chat': { sup: ['Technology Delivery & Change', 'Service Operations, Incident & Production Support', 'Change Management & Adoption', 'Customer Service & Experience', 'Complaints Management'] },
};

// Life/Disability/Retirement streams have no dedicated PAS app in the catalog —
// tie the shared policy/billing/claims/doc tooling so they aren't app-less.
const LDR_SHARED: Record<string, string[]> = {
  'Guidewire PolicyCenter': ['Life New Business & Underwriting', 'Life Policy Administration & Inforce Servicing', 'Annuity New Business & Servicing', 'Retirement Plan Administration', 'Disability & Absence Management'],
  'Guidewire ClaimCenter': ['Life & Annuity Claims', 'Disability & Absence Management'],
  'Sapiens BillingPro': ['Life, Annuity & Retirement Billing'],
  'OpenText Exstream': ['Life New Business & Underwriting', 'Annuity New Business & Servicing', 'Retirement Plan Administration'],
  'E-Signature': ['Life Policy Administration & Inforce Servicing', 'Retirement Plan Administration', 'Disability & Absence Management'],
  'BI / Reporting': ['Retirement Plan Administration', 'Disability & Absence Management'],
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  const apps = await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } });
  const appId = new Map(apps.map((a) => [a.name, a.id]));
  const vs = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
  const vsId = new Map(vs.map((v) => [v.name, v.id]));

  const missingApp = new Set<string>(), missingVs = new Set<string>();
  let created = 0;
  async function link(appName: string, streamName: string, role: string) {
    const aId = appId.get(appName); const sId = vsId.get(streamName);
    if (!aId) { missingApp.add(appName); return; }
    if (!sId) { missingVs.add(streamName); return; }
    try {
      await prisma.applicationValueStream.create({ data: { tenantId, applicationId: aId, valueStreamId: sId, systemRole: role, illustrative: true } });
      created++;
    } catch (e) { if ((e as { code?: string }).code !== 'P2002') throw e; }
  }

  for (const [app, m] of Object.entries(MAP)) {
    for (const s of m.sor ?? []) await link(app, s, 'System of Record');
    for (const s of m.sup ?? []) await link(app, s, 'Supporting');
  }
  for (const [app, streams] of Object.entries(LDR_SHARED)) {
    for (const s of streams) await link(app, s, 'Supporting');
  }

  const noApps = (await prisma.valueStream.findMany({ where: { companyId, applicationLinks: { none: {} } }, select: { name: true } })).map((v) => v.name);
  console.log(`Linked ${created} ApplicationValueStream rows.`);
  if (missingApp.size) console.log('MISSING apps:', [...missingApp].join(', '));
  if (missingVs.size) console.log('MISSING streams:', [...missingVs].join(', '));
  console.log('Streams still with NO apps:', noApps.length ? noApps.join(', ') : 'none ✓');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
