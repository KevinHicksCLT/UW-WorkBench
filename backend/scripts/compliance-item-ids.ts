/** Print id + Work Library deep link for the given compliance item codes. */
import { prisma } from '../src/db/prisma.js';

async function main() {
  const codes = process.argv.slice(2);
  const rows = await prisma.complianceItem.findMany({
    where: { itemCode: { in: codes } },
    select: { itemCode: true, id: true, name: true },
    orderBy: { itemCode: 'asc' },
  });
  for (const r of rows) console.log(`${r.itemCode}\t${r.id}\t${r.name}`);
}

main().finally(() => prisma.$disconnect());
