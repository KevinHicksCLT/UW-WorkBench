/** Print one compliance item's applied plan (generic answers + specific steps) by item code. */
import { prisma } from '../src/db/prisma.js';

const code = process.argv[2] ?? 'REG-020-C03';

async function main() {
  const item = await prisma.complianceItem.findFirst({
    where: { itemCode: code },
    select: { id: true, itemCode: true, name: true },
  });
  if (!item) return console.log('not found');
  console.log(`${item.itemCode} — ${item.name}\n`);

  const answers = await prisma.complianceItemTemplateAnswer.findMany({
    where: { complianceItemId: item.id },
    include: { templateKey: { select: { key: true, template: { select: { kind: true } } } } },
    orderBy: [{ sortOrder: 'asc' }],
  });
  const generic = answers.filter((a) => a.templateKeyId);
  const custom = answers.filter((a) => !a.templateKeyId);
  console.log(
    `generic=${generic.length} checklistSteps=${
      custom.filter((c) => c.kind === 'CHECKLIST').length
    } testSteps=${custom.filter((c) => c.kind === 'TEST').length}\n`,
  );

  for (const g of generic.slice(0, 4)) console.log(`  [${g.templateKey?.key}] ${g.value ?? ''}`);
  for (const kind of ['CHECKLIST', 'TEST'] as const) {
    const rows = custom.filter((c) => c.kind === kind).slice(0, 2);
    console.log(`\n── ${kind} (first 2) ──`);
    for (const r of rows) console.log(`\n${r.customKey}\n${r.value ?? ''}`);
  }
}

main().finally(() => prisma.$disconnect());
