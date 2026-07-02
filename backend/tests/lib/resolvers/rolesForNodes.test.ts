// rolesForNodes / rolesForNodesByRelation — NodeRole junction resolution with a
// mocked prisma client; asserts derived shapes, batching, and dedupe.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  nodeRole: { findMany: vi.fn() },
  role: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { rolesForNodes, rolesForNodesByRelation } from '../../../src/lib/resolvers/rolesForNodes.js';

const ROWS = [
  { processNodeId: 'n1', role_: 'Owner', ownerLevel: 'L4', role: { id: 'r1', displayValue: 'Claims Manager' } },
  { processNodeId: 'n1', role_: 'Participant', ownerLevel: null, role: { id: 'r2', displayValue: 'Adjuster' } },
  { processNodeId: 'n2', role_: 'Participant', ownerLevel: null, role: { id: 'r1', displayValue: 'Claims Manager' } },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rolesForNodes', () => {
  it('groups NodeRole rows per node with the derived entry shape', async () => {
    prismaMock.nodeRole.findMany.mockResolvedValue(ROWS);

    const out = await rolesForNodes(['n1', 'n2']);
    expect(out.get('n1')).toEqual([
      { id: 'r1', name: 'Claims Manager', role_: 'Owner', ownerLevel: 'L4' },
      { id: 'r2', name: 'Adjuster', role_: 'Participant', ownerLevel: null },
    ]);
    expect(out.get('n2')).toEqual([
      { id: 'r1', name: 'Claims Manager', role_: 'Participant', ownerLevel: null },
    ]);
    // orgUnit key absent when withOrgUnit is not requested.
    expect(out.get('n1')?.[0]).not.toHaveProperty('orgUnit');
  });

  it('dedupes ids, drops blanks, and issues one batched findMany', async () => {
    prismaMock.nodeRole.findMany.mockResolvedValue([]);

    await rolesForNodes(['n1', 'n1', '', 'n2']);
    expect(prismaMock.nodeRole.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.nodeRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processNodeId: { in: ['n1', 'n2'] } } }),
    );
    expect(prismaMock.role.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty map without querying when every id is blank', async () => {
    const out = await rolesForNodes(['', '']);
    expect(out.size).toBe(0);
    expect(prismaMock.nodeRole.findMany).not.toHaveBeenCalled();
  });

  it('withOrgUnit attaches each role home in ONE extra query over distinct role ids', async () => {
    prismaMock.nodeRole.findMany.mockResolvedValue(ROWS);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'r1', orgUnit: { id: 'ou1', displayValue: 'Claims Ops', parent: { displayValue: 'Operations' } } },
      { id: 'r2', orgUnit: null },
    ]);

    const out = await rolesForNodes(['n1', 'n2'], { withOrgUnit: true });

    expect(prismaMock.role.findMany).toHaveBeenCalledTimes(1);
    // r1 appears in two NodeRole rows but is fetched once (distinct role ids).
    expect(prismaMock.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['r1', 'r2'] } } }),
    );
    expect(out.get('n1')?.[0].orgUnit).toEqual({
      id: 'ou1',
      displayValue: 'Claims Ops',
      parent: { displayValue: 'Operations' },
    });
    expect(out.get('n1')?.[1].orgUnit).toBeNull();
    expect(out.get('n2')?.[0].orgUnit).toEqual(out.get('n1')?.[0].orgUnit);
  });
});

describe('rolesForNodesByRelation', () => {
  it('splits owners and participants per node', async () => {
    prismaMock.nodeRole.findMany.mockResolvedValue(ROWS);

    const out = await rolesForNodesByRelation(['n1', 'n2']);
    expect(out.get('n1')).toEqual({
      owners: [{ id: 'r1', name: 'Claims Manager', role_: 'Owner', ownerLevel: 'L4' }],
      participants: [{ id: 'r2', name: 'Adjuster', role_: 'Participant', ownerLevel: null }],
    });
    expect(out.get('n2')?.owners).toEqual([]);
    expect(out.get('n2')?.participants).toHaveLength(1);
  });

  it('omits nodes that have no NodeRole rows', async () => {
    prismaMock.nodeRole.findMany.mockResolvedValue([]);
    const out = await rolesForNodesByRelation(['n1']);
    expect(out.has('n1')).toBe(false);
  });
});
