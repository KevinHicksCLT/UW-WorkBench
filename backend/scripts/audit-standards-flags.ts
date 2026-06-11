import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// D5.8 follow-up: which areas are flagged illustrative, and do the per-area item
// counts come from a uniform seed template? Also sample item names from two
// 22-item areas to see if they repeat across areas.

async function main() {
  const rows = await prisma.standard.findMany({
    select: { id: true, department: true, illustrative: true, count: true, _count: { select: { items: true } } },
    orderBy: { department: 'asc' },
  });
  for (const r of rows) {
    console.log(`${String(r._count.items).padStart(3)} items  count=${String(r.count).padStart(3)}  illustrative=${r.illustrative}  ${r.department}`);
  }
  const a = rows.find((r) => r.department === 'Finance & Accounting');
  const b = rows.find((r) => r.department === 'Human Resources');
  for (const area of [a, b]) {
    if (!area) continue;
    const items = await prisma.standardItem.findMany({ where: { standardId: area.id }, select: { name: true, category: true }, take: 25 });
    console.log(`\n${area.department}:`);
    for (const i of items) console.log(`  [${i.category}] ${i.name}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
