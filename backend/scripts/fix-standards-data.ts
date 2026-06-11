import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D5 data fixes (idempotent):
//   1. Rename the "Cybersecurity & ISO" area to "Information Security" — the
//      review asked for unabbreviated group names. Script references
//      (load-standards.ts, link-standards-skills.ts) were updated to match.
//   2. Provenance: every area except Information Security was authored from a
//      ~22-item-per-department template (the audit found 8 areas with exactly
//      22 items — not a coincidence). Information Security's items come from
//      real regulatory packs (GDPR / CCPA-CPRA / NYDFS 500). Flag the template
//      areas illustrative=true so the UI can say so instead of presenting
//      uniform counts as real.

async function main() {
  const renamed = await prisma.standard.updateMany({
    where: { department: 'Cybersecurity & ISO' },
    data: { department: 'Information Security' },
  });
  console.log(`Renamed Cybersecurity & ISO → Information Security: ${renamed.count} row(s)`);

  const flagged = await prisma.standard.updateMany({
    where: { department: { not: 'Information Security' }, illustrative: false },
    data: { illustrative: true },
  });
  const real = await prisma.standard.updateMany({
    where: { department: 'Information Security', illustrative: true },
    data: { illustrative: false },
  });
  console.log(`Flagged template areas illustrative: ${flagged.count}; ensured Information Security real: ${real.count}`);

  const after = await prisma.standard.findMany({ select: { department: true, illustrative: true, count: true }, orderBy: { department: 'asc' } });
  for (const a of after) console.log(`  ${a.illustrative ? 'illustrative' : 'real       '}  ${String(a.count).padStart(3)}  ${a.department}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
