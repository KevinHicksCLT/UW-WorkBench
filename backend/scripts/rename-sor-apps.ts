// Replace the generic system-of-record placeholder app names with the ACTUAL
// application/product (the real product had been hiding in the `vendor` column).
// e.g. "Policy Administration Platform" → "Guidewire PolicyCenter".
//
// Where an older illustrative no-code row already duplicates that product, it is
// MERGED into the system-of-record app: its step usages, value-stream links and
// deliverable references are re-pointed to the SoR app, then the duplicate row is
// deleted. This both gives every SoR app a real name and removes the twin rows.
//
// Renames preserve the row id, so the StepAppUsage / StepDeliverable FKs stay
// intact. Idempotent: re-runs find no duplicate and the rename is a no-op.
//   npx tsx scripts/rename-sor-apps.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SoR app (by code) → real product name, maker (vendor), and what it does.
const RENAME: Record<string, { name: string; vendor: string; desc: string }> = {
  'APP-001': { name: 'Guidewire PolicyCenter', vendor: 'Guidewire', desc: 'Core policy administration system of record — quote, issue, endorse, renew and service P&C policies across their lifecycle.' },
  'APP-002': { name: 'Guidewire ClaimCenter', vendor: 'Guidewire', desc: 'Core claims management system of record — first notice of loss, adjudication, reserving, payments and recovery.' },
  'APP-003': { name: 'Sapiens BillingPro', vendor: 'Sapiens', desc: 'Billing and receivables system of record — invoicing, premium collection, disbursements and reconciliation.' },
  'APP-004': { name: 'hyperexponential hx Renew', vendor: 'hyperexponential', desc: 'Underwriting workbench / pricing decision platform for risk assessment, rating and quote construction.' },
  'APP-005': { name: 'Earnix', vendor: 'Earnix', desc: 'Rating and pricing engine — analytical price optimization and rate deployment.' },
  'APP-006': { name: 'Sapiens ReinsuranceMaster', vendor: 'Sapiens', desc: 'Reinsurance management system — treaty/facultative administration, cessions, recoveries and bordereaux.' },
  'APP-007': { name: 'Salesforce Experience Cloud', vendor: 'Salesforce', desc: 'Broker / distribution portal — partner self-service for submissions, quotes, documents and servicing.' },
  'APP-009': { name: 'OpenText Exstream', vendor: 'OpenText', desc: 'Customer communications and document/forms management — generation, composition and archival of policy documents.' },
  'APP-010': { name: 'FIS Prophet', vendor: 'FIS', desc: 'Actuarial reserving and modeling platform — valuation, projections and reserve calculation.' },
  'APP-012': { name: 'SAP S/4HANA Finance', vendor: 'SAP', desc: 'Finance ERP / general ledger system of record — accounting, close, financial reporting and controls.' },
  'APP-014': { name: 'Workday HCM', vendor: 'Workday', desc: 'Human capital management system of record — workforce, org, compensation and talent data.' },
  'APP-015': { name: 'Coupa', vendor: 'Coupa', desc: 'Procurement and vendor management — sourcing, purchasing, invoicing and supplier records.' },
  'APP-016': { name: 'Kyriba', vendor: 'Kyriba', desc: 'Treasury management — cash, liquidity, payments and bank connectivity.' },
  'APP-017': { name: 'Ironclad', vendor: 'Ironclad', desc: 'Legal contract lifecycle management — drafting, approval, execution and contract repository.' },
  'APP-019': { name: 'Archer', vendor: 'Archer', desc: 'Governance, risk and compliance platform — risk register, controls, issues and regulatory tracking.' },
  'APP-021': { name: 'GitHub', vendor: 'GitHub', desc: 'Source control and code collaboration — repositories, pull requests and code review.' },
  'APP-023': { name: 'ServiceNow ITSM', vendor: 'ServiceNow', desc: 'IT service management system of record — incidents, requests, changes and the CMDB.' },
  'APP-025': { name: 'Microsoft Entra ID', vendor: 'Microsoft', desc: 'Identity and access management — authentication, SSO, conditional access and directory.' },
  'APP-026': { name: 'Snowflake', vendor: 'Snowflake', desc: 'Cloud data and analytics platform — the enterprise data warehouse and analytics workloads.' },
  'APP-029': { name: 'Cornerstone OnDemand', vendor: 'Cornerstone', desc: 'Learning management system — training assignment, completion tracking and compliance learning.' },
};

// no-code duplicate row name → SoR code it should be merged into.
const MERGE: Record<string, string> = {
  'Guidewire PolicyCenter': 'APP-001',
  'Guidewire ClaimCenter': 'APP-002',
  'Workday HCM': 'APP-014',
  'ServiceNow ITSM': 'APP-023',
  'Snowflake Data Cloud': 'APP-026',
  'Earnix Rating & Pricing': 'APP-005',
  'Archer GRC': 'APP-019',
  'SAP S/4HANA (GL)': 'APP-012',
  'Finance ERP': 'APP-012',
  'OpenText Document Mgmt': 'APP-009',
};

async function mergeInto(dupId: string, targetId: string) {
  // step usages — no (step, app) unique, so straight re-point is safe.
  await prisma.stepAppUsage.updateMany({ where: { applicationId: dupId }, data: { applicationId: targetId } });
  // deliverable SoR / approval app references.
  await prisma.stepDeliverable.updateMany({ where: { sorApplicationId: dupId }, data: { sorApplicationId: targetId } });
  await prisma.stepDeliverable.updateMany({ where: { approvalApplicationId: dupId }, data: { approvalApplicationId: targetId } });
  // value-stream links — unique on (applicationId, valueStreamId); skip if target already has it.
  const dupLinks = await prisma.applicationValueStream.findMany({ where: { applicationId: dupId }, select: { id: true, valueStreamId: true } });
  const targetVs = new Set((await prisma.applicationValueStream.findMany({ where: { applicationId: targetId }, select: { valueStreamId: true } })).map((l) => l.valueStreamId));
  for (const l of dupLinks) {
    if (targetVs.has(l.valueStreamId)) await prisma.applicationValueStream.delete({ where: { id: l.id } });
    else await prisma.applicationValueStream.update({ where: { id: l.id }, data: { applicationId: targetId } });
  }
  await prisma.application.delete({ where: { id: dupId } });
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;
  console.log(`Company: ${company.name}`);

  const byCode = new Map<string, string>(); // code → id
  for (const a of await prisma.application.findMany({ where: { companyId, code: { not: null } }, select: { id: true, code: true } })) {
    if (a.code) byCode.set(a.code, a.id);
  }

  // 1) merge duplicate no-code rows into their SoR app (frees the target name).
  let merged = 0;
  for (const [dupName, code] of Object.entries(MERGE)) {
    const targetId = byCode.get(code);
    if (!targetId) continue;
    const dup = await prisma.application.findFirst({ where: { companyId, name: dupName, code: null }, select: { id: true } });
    if (!dup || dup.id === targetId) continue;
    await mergeInto(dup.id, targetId);
    merged++;
    console.log(`  merged duplicate "${dupName}" → ${code}`);
  }

  // 2) rename each SoR app to the real product + set vendor/description.
  let renamed = 0;
  for (const [code, r] of Object.entries(RENAME)) {
    const id = byCode.get(code);
    if (!id) { console.log(`  WARN ${code} not found`); continue; }
    await prisma.application.update({ where: { id }, data: { name: r.name, vendor: r.vendor, description: r.desc } });
    renamed++;
  }
  console.log(`Renamed ${renamed} SoR apps to real products; merged ${merged} duplicate rows.`);

  const total = await prisma.application.count({ where: { companyId } });
  console.log(`Application catalog now: ${total} apps.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
