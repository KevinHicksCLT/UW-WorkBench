import { prisma } from '../src/db/prisma.js';
const c = await prisma.company.findFirst({ select: { id: true } });
const companyId = c!.id;
const keep = await prisma.jurisdiction.findFirst({
  where: { companyId, code: 'FED-SEC' },
  select: { id: true },
});
const dupe = await prisma.jurisdiction.findFirst({
  where: { companyId, code: 'SEC', regulatorType: 'FEDERAL_SECURITIES' },
  select: { id: true },
});
if (!keep || !dupe) {
  console.log('nothing to merge', { keep: !!keep, dupe: !!dupe });
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  const K = keep.id,
    D = dupe.id;
  await tx.$executeRaw`UPDATE public."RegulatoryRequirement" SET "jurisdictionId"=${K} WHERE "jurisdictionId"=${D}`;
  await tx.$executeRaw`UPDATE public."RegulatoryBulletin"    SET "jurisdictionId"=${K} WHERE "jurisdictionId"=${D}`;
  await tx.$executeRaw`UPDATE public."ComplianceRule"        SET "jurisdictionId"=${K} WHERE "jurisdictionId"=${D}`;
  await tx.$executeRaw`UPDATE public."RegulatorySource"      SET "jurisdictionId"=${K} WHERE "jurisdictionId"=${D}`;
  // integration has a unique(jurisdictionId,systemId,scope) — move only non-colliding, drop the rest
  await tx.$executeRaw`
    UPDATE public."JurisdictionIntegration" d SET "jurisdictionId"=${K}
    WHERE d."jurisdictionId"=${D}
      AND NOT EXISTS (SELECT 1 FROM public."JurisdictionIntegration" k
        WHERE k."jurisdictionId"=${K} AND k."systemId"=d."systemId" AND k.scope=d.scope)`;
  await tx.$executeRaw`DELETE FROM public."JurisdictionIntegration" WHERE "jurisdictionId"=${D}`;
  await tx.$executeRaw`DELETE FROM public."Jurisdiction" WHERE id=${D}`;
});

// clean securities display names to match the FED-* convention (name = regulatorName)
await prisma.$executeRaw`UPDATE public."Jurisdiction" SET name="regulatorName"
  WHERE "companyId"=${companyId} AND "regulatorType"='FEDERAL_SECURITIES' AND "regulatorName" IS NOT NULL AND "regulatorName" <> ''`;

const after = await prisma.jurisdiction.findMany({
  where: { companyId, regulatorType: { in: ['FEDERAL', 'FEDERAL_SECURITIES'] } },
  select: {
    code: true,
    name: true,
    regulatorType: true,
    _count: { select: { requirements: true } },
  },
  orderBy: { code: 'asc' },
});
console.log('AFTER — federal rows:', after.length);
for (const j of after)
  console.log(`${j.code}\t${j.regulatorType}\treqs=${j._count.requirements}\t${j.name}`);
await prisma.$disconnect();
