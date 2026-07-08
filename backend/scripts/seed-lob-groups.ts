// seed-lob-groups.ts — assign every LineOfBusiness a family GROUP (the roll-up
// the Regulations table + filter show; the requirement detail page still lists
// the specific line). Deterministic keyword rules over the taxonomy labels.
//
// Run (cwd = backend): npx tsx --env-file=.env scripts/seed-lob-groups.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Ordered rules — first match wins. Each: [predicate, group].
const RULES: [(l: string) => boolean, string][] = [
  [(l) => /reinsurance/i.test(l), 'Reinsurance'],
  [(l) => /group life/i.test(l), 'Group Life'],
  [
    (l) =>
      /individual life|permanent life|variable universal life|variable life|\blife\b.*industrial/i.test(
        l,
      ),
    'Individual Life',
  ],
  [
    (l) => /life assurance|unit-linked|tontines|capital redemption|marriage assurance/i.test(l),
    'Individual Life',
  ],
  [
    (l) => /group annuit|management of group pension|pension risk transfer/i.test(l),
    'Group Annuities',
  ],
  [
    (l) => /individual annuit|annuit|registered index-linked|cash value|annuity contracts/i.test(l),
    'Individual Annuities',
  ],
  [
    (l) =>
      /medicare|medicaid|comprehensive \(hospital|comprehensive health|vision only|dental only|disability income|long-term care|other health|hmo|health care center|federal employees health|group health|group disability|sickness|permanent health insurance|accident\b/i.test(
        l,
      ),
    'Medical & Health',
  ],
  [
    (l) =>
      /private passenger auto|other private passenger|no-fault \(pip\)|automobile club|land vehicles|motor vehicle liability/i.test(
        l,
      ),
    'Personal Auto',
  ],
  [(l) => /commercial auto/i.test(l), 'Commercial Auto'],
  [(l) => /workers'? comp/i.test(l), "Workers' Compensation"],
  [
    (l) =>
      /ocean marine|inland marine|aircraft|ships|goods in transit|railway rolling|aviation|liability for ships/i.test(
        l,
      ),
    'Marine & Aviation',
  ],
  [
    (l) =>
      /liability|products liability|medical professional|general liability|legal expenses/i.test(l),
    'Liability',
  ],
  [(l) => /title/i.test(l), 'Title'],
  [
    (l) =>
      /credit|mortgage guaranty|financial guaranty|suretyship|surety|fidelity|bail bond|miscellaneous financial/i.test(
        l,
      ),
    'Financial & Credit',
  ],
  [
    (l) =>
      /fire|allied lines|homeowners|farmowners|mobile home|earthquake|flood|multiple peril|boiler|glass|burglary|elevator|leakage|residual value|other damage to property|fire and natural|industrial fire|industrial extended|crop|entertainments|livestock/i.test(
        l,
      ),
    'Property',
  ],
  [
    (l) => /surplus lines|captives|risk retention|fraternal|residual market/i.test(l),
    'Alternative Risk',
  ],
  [
    (l) =>
      /warranty|service warranties|pet insurance|prepaid legal|family leave|assistance|terrorism|nuclear|international|aggregate write-ins/i.test(
        l,
      ),
    'Specialty & Other',
  ],
];

const groupFor = (label: string): string => {
  for (const [pred, g] of RULES) if (pred(label)) return g;
  return 'Specialty & Other';
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const lobs = await prisma.lineOfBusiness.findMany({
    where: { companyId: company.id },
    select: { id: true, label: true },
  });
  const counts: Record<string, number> = {};
  for (const l of lobs) {
    const group = groupFor(l.label);
    counts[group] = (counts[group] ?? 0) + 1;
    await prisma.lineOfBusiness.update({ where: { id: l.id }, data: { group } });
  }
  console.log(`grouped ${lobs.length} lines into ${Object.keys(counts).length} families:`);
  for (const [g, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
    console.log(`  ${n.toString().padStart(3)}  ${g}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
