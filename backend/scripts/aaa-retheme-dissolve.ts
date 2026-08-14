// Re-theme prep — dissolves credit-era fallback groupings so the rollout can
// regroup them thematically. A fallback main is one with an L6 child named
// exactly "<main name> — <actor>" (the deterministic fallback signature).
// For each: ALL its L6 children dissolve — their custom rows move back to the
// main (renumbered), the L6 nodes delete — and attributes.l6Regrouped clears
// so a rollout rerun picks the main up again. dependsOn refs to deleted nodes
// are scrubbed. Run: npx tsx --env-file=.env scripts/aaa-retheme-dissolve.ts <l2Id> [...]
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const streams = process.argv.slice(2);
if (!streams.length) {
  console.error('usage: aaa-retheme-dissolve.ts <l2Id> [...]');
  process.exit(1);
}

let dissolvedMains = 0;
let dissolvedL6 = 0;
for (const L2 of streams) {
  const d3 = (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L2, depth: 3 },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId);
  const mains = await prisma.processNode.findMany({
    where: { id: { in: d3 }, isTask: true },
    select: { id: true, displayValue: true, attributes: true },
  });
  for (const main of mains) {
    const children = await prisma.processNode.findMany({
      where: { parentId: main.id, isTask: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, displayValue: true },
    });
    const isFallback = children.some((c) => c.displayValue.startsWith(`${main.displayValue} — `));
    if (!isFallback) continue;

    // Move every child's custom rows back to the main, renumbered in order.
    let k = 0;
    for (const c of children) {
      const rows = await prisma.nodeTemplateAnswer.findMany({
        where: { processNodeId: c.id, templateKeyId: null, NOT: { customKey: null } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, customKey: true },
      });
      for (const r of rows) {
        k += 1;
        await prisma.nodeTemplateAnswer.update({
          where: { id: r.id },
          data: {
            processNodeId: main.id,
            customKey: `${k}. ${r.customKey!.replace(/^\d+\. /, '')}`,
            sortOrder: 100 + k * 10,
          },
        });
      }
      await prisma.processNode.delete({ where: { id: c.id } });
      dissolvedL6 += 1;
    }
    const attrs = (main.attributes ?? {}) as Prisma.JsonObject;
    delete attrs.l6Regrouped;
    await prisma.processNode.update({ where: { id: main.id }, data: { attributes: attrs } });
    dissolvedMains += 1;
  }
}
// Scrub dependsOn refs pointing at deleted nodes.
const live = new Set(
  (await prisma.processNode.findMany({ select: { id: true } })).map((n) => n.id),
);
const withDeps = await prisma.processNode.findMany({
  where: { attributes: { path: ['dependsOn'], not: Prisma.DbNull } },
  select: { id: true, attributes: true },
});
let scrubbed = 0;
for (const t of withDeps) {
  const attrs = (t.attributes ?? {}) as Prisma.JsonObject;
  const dep = attrs.dependsOn;
  if (!Array.isArray(dep)) continue;
  const clean = dep.filter((d): d is string => typeof d === 'string' && live.has(d));
  if (clean.length !== dep.length) {
    await prisma.processNode.update({
      where: { id: t.id },
      data: { attributes: { ...attrs, dependsOn: clean } },
    });
    scrubbed += 1;
  }
}
console.log(
  `dissolved ${dissolvedMains} fallback mains (${dissolvedL6} L6 nodes); scrubbed deps on ${scrubbed}`,
);
await prisma.$disconnect();
