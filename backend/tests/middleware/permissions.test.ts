// middleware/permissions — method→action mapping, 403 body, DEACTIVATED 401,
// requireAnyPermission OR semantics, requireUserAdmin scope building from the
// closure, and the fail-closed path when the anchor L1 is missing.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const prismaMock = vi.hoisted(() => ({
  permissionSet: { findUnique: vi.fn() },
  userPermissionOverride: { findMany: vi.fn() },
  orgUnit: { findMany: vi.fn() },
  orgUnitClosure: { findMany: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const { requirePermission, requireAnyPermission, requireUserAdmin, userScopeWhere } =
  await import('../../src/middleware/permissions.js');
const { invalidateTenantPermissions } = await import('../../src/services/permissionService.js');

let userSeq = 0;
function makeReq(role: string, method = 'GET', status = 'ACTIVE'): Request {
  return {
    method,
    tenantId: 't1',
    user: { id: `pm${++userSeq}`, tenantId: 't1', email: 'x@y.z', role, status },
  } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const makeNext = () => vi.fn() as NextFunction & ReturnType<typeof vi.fn>;

function grantRow(menuKey: string, r: boolean, u = false) {
  return { menuKey, canCreate: false, canRead: r, canUpdate: u, canDelete: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateTenantPermissions('t1'); // permissionService cache is module-global
  prismaMock.permissionSet.findUnique.mockResolvedValue(null);
  prismaMock.userPermissionOverride.findMany.mockResolvedValue([]);
});

describe('requirePermission', () => {
  it('derives the action from the HTTP method (GET→read passes, DELETE→delete fails)', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps',
      grants: [grantRow('roles', true)],
    });
    const next = makeNext();
    await requirePermission('roles')(makeReq('MEMBER', 'GET'), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps',
      grants: [grantRow('roles', true)],
    });
    const res = makeRes();
    const next2 = makeNext();
    await requirePermission('roles')(makeReq('MEMBER', 'DELETE'), res, next2);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Missing permission: roles:delete' });
    expect(next2).not.toHaveBeenCalled();
  });

  it('an explicit action overrides the method mapping', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps',
      grants: [grantRow('roles', true, true)],
    });
    const next = makeNext();
    // POST would map to create (not granted) — the explicit 'update' passes.
    await requirePermission('roles', 'update')(makeReq('MEMBER', 'POST'), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('PATCH and PUT both map to update', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps',
      grants: [grantRow('roles', true, true)],
    });
    for (const method of ['PATCH', 'PUT']) {
      const next = makeNext();
      await requirePermission('roles')(makeReq('MEMBER', method), makeRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects DEACTIVATED users with 401 before any permission lookup', async () => {
    const res = makeRes();
    const next = makeNext();
    await requirePermission('roles')(makeReq('SITE_ADMIN', 'GET', 'DEACTIVATED'), res, next);
    expect(res.statusCode).toBe(401);
    expect(prismaMock.permissionSet.findUnique).not.toHaveBeenCalled();
  });

  it('SITE_ADMIN passes everything', async () => {
    const next = makeNext();
    await requirePermission('data-admin.configure')(
      makeReq('SITE_ADMIN', 'DELETE'),
      makeRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireAnyPermission', () => {
  it('passes when ANY key grants the action and 403s when none do', async () => {
    prismaMock.permissionSet.findUnique.mockResolvedValue({
      id: 'ps',
      grants: [grantRow('deliverables', true)],
    });
    const next = makeNext();
    await requireAnyPermission(['tasks', 'deliverables'])(
      makeReq('MEMBER', 'GET'),
      makeRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);

    prismaMock.permissionSet.findUnique.mockResolvedValue({ id: 'ps', grants: [] });
    const res = makeRes();
    const next2 = makeNext();
    await requireAnyPermission(['tasks', 'deliverables'])(makeReq('MEMBER', 'GET'), res, next2);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Missing permission: tasks|deliverables:read' });
  });
});

describe('requireUserAdmin', () => {
  it("SITE_ADMIN gets scope 'all' without touching the org tables", async () => {
    const req = makeReq('SITE_ADMIN');
    const next = makeNext();
    await requireUserAdmin()(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userAdminScope).toBe('all');
    expect(prismaMock.orgUnit.findMany).not.toHaveBeenCalled();
  });

  it('a domain admin gets the closure-descendant org ids of the anchor L1', async () => {
    prismaMock.orgUnit.findMany.mockResolvedValue([{ id: 'l1-tech' }]);
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([
      { descendantId: 'l1-tech' },
      { descendantId: 'dept-a' },
      { descendantId: 'dept-b' },
    ]);
    const req = makeReq('TECHNOLOGY_ADMIN');
    const next = makeNext();
    await requireUserAdmin()(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userAdminScope).toEqual({ orgUnitIds: ['l1-tech', 'dept-a', 'dept-b'] });
    expect(prismaMock.orgUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dbValue: 'Technology' }) }),
    );
    expect(userScopeWhere(req)).toEqual({ orgUnitId: { in: ['l1-tech', 'dept-a', 'dept-b'] } });
  });

  it('fails closed (403) when the anchor L1 has been renamed away', async () => {
    prismaMock.orgUnit.findMany.mockResolvedValue([]);
    const res = makeRes();
    const next = makeNext();
    await requireUserAdmin()(makeReq('CORE_BUSINESS_ADMIN'), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-admin user types with 403', async () => {
    const res = makeRes();
    const next = makeNext();
    await requireUserAdmin()(makeReq('SUPER_USER'), res, next);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.orgUnit.findMany).not.toHaveBeenCalled();
  });
});
