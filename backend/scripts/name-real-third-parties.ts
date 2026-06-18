// E-03 refinement — make the third-party VENDORS real named firms.
// The 27 hand-authored "External Interactions" rows used generic category labels
// ("Cloud Provider", "System Integrator", "Third-Party Administrator")  rather
// than real vendors. This renames each firm-nameable party to a researched market
// leader (TCS, Capgemini, Assurant, AWS, …) and records the original category in
// notes, so the Third-Parties tab reads as a real vendor roster.
//
// Inherently-generic role/channel/regulator types (policyholder, independent
// broker, insurance regulator) are NOT single firms and stay as categories.
//
// Idempotent: matches rows whose externalRole is still the generic label, so a
// re-run after rename is a no-op. Run from backend/:
//   npx tsx scripts/name-real-third-parties.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// generic externalRole  →  real market-leader firm (illustrative; reconcile with
// ABC's actual contracts). Category label preserved in notes.
const REAL_FIRM: Record<string, string> = {
  // Vendors (IT, platform, data, ops)
  'Core Platform Vendor': 'Guidewire',
  'Cloud Provider': 'Amazon Web Services (AWS)',
  'Data / Cat Model Provider': 'Verisk',
  'Payment Processor': 'Fiserv',
  'Identity / Fraud Vendor': 'LexisNexis Risk Solutions',
  'Document / Print / Mail Vendor': 'Broadridge',
  'System Integrator (Project-Based)': 'Capgemini',
  'Managed Services Provider': 'Tata Consultancy Services (TCS)',
  'Staff Augmentation Partner': 'Infosys',
  'Application Managed Services Partner': 'Cognizant',
  // Service providers (claims ecosystem)
  'Third-Party Administrator (TPA)': 'Assurant',
  'Loss Adjuster / Independent Adjuster': 'Crawford & Company',
  'Repair Network Provider': 'Caliber Collision',
  'Medical Provider / IME': 'ExamWorks',
  // Capital partners
  'Reinsurer': 'Munich Re',
  'Reinsurance Broker': 'Guy Carpenter',
  // Distribution (firm-nameable)
  'Managing General Agent (MGA)': 'Amwins',
  'Affinity / Embedded Partner': 'Cover Genius',
  // Professional services
  'External Auditor': 'Deloitte',
  'Outside Counsel': 'DLA Piper',
  // Rating agency
  'Financial Strength Rating Agency': 'AM Best',
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;
  console.log(`Company: ${company.name}`);

  let renamed = 0;
  for (const [generic, firm] of Object.entries(REAL_FIRM)) {
    const rows = await prisma.externalInteraction.findMany({
      where: { companyId, sourceSheet: 'External Interactions', externalRole: generic },
      select: { id: true, notes: true },
    });
    for (const r of rows) {
      const note = `Third-party type: ${generic}. Illustrative named market leader — reconcile with ABC's actual contracts.`;
      await prisma.externalInteraction.update({
        where: { id: r.id },
        data: { externalRole: firm, notes: note },
      });
      renamed++;
    }
  }
  console.log(`E-03: renamed ${renamed} generic third parties to real named firms.`);

  // Report what intentionally stays generic (role/channel/regulator types).
  const still = await prisma.externalInteraction.findMany({
    where: { companyId, sourceSheet: 'External Interactions' },
    select: { externalRole: true, partyType: true },
    orderBy: { partyType: 'asc' },
  });
  const generic = still.filter((s) => !Object.values(REAL_FIRM).includes(s.externalRole));
  console.log(`Kept generic (not single firms): ${generic.map((g) => g.externalRole).join(', ')}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
