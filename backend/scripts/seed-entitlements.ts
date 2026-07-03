// Idempotent entitlements seeder — the pipeline's DATA step for RBAC config.
//
// Runs after `prisma migrate deploy` on develop/master (see .github/workflows/
// ci.yml) and is safe to run against ANY environment, including production:
//   • per tenant, upsert the six per-user-type PermissionSets and replace their
//     grants from the single-source matrix (entitlementGrants.ts);
//   • normalise the legacy admin token `role='ADMIN'` → 'SITE_ADMIN' so the
//     bootstrap admin regains access under the RBAC model.
//
// It writes ONLY through the target DATABASE_URL — it performs NO Neon branch
// operations, so it cannot re-parent branches or create a lineage deadlock.
// It creates NO demo users (unlike src/seed/seedPermissions.ts).
//
// Run locally:  npx tsx --env-file=.env scripts/seed-entitlements.ts
import { USER_TYPES } from '@cascade/shared';
import { prisma } from '../src/db/prisma.js';
import { grantsFor } from '../src/seed/entitlementGrants.js';

async function main() {
  // 1. Normalise the legacy admin token so SITE_ADMIN bypass applies.
  const renamed = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { role: 'SITE_ADMIN' },
  });
  if (renamed.count > 0) {
    console.log(`   ~ normalised ${renamed.count} legacy ADMIN user(s) -> SITE_ADMIN`);
  }

  // 2. Upsert the per-user-type permission sets + grants for every tenant.
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  if (tenants.length === 0) {
    console.log('   (no tenants found — nothing to seed)');
    return;
  }

  let setCount = 0;
  let grantCount = 0;
  for (const tenant of tenants) {
    for (const userType of USER_TYPES) {
      const set = await prisma.permissionSet.upsert({
        where: { tenantId_userType: { tenantId: tenant.id, userType } },
        update: {},
        create: { tenantId: tenant.id, userType },
      });
      setCount += 1;
      // Replace-all grants: the matrix is authoritative, so wipe this set's
      // rows and recreate. Scoped to permissionSetId — never a global delete.
      await prisma.permissionGrant.deleteMany({ where: { permissionSetId: set.id } });
      const grants = grantsFor(userType);
      if (grants.length > 0) {
        await prisma.permissionGrant.createMany({
          data: grants.map((g) => ({ ...g, permissionSetId: set.id })),
        });
        grantCount += grants.length;
      }
    }
  }
  console.log(
    `   + ${setCount} permission set(s), ${grantCount} grant(s) across ${tenants.length} tenant(s)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
