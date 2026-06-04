import { PrismaClient } from '@prisma/client';
import { seedDeepLevels } from '../src/seed/illustrative.js';

// One-off: additively seed the deep levels (initiatives, people, assignments,
// person tasks/metrics/signals/app-usage, risks) for every company in the demo
// tenant whose deep levels are still empty. PURELY ADDITIVE — passes clear:false
// so it never deletes; it skips any company that already has people, so it is
// safe to re-run without duplicating rows.
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'strata' }, select: { id: true } });
  if (!tenant) throw new Error('strata tenant not found — run db:seed first');
  const companies = await prisma.company.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
  for (const c of companies) {
    const existing = await prisma.person.count({ where: { companyId: c.id } });
    if (existing > 0) {
      console.log(`Skipping ${c.name}: already has ${existing} people (run a full db:seed to rebuild)`);
      continue;
    }
    console.log('Seeding deep levels for company:', c.name);
    await seedDeepLevels(prisma, { tenantId: tenant.id, companyId: c.id, clear: false });
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
