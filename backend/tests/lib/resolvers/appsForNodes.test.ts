// appsForNodes — NodeAppUsage junction resolution with a mocked prisma client.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  nodeAppUsage: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { appsForNodes } from '../../../src/lib/resolvers/appsForNodes.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('appsForNodes', () => {
  it('groups applications per node with usageType', async () => {
    prismaMock.nodeAppUsage.findMany.mockResolvedValue([
      { processNodeId: 'n1', usageType: 'performed', application: { id: 'a1', name: 'Guidewire' } },
      { processNodeId: 'n1', usageType: 'memorialized', application: { id: 'a2', name: 'SharePoint' } },
      { processNodeId: 'n2', usageType: 'performed', application: { id: 'a1', name: 'Guidewire' } },
    ]);

    const out = await appsForNodes(['n1', 'n2']);
    expect(out.get('n1')).toEqual([
      { id: 'a1', name: 'Guidewire', usageType: 'performed' },
      { id: 'a2', name: 'SharePoint', usageType: 'memorialized' },
    ]);
    expect(out.get('n2')).toEqual([{ id: 'a1', name: 'Guidewire', usageType: 'performed' }]);
  });

  it('dedupes ids and issues one batched {in: ids} query', async () => {
    prismaMock.nodeAppUsage.findMany.mockResolvedValue([]);
    await appsForNodes(['n1', 'n1', '', 'n2']);
    expect(prismaMock.nodeAppUsage.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.nodeAppUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processNodeId: { in: ['n1', 'n2'] } } }),
    );
  });

  it('returns an empty map without querying for blank input', async () => {
    const out = await appsForNodes(['']);
    expect(out.size).toBe(0);
    expect(prismaMock.nodeAppUsage.findMany).not.toHaveBeenCalled();
  });
});
