import { PrismaClient } from '@prisma/client';
import { seedWork } from '../src/seed/work.js';

// One-off: seed only Deliverables & Tasks for every company in the demo tenant,
// without wiping the rest of the operating model. Safe to re-run (idempotent).
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'strata' }, select: { id: true } });
  if (!tenant) throw new Error('strata tenant not found — run db:seed first');
  const companies = await prisma.company.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
  for (const c of companies) {
    console.log('Seeding work for company:', c.name);
    await seedWork(prisma, { tenantId: tenant.id, companyId: c.id });
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
