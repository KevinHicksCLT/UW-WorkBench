// permissionService — set resolution, parent→child inheritance, explicit
// child carve-outs, tri-state overrides, SITE_ADMIN bypass, cache TTL +
// invalidation. Prisma mocked; the shared MENU_TREE is the real registry.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';
import { allMenuKeys } from '@cascade/shared';

const prismaMock = vi.hoisted(() => ({
  permissionSet: { findUnique: vi.fn() },
  userPermissionOverride: { findMany: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const {
  getEffectivePermissions,
  hasPermission,
  invalidateUserPermissions,
  invalidateTenantPermissions,
} = await import('../../src/services/permissionService.js');

let userSeq = 0;
function makeUser(role: string): User {
  // Fresh id per test → no cross-test cache hits.
  return {
    id: `u${++userSeq}`,
    tenantId: 't1',
    email: 'x@y.z',
    role,
    status: 'ACTIVE',
  } as unknown as User;
}

function grant(menuKey: string, crud: Partial<Record<'c' | 'r' | 'u' | 'd', boolean>>) {
  return {
    menuKey,
    canCreate: crud.c ?? false,
    canRead: crud.r ?? false,
    canUpdate: crud.u ?? false,
    canDelete: crud.d ?? false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.permissionSet.findUnique.mockResolvedValue(null);
  prismaMock.userPermissionOverride.findMany.mockResolvedValue([]);
});

describe('getEffectivePermissions', () => {
  it('SITE_ADMIN bypasses sets entirely — full CRUD on every key, no queries', async () => {
    const perms = await getEffectivePermissions(makeUser('SITE_ADMIN'));
    for (const key of allMenuKeys()) {
      expect(perms[key]).toEqual({ create: true, read: true, update: true, delete: true });
    }
    expect(prismaMock.permissionSet.findUnique).not.toHaveBeenCalled();
  });

  it('no permission set at all → nothing is allowed', async () => {
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    expect(hasPermission(perms, 'home', 'read')).toBe(false);
    expect(hasPermission(perms, 'data-admin.configure', 'read')).toBe(false);
  });

  it('a parent grant covers its whole subtree', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps1',
      grants: [grant('data-admin', { r: true, u: true })],
    });
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    expect(hasPermission(perms, 'data-admin.configure', 'read')).toBe(true);
    expect(hasPermission(perms, 'data-admin.audit-log', 'update')).toBe(true);
    expect(hasPermission(perms, 'data-admin.audit-log', 'delete')).toBe(false);
    // Unrelated top-level keys stay closed.
    expect(hasPermission(perms, 'roles', 'read')).toBe(false);
  });

  it('an explicit child row is a carve-out that beats parent inheritance', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps1',
      grants: [grant('data-admin', { r: true }), grant('data-admin.audit-log', {})],
    });
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    expect(hasPermission(perms, 'data-admin.configure', 'read')).toBe(true);
    expect(hasPermission(perms, 'data-admin.audit-log', 'read')).toBe(false);
  });

  it('tri-state overrides apply per action and flow down to un-granted children', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps1',
      grants: [grant('user-admin', { r: true })],
    });
    prismaMock.userPermissionOverride.findMany.mockResolvedValue([
      { menuKey: 'user-admin', canCreate: true, canRead: null, canUpdate: null, canDelete: null },
    ]);
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    // Overridden action ON, inherited action preserved.
    expect(hasPermission(perms, 'user-admin', 'create')).toBe(true);
    expect(hasPermission(perms, 'user-admin', 'read')).toBe(true);
    // Children without their own grant/override re-inherit the overridden parent.
    expect(hasPermission(perms, 'user-admin.users', 'create')).toBe(true);
  });

  it('an override can deny what the set allows', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps1',
      grants: [grant('standards', { r: true, u: true })],
    });
    prismaMock.userPermissionOverride.findMany.mockResolvedValue([
      { menuKey: 'standards', canCreate: null, canRead: null, canUpdate: false, canDelete: null },
    ]);
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    expect(hasPermission(perms, 'standards', 'read')).toBe(true);
    expect(hasPermission(perms, 'standards', 'update')).toBe(false);
  });

  it('stale override keys from an older registry are ignored', async () => {
    prismaMock.userPermissionOverride.findMany.mockResolvedValue([
      { menuKey: 'retired-tab', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    ]);
    const perms = await getEffectivePermissions(makeUser('MEMBER'));
    expect(Object.keys(perms).sort()).toEqual([...allMenuKeys()].sort());
  });

  it('caches per user until invalidated', async () => {
    const user = makeUser('MEMBER');
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps1',
      grants: [grant('roles', { r: true })],
    });
    await getEffectivePermissions(user);
    await getEffectivePermissions(user);
    expect(prismaMock.permissionSet.findUnique).toHaveBeenCalledTimes(1);

    invalidateUserPermissions(user.id);
    await getEffectivePermissions(user);
    expect(prismaMock.permissionSet.findUnique).toHaveBeenCalledTimes(2);
  });

  it('tenant invalidation drops every cached user', async () => {
    const a = makeUser('MEMBER');
    const b = makeUser('SUPER_USER');
    prismaMock.permissionSet.findUnique.mockResolvedValue({ id: 'ps1', grants: [] });
    await getEffectivePermissions(a);
    await getEffectivePermissions(b);
    expect(prismaMock.permissionSet.findUnique).toHaveBeenCalledTimes(2);

    invalidateTenantPermissions('t1');
    await getEffectivePermissions(a);
    await getEffectivePermissions(b);
    expect(prismaMock.permissionSet.findUnique).toHaveBeenCalledTimes(4);
  });
});
