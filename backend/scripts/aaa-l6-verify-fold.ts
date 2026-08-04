// Round-7 finisher: fold the surviving round-6 verification rows into the new
// L6 actions' Definitions of Done — the reviewed format "Done when in <App>
// <pass condition>" — then delete the emptied leftover tasks. A verify row
// matches its action by name ("k. Verify <action>" → the L6 row whose key ends
// with <action>); unmatched leftover ACTION rows append to the same-actor L6.
// Run: npx tsx --env-file=.env scripts/aaa-l6-verify-fold.ts
import { prisma } from '../src/db/prisma.js';

const L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237';

const mains = await prisma.processNode.findMany({
  where: { parentId: L4, isTask: true },
  select: { id: true, displayValue: true, companyId: true },
});
const catalog = await prisma.application.findMany({
  where: { companyId: mains[0].companyId },
  select: { name: true },
});
const appNames = catalog.map((c) => c.name);

let folded = 0;
let appended = 0;
for (const main of mains) {
  const children = await prisma.processNode.findMany({
    where: { parentId: main.id, isTask: true },
    select: {
      id: true,
      displayValue: true,
      attributes: true,
      nodeRoles: {
        where: { role_: 'Owner' },
        select: { role: { select: { displayValue: true } } },
      },
    },
  });
  // New L6s were minted by the regroup (sortOrder 1..n, no marker needed):
  // leftovers are the ones still holding "Verify"-style rows or stray actions.
  const l6Rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: children.map((c) => c.id) }, templateKeyId: null },
    select: { id: true, processNodeId: true, customKey: true, value: true },
  });
  const actionRows = l6Rows.filter((r) => !/^\d+\. Verify[ :]/.test(r.customKey ?? ''));
  const leftoverRows = l6Rows.filter((r) => /^\d+\. Verify[ :]/.test(r.customKey ?? ''));

  for (const r of leftoverRows) {
    const action = r.customKey!.replace(/^\d+\. Verify[ :]\s*/, '').trim();
    const target = actionRows.find(
      (a) =>
        a
          .customKey!.replace(/^\d+\. /, '')
          .trim()
          .toLowerCase() === action.toLowerCase(),
    );
    const passWhen = r.value?.match(/^Pass when (.+)$/im)?.[1]?.trim() ?? null;
    if (target && passWhen) {
      const app =
        appNames.find((n) =>
          new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
            target.value ?? '',
          ),
        ) ?? null;
      const dod = `Done when${app ? ` in ${app}` : ''} ${passWhen}`;
      const newValue = /^Done when /im.test(target.value ?? '')
        ? target.value!.replace(/^Done when .+$/im, dod)
        : `${target.value ?? ''}\n${dod}`;
      await prisma.nodeTemplateAnswer.update({
        where: { id: target.id },
        data: { value: newValue },
      });
      await prisma.nodeTemplateAnswer.delete({ where: { id: r.id } });
      folded += 1;
    } else if (!target) {
      // A stray real action that merely STARTS with "Verify" — append it to
      // the same-actor L6 under this main.
      const actor = r.value?.match(/^By the ([^:\n]+):?$/im)?.[1]?.trim();
      const home = children.find(
        (c) =>
          c.nodeRoles[0]?.role.displayValue === actor &&
          actionRows.some((a) => a.processNodeId === c.id),
      );
      if (home && actor) {
        const count = await prisma.nodeTemplateAnswer.count({
          where: { processNodeId: home.id, templateKeyId: null },
        });
        await prisma.nodeTemplateAnswer.update({
          where: { id: r.id },
          data: {
            processNodeId: home.id,
            customKey: `${count + 1}. ${r.customKey!.replace(/^\d+\. /, '')}`,
            sortOrder: 100 + (count + 1) * 10,
          },
        });
        appended += 1;
      }
    }
  }
  // Delete leftover tasks emptied of rows.
  for (const c of children) {
    const left = await prisma.nodeTemplateAnswer.count({ where: { processNodeId: c.id } });
    if (left === 0) {
      await prisma.processNode.delete({ where: { id: c.id } });
      console.log(`deleted emptied: ${c.displayValue} (under ${main.displayValue})`);
    }
  }
}
const l6 = await prisma.processNode.count({ where: { parent: { parentId: L4 }, isTask: true } });
console.log(
  `folded ${folded} verify rows into DoDs, appended ${appended} stray actions; L6 count now ${l6}`,
);
await prisma.$disconnect();
