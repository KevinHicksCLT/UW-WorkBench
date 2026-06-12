// Defect follow-up: the demo portfolio had no MISSED milestones, so the Home
// timeline showed no red diamonds. Marks two past-due milestones MISSED —
// mirrors the same change in src/seed/portfolio.ts. Idempotent (updates are
// absolute). Also deletes the two "milestone missed" RAID issues an earlier
// version of this script created (the user wanted timeline reds only).
import { prisma } from '../src/db/prisma.js';

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }

const MISSED: { initiative: string; milestone: string; monthOffset: number }[] = [
  { initiative: 'Automated FNOL Triage', milestone: 'Assisted-routing pilot', monthOffset: -1 },
  { initiative: 'Unified Claims Data Platform', milestone: 'Business case approval', monthOffset: 0 },
];

const RETIRED_ISSUE_TITLES = [
  'Assisted-routing pilot milestone missed',
  'Business case approval milestone missed',
];

async function main() {
  const today = new Date();
  for (const m of MISSED) {
    const initiatives = await prisma.portfolioInitiative.findMany({
      where: { name: m.initiative }, select: { id: true },
    });
    if (initiatives.length === 0) { console.warn(`no initiative named "${m.initiative}" — skipped`); continue; }
    for (const init of initiatives) {
      const dueDate = startOfMonth(addMonths(today, m.monthOffset));
      const updated = await prisma.milestone.updateMany({
        where: { initiativeId: init.id, name: m.milestone },
        data: { status: 'MISSED', dueDate, completedAt: null },
      });
      if (updated.count === 0) { console.warn(`no milestone "${m.milestone}" on "${m.initiative}"`); continue; }
      console.log(`${m.initiative}: "${m.milestone}" → MISSED (due ${dueDate.toISOString().slice(0, 10)})`);
    }
  }

  const removed = await prisma.raidItem.deleteMany({ where: { type: 'ISSUE', title: { in: RETIRED_ISSUE_TITLES } } });
  console.log(`retired "milestone missed" issues removed: ${removed.count}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
