// export-deliverables-for-classify.mjs — NO API. Dump every Deliverable with its
// L5 task texts + VS context into chunk files for subagent classification.
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';

const OUT = process.argv[2] || 'C:/Users/xando/AppData/Local/Temp/claude/C--Users-xando-Code-transform-platform/29c5241a-e8ab-4239-94cc-c34c64dea829/scratchpad/deliv-chunks';
const CHUNK = Number(process.argv[3] || 50);
const SUFFIX = ' output/record (validated & control sign-off)';

const p = new PrismaClient();
const company = await p.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

const dels = await p.deliverable.findMany({
  where: { companyId: company.id },
  include: { nodeDeliverables: { include: { processNode: { select: { id: true, displayValue: true } } } } },
  orderBy: { title: 'asc' },
});

// VS context: one closure lookup per deliverable's first task
const recs = [];
for (const d of dels) {
  const tasks = d.nodeDeliverables.map((nd, i) => ({ i, text: nd.processNode.displayValue }));
  let vs = '';
  const firstNode = d.nodeDeliverables[0]?.processNode.id;
  if (firstNode) {
    const anc = await p.processNodeClosure.findMany({
      where: { descendantId: firstNode, depth: { gt: 0 } },
      include: { ancestor: { select: { displayValue: true } } },
      orderBy: { depth: 'desc' },
    });
    vs = anc.map((a) => a.ancestor.displayValue).join(' > ');
  }
  recs.push({ id: d.id, base: d.title.replace(SUFFIX, '').trim(), vs, tasks });
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (let s = 0; s < recs.length; s += CHUNK) {
  const chunk = recs.slice(s, s + CHUNK);
  const idx = String(n).padStart(3, '0');
  writeFileSync(`${OUT}/chunk-${idx}.json`, JSON.stringify(chunk, null, 0));
  n++;
}
console.log(`Exported ${recs.length} deliverables into ${n} chunk files (<=${CHUNK} each) at:\n${OUT}`);
await p.$disconnect();
