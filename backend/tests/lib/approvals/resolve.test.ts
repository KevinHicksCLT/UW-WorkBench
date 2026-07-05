// approvals/resolve.ts — RBAC seat resolution × ABAC bounded-context filter.
// Prisma mocked; asserts both the candidate queries (requester exclusion,
// isApprover) and the containment filters (org subtree, geography, streams).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  orgUnitClosure: { findMany: vi.fn() },
  userValueStream: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const { abacFilter, resolveStageSeats } = await import('../../../src/lib/approvals/resolve.js');

const u = (id: string, orgUnitId: string | null = null, geography: string | null = null) => ({
  id,
  orgUnitId,
  geography,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.orgUnitClosure.findMany.mockResolvedValue([]);
  prismaMock.userValueStream.findMany.mockResolvedValue([]);
});

describe('abacFilter — geography', () => {
  it('passes GLOBAL, matching, and unset candidates; drops mismatches', async () => {
    const out = await abacFilter(
      [
        u('global', null, 'GLOBAL'),
        u('match', null, 'NORTH_AMERICA'),
        u('unset'),
        u('apac', null, 'APAC'),
      ],
      { geography: 'NORTH_AMERICA' },
    );
    expect(out.map((c) => c.id)).toEqual(['global', 'match', 'unset']);
  });

  it('skips the dimension when the subject has no geography', async () => {
    const out = await abacFilter([u('apac', null, 'APAC')], { orgUnitId: null, geography: null });
    expect(out).toHaveLength(1);
  });
});

describe('abacFilter — org-unit subtree containment', () => {
  it('keeps ancestors (closure row), same-unit, and unscoped candidates; drops outsiders', async () => {
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([{ ancestorId: 'org-parent' }]);
    const out = await abacFilter(
      [
        u('anc', 'org-parent'),
        u('same', 'org-subject'),
        u('unscoped'),
        u('other', 'org-elsewhere'),
      ],
      { orgUnitId: 'org-subject' },
    );
    expect(out.map((c) => c.id)).toEqual(['anc', 'same', 'unscoped']);
  });
});

describe('abacFilter — value streams', () => {
  it('a candidate with links must include the subject stream; no links = unbounded', async () => {
    prismaMock.userValueStream.findMany.mockResolvedValue([
      { userId: 'in-scope', processNodeId: 'vs-uw' },
      { userId: 'out-of-scope', processNodeId: 'vs-claims' },
    ]);
    const out = await abacFilter([u('in-scope'), u('out-of-scope'), u('unbounded')], {
      valueStreamNodeId: 'vs-uw',
    });
    expect(out.map((c) => c.id)).toEqual(['in-scope', 'unbounded']);
  });
});

describe('resolveStageSeats', () => {
  it('MANAGER seat resolves the requester’s reportsTo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ reportsToId: 'mgr-1' });
    prismaMock.user.findMany.mockResolvedValue([u('mgr-1')]);
    const seats = await resolveStageSeats('t1', 'req-user', [{ kind: 'MANAGER' }], null);
    expect(seats).toEqual([{ seatKey: 'manager', userIds: ['mgr-1'], escalated: false }]);
  });

  it('a reportsTo pointing at the requester never becomes a self-seat', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ reportsToId: 'req-user' });
    prismaMock.user.findMany.mockResolvedValue([]); // fallback SITE_ADMINS empty too
    const seats = await resolveStageSeats('t1', 'req-user', [{ kind: 'MANAGER' }], null);
    expect(seats[0]).toMatchObject({ userIds: [], escalated: true });
  });

  it('ROLES seat requires isApprover and escalates to manager when empty', async () => {
    // First findMany (ROLES) empty, second (fallback MANAGER) returns the manager.
    prismaMock.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([u('mgr-1')]);
    prismaMock.user.findUnique.mockResolvedValue({ reportsToId: 'mgr-1' });
    const seats = await resolveStageSeats(
      't1',
      'req-user',
      [{ kind: 'ROLES', roleIds: ['r1'] }],
      null,
    );
    expect(prismaMock.user.findMany.mock.calls[0][0].where).toMatchObject({ isApprover: true });
    expect(seats[0]).toMatchObject({ userIds: ['mgr-1'], escalated: true });
  });

  it('falls back to SITE_ADMINS and flags escalated when manager is also empty', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ reportsToId: null });
    prismaMock.user.findMany.mockResolvedValue([u('admin-2')]);
    const seats = await resolveStageSeats('t1', 'req-user', [{ kind: 'MANAGER' }], null);
    expect(seats[0]).toMatchObject({ userIds: ['admin-2'], escalated: true });
    const lastWhere = prismaMock.user.findMany.mock.calls.at(-1)?.[0].where;
    expect(lastWhere).toMatchObject({ role: 'SITE_ADMIN' });
  });

  it('returns an empty seat (not a throw) when even the fallback is empty', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ reportsToId: null });
    prismaMock.user.findMany.mockResolvedValue([]);
    const seats = await resolveStageSeats(
      't1',
      'req-user',
      [{ kind: 'USERS', userIds: ['u9'] }],
      null,
    );
    expect(seats[0]).toMatchObject({ userIds: [], escalated: true });
  });

  it('ENTITY_ROLE seat reads the role id from subjectAttrs', async () => {
    prismaMock.user.findMany.mockResolvedValue([u('sponsor-holder')]);
    const seats = await resolveStageSeats(
      't1',
      'req-user',
      [{ kind: 'ENTITY_ROLE', attr: 'sponsorRoleId' }],
      { sponsorRoleId: 'role-sponsor' },
    );
    expect(prismaMock.user.findMany.mock.calls[0][0].where).toMatchObject({
      operatingRoleId: 'role-sponsor',
      isApprover: true,
    });
    expect(seats[0].userIds).toEqual(['sponsor-holder']);
  });
});
