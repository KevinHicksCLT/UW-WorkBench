// Replace placeholder / boilerplate application descriptions ("Placeholder",
// "[Extension] … placeholder estate", terse stubs) with a real "what it does".
// Overwrites by exact app name (idempotent — safe to re-run).
//   npx tsx scripts/fix-placeholder-descriptions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DESC: Record<string, string> = {
  // were literal "Placeholder"
  'BI / Reporting': 'Business intelligence and reporting — dashboards, self-service analytics and operational/management reports.',
  'CI/CD Pipeline': 'Continuous integration and delivery pipelines — automated build, test and deployment of applications.',
  'CRM': 'Customer relationship management — customer, household, lead and interaction records for sales and service.',
  'Catastrophe Modeling': 'Catastrophe risk modeling — natural-hazard exposure, accumulation and probable-maximum-loss analysis.',
  'Collaboration / Chat': 'Team collaboration, messaging and meetings for day-to-day communication and file sharing.',
  'E-Signature': 'Electronic signature and agreement workflows for policy, claims and contract documents.',
  'FP&A Planning Tool': 'Financial planning and analysis — budgeting, forecasting and scenario planning.',
  'Microsoft 365 (Office, SharePoint)': 'Productivity suite — documents, spreadsheets, email and SharePoint content collaboration.',
  'Work / Issue Tracking': 'Work and issue tracking — backlogs, sprints and delivery workflow for engineering and operations teams.',
  // were "[Extension] … placeholder estate" boilerplate
  'Azure Cloud Platform': 'Public cloud platform hosting applications, data and infrastructure services.',
  'BlackRock Aladdin': 'Investment and risk management platform — portfolio management, trading and asset analytics.',
  'Catastrophe Data Provider': 'External hazard and exposure data feeds used in catastrophe and underwriting risk assessment.',
  'Credit Bureau & Data Services': 'Third-party credit, identity and risk data services used in underwriting and fraud checks.',
  'CrowdStrike Falcon': 'Endpoint detection and response — threat prevention, detection and security telemetry.',
  'Customer Self-Service Portal': 'Policyholder self-service portal — account access, policy servicing, payments and claims status.',
  'FRISS Fraud Detection': 'Fraud detection and risk scoring across underwriting and claims.',
  'Payment Gateway': 'Payment processing gateway for premium collection and disbursement transactions.',
  'Regulatory Filing Portal': 'Submission portal for regulatory filings (SERFF / state systems) and compliance returns.',
  'Reinsurer Exchange': 'Marketplace for placing and administering reinsurance with external markets.',
  // terse stub
  'Viva Insights (Capacity Signals)': 'Workforce analytics — capacity, workload and collaboration signals feeding the capacity model.',
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  console.log(`Company: ${company.name}`);

  let n = 0;
  for (const [name, text] of Object.entries(DESC)) {
    const r = await prisma.application.updateMany({ where: { companyId: company.id, name }, data: { description: text } });
    n += r.count;
    if (r.count === 0) console.log(`  WARN no app named "${name}"`);
  }
  console.log(`Rewrote ${n} placeholder descriptions.`);

  // sanity: any remaining junk?
  const junk = await prisma.application.count({
    where: { companyId: company.id, OR: [{ description: null }, { description: '' }, { description: { contains: 'Placeholder' } }, { description: { contains: '[Extension]' } }] },
  });
  console.log(`Remaining apps with null/Placeholder/[Extension] descriptions: ${junk}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
