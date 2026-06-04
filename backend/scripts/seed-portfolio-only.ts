import { PrismaClient } from '@prisma/client';
import { seedPortfolio } from '../src/seed/portfolio.js';

// One-off: seed the Initiative Tracker (Program → Workstream →
// PortfolioInitiative + benefit/cost lines, milestones, RAID) for every company
// in the demo tenant whose portfolio is still empty. PURELY ADDITIVE — it skips
// any company that already has programs, so it is safe to re-run without
// duplicating rows (run a full db:seed to rebuild a company from scratch).
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'strata' }, select: { id: true } });
  if (!tenant) throw new Error('strata tenant not found — run db:seed first');

  const companies = await prisma.company.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
  for (const c of companies) {
    const existing = await prisma.program.count({ where: { companyId: c.id } });
    if (existing > 0) {
      console.log(`Skipping ${c.name}: already has ${existing} program(s) (run a full db:seed to rebuild)`);
      continue;
    }
    console.log('Seeding portfolio for company:', c.name);
    await seedPortfolio(prisma, { tenantId: tenant.id, companyId: c.id });
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
