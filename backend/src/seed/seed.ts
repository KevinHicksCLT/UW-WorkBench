/**
 * Standalone seed — the minimal operating-model catalog the UW domain joins
 * against (tenant, company, users, roles with a manager chain, org units,
 * PAS applications, the Underwriting value-stream node), then the full UW
 * demo estate via seedUwWorkbench (wireframe scenarios AS-114/201/090,
 * GR-2201, AG-31/12, SUB-88121..). Idempotent: catalog rows upsert by their
 * natural keys; the UW domain is delete-then-recreate per company.
 *
 * Demo login: kevin.hicks@capgemini.com / demo1234 (SITE_ADMIN, operating
 * role = Chief Underwriting Officer, so the CUO gate INV-6 and dual-control
 * release INV-4 are exercisable out of the box).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedUwWorkbench } from './seedUwWorkbench.js';

const prisma = new PrismaClient();

async function ensureRole(companyId: string, dbValue: string, displayValue: string, managerRoleId?: string) {
  const existing = await prisma.role.findFirst({ where: { companyId, dbValue } });
  if (existing) {
    return prisma.role.update({
      where: { id: existing.id },
      data: { displayValue, managerRoleId: managerRoleId ?? null },
    });
  }
  return prisma.role.create({ data: { companyId, dbValue, displayValue, managerRoleId } });
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'uw-workbench' },
    update: {},
    create: { name: 'UW WorkBench', slug: 'uw-workbench' },
  });

  const company = await prisma.company.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'demo-carrier' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Demo Carrier', slug: 'demo-carrier' },
  });

  // Org units — first by sortOrder is the appetite owner the UW seeder picks.
  const property = await prisma.orgUnit.findFirst({ where: { companyId: company.id, dbValue: 'property' } })
    ?? await prisma.orgUnit.create({
      data: { companyId: company.id, dbValue: 'property', displayValue: 'Property', sortOrder: 0 },
    });
  if (!(await prisma.orgUnit.findFirst({ where: { companyId: company.id, dbValue: 'casualty' } }))) {
    await prisma.orgUnit.create({
      data: { companyId: company.id, dbValue: 'casualty', displayValue: 'Casualty', sortOrder: 1 },
    });
  }

  // Roles catalog with the solid-line manager chain the referral resolver
  // walks (INV-1 auto-referral → escalation): Underwriter → Senior
  // Underwriter → Chief Underwriting Officer.
  const cuo = await ensureRole(company.id, 'chief-underwriting-officer', 'Chief Underwriting Officer');
  const senior = await ensureRole(company.id, 'senior-underwriter', 'Senior Underwriter', cuo.id);
  const underwriter = await ensureRole(company.id, 'underwriter', 'Underwriter', senior.id);

  // PAS bind targets (kind SystemOfRecord is what the UW seeder looks for).
  for (const app of [
    { code: 'PAS', name: 'Policy Administration System', kind: 'SystemOfRecord' },
    { code: 'RATE', name: 'Rating Engine', kind: 'Service' },
  ]) {
    if (!(await prisma.application.findFirst({ where: { companyId: company.id, name: app.name } }))) {
      await prisma.application.create({ data: { companyId: company.id, ...app } });
    }
  }

  // The value stream submissions flow through (Submission→ProcessNode).
  if (!(await prisma.processNode.findFirst({ where: { companyId: company.id, dbValue: 'underwriting' } }))) {
    await prisma.processNode.create({
      data: { companyId: company.id, dbValue: 'underwriting', displayValue: 'Underwriting' },
    });
  }

  const password = await bcrypt.hash('demo1234', 10);
  await prisma.user.upsert({
    where: { email: 'kevin.hicks@capgemini.com' },
    update: { operatingRoleId: cuo.id, orgUnitId: property.id },
    create: {
      tenantId: tenant.id,
      email: 'kevin.hicks@capgemini.com',
      name: 'Kevin Hicks',
      password,
      role: 'SITE_ADMIN',
      status: 'ACTIVE',
      operatingRoleId: cuo.id,
      orgUnitId: property.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'underwriter@demo-carrier.io' },
    update: { operatingRoleId: underwriter.id, orgUnitId: property.id },
    create: {
      tenantId: tenant.id,
      email: 'underwriter@demo-carrier.io',
      name: 'Dana Marsh',
      password,
      role: 'MEMBER',
      status: 'ACTIVE',
      operatingRoleId: underwriter.id,
      orgUnitId: property.id,
    },
  });

  await seedUwWorkbench(prisma, { tenantId: tenant.id, companyId: company.id });

  console.log('Seed complete — login kevin.hicks@capgemini.com / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
