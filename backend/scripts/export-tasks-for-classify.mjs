// export-tasks-for-classify.mjs — NO API. Dump every L5 task grouped UNDER its
// deliverable (so a classifier can see a deliverable's full task set and spot
// tasks that really belong to a different/related deliverable). Chunks keep each
// deliverable's tasks together, ~150 tasks per chunk file.
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';

const OUT = process.argv[2] || 'C:/Users/xando/AppData/Local/Temp/claude/C--Users-xando-Code-transform-platform/29c5241a-e8ab-4239-94cc-c34c64dea829/scratchpad/task-chunks';
const TASKS_PER_CHUNK = Number(process.argv[3] || 150);

const p = new PrismaClient();
const company = await p.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

// every deliverable + the L5 task nodes linked to it
const dels = await p.deliverable.findMany({
  where: { companyId: company.id },
  select: {
    id: true, title: true, description: true,
    nodeDeliverables: { select: { processNode: { select: { id: true, displayValue: true, isTask: true } } } },
  },
  orderBy: { title: 'asc' },
});

// VS context per deliverable (one closure lookup on its first task)
const groups = [];
for (const d of dels) {
  const tasks = d.nodeDeliverables.map((nd) => nd.processNode).filter((n) => n.isTask);
  if (!tasks.length) continue;
  let vs = '';
  const anc = await p.processNodeClosure.findMany({
    where: { descendantId: tasks[0].id, depth: { gt: 0 } },
    include: { ancestor: { select: { displayValue: true } } }, orderBy: { depth: 'desc' },
  });
  vs = anc.map((a) => a.ancestor.displayValue).join(' > ');
  groups.push({ deliverableId: d.id, deliverableTitle: d.title, deliverableDescription: d.description, vs,
    tasks: tasks.map((t) => ({ id: t.id, text: t.displayValue })) });
}

mkdirSync(OUT, { recursive: true });
let chunk = [], count = 0, n = 0, totalTasks = 0;
const flush = () => { if (!chunk.length) return; writeFileSync(`${OUT}/chunk-${String(n).padStart(3, '0')}.json`, JSON.stringify(chunk, 0)); n++; chunk = []; count = 0; };
for (const g of groups) {
  chunk.push(g); count += g.tasks.length; totalTasks += g.tasks.length;
  if (count >= TASKS_PER_CHUNK) flush();
}
flush();
console.log(`Exported ${groups.length} deliverable-groups (${totalTasks} tasks) into ${n} chunk files at:\n${OUT}`);
await p.$disconnect();
