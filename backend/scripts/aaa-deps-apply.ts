// Max-plan dependency apply — the session model authors the edges (no API):
//   1. scripts/aaa-deps-dump.ts writes deps-input.json (L4s missing deps)
//   2. the session authors deps-out-*.json keyed by L4 index:
//        {"<l4Idx>":[{"t":<taskIdx>,"d":[<taskIdx>,...]},...]}
//   3. this script validates (bounds, self-refs, cap 3, cycle check) and
//      writes attributes.dependsOn.
// Run: npx tsx --env-file=.env scripts/aaa-deps-apply.ts deps-out-1.json ...
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const input = JSON.parse(readFileSync(join('scripts', 'deps-input.json'), 'utf8')) as {
  l4: string;
  name: string;
  tasks: { id: string; name: string }[];
}[];
const edges = new Map<number, { t: number; d: number[] }[]>();
for (const f of process.argv.slice(2)) {
  const chunk = JSON.parse(readFileSync(join('scripts', f), 'utf8')) as Record<
    string,
    { t: number; d: number[] }[]
  >;
  for (const [k, v] of Object.entries(chunk)) edges.set(Number(k), v);
}

let applied = 0;
let skipped = 0;
for (const [idx, list] of edges) {
  const l4 = input[idx];
  if (!l4) {
    console.log(`no such L4 index ${idx}`);
    continue;
  }
  const n = l4.tasks.length;
  // Cycle check over the proposed graph.
  const adj = new Map<number, number[]>();
  for (const e of list)
    adj.set(
      e.t,
      (e.d ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < n && i !== e.t),
    );
  const state = new Array<number>(n).fill(0);
  let cyclic = false;
  const visit = (u: number): void => {
    if (state[u] === 1) {
      cyclic = true;
      return;
    }
    if (state[u] === 2) return;
    state[u] = 1;
    for (const v of adj.get(u) ?? []) visit(v);
    state[u] = 2;
  };
  for (let u = 0; u < n && !cyclic; u++) visit(u);
  if (cyclic) {
    console.log(`CYCLE in "${l4.name}" — skipped`);
    skipped += 1;
    continue;
  }
  for (const e of list) {
    const task = l4.tasks[e.t];
    const depIds = (adj.get(e.t) ?? []).slice(0, 3).map((i) => l4.tasks[i].id);
    if (!task || !depIds.length) continue;
    const row = await prisma.processNode.findFirst({
      where: { id: task.id },
      select: { attributes: true },
    });
    const attrs = (row?.attributes ?? {}) as Prisma.JsonObject;
    await prisma.processNode.update({
      where: { id: task.id },
      data: { attributes: { ...attrs, dependsOn: depIds } },
    });
    applied += 1;
  }
}
console.log(`deps applied to ${applied} tasks (${skipped} L4s skipped for cycles)`);
await prisma.$disconnect();
