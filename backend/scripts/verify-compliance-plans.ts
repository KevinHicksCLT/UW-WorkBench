/** Verify applied compliance plans: per-item completeness and step-shape defects. */
import { prisma } from '../src/db/prisma.js';

async function main() {
  const rows = await prisma.complianceItemTemplateAnswer.findMany({
    select: {
      complianceItemId: true,
      templateKeyId: true,
      kind: true,
      value: true,
      customKey: true,
      complianceItem: { select: { itemCode: true } },
    },
  });
  type Acc = { generic: number; checklist: number; test: number; badShape: number; blank: number };
  const byItem = new Map<string, Acc>();
  for (const r of rows) {
    const code = r.complianceItem.itemCode;
    const a = byItem.get(code) ?? { generic: 0, checklist: 0, test: 0, badShape: 0, blank: 0 };
    if (r.templateKeyId) {
      a.generic++;
      if (!r.value?.trim()) a.blank++;
    } else {
      if (r.kind === 'TEST') a.test++;
      else a.checklist++;
      const lines = (r.value ?? '').split('\n').filter((l) => l.trim());
      // A well-formed specific step is: By the <role>: / atomic actions / Done when …
      const ok =
        lines.length >= 3 &&
        /^By the .+:$/.test(lines[0]) &&
        /^(Done|Pass) when\b/i.test(lines[lines.length - 1]);
      if (!ok) a.badShape++;
    }
    byItem.set(code, a);
  }

  const items = [...byItem.entries()];
  const short = items.filter(([, a]) => a.generic < 18 || a.checklist < 15 || a.test < 10);
  const badShape = items.filter(([, a]) => a.badShape > 0);
  const blanks = items.filter(([, a]) => a.blank > 0);
  console.log(`itemsWithPlans=${items.length}`);
  console.log(`under-target (generic<18 | checklist<15 | test<10) = ${short.length}`);
  for (const [code, a] of short.slice(0, 25))
    console.log(`  ${code}: generic=${a.generic} checklist=${a.checklist} test=${a.test}`);
  console.log(`items with malformed step values = ${badShape.length}`);
  for (const [code, a] of badShape.slice(0, 15)) console.log(`  ${code}: ${a.badShape} steps`);
  console.log(`items with blank generic answers = ${blanks.length}`);
  for (const [code, a] of blanks.slice(0, 15)) console.log(`  ${code}: ${a.blank} blank`);
}

main().finally(() => prisma.$disconnect());
