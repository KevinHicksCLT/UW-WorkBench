// AAA POC step 2: one actor per task. Where a task's sub-tasks name more than
// one actor, the task SPLITS — the majority actor keeps the original task and
// every other actor gets a sibling task carrying exactly its sub-tasks (with
// their paired Verify rows), its deliverable links, the applications its
// sub-task text actually references, and itself as the single Owner. Task
// names for multi-step groups come from a Haiku call (deterministic fallback).
// Idempotent: a split group whose task name already exists under the parent is
// skipped. Run with:
//   npx tsx --env-file=.env scripts/aaa-poc-split-task.ts
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';
import { taskPlans } from '../src/lib/workPlan.js';
import { parseAaaSubTasks, type AaaSubTask } from '../src/lib/subTaskAaa.js';

const TASK_NAME = 'Document requirements specification';

async function nameFor(actor: string, actions: string[]): Promise<string> {
  if (actions.length === 1) return actions[0];
  const fallback = `${actions[0]} (+${actions.length - 1} related steps)`;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
    const r = await ai.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: `These sub-task actions all belong to the ${actor} and are being split out of "${TASK_NAME}" into one task. Reply with ONLY a concise task name (max 8 words, imperative verb first, no quotes):\n${actions.map((a) => `- ${a}`).join('\n')}`,
        },
      ],
    });
    const text = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return text && text.length <= 90 ? text : fallback;
  } catch {
    return fallback;
  }
}

const task = await prisma.processNode.findFirst({
  where: { displayValue: TASK_NAME, isTask: true },
  select: {
    id: true,
    parentId: true,
    processLevelTypeId: true,
    sortOrder: true,
    companyId: true,
    automatability: true,
  },
});
if (!task) throw new Error('task not found');

const [plan, appLinks, delivLinks, roleLinks, ancestors, answers] = await Promise.all([
  taskPlans([task.id], {}).then((m) => m.get(task.id)!),
  prisma.nodeAppUsage.findMany({
    where: { processNodeId: task.id },
    select: { applicationId: true, usageType: true, application: { select: { name: true } } },
  }),
  prisma.nodeDeliverable.findMany({
    where: { processNodeId: task.id },
    select: { deliverableId: true },
  }),
  prisma.nodeRole.findMany({
    where: { processNodeId: task.id },
    select: { id: true, roleId: true, role_: true, role: { select: { displayValue: true } } },
  }),
  prisma.processNodeClosure.findMany({
    where: { descendantId: task.id, depth: { gt: 0 } },
    select: { ancestorId: true, depth: true },
  }),
  prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: task.id, templateKeyId: null, NOT: { customKey: null } },
    select: { id: true, customKey: true, kind: true },
  }),
]);

const { subTasks } = parseAaaSubTasks(
  plan.checklist,
  plan.testing,
  appLinks.map((a) => a.application.name),
);
const byActor = new Map<string, AaaSubTask[]>();
for (const s of subTasks) byActor.set(s.actor ?? 'Unknown', [...(byActor.get(s.actor ?? 'Unknown') ?? []), s]);
const groups = [...byActor.entries()].sort((a, b) => b[1].length - a[1].length);
const [keeper, ...movers] = groups;
console.log('groups:', groups.map(([a, s]) => `${a}=${s.length}`).join(', '), '| keeper:', keeper[0]);

// Answer rows by sub-task number (action row + its Verify row).
const answerByN = new Map<number, { action?: string; verify?: string }>();
for (const a of answers) {
  const m = a.customKey!.match(/^(\d+)\. (Verify: )?/);
  if (!m) continue;
  const e = answerByN.get(Number(m[1])) ?? {};
  if (m[2]) e.verify = a.id;
  else e.action = a.id;
  answerByN.set(Number(m[1]), e);
}

const renumber = async (list: AaaSubTask[], nodeId: string) => {
  let k = 0;
  for (const s of [...list].sort((a, b) => a.n - b.n)) {
    k += 1;
    const ids = answerByN.get(s.n);
    if (ids?.action)
      await prisma.nodeTemplateAnswer.update({
        where: { id: ids.action },
        data: { processNodeId: nodeId, customKey: `${k}. ${s.action}`, sortOrder: 100 + k * 10 },
      });
    if (ids?.verify)
      await prisma.nodeTemplateAnswer.update({
        where: { id: ids.verify },
        data: {
          processNodeId: nodeId,
          customKey: `${k}. Verify: ${s.action}`,
          sortOrder: 105 + k * 10,
        },
      });
  }
};

let nextSort = task.sortOrder ?? 0;
for (const [actor, list] of movers) {
  const role = await prisma.role.findFirst({
    where: { companyId: task.companyId, displayValue: actor },
    select: { id: true },
  });
  if (!role) {
    console.log(`SKIP ${actor}: no such role`);
    continue;
  }
  const name = await nameFor(actor, list.map((s) => s.action));
  const dup = await prisma.processNode.findFirst({
    where: { parentId: task.parentId, displayValue: name },
    select: { id: true },
  });
  if (dup) {
    console.log(`SKIP ${actor}: "${name}" already exists`);
    continue;
  }
  nextSort += 1;
  const groupText = list.map((s) => `${s.action}\n${s.steps.join('\n')}`).join('\n');
  const groupApps = appLinks.filter((a) =>
    new RegExp(`\\b${a.application.name}\\b`, 'i').test(groupText),
  );
  const node = await prisma.$transaction(async (tx) => {
    const n = await tx.processNode.create({
      data: {
        companyId: task.companyId,
        parentId: task.parentId,
        processLevelTypeId: task.processLevelTypeId,
        dbValue: name,
        displayValue: name,
        isTask: true,
        sortOrder: nextSort,
        automatability: task.automatability,
      },
      select: { id: true },
    });
    await tx.processNodeClosure.createMany({
      data: [
        { ancestorId: n.id, descendantId: n.id, depth: 0 },
        ...ancestors.map((a) => ({ ancestorId: a.ancestorId, descendantId: n.id, depth: a.depth })),
      ],
    });
    await tx.nodeRole.create({
      data: { companyId: task.companyId, processNodeId: n.id, roleId: role.id, role_: 'Owner' },
    });
    await tx.nodeDeliverable.createMany({
      data: delivLinks.map((d) => ({
        companyId: task.companyId,
        processNodeId: n.id,
        deliverableId: d.deliverableId,
      })),
    });
    await tx.nodeAppUsage.createMany({
      data: (groupApps.length ? groupApps : appLinks).map((a) => ({
        companyId: task.companyId,
        processNodeId: n.id,
        applicationId: a.applicationId,
        usageType: a.usageType,
      })),
    });
    return n;
  });
  await renumber(list, node.id);
  // The actor's link on the original task goes — its work now lives here.
  await prisma.nodeRole.deleteMany({ where: { processNodeId: task.id, roleId: role.id } });
  console.log(`split → "${name}" (${actor}, ${list.length} sub-tasks, ${groupApps.length || appLinks.length} apps)`);
}

// Renumber the keeper's remaining sub-tasks 1..k and drop any leftover
// non-keeper role links (participants whose work moved out).
await renumber(keeper[1], task.id);
const keeperRole = roleLinks.find((r) => r.role.displayValue === keeper[0]);
if (keeperRole) {
  await prisma.nodeRole.deleteMany({
    where: { processNodeId: task.id, NOT: { roleId: keeperRole.roleId } },
  });
  await prisma.nodeRole.updateMany({
    where: { processNodeId: task.id, roleId: keeperRole.roleId },
    data: { role_: 'Owner' },
  });
}

const finalRoles = await prisma.nodeRole.findMany({
  where: { processNodeId: task.id },
  select: { role_: true, role: { select: { displayValue: true } } },
});
console.log('keeper roles:', finalRoles.map((r) => `${r.role.displayValue}=${r.role_}`).join(', '));
await prisma.$disconnect();
