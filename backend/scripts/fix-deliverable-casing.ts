import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D8.5 — make Deliverable a single source of truth:
//   1. Merge duplicate rows (same company + value stream + normalized title):
//      tasks are repointed to the keeper (the row with the most tasks), nullable
//      metadata is backfilled from the dupes, and the dupes are deleted.
//      Same-name deliverables in DIFFERENT value streams are legitimate and kept.
//   2. Normalize letter casing: titles render in sentence case, so any title
//      starting with a lowercase letter gets its first letter capitalized.
// Idempotent — a second run finds nothing to do. Dry-run by default; pass
// --fix to apply.

const APPLY = process.argv.includes('--fix');

async function main() {
  const rows = await prisma.deliverable.findMany({
    select: {
      id: true, title: true, description: true, owner: true, valueStreamId: true,
      companyId: true, dueDate: true, createdAt: true, _count: { select: { tasks: true } },
    },
  });

  // ── 1. Duplicate merge (within company + value stream) ──
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.companyId}::${r.valueStreamId ?? 'none'}::${r.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`Duplicate groups (same company + value stream + title): ${dupGroups.length}`);

  let merged = 0;
  for (const g of dupGroups) {
    const sorted = [...g].sort((a, b) => b._count.tasks - a._count.tasks || a.createdAt.getTime() - b.createdAt.getTime());
    const keeper = sorted[0];
    const dupes = sorted.slice(1);
    console.log(`  keep "${keeper.title}" (${keeper._count.tasks} tasks) ← merge ${dupes.map((d) => `"${d.title}" (${d._count.tasks})`).join(', ')}`);
    if (!APPLY) continue;
    const fill: Record<string, unknown> = {};
    for (const d of dupes) {
      if (!keeper.description && d.description) fill.description = d.description;
      if (!keeper.owner && d.owner) fill.owner = d.owner;
      if (!keeper.dueDate && d.dueDate) fill.dueDate = d.dueDate;
    }
    await prisma.$transaction([
      prisma.task.updateMany({ where: { deliverableId: { in: dupes.map((d) => d.id) } }, data: { deliverableId: keeper.id } }),
      ...(Object.keys(fill).length ? [prisma.deliverable.update({ where: { id: keeper.id }, data: fill })] : []),
      prisma.deliverable.deleteMany({ where: { id: { in: dupes.map((d) => d.id) } } }),
    ]);
    merged += dupes.length;
  }

  // ── 2. Sentence-case titles ──
  const survivors = await prisma.deliverable.findMany({ select: { id: true, title: true } });
  const toCase = survivors.filter((r) => /^[a-z]/.test(r.title));
  console.log(`\nTitles to sentence-case: ${toCase.length}`);
  let cased = 0;
  for (const r of toCase) {
    const fixed = r.title.charAt(0).toUpperCase() + r.title.slice(1);
    if (!APPLY) { if (cased < 10) console.log(`  "${r.title}" → "${fixed}"`); cased++; continue; }
    await prisma.deliverable.update({ where: { id: r.id }, data: { title: fixed } });
    cased++;
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN (pass --fix to apply)'}: ${merged} duplicates merged, ${cased} titles ${APPLY ? 'recased' : 'needing recase'}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
