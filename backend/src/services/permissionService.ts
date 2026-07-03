// Effective-permission resolution — the single authz derivation layer.
// PermissionSet grants (per tenant + user type) merged with tri-state per-user
// overrides across the shared MENU_TREE. A grant on a parent key covers its
// whole subtree; an explicit child grant row is a subset carve-out. SITE_ADMIN
// bypasses sets entirely.
//
// Results are cached in-process per user (TTL 60s) with explicit invalidation
// from the permission-write routes. On multi-instance deployments invalidation
// doesn't cross processes — the TTL bounds staleness; the JWT never carries
// permissions so no token ever goes stale.
import type { User } from '@prisma/client';
import {
  allMenuKeys,
  parentKey,
  type Crud,
  type EffectivePermissions,
  type MenuAction,
  type MenuKey,
} from '@cascade/shared';
import { prisma } from '../db/prisma.js';

const TTL_MS = 60_000;

type CacheEntry = { exp: number; perms: EffectivePermissions };
const cache = new Map<string, CacheEntry>();

const NONE: Crud = { create: false, read: false, update: false, delete: false };
const ALL: Crud = { create: true, read: true, update: true, delete: true };

function fullAccess(): EffectivePermissions {
  const out = {} as EffectivePermissions;
  for (const key of allMenuKeys()) out[key] = { ...ALL };
  return out;
}

export async function getEffectivePermissions(user: User): Promise<EffectivePermissions> {
  if (user.role === 'SITE_ADMIN') return fullAccess();

  const hit = cache.get(user.id);
  if (hit && hit.exp > Date.now()) return hit.perms;

  const [set, overrides] = await Promise.all([
    prisma.permissionSet.findUnique({
      where: { tenantId_userType: { tenantId: user.tenantId, userType: user.role } },
      include: { grants: true },
    }),
    prisma.userPermissionOverride.findMany({ where: { userId: user.id } }),
  ]);

  const grants = new Map<string, Crud>();
  for (const g of set?.grants ?? []) {
    grants.set(g.menuKey, {
      create: g.canCreate,
      read: g.canRead,
      update: g.canUpdate,
      delete: g.canDelete,
    });
  }

  // Pass 1 — sets + parent inheritance. allMenuKeys() lists parents before
  // children, so a child can resolve against its parent's finished entry.
  const perms = {} as EffectivePermissions;
  for (const key of allMenuKeys()) {
    const explicit = grants.get(key);
    if (explicit) {
      perms[key] = { ...explicit };
      continue;
    }
    const parent = parentKey(key);
    perms[key] = parent ? { ...perms[parent] } : { ...NONE };
  }

  // Pass 2 — tri-state overrides at their exact key (null action = inherit).
  const overridden = new Set<MenuKey>();
  for (const o of overrides) {
    const key = o.menuKey as MenuKey;
    if (!(key in perms)) continue; // stale key from an older registry version
    const base = perms[key];
    perms[key] = {
      create: o.canCreate ?? base.create,
      read: o.canRead ?? base.read,
      update: o.canUpdate ?? base.update,
      delete: o.canDelete ?? base.delete,
    };
    overridden.add(key);
  }

  // Pass 3 — re-inherit children that had neither an explicit grant nor an
  // override, so a parent-level override flows down the subtree.
  for (const key of allMenuKeys()) {
    if (grants.has(key) || overridden.has(key)) continue;
    const parent = parentKey(key);
    if (parent) perms[key] = { ...perms[parent] };
  }

  cache.set(user.id, { exp: Date.now() + TTL_MS, perms });
  return perms;
}

export function hasPermission(
  perms: EffectivePermissions,
  key: MenuKey,
  action: MenuAction,
): boolean {
  return perms[key]?.[action] === true;
}

export function invalidateUserPermissions(userId: string): void {
  cache.delete(userId);
}

// Permission-set edits affect every user of that type — drop the whole cache
// (it's small and repopulates lazily) rather than tracking type membership.
export function invalidateTenantPermissions(_tenantId: string): void {
  cache.clear();
}
