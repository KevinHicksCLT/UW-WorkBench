// Reseed ONLY the Forms module (SCRUM-229): wholesale-replaces PolicyForm and
// every dependent surface for the active company, regenerates the per-product
// form families + FormProductNode links and strips legacy attribute-borne form
// lists from the product spine. Run from backend/:
//   npx tsx --env-file=.env scripts/reseed-forms.ts
import { prisma } from '../src/db/prisma.js';
import { seedForms } from '../src/seed/seedForms.js';

const company = await prisma.company.findFirst({
  orderBy: { createdAt: 'asc' },
  select: { id: true, tenantId: true, name: true },
});
if (!company) throw new Error('No company found');
console.log(`Reseeding forms for ${company.name} (${company.id})…`);
await seedForms(prisma, { tenantId: company.tenantId, companyId: company.id });
const [forms, versions, clauses, productLinks, processLinks, appLinks] = await Promise.all([
  prisma.policyForm.count({ where: { companyId: company.id } }),
  prisma.policyFormVersion.count({ where: { companyId: company.id } }),
  prisma.formClause.count({ where: { companyId: company.id } }),
  prisma.formProductNode.count({ where: { companyId: company.id } }),
  prisma.formProcessNode.count({ where: { companyId: company.id } }),
  prisma.formApplication.count({ where: { companyId: company.id } }),
]);
console.log({ forms, versions, clauses, productLinks, processLinks, appLinks });
await prisma.$disconnect();
