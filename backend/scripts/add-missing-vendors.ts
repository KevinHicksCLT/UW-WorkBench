// Close the external-party gap for the streams added/renamed after the original
// vendor pass (the reinsurance trio + the cybersecurity splits). Adds researched
// market-leader application/service vendors as third parties (sourceSheet='E-01'),
// so every value stream has external-party coverage. Scoped + idempotent: only
// the listed streams are cleared and rebuilt.
//   npx tsx scripts/add-missing-vendors.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VENDORS: Record<string, string[]> = {
  'Ceded Reinsurance Management': ['Sapiens ReinsuranceMaster', 'SAP FS-RI', 'Verisk Touchstone', "Moody's RMS", 'Aon (Reinsurance Solutions)'],
  'Assumed Reinsurance Underwriting': ['Sapiens ReinsuranceMaster', 'hyperexponential', 'Verisk Touchstone', "Moody's AXIS", 'SAP FS-RI'],
  'Retrocession Management': ['Sapiens ReinsuranceMaster', 'SAP FS-RI', 'Verisk Touchstone', 'Guy Carpenter', "Moody's RMS"],
  'Cybersecurity & Threat Management': ['CrowdStrike', 'Microsoft Defender', 'Palo Alto Networks', 'Tenable', 'Splunk'],
  'Identity & Access Management': ['Microsoft Entra ID', 'Okta', 'SailPoint', 'CyberArk', 'Ping Identity'],
  'Operational Resilience & Continuity': ['Archer', 'Fusion Risk Management', 'Everbridge', 'ServiceNow', 'CrowdStrike'],
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const vsNames = new Set((await prisma.valueStream.findMany({ where: { companyId }, select: { name: true } })).map((v) => v.name));

  let added = 0;
  const missing: string[] = [];
  for (const [stream, vendors] of Object.entries(VENDORS)) {
    if (!vsNames.has(stream)) { missing.push(stream); continue; }
    await prisma.externalInteraction.deleteMany({ where: { companyId, sourceSheet: 'E-01', relatedValueStream: stream } });
    for (const vendor of vendors) {
      await prisma.externalInteraction.create({
        data: {
          tenantId, companyId, partyType: 'Application Vendor', externalRole: vendor,
          interactionType: 'Software / SaaS provider', relatedValueStream: stream,
          dependencyType: 'Operational', frequency: 'Continuous',
          notes: 'E-01 researched market-leader vendor (assumed — reconcile with ABC inventory).', sourceSheet: 'E-01',
        },
      });
      added++;
    }
  }
  console.log(`Added ${added} vendor third parties across ${Object.keys(VENDORS).length - missing.length} streams.`);
  if (missing.length) console.log('MISSING streams:', missing.join(', '));
  const none = (await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }))
    .filter((v) => true);
  const gap = (await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) n FROM "ValueStream" vs WHERE NOT EXISTS (SELECT 1 FROM "ExternalInteraction" ei WHERE ei."relatedValueStream"=vs.name AND ei."companyId"=$1)`,
    companyId,
  ));
  console.log('Streams still with no external party:', Number(gap[0].n));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
