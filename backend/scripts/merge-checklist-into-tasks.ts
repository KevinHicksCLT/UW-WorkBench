// T-05 — merge the Checklist concept into Tasks. The Checklist and Task datasets
// overlap ~85% (4743 checklist items are exact text duplicates of a task); the
// remaining ~861 checklist items are unique work not represented as a task.
// This folds those unique items into the Task table (source='checklist', owner =
// the item's role) so the Tasks tab is the single list. The duplicates are left
// alone (already tasks). The ChecklistItem table is NOT deleted — role pages and
// the DQ-01 completeness invariant (every role has tasks AND checklist) still
// read it; only the separate Checklist *tab* goes away (frontend).
//
// Idempotent: a checklist item is folded only if no task already has its text
// (so re-runs and the previously-folded rows are skipped). Run from backend/:
//   npx tsx scripts/merge-checklist-into-tasks.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  const tasks = await prisma.task.findMany({ where: { companyId }, select: { title: true } });
  const taskText = new Set(tasks.map((t) => norm(t.title)));

  const items = await prisma.checklistItem.findMany({
    where: { role: { companyId } },
    select: { text: true, role: { select: { name: true } } },
  });

  // Unique checklist items with no matching task text — fold these in.
  const toAdd: { title: string; owner: string }[] = [];
  for (const it of items) {
    const key = norm(it.text);
    if (taskText.has(key)) continue;
    taskText.add(key); // dedup within this run too
    toAdd.push({ title: it.text, owner: it.role?.name ?? '' });
  }

  let created = 0;
  for (const a of toAdd) {
    await prisma.task.create({
      data: {
        tenantId, companyId, title: a.title, owner: a.owner || null,
        status: 'To Do', priority: 'Medium', source: 'checklist',
      },
    });
    created++;
  }
  const total = await prisma.task.count({ where: { companyId } });
  console.log(`T-05: folded ${created} unique checklist items into Tasks (source='checklist'). Task total now ${total}.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
