// AAA POC step 3 (Kevin round-3 feedback):
//  1. A sub-task's VERIFY row that names a DIFFERENT role than the task owner
//     is foreign work — it breaks out into a verification task owned by the
//     verifying actor (rows convert to sub-tasks; "Pass when" is their DoD).
//     Same-actor verification stays inline in the DoD box.
//  2. Every POC task's application links narrow to what its sub-task text
//     actually references (drops Jira where unused, adds referenced apps).
//  3. Microsoft Word enters the catalog and the exemplar's authoring path:
//     the spec document is DRAFTED in Word and published INTO Confluence.
// Idempotent. Run with:
//   npx tsx --env-file=.env scripts/aaa-poc-verify-split.ts
import { prisma } from '../src/db/prisma.js';

const PARENT_L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237'; // Business Analysis & Requirements Elaboration
const POC_TASKS = [
  'Document requirements specification',
  'Quantify NFRs and baseline specification in Confluence',
  'Specify the security requirements in Confluence',
];
const VERIFY_TASK_NAME = 'Verify the requirements specification';

const WORD_STEP_1 = [
  'By the Business Analyst:',
  '1) Draft the requirements specification document in Microsoft Word from the enterprise requirements template',
  '2) Open the requirements space in Confluence and click Create',
  '3) Import the Word document into Confluence as the page for the epic and publish it',
  'Done when the page exists for the epic',
].join('\n');

const actorOf = (value: string | null): string | null =>
  value?.match(/^By the ([^:\n]+):?$/im)?.[1]?.trim() ?? null;

const tasks = await prisma.processNode.findMany({
  where: { parentId: PARENT_L4, displayValue: { in: POC_TASKS }, isTask: true },
  select: { id: true, displayValue: true, companyId: true, processLevelTypeId: true, sortOrder: true, automatability: true },
});
if (!tasks.length) throw new Error('POC tasks not found');
const companyId = tasks[0].companyId;

// ── 3. Word joins the catalog + the authoring path on sub-task 1 ─────────────
let word = await prisma.application.findFirst({
  where: { companyId, name: 'Microsoft Word' },
  select: { id: true },
});
word ??= await prisma.application.create({
  data: {
    companyId,
    name: 'Microsoft Word',
    kind: 'Tool',
    isInternal: false,
    description:
      'Document authoring. Specifications and formal documents are drafted here before publication into their system of record (e.g. Confluence).',
  },
  select: { id: true },
});
const docTask = tasks.find((t) => t.displayValue === POC_TASKS[0])!;
const step1 = await prisma.nodeTemplateAnswer.findFirst({
  where: { processNodeId: docTask.id, customKey: { startsWith: '1. ' }, kind: { not: 'TEST' } },
  select: { id: true },
});
if (step1) await prisma.nodeTemplateAnswer.update({ where: { id: step1.id }, data: { value: WORD_STEP_1 } });

// ── 1. Foreign-actor verify rows → verification task per verifying actor ─────
const owners = await prisma.nodeRole.findMany({
  where: { processNodeId: { in: tasks.map((t) => t.id) }, role_: 'Owner' },
  select: { processNodeId: true, role: { select: { id: true, displayValue: true } } },
});
const ownerByTask = new Map(owners.map((o) => [o.processNodeId, o.role]));

type MovedRow = { id: string; action: string; value: string | null };
const movesByActor = new Map<string, MovedRow[]>();
for (const t of tasks) {
  const owner = ownerByTask.get(t.id);
  const verifyRows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: t.id, kind: 'TEST', customKey: { contains: 'Verify: ' } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, customKey: true, value: true },
  });
  for (const r of verifyRows) {
    const actor = actorOf(r.value);
    if (!actor || actor === owner?.displayValue) continue; // self-verification stays inline
    const action = r.customKey!.replace(/^\d+\. Verify: /, '');
    movesByActor.set(actor, [...(movesByActor.get(actor) ?? []), { id: r.id, action, value: r.value }]);
  }
}

for (const [actor, rows] of movesByActor) {
  const role = await prisma.role.findFirst({
    where: { companyId, displayValue: actor },
    select: { id: true },
  });
  if (!role) {
    console.log(`SKIP verifier ${actor}: no such role`);
    continue;
  }
  let vTask = await prisma.processNode.findFirst({
    where: { parentId: PARENT_L4, displayValue: VERIFY_TASK_NAME },
    select: { id: true },
  });
  if (!vTask) {
    const src = docTask;
    const ancestors = await prisma.processNodeClosure.findMany({
      where: { descendantId: src.id, depth: { gt: 0 } },
      select: { ancestorId: true, depth: true },
    });
    const delivLinks = await prisma.nodeDeliverable.findMany({
      where: { processNodeId: src.id },
      select: { deliverableId: true },
    });
    vTask = await prisma.$transaction(async (tx) => {
      const n = await tx.processNode.create({
        data: {
          companyId,
          parentId: PARENT_L4,
          processLevelTypeId: src.processLevelTypeId,
          dbValue: VERIFY_TASK_NAME,
          displayValue: VERIFY_TASK_NAME,
          isTask: true,
          sortOrder: (src.sortOrder ?? 0) + 3,
          automatability: src.automatability,
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
        data: { companyId, processNodeId: n.id, roleId: role.id, role_: 'Owner' },
      });
      await tx.nodeDeliverable.createMany({
        data: delivLinks.map((d) => ({ companyId, processNodeId: n.id, deliverableId: d.deliverableId })),
      });
      return n;
    });
  }
  let k = 0;
  for (const r of rows) {
    k += 1;
    // Promoted to an action row: the actor's own sub-task whose DoD is its
    // Pass-when line (the parser reads Pass when as the DoD fallback).
    await prisma.nodeTemplateAnswer.update({
      where: { id: r.id },
      data: {
        processNodeId: vTask.id,
        kind: 'CHECKLIST',
        customKey: `${k}. Verify ${r.action.charAt(0).toLowerCase()}${r.action.slice(1)}`,
        sortOrder: 100 + k * 10,
      },
    });
  }
  console.log(`verification task "${VERIFY_TASK_NAME}" (${actor}): ${k} sub-tasks moved in`);
}

// ── 2. Narrow every POC task's app links to what its text references ─────────
const allTasks = await prisma.processNode.findMany({
  where: { parentId: PARENT_L4, displayValue: { in: [...POC_TASKS, VERIFY_TASK_NAME] } },
  select: { id: true, displayValue: true },
});
const catalog = await prisma.application.findMany({
  where: { companyId, name: { in: ['Confluence', 'Jira', 'Microsoft Word'] } },
  select: { id: true, name: true },
});
for (const t of allTasks) {
  const answers = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: t.id, templateKeyId: null, NOT: { customKey: null } },
    select: { customKey: true, value: true },
  });
  const text = answers.map((a) => `${a.customKey}\n${a.value ?? ''}`).join('\n');
  const referenced = catalog.filter((c) => new RegExp(`\\b${c.name}\\b`, 'i').test(text));
  const links = await prisma.nodeAppUsage.findMany({
    where: { processNodeId: t.id },
    select: { id: true, applicationId: true },
  });
  const refIds = new Set(referenced.map((r) => r.id));
  const stale = links.filter((l) => !refIds.has(l.applicationId));
  if (stale.length)
    await prisma.nodeAppUsage.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  const have = new Set(links.map((l) => l.applicationId));
  const missing = referenced.filter((r) => !have.has(r.id));
  if (missing.length)
    await prisma.nodeAppUsage.createMany({
      data: missing.map((m) => ({ companyId, processNodeId: t.id, applicationId: m.id, usageType: 'performed' })),
    });
  console.log(`${t.displayValue}: apps = [${referenced.map((r) => r.name).join(', ')}]`);
}
await prisma.$disconnect();
