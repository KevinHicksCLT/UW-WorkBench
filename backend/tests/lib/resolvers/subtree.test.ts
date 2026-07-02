// subtree resolvers — closure-driven subtree expansion (process + org spines)
// against a mocked prisma client: depth bounds, ordering, and batching.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  processNodeClosure: { findMany: vi.fn() },
  processNode: { findMany: vi.fn() },
  orgUnitClosure: { findMany: vi.fn() },
  orgUnit: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { orgSubtree, processSubtree, processSubtrees } from '../../../src/lib/resolvers/subtree.js';

const node = (id: string, parentId: string | null, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id,
  parentId,
  dbValue: id,
  displayValue: id.toUpperCase(),
  processLevelTypeId: 'plt1',
  isTask: false,
  sortOrder,
  automatability: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processSubtree', () => {
  it('returns depth-annotated nodes ordered by (depth, sortOrder, dbValue)', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([
      { descendantId: 'root', depth: 0 },
      { descendantId: 'b', depth: 1 },
      { descendantId: 'a', depth: 1 },
      { descendantId: 'c', depth: 2 },
    ]);
    // Rows arrive unordered — assembleProcess must sort.
    prismaMock.processNode.findMany.mockResolvedValue([
      node('c', 'a', 0),
      node('a', 'root', 5),
      node('b', 'root', 5), // same depth + sortOrder as none; ties with a on depth, differs on sortOrder? equal → dbValue
      node('root', null, 0),
    ]);

    const { nodes, depthById } = await processSubtree('root');
    expect(nodes.map((n) => n.id)).toEqual(['root', 'a', 'b', 'c']);
    expect(nodes[0].depth).toBe(0);
    expect(depthById.get('c')).toBe(2);
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ancestorId: 'root', depth: { gte: 0 } } }),
    );
    expect(prismaMock.processNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['root', 'b', 'a', 'c'] } } }),
    );
  });

  it('applies minDepth/maxDepth and excludeSelf to the closure filter', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([]);

    await processSubtree('root', { minDepth: 0, maxDepth: 2, excludeSelf: true });
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ancestorId: 'root', depth: { gte: 1, lte: 2 } } }),
    );
    // No edges → no node read at all.
    expect(prismaMock.processNode.findMany).not.toHaveBeenCalled();
  });

  it('honours an explicit minDepth above 1', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([]);
    await processSubtree('root', { minDepth: 3 });
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ancestorId: 'root', depth: { gte: 3 } } }),
    );
  });
});

describe('processSubtrees', () => {
  it('resolves many roots in exactly two queries and buckets by root', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([
      { ancestorId: 'r1', descendantId: 'r1', depth: 0 },
      { ancestorId: 'r1', descendantId: 'a', depth: 1 },
      { ancestorId: 'r2', descendantId: 'r2', depth: 0 },
    ]);
    prismaMock.processNode.findMany.mockResolvedValue([
      node('a', 'r1', 0),
      node('r1', null, 0),
      node('r2', null, 1),
    ]);

    const out = await processSubtrees(['r1', 'r2', 'r1', '']);
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ancestorId: { in: ['r1', 'r2'] }, depth: { gte: 0 } } }),
    );
    expect(prismaMock.processNode.findMany).toHaveBeenCalledTimes(1);

    expect(out.get('r1')?.nodes.map((n) => n.id)).toEqual(['r1', 'a']);
    expect(out.get('r1')?.depthById.get('a')).toBe(1);
    expect(out.get('r2')?.nodes.map((n) => n.id)).toEqual(['r2']);
  });

  it('returns empty buckets (and skips queries) for empty input', async () => {
    const out = await processSubtrees([]);
    expect(out.size).toBe(0);
    expect(prismaMock.processNodeClosure.findMany).not.toHaveBeenCalled();
  });

  it('returns empty buckets when the closure has no edges', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([]);
    const out = await processSubtrees(['r1']);
    expect(out.get('r1')).toEqual({ nodes: [], depthById: new Map() });
    expect(prismaMock.processNode.findMany).not.toHaveBeenCalled();
  });
});

describe('orgSubtree', () => {
  it('walks OrgUnitClosure/OrgUnit with the same depth-ordered contract', async () => {
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([
      { descendantId: 'div', depth: 0 },
      { descendantId: 'dept', depth: 1 },
    ]);
    prismaMock.orgUnit.findMany.mockResolvedValue([
      { id: 'dept', parentId: 'div', dbValue: 'dept', displayValue: 'Dept', orgLevelTypeId: 'olt3', sortOrder: 0 },
      { id: 'div', parentId: null, dbValue: 'div', displayValue: 'Div', orgLevelTypeId: 'olt2', sortOrder: 0 },
    ]);

    const { nodes, depthById } = await orgSubtree('div', { excludeSelf: false });
    expect(nodes.map((n) => n.id)).toEqual(['div', 'dept']);
    expect(nodes[1]).toMatchObject({ orgLevelTypeId: 'olt3', depth: 1 });
    expect(depthById.get('dept')).toBe(1);
  });

  it('returns empty result without a node read when no edges match', async () => {
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([]);
    const out = await orgSubtree('missing');
    expect(out.nodes).toEqual([]);
    expect(prismaMock.orgUnit.findMany).not.toHaveBeenCalled();
  });
});
