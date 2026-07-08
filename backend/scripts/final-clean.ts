import { prisma } from '../src/db/prisma.js';
const c = await prisma.company.findFirst({ select: { id: true } });
const companyId = c!.id;
await prisma.$executeRaw`UPDATE public."Jurisdiction" SET name='U.S. Department of Justice (DOJ)', "regulatorName"='U.S. Department of Justice (DOJ)'
  WHERE "companyId"=${companyId} AND code='FED-DOJ'`;
// verify NO duplicate names & NO duplicate codes anywhere
const dupName = await prisma.$queryRaw<{ name: string; n: number }[]>`
  SELECT name, COUNT(*)::int n FROM public."Jurisdiction" WHERE "companyId"=${companyId} GROUP BY name HAVING COUNT(*)>1`;
const dupCode = await prisma.$queryRaw<{ code: string; n: number }[]>`
  SELECT code, COUNT(*)::int n FROM public."Jurisdiction" WHERE "companyId"=${companyId} GROUP BY code HAVING COUNT(*)>1`;
const total = await prisma.jurisdiction.count({ where: { companyId } });
const states = await prisma.jurisdiction.count({
  where: { companyId, regulatorType: 'STATE_INSURANCE_REGULATOR', code: { not: 'NAIC' } },
});
console.log('total jurisdictions:', total, '| states:', states);
console.log('dup names:', dupName, '| dup codes:', dupCode);
await prisma.$disconnect();
