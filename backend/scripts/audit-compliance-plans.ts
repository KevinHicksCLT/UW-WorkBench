/** Audit: which WorkTemplates exist and how much compliance-plan content is filled in. */
import { prisma } from '../src/db/prisma.js';

async function main() {
  const templates = await prisma.workTemplate.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    include: {
      keys: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { complianceLinks: true } },
    },
  });
  for (const t of templates) {
    console.log(
      `[${t.kind}] ${t.name} (default=${t.isDefault}) complianceLinks=${t._count.complianceLinks} keys=${t.keys.length}`,
    );
    for (const k of t.keys) console.log(`    - ${k.key} [${k.valueKind}] :: ${k.guidance ?? ''}`);
  }

  const itemCount = await prisma.complianceItem.count();
  const withTemplates = await prisma.complianceItemWorkTemplate.groupBy({
    by: ['complianceItemId'],
    _count: true,
  });
  const answers = await prisma.complianceItemTemplateAnswer.groupBy({
    by: ['complianceItemId'],
    _count: true,
  });
  const customAnswers = await prisma.complianceItemTemplateAnswer.count({
    where: { customKey: { not: null } },
  });
  console.log(
    `\nitems=${itemCount} itemsWithTemplates=${withTemplates.length} itemsWithAnswers=${answers.length} customStepRows=${customAnswers}`,
  );

  const regs = await prisma.complianceRegulation.findMany({
    orderBy: { regCode: 'asc' },
    select: {
      regCode: true,
      name: true,
      category: true,
      ownerTeam: true,
      _count: { select: { items: true } },
    },
  });
  console.log(`\nregulations=${regs.length}`);
  for (const r of regs.slice(0, 60))
    console.log(
      `  ${r.regCode} ${r.name} | ${r.category} | ${r.ownerTeam} | items=${r._count.items}`,
    );
}

main().finally(() => prisma.$disconnect());
