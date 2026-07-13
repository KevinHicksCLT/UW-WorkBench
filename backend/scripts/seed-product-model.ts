// Targeted Product-Model-Workspace seed runner (Agent 1, PM-02).
//
// Applies ONLY the new/refreshed workspace seed modules to the ACTIVE database
// (backend/.env) without touching anything else — the full `npm run db:seed`
// would wipe + rebuild the whole company and destroy pilot data applied by
// one-off scripts. Each module is idempotent (wholesale replace per company;
// the rationalization refresh replaces illustrative boards only, preserving
// user-authored boards like "Transformation Bridge — Self Anatomy").
//
// Run from backend/:  npx tsx --env-file=.env scripts/seed-product-model.ts
import { prisma } from '../src/db/prisma.js';
import { resolveSpineRefs } from '../src/seed/resolveSpineRefs.js';
import { seedWorkspaceVocabulary } from '../src/seed/seedWorkspaceVocabulary.js';
import { seedProductModelAnatomy } from '../src/seed/seedProductModelAnatomy.js';
import { seedProductModel } from '../src/seed/productModel.js';
import { seedRationalization } from '../src/seed/rationalization.js';

async function main() {
  const company = await prisma.company.findFirst({
    where: { slug: 'abc-insurance' },
    select: { id: true, tenantId: true, name: true },
  });
  if (!company) throw new Error('Company abc-insurance not found on the active database');
  const ctx = { tenantId: company.tenantId, companyId: company.id };
  console.log(`Seeding Product Model Workspace data for ${company.name} (${company.id})`);

  console.log('▶ seedWorkspaceVocabulary …');
  await seedWorkspaceVocabulary(prisma, ctx);

  console.log('▶ seedProductModelAnatomy …');
  await seedProductModelAnatomy(prisma, ctx);

  const refs = await resolveSpineRefs(prisma, company.id);

  console.log('▶ seedProductModel (demo workspace) …');
  await seedProductModel(prisma, { ...ctx, refs });

  console.log('▶ seedRationalization (app-board v3 refresh) …');
  await seedRationalization(prisma, { ...ctx, refs });

  const c = company.id;
  const counts = {
    workspaceVocabulary: await prisma.workspaceVocabulary.count({ where: { companyId: c } }),
    productModelAnatomyCategory: await prisma.productModelAnatomyCategory.count({
      where: { companyId: c },
    }),
    productModelWorkspace: await prisma.productModelWorkspace.count({ where: { companyId: c } }),
    legacyProductModel: await prisma.legacyProductModel.count({ where: { companyId: c } }),
    productModelFinding: await prisma.productModelFinding.count({ where: { companyId: c } }),
    productModelNormalizationEntry: await prisma.productModelNormalizationEntry.count({
      where: { companyId: c },
    }),
    productModelComponent: await prisma.productModelComponent.count({ where: { companyId: c } }),
    canonicalProductModel: await prisma.canonicalProductModel.count({ where: { companyId: c } }),
    normalizationEntry: await prisma.normalizationEntry.count({ where: { companyId: c } }),
    rationalizationWorkspace: await prisma.rationalizationWorkspace.count({
      where: { companyId: c },
    }),
    rationalizationCapability: await prisma.rationalizationCapability.count({
      where: { companyId: c },
    }),
    deadCodeFindings: await prisma.rationalizationCapability.count({
      where: { companyId: c, deadCode: true },
    }),
  };
  console.log('\n── Row counts ──');
  for (const [k, v] of Object.entries(counts)) console.log(`   ${k.padEnd(32)} ${v}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
