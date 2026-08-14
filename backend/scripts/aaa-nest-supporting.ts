// AAA pilot round 6 — hierarchy instead of 37 flat siblings. Every task the
// pipeline split OUT of an original moves UNDER it as an L6 supporting task
// (ProcessNode self-nesting; closure rebuilt). The five L4-wide verification
// sinks dissolve: each verify row returns to a per-main nested verify task
// ("Verify: <main task>", owned by the verifying actor, dependsOn the main).
// Result: the L4 lists the original mains; each main carries its supporting
// and verification tasks inside it. Idempotent. Run:
//   npx tsx --env-file=.env scripts/aaa-nest-supporting.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237';
const L6_TYPE = 'cmqssmorj0003j6a7a77y7wu7';

// Split task → its source main (from the pipeline run log + the exemplar).
const NEST: Record<string, string> = {
  'Conduct stakeholder workshop, document questions, escalate large stories':
    'Facilitate requirements elicitation workshop',
  'Record data sources and validate volume claims': 'Facilitate current-state discovery workshops',
  'Split any story over the 8-point ceiling in Jira': 'Translate requirements into user stories',
  'Record the Product Owner acceptance of the story set in Jira':
    'Translate requirements into user stories',
  'Link systems to CMDB, document integration points.': 'Assess technical feasibility',
  'Document the non-functional constraints on the record in Jira': 'Assess technical feasibility',
  'Route any not-feasible finding back to the Product Owner in Jira':
    'Assess technical feasibility',
  'Document critical dependencies and fallback plans': 'Identify cross-system dependencies',
  'Resolve every named system dependency to a CI record in CMDB (+1 related)':
    'Identify cross-system dependencies',
  'Document story dispositions and epic sign-offs':
    'Validate requirements with business stakeholders',
  'Prioritize requirements and document sign-off decisions': 'Obtain sign-off on elaborated scope',
  'Link the sign-off record on the initiative epic in Jira': 'Obtain sign-off on elaborated scope',
  'Document compliance obligations and obtain sign-off':
    'Identify applicable compliance requirements',
  'Split requirements traceability matrix documentation subtasks':
    'Produce requirements traceability matrix',
  'Flag high-effort stories and secure engineering approval':
    'Hand elaborated requirements package to engineering team',
  'Draft data flow diagrams, mark trust boundaries, verify systems exist':
    'Model proposed solution flows',
  'Draw the error path for every exception case in GitHub Enterprise':
    'Model proposed solution flows',
  // exemplar trio nests under the doc task
  'Define and quantify the non-functional requirements': 'Document requirements specification',
  'Specify the security requirements in Confluence': 'Document requirements specification',
  'Verify the requirements specification': 'Document requirements specification',
};

const tasks = await prisma.processNode.findMany({
  where: { parentId: L4, isTask: true },
  select: { id: true, displayValue: true, companyId: true, attributes: true, sortOrder: true },
});
const companyId = tasks[0].companyId;
const byName = new Map(tasks.map((t) => [t.displayValue, t]));

async function reparent(nodeId: string, newParentId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.processNode.update({
      where: { id: nodeId },
      data: { parentId: newParentId, processLevelTypeId: L6_TYPE },
    });
    await tx.processNodeClosure.deleteMany({ where: { descendantId: nodeId, depth: { gt: 0 } } });
    const parentAncestors = await tx.processNodeClosure.findMany({
      where: { descendantId: newParentId },
      select: { ancestorId: true, depth: true },
    });
    await tx.processNodeClosure.createMany({
      data: parentAncestors.map((a) => ({
        ancestorId: a.ancestorId,
        descendantId: nodeId,
        depth: a.depth + 1,
      })),
    });
  });
}

// 1. Nest the split tasks under their mains.
for (const [child, parent] of Object.entries(NEST)) {
  const c = byName.get(child);
  const p = byName.get(parent);
  if (!c || !p) continue;
  await reparent(c.id, p.id);
  console.log(`nested "${child}" → under "${parent}"`);
}

// 2. Dissolve the actor sinks into per-main nested verify tasks.
// Map every action row's text → its owning task, to route verify rows home.
const l4TaskIds = new Set(
  (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L4, depth: { gt: 0 } },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId),
);
const allNodes = await prisma.processNode.findMany({
  where: { id: { in: [...l4TaskIds] }, isTask: true },
  select: {
    id: true,
    displayValue: true,
    parentId: true,
    processLevelTypeId: true,
    sortOrder: true,
    automatability: true,
  },
});
const nodeById = new Map(allNodes.map((n) => [n.id, n]));
const mainOf = (id: string): string => {
  const n = nodeById.get(id);
  return n && n.parentId && n.parentId !== L4 ? mainOf(n.parentId) : id;
};
const actionRows = await prisma.nodeTemplateAnswer.findMany({
  where: {
    processNodeId: { in: [...l4TaskIds] },
    templateKeyId: null,
    NOT: { customKey: null },
    OR: [{ kind: null }, { kind: 'CHECKLIST' }],
  },
  select: { processNodeId: true, customKey: true },
});
const taskByAction = new Map<string, string>();
for (const r of actionRows) {
  const m = r.customKey!.match(/^\d+\. (?!Verify[ :])(.+)$/);
  if (m) taskByAction.set(m[1].toLowerCase(), r.processNodeId);
}

const sinks = allNodes.filter((n) => /^Verify elaboration outputs — /.test(n.displayValue));
for (const sink of sinks) {
  const actor = sink.displayValue.replace('Verify elaboration outputs — ', '');
  const roleLink = await prisma.nodeRole.findFirst({
    where: { processNodeId: sink.id, role_: 'Owner' },
    select: { roleId: true },
  });
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: sink.id, templateKeyId: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, customKey: true },
  });
  const perMain = new Map<string, { id: string; action: string }[]>();
  for (const r of rows) {
    const action = r.customKey!.replace(/^\d+\. Verify /, '');
    const lookup = (action.charAt(0).toUpperCase() + action.slice(1)).toLowerCase();
    const ownerTask = taskByAction.get(lookup);
    const main = ownerTask ? mainOf(ownerTask) : null;
    if (!main) {
      console.log(`  unmatched verify row kept on sink: ${r.customKey}`);
      continue;
    }
    perMain.set(main, [...(perMain.get(main) ?? []), { id: r.id, action }]);
  }
  for (const [mainId, list] of perMain) {
    const main = nodeById.get(mainId)!;
    const vName = `Verify: ${main.displayValue}`;
    let vTask = await prisma.processNode.findFirst({
      where: { parentId: mainId, displayValue: vName },
      select: { id: true },
    });
    if (!vTask) {
      vTask = await prisma.$transaction(async (tx) => {
        const n = await tx.processNode.create({
          data: {
            companyId,
            parentId: mainId,
            processLevelTypeId: L6_TYPE,
            dbValue: vName,
            displayValue: vName,
            isTask: true,
            sortOrder: 99,
            automatability: main.automatability,
            attributes: { dependsOn: [mainId] } as Prisma.JsonObject,
          },
          select: { id: true },
        });
        const anc = await tx.processNodeClosure.findMany({
          where: { descendantId: mainId },
          select: { ancestorId: true, depth: true },
        });
        await tx.processNodeClosure.createMany({
          data: [
            { ancestorId: n.id, descendantId: n.id, depth: 0 },
            ...anc.map((a) => ({
              ancestorId: a.ancestorId,
              descendantId: n.id,
              depth: a.depth + 1,
            })),
          ],
        });
        if (roleLink)
          await tx.nodeRole.create({
            data: { companyId, processNodeId: n.id, roleId: roleLink.roleId, role_: 'Owner' },
          });
        const deliv = await tx.nodeDeliverable.findMany({
          where: { processNodeId: mainId },
          select: { deliverableId: true },
        });
        await tx.nodeDeliverable.createMany({
          data: deliv.map((d) => ({
            companyId,
            processNodeId: n.id,
            deliverableId: d.deliverableId,
          })),
        });
        return n;
      });
    }
    const existing = await prisma.nodeTemplateAnswer.count({
      where: { processNodeId: vTask.id, templateKeyId: null },
    });
    let k = existing;
    for (const r of list) {
      k += 1;
      await prisma.nodeTemplateAnswer.update({
        where: { id: r.id },
        data: {
          processNodeId: vTask.id,
          customKey: `${k}. Verify ${r.action}`,
          sortOrder: 100 + k * 10,
        },
      });
    }
    console.log(`verify rows → "${vName}" (${actor}, ${list.length})`);
  }
  const left = await prisma.nodeTemplateAnswer.count({ where: { processNodeId: sink.id } });
  if (left === 0) {
    await prisma.processNode.delete({ where: { id: sink.id } });
    console.log(`sink deleted: ${sink.displayValue}`);
  } else console.log(`sink kept (${left} rows unmatched): ${sink.displayValue}`);
}

// 3. Scrub dangling dependsOn ids (deleted sinks).
const live = new Set(
  (await prisma.processNode.findMany({ where: { companyId }, select: { id: true } })).map(
    (n) => n.id,
  ),
);
const withDeps = await prisma.processNode.findMany({
  where: { companyId, attributes: { path: ['dependsOn'], not: Prisma.DbNull } },
  select: { id: true, attributes: true },
});
for (const t of withDeps) {
  const attrs = (t.attributes ?? {}) as Prisma.JsonObject;
  const dep = attrs.dependsOn;
  if (!Array.isArray(dep)) continue;
  const clean = dep.filter((d): d is string => typeof d === 'string' && live.has(d));
  if (clean.length !== dep.length)
    await prisma.processNode.update({
      where: { id: t.id },
      data: { attributes: { ...attrs, dependsOn: clean } },
    });
}

const top = await prisma.processNode.count({ where: { parentId: L4, isTask: true } });
const nested = await prisma.processNode.count({
  where: { parent: { parentId: L4 }, isTask: true },
});
console.log(
  `\nL4 now lists ${top} main tasks; ${nested} supporting/verify tasks nested inside them`,
);
await prisma.$disconnect();
