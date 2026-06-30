// Make every application explain itself ("What it does") and ensure no app is
// left unconnected. Two passes, both idempotent / non-destructive:
//   1) set a description on the apps still missing one.
//   2) apps with NO value stream AND NO role (unconnected) get a value-stream
//      link by category, so they're "assigned" rather than orphaned.
//   npx tsx scripts/fill-app-descriptions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// app name → what it does (only applied where description is null).
const DESC: Record<string, string> = {
  'IAM Platform': 'Identity and access management — authentication, single sign-on and access governance across applications.',
  'Data Analytics Platform': 'Analytics and data-science platform — large-scale data processing, machine learning and BI workloads.',
  'Guidewire BillingCenter': 'Billing engine for premium invoicing, collections, disbursements and account reconciliation.',
  'Duck Creek Distribution': 'Distribution management platform — producer, channel and quote distribution for new business.',
  'SAS Actuarial Platform': 'Actuarial and statistical modeling platform for pricing, reserving and risk analytics.',
  'Databricks Lakehouse': 'Lakehouse data platform unifying data engineering, analytics and machine learning.',
  'SailPoint IGA': 'Identity governance and administration — access certification, provisioning and segregation-of-duties controls.',
  'Broker & Agent Portal': 'Self-service portal for brokers and agents — submissions, quotes, policy servicing and documents.',
  'Salesforce FSC': 'Salesforce Financial Services Cloud CRM — customer, household and relationship management for distribution.',
  'Moody’s RMS (Cat Model)': 'Catastrophe risk modeling — natural-hazard exposure, accumulation and probable-maximum-loss analysis.',
  'Bank & Treasury Network': 'Banking and payment network connectivity for treasury settlement, payments and cash management.',
};

// unconnected app name → value stream to assign it to (must match a ValueStream).
const ASSIGN_VS: Record<string, string> = {
  'Catastrophe Modeling': 'Actuarial Capital Modeling',
  'Viva Insights (Capacity Signals)': 'Talent & Workforce Management',
  'Collaboration / Chat': 'Technology Delivery & Change',
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name}`);

  // 1) descriptions
  let desc = 0;
  for (const [name, text] of Object.entries(DESC)) {
    const r = await prisma.application.updateMany({ where: { companyId, name, description: null }, data: { description: text } });
    desc += r.count;
  }
  const stillBlank = await prisma.application.count({ where: { companyId, OR: [{ description: null }, { description: '' }] } });
  console.log(`Descriptions: set ${desc}; ${stillBlank} apps still without one.`);

  // 2) assign a value stream to unconnected apps
  const vsByName = new Map((await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } })).map((v) => [v.name, v.id]));
  let assigned = 0;
  for (const [name, vsName] of Object.entries(ASSIGN_VS)) {
    const app = await prisma.application.findFirst({ where: { companyId, name }, select: { id: true } });
    const vsId = vsByName.get(vsName);
    if (!app || !vsId) { console.log(`  skip ${name} (app or VS not found)`); continue; }
    await prisma.applicationValueStream.upsert({
      where: { applicationId_valueStreamId: { applicationId: app.id, valueStreamId: vsId } },
      update: {},
      create: { tenantId, applicationId: app.id, valueStreamId: vsId, systemRole: 'Supporting' },
    });
    assigned++;
    console.log(`  assigned "${name}" → ${vsName}`);
  }
  console.log(`Assigned ${assigned} previously-unconnected apps to a value stream.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
