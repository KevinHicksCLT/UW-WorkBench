// Post-pipeline fixups for the L4 pilot run:
//  1. Verification sinks are owned BY DEFINITION by the actor in their name —
//     re-assert that (the realism pass wrongly re-owned the BA sink).
//  2. The generic "Architect" role the AI minted resolves to the specific
//     architect: NFR-constraint work → Software Architect; the requirements
//     handover goes back to the Business Analyst (it is BA work). The bare
//     "Architect" role is deleted once unreferenced.
//  3. The dependency pass re-runs with a bigger token budget + one retry.
// Run: npx tsx --env-file=.env scripts/aaa-pipeline-fixups.ts
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237';
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 2 });

const tasksAll = () =>
  prisma.processNode.findMany({
    where: { parentId: L4, isTask: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, displayValue: true, companyId: true, attributes: true },
  });
let tasks = await tasksAll();
const companyId = tasks[0].companyId;

async function ensureRole(name: string): Promise<string> {
  let r = await prisma.role.findFirst({
    where: { companyId, displayValue: name },
    select: { id: true },
  });
  r ??= await prisma.role.create({
    data: { companyId, dbValue: name, displayValue: name },
    select: { id: true },
  });
  return r.id;
}

async function setOwner(taskId: string, roleName: string) {
  const rid = await ensureRole(roleName);
  await prisma.nodeRole.deleteMany({ where: { processNodeId: taskId } });
  await prisma.nodeRole.create({
    data: { companyId, processNodeId: taskId, roleId: rid, role_: 'Owner' },
  });
}

async function revoice(taskId: string, from: string, to: string) {
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: taskId, templateKeyId: null, value: { contains: `By the ${from}` } },
    select: { id: true, value: true },
  });
  for (const r of rows)
    await prisma.nodeTemplateAnswer.update({
      where: { id: r.id },
      data: { value: r.value!.replaceAll(`By the ${from}`, `By the ${to}`) },
    });
  return rows.length;
}

// 1. Sinks owned by their named actor; rows re-voiced back if the AI drifted.
for (const t of tasks) {
  const m = t.displayValue.match(/^Verify elaboration outputs — (.+)$/);
  if (!m) continue;
  const actor = m[1];
  await setOwner(t.id, actor);
  const owner = actor;
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: {
      processNodeId: t.id,
      templateKeyId: null,
      NOT: { value: { contains: `By the ${owner}` } },
    },
    select: { id: true, value: true },
  });
  for (const r of rows) {
    const fixed = r.value?.replace(/^By the [^:\n]+:?$/im, `By the ${owner}:`);
    if (fixed && fixed !== r.value)
      await prisma.nodeTemplateAnswer.update({ where: { id: r.id }, data: { value: fixed } });
  }
  console.log(`sink "${t.displayValue}" → owner ${actor} (${rows.length} rows re-voiced)`);
}

// 2. Resolve the generic "Architect".
const handover = tasks.find(
  (t) => t.displayValue === 'Hand elaborated requirements package to engineering team',
);
if (handover) {
  await setOwner(handover.id, 'Business Analyst');
  const n = await revoice(handover.id, 'Architect', 'Business Analyst');
  console.log(`handover → Business Analyst (${n} rows)`);
}
const nfrConstraints = tasks.find(
  (t) => t.displayValue === 'Document the non-functional constraints on the record in Jira',
);
if (nfrConstraints) {
  await setOwner(nfrConstraints.id, 'Software Architect');
  const n = await revoice(nfrConstraints.id, 'Architect', 'Software Architect');
  console.log(`NFR constraints → Software Architect (${n} rows)`);
}
const generic = await prisma.role.findFirst({
  where: { companyId, displayValue: 'Architect' },
  select: { id: true },
});
if (generic) {
  const uses = await prisma.nodeRole.count({ where: { roleId: generic.id } });
  if (uses === 0) {
    await prisma.role.delete({ where: { id: generic.id } });
    console.log('generic "Architect" role deleted');
  } else console.log(`generic "Architect" still used by ${uses} links — kept`);
}

// 3. Dependencies, retried.
tasks = await tasksAll();
const owners = await prisma.nodeRole.findMany({
  where: { processNodeId: { in: tasks.map((t) => t.id) }, role_: 'Owner' },
  select: { processNodeId: true, role: { select: { displayValue: true } } },
});
const ownerName = new Map(owners.map((o) => [o.processNodeId, o.role.displayValue]));
const prompt = tasks
  .map((t, i) => `${i}: "${t.displayValue}" (owner: ${ownerName.get(t.id) ?? '?'})`)
  .join('\n');
const SYSTEM = [
  'These tasks form one sub-process (requirements elaboration for an insurance carrier).',
  'Propose dependency edges: which tasks cannot COMPLETE until another has. Only real,',
  'load-bearing input dependencies, max 3 per task, no cycles; verification tasks depend',
  'on what they verify. Reply ONLY minified JSON, no markdown:',
  '{"deps":[{"task":<index>,"dependsOn":[<index>,...]},...]}',
].join(' ');
let applied = 0;
for (let attempt = 0; attempt < 2 && !applied; attempt++) {
  try {
    const r = await ai.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ');
    const deps = JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    ) as {
      deps?: { task: number; dependsOn: number[] }[];
    };
    for (const d of deps.deps ?? []) {
      const t = tasks[d.task];
      if (!t) continue;
      const ids = (d.dependsOn ?? [])
        .filter((i) => Number.isInteger(i) && tasks[i] && i !== d.task)
        .slice(0, 3)
        .map((i) => tasks[i].id);
      if (!ids.length) continue;
      const attrs = (t.attributes ?? {}) as Prisma.JsonObject;
      await prisma.processNode.update({
        where: { id: t.id },
        data: { attributes: { ...attrs, dependsOn: ids } },
      });
      applied += 1;
    }
    console.log(`dependencies applied to ${applied} tasks`);
  } catch (e) {
    console.log(`dep attempt ${attempt + 1} failed:`, (e as Error).message);
  }
}
await prisma.$disconnect();
