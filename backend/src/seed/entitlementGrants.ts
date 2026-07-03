// Single source of truth for the per-user-type PermissionSet grant matrix.
// Both the full reseed (seedPermissions.ts) and the pipeline entitlements
// seeder (scripts/seed-entitlements.ts) build grants from here so the two can
// never drift.
//
// Grant defaults:
//   SITE_ADMIN     — no rows (permissionService bypass: always full access)
//   domain admins  — full CRUD on every data tab + full user-admin
//   SUPER_USER     — full CRUD on every data tab, NO user/data admin
//   MEMBER         — read-only on every data tab
// Data tabs = every top-level MENU_TREE key except data-admin / user-admin.
import { MENU_TREE, isDomainAdmin, type UserType } from '@cascade/shared';

export const DATA_TAB_KEYS = MENU_TREE.filter(
  (n) => n.key !== 'data-admin' && n.key !== 'user-admin',
).map((n) => n.key);

export type GrantRow = {
  menuKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function grantsFor(userType: UserType): GrantRow[] {
  if (userType === 'SITE_ADMIN') return []; // bypass in permissionService
  const full = (menuKey: string): GrantRow => ({
    menuKey,
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });
  const readOnly = (menuKey: string): GrantRow => ({
    menuKey,
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
  });
  if (isDomainAdmin(userType)) return [...DATA_TAB_KEYS.map(full), full('user-admin')];
  if (userType === 'SUPER_USER') return DATA_TAB_KEYS.map(full);
  return DATA_TAB_KEYS.map(readOnly); // MEMBER
}
