// User decision 2026-07-01: start with ZERO standard/reg associations — the
// Standards/Regulations tabs remain the catalogs; ties get made deliberately,
// task by task, in the Work Library. Wipes ALL NodeStandard/NodeRegulation
// rows (pre-migration VS-grain state is preserved in scripts/backups/).
// Run: npx tsx --env-file=.env scripts/wipe-task-standards-regs.ts
import { prisma } from '../src/db/prisma.js';

async function main() {
  const std = await prisma.nodeStandard.deleteMany({});
  const reg = await prisma.nodeRegulation.deleteMany({});
  const [stdLeft, regLeft, catalogStd, catalogReg] = await Promise.all([
    prisma.nodeStandard.count(),
    prisma.nodeRegulation.count(),
    prisma.standard.count(),
    prisma.regulatoryRequirement.count(),
  ]);
  console.log(`deleted — NodeStandard: ${std.count} | NodeRegulation: ${reg.count}`);
  console.log(`remaining links — standards: ${stdLeft} | regulations: ${regLeft}`);
  console.log(`catalogs untouched — Standard rows: ${catalogStd} | RegulatoryRequirement rows: ${catalogReg}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
