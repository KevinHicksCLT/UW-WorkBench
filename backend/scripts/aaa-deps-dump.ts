// Max-plan dependency dump — step 1 of the no-API dependency flow (see
// scripts/AAA-ROLLOUT-RUNBOOK.md). Writes scripts/deps-input.json listing
// every L4 under the given L2 value stream(s) whose child tasks do not yet
// carry attributes.dependsOn, with an index-stable task list the session
// authors edges against.
// Run: npx tsx --env-file=.env scripts/aaa-deps-dump.ts <l2Id> [<l2Id> ...]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const streams = process.argv.slice(2);
if (!streams.length) {
  console.error('usage: aaa-deps-dump.ts <l2Id> [<l2Id> ...]');
  process.exit(1);
}
const out: { l4: string; name: string; tasks: { id: string; name: string }[] }[] = [];
for (const L2 of streams) {
  const l4Ids = (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L2, depth: 2 },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId);
  const l4s = await prisma.processNode.findMany({
    where: { id: { in: l4Ids }, isTask: false },
    select: { id: true, displayValue: true },
  });
  for (const l4 of l4s) {
    const kids = await prisma.processNode.findMany({
      where: { parentId: l4.id, isTask: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, displayValue: true, attributes: true },
    });
    if (kids.length < 2) continue;
    if (
      kids.some((k) => Array.isArray((k.attributes as { dependsOn?: unknown } | null)?.dependsOn))
    )
      continue;
    out.push({
      l4: l4.id,
      name: l4.displayValue,
      tasks: kids.map((k) => ({ id: k.id, name: k.displayValue })),
    });
  }
}
writeFileSync(join('scripts', 'deps-input.json'), JSON.stringify(out));
console.log(
  `L4s needing deps: ${out.length} | tasks: ${out.reduce((a, x) => a + x.tasks.length, 0)}`,
);
for (let i = 0; i < out.length; i++) {
  console.log(`### ${i} ${out[i].name}`);
  out[i].tasks.forEach((t, j) => console.log(`${j}: ${t.name}`));
}
await prisma.$disconnect();
