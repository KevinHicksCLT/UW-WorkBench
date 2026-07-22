/** Dump one compliance item with its regulation + L3 source rows, for plan authoring. */
import { prisma } from '../src/db/prisma.js';

const code = process.argv[2] ?? 'REG-018-C01';

async function main() {
  const item = await prisma.complianceItem.findFirst({
    where: { itemCode: code },
    include: {
      regulation: true,
      requirementLinks: { include: { requirement: true } },
    },
  });
  if (!item) return console.log('not found');
  const { regulation, requirementLinks, ...rest } = item;
  console.log('ITEM', JSON.stringify(rest, null, 2));
  console.log('REGULATION', JSON.stringify(regulation, null, 2));
  console.log('LINKED L3 ROWS', requirementLinks.length);

  const siblings = await prisma.complianceItem.findMany({
    where: { regulationId: item.regulationId },
    orderBy: { itemCode: 'asc' },
    select: { itemCode: true, name: true, frequency: true, evidence: true, ownerTeam: true },
  });
  console.log('SIBLINGS', JSON.stringify(siblings, null, 2));

  const l3 = await prisma.regulatoryRequirement.findMany({
    where: { complianceRegulationId: item.regulationId },
    take: 6,
    select: { title: true, citation: true, jurisdiction: true, description: true, sourceUrl: true },
  });
  console.log('SAMPLE L3 SOURCES', JSON.stringify(l3, null, 2));
}

main().finally(() => prisma.$disconnect());
