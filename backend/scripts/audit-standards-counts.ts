import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D5.8 — is "N departments with exactly 22 standards" real
// variation or a seed artifact? Report per-area guideline counts.

async function main() {
  const rows = await prisma.standard.findMany({
    select: { id: true, department: true, owner: true, _count: { select: { items: true } } },
    orderBy: { department: 'asc' },
  });
  for (const r of rows) console.log(String(r._count.items).padStart(3) + '  ' + r.department + '  (owner: ' + (r.owner ?? '—') + ')');
  const byCount = new Map<number, number>();
  for (const r of rows) byCount.set(r._count.items, (byCount.get(r._count.items) ?? 0) + 1);
  console.log('\nDistribution: ' + [...byCount.entries()].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${n} areas × ${c} items`).join(', '));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
