import { PrismaClient } from '@prisma/client';
import { metricReading } from '../src/seed/illustrative.js';

// One-off: backfill a numeric `target` on the KPIs whose target text is
// qualitative ("Downward trend", "Within tolerance", …) and therefore parsed to
// null. Uses the same metricReading() the seeder uses, so the synthesized target
// sits near the existing reading in the same jitter family. Pure UPDATEs — no
// deletes; idempotent (only touches rows where target IS NULL).
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.metric.findMany({
    where: { target: null },
    select: { id: true, name: true, targetText: true, notes: true, category: true },
  });
  let n = 0;
  for (const m of rows) {
    const r = metricReading({ name: m.name, target: m.targetText, notes: m.notes, category: m.category });
    if (r.target == null) continue;
    await prisma.metric.update({ where: { id: m.id }, data: { target: r.target } });
    n++;
  }
  console.log(`Backfilled numeric target on ${n}/${rows.length} metrics`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
