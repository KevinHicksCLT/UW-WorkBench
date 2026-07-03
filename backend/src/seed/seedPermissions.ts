// ── Permission sets + demo users (entitlements) ──
// Creates the six per-user-type PermissionSets for the tenant and a demo user
// per user type so every entitlement path is exercisable after a reseed.
// Grant defaults:
//   SITE_ADMIN                — no rows (middleware bypass: always full access)
//   domain admins             — full CRUD on every data tab + full user-admin
//   SUPER_USER                — full CRUD on every data tab, NO user/data admin
//   MEMBER                    — read-only on every data tab
// Data tabs = every top-level MENU_TREE key except data-admin / user-admin.
// Idempotent: sets are upserted and their grants replaced wholesale.
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DOMAIN_ADMIN_SCOPE, USER_TYPES, type UserType } from '@cascade/shared';
import { grantsFor } from './entitlementGrants.js';

export async function seedPermissions(
  p: PrismaClient,
  ctx: { tenantId: string; companyId: string },
) {
  for (const userType of USER_TYPES) {
    const set = await p.permissionSet.upsert({
      where: { tenantId_userType: { tenantId: ctx.tenantId, userType } },
      update: {},
      create: { tenantId: ctx.tenantId, userType },
    });
    await p.permissionGrant.deleteMany({ where: { permissionSetId: set.id } });
    const grants = grantsFor(userType);
    if (grants.length > 0) {
      await p.permissionGrant.createMany({
        data: grants.map((g) => ({ ...g, permissionSetId: set.id })),
      });
    }
  }
  console.log(`   + ${USER_TYPES.length} permission sets`);

  // L1 anchors — the same dbValues DOMAIN_ADMIN_SCOPE points at.
  const l1s = await p.orgUnit.findMany({
    where: { companyId: ctx.companyId, dbValue: { in: Object.values(DOMAIN_ADMIN_SCOPE) } },
    select: { id: true, dbValue: true },
  });
  const l1 = (dbValue: string) => l1s.find((u) => u.dbValue === dbValue)?.id ?? null;
  const password = await bcrypt.hash('demo1234', 10);

  const demoUsers: {
    email: string;
    name: string;
    role: UserType;
    org: string | null;
    isManager: boolean;
  }[] = [
    {
      email: 'core.admin@abc-insurance.demo',
      name: 'Cora Marsh',
      role: 'CORE_BUSINESS_ADMIN',
      org: 'Core Business',
      isManager: true,
    },
    {
      email: 'tech.admin@abc-insurance.demo',
      name: 'Ted Novak',
      role: 'TECHNOLOGY_ADMIN',
      org: 'Technology',
      isManager: true,
    },
    {
      email: 'corp.admin@abc-insurance.demo',
      name: 'Cory Fielding',
      role: 'CORPORATE_FUNCTIONS_ADMIN',
      org: 'Corporate Functions',
      isManager: true,
    },
    {
      email: 'super.user@abc-insurance.demo',
      name: 'Sue Prue',
      role: 'SUPER_USER',
      org: 'Technology',
      isManager: false,
    },
    {
      email: 'member@abc-insurance.demo',
      name: 'Mel Member',
      role: 'MEMBER',
      org: 'Core Business',
      isManager: false,
    },
  ];
  for (const u of demoUsers) {
    const orgUnitId = u.org ? l1(u.org) : null;
    await p.user.upsert({
      where: { email: u.email },
      // Reseeds recreate the company (cascade nulls orgUnitId) — restore it.
      update: {
        role: u.role,
        orgUnitId,
        geography: 'NORTH_AMERICA',
        isManager: u.isManager,
        status: 'ACTIVE',
      },
      create: {
        tenantId: ctx.tenantId,
        email: u.email,
        name: u.name,
        password,
        role: u.role,
        orgUnitId,
        geography: 'NORTH_AMERICA',
        isManager: u.isManager,
        isApprover: u.isManager,
      },
    });
  }
  console.log(`   + ${demoUsers.length} demo users (…@abc-insurance.demo / demo1234)`);

  // Kevin — SITE_ADMIN with a full attribute profile (also repairs role for
  // environments where the ADMIN→SITE_ADMIN data migration hasn't run).
  await p.user.update({
    where: { email: 'kevin.hicks@capgemini.com' },
    data: {
      role: 'SITE_ADMIN',
      orgUnitId: l1('Technology'),
      geography: 'NORTH_AMERICA',
      isManager: true,
      isApprover: true,
      status: 'ACTIVE',
    },
  });
}
