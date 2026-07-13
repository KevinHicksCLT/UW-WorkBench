// One-off backfill: ProcessNode.isTask must match erd_v5's invariant (L5 = task
// leaf). Nodes created via the map's Add feature (or drag-relevelled) before the
// builder.ts / closure.ts fix landed this session never had isTask set/updated,
// so they can drift from their level. Idempotent — safe to re-run.
import { prisma } from '../src/db/prisma.js';

const TASK_LEVEL = 5;

async function main() {
  const nodes = await prisma.processNode.findMany({
    select: {
      id: true,
      displayValue: true,
      isTask: true,
      processLevelType: { select: { levelNumber: true } },
    },
  });
  const drifted = nodes.filter((n) => n.isTask !== (n.processLevelType.levelNumber === TASK_LEVEL));
  console.log(`${nodes.length} process nodes checked, ${drifted.length} drifted.`);
  for (const n of drifted) {
    const shouldBeTask = n.processLevelType.levelNumber === TASK_LEVEL;
    await prisma.processNode.update({ where: { id: n.id }, data: { isTask: shouldBeTask } });
    console.log(
      `  fixed "${n.displayValue}" (L${n.processLevelType.levelNumber}): isTask ${n.isTask} → ${shouldBeTask}`,
    );
  }
  console.log('Done.');
}

main().finally(() => prisma.$disconnect());
