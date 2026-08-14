// Rollout finisher: actions whose text itself starts with "Verify" were
// conservatively held back as verification pairs and stranded on their L5.
// Each pair (CHECKLIST "N. Verify <x>" + TEST "N. Verify: Verify <x>") rehomes:
// the action appends to the same-actor L6 under its main with the DoD merged
// from the pair's Pass-when; the TEST row is deleted. If the main has no L6
// for that actor, one is created. Idempotent.
// Run: npx tsx --env-file=.env scripts/aaa-tech-strays.ts [l2Id]
import { prisma } from '../src/db/prisma.js';

const L2 = process.argv[2] ?? 'bb67119f-5481-4e4b-9314-0a46acae47e6';
const L6_TYPE = 'cmqssmorj0003j6a7a77y7wu7';

const closure = await prisma.processNodeClosure.findMany({
  where: { ancestorId: L2, depth: 3 },
  select: { descendantId: true },
});
const l5Ids = closure.map((c) => c.descendantId);
const mains = await prisma.processNode.findMany({
  where: { id: { in: l5Ids }, isTask: true },
  select: { id: true, displayValue: true, companyId: true, automatability: true },
});
const companyId = mains[0].companyId;
const catalog = await prisma.application.findMany({
  where: { companyId },
  select: { id: true, name: true },
});

let moved = 0;
let folded = 0;
for (const main of mains) {
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: main.id, templateKeyId: null, customKey: { contains: '. Verify' } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, customKey: true, kind: true, value: true },
  });
  if (!rows.length) continue;
  const actions = rows.filter((r) => r.kind !== 'TEST' && !/\. Verify: /.test(r.customKey!));
  const tests = rows.filter((r) => r.kind === 'TEST' || /\. Verify: /.test(r.customKey!));

  const children = await prisma.processNode.findMany({
    where: { parentId: main.id, isTask: true },
    select: {
      id: true,
      sortOrder: true,
      nodeRoles: {
        where: { role_: 'Owner' },
        select: { role: { select: { id: true, displayValue: true } } },
      },
    },
  });

  for (const a of actions) {
    const n = Number(a.customKey!.match(/^(\d+)\./)?.[1]);
    const action = a.customKey!.replace(/^\d+\. /, '');
    const actor = a.value?.match(/^By the ([^:\n]+):?$/im)?.[1]?.trim() ?? 'Unknown';
    const pair = tests.find((t) => Number(t.customKey!.match(/^(\d+)\./)?.[1]) === n);
    const passWhen = pair?.value?.match(/^Pass when (.+)$/im)?.[1]?.trim() ?? null;

    let home = children.find((c) => c.nodeRoles[0]?.role.displayValue === actor);
    if (!home) {
      let role = await prisma.role.findFirst({
        where: { companyId, displayValue: actor },
        select: { id: true },
      });
      role ??= await prisma.role.create({
        data: { companyId, dbValue: actor, displayValue: actor },
        select: { id: true },
      });
      const sort = Math.max(0, ...children.map((c) => c.sortOrder ?? 0)) + 1;
      const anc = await prisma.processNodeClosure.findMany({
        where: { descendantId: main.id },
        select: { ancestorId: true, depth: true },
      });
      const name = `Verification & checks — ${actor}`;
      const created = await prisma.$transaction(async (tx) => {
        const node = await tx.processNode.create({
          data: {
            companyId,
            parentId: main.id,
            processLevelTypeId: L6_TYPE,
            dbValue: name,
            displayValue: name,
            isTask: true,
            sortOrder: sort,
            automatability: main.automatability,
          },
          select: { id: true },
        });
        await tx.processNodeClosure.createMany({
          data: [
            { ancestorId: node.id, descendantId: node.id, depth: 0 },
            ...anc.map((x) => ({
              ancestorId: x.ancestorId,
              descendantId: node.id,
              depth: x.depth + 1,
            })),
          ],
        });
        await tx.nodeRole.create({
          data: { companyId, processNodeId: node.id, roleId: role!.id, role_: 'Owner' },
        });
        return node;
      });
      home = {
        id: created.id,
        sortOrder: sort,
        nodeRoles: [{ role: { id: '', displayValue: actor } }],
      };
      children.push(home);
    }
    const count = await prisma.nodeTemplateAnswer.count({
      where: { processNodeId: home.id, templateKeyId: null },
    });
    // Rebuild the body with the merged DoD.
    const bodyLines = (a.value ?? '').split(/\r?\n/).filter((l) => !/^Done when /i.test(l.trim()));
    const steps = bodyLines.filter((l) => /^\d+\)/.test(l.trim()));
    const cond = passWhen ?? a.value?.match(/^Done when (.+)$/im)?.[1] ?? 'the check passes';
    const app = catalog.find((c) =>
      new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(a.value ?? ''),
    );
    const value = [
      `By the ${actor}:`,
      ...steps,
      `Done when${app ? ` in ${app.name}` : ''} ${cond}`,
    ].join('\n');
    await prisma.nodeTemplateAnswer.update({
      where: { id: a.id },
      data: {
        processNodeId: home.id,
        customKey: `${count + 1}. ${action}`,
        value,
        kind: 'CHECKLIST',
        sortOrder: 100 + (count + 1) * 10,
      },
    });
    moved += 1;
    if (pair) {
      await prisma.nodeTemplateAnswer.delete({ where: { id: pair.id } });
      folded += 1;
    }
    // App link on the home L6 if newly referenced.
    if (app) {
      const has = await prisma.nodeAppUsage.findFirst({
        where: { processNodeId: home.id, applicationId: app.id },
        select: { id: true },
      });
      if (!has)
        await prisma.nodeAppUsage.create({
          data: {
            companyId,
            processNodeId: home.id,
            applicationId: app.id,
            usageType: 'performed',
          },
        });
    }
  }
  // Any orphan TEST rows left (action matched elsewhere or missing): delete —
  // their content is the Pass-when now carried by the action DoDs.
  const orphanTests = await prisma.nodeTemplateAnswer.findMany({
    where: {
      processNodeId: main.id,
      templateKeyId: null,
      kind: 'TEST',
      customKey: { contains: '. Verify' },
    },
    select: { id: true },
  });
  for (const o of orphanTests) await prisma.nodeTemplateAnswer.delete({ where: { id: o.id } });
}
console.log(`strays rehomed: ${moved} actions moved, ${folded} verify pairs folded`);
const left = await prisma.nodeTemplateAnswer.count({
  where: { processNodeId: { in: l5Ids }, customKey: { contains: '. Verify' } },
});
console.log('remaining Verify-keyed rows on L5s:', left);
await prisma.$disconnect();
