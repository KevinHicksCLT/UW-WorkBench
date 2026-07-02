// ancestorNames / streamAncestry — derived location strings computed from
// synthetic closure + node fixtures against a fully mocked prisma client.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  processNodeClosure: { findMany: vi.fn() },
  processNode: { findMany: vi.fn() },
  nodeRole: { findMany: vi.fn() },
  orgUnitClosure: { findMany: vi.fn() },
  orgUnit: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { ancestorNames, streamAncestry } from '../../../src/lib/resolvers/ancestorNames.js';

// Process spine fixture: dom (L1) → vs (L2) → l3 (L3) → l4 (L4) → task t1 (L5).
const PROCESS_ANCESTORS = [
  { id: 'dom', displayValue: 'Insurance', processLevelType: { levelNumber: 1 } },
  { id: 'vs', displayValue: 'Claims', processLevelType: { levelNumber: 2 } },
  { id: 'l3', displayValue: 'Intake', processLevelType: { levelNumber: 3 } },
  { id: 'l4', displayValue: 'Triage', processLevelType: { levelNumber: 4 } },
  { id: 't1', displayValue: 'Log FNOL', processLevelType: { levelNumber: 5 } },
];
const T1_EDGES = [
  { ancestorId: 't1', descendantId: 't1', depth: 0 },
  { ancestorId: 'l4', descendantId: 't1', depth: 1 },
  { ancestorId: 'l3', descendantId: 't1', depth: 2 },
  { ancestorId: 'vs', descendantId: 't1', depth: 3 },
  { ancestorId: 'dom', descendantId: 't1', depth: 4 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ancestorNames', () => {
  it('returns an empty map for an empty/blank id list without querying', async () => {
    const out = await ancestorNames(['', '']);
    expect(out.size).toBe(0);
    expect(prismaMock.processNodeClosure.findMany).not.toHaveBeenCalled();
  });

  it('resolves process names by level and org division/department from the Owner role', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue(T1_EDGES);
    prismaMock.nodeRole.findMany.mockResolvedValue([
      { processNodeId: 't1', role: { orgUnitId: 'dept' } },
    ]);
    prismaMock.processNode.findMany.mockResolvedValue(PROCESS_ANCESTORS);
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([
      { ancestorId: 'dept', descendantId: 'dept' },
      { ancestorId: 'div', descendantId: 'dept' },
      { ancestorId: 'seg', descendantId: 'dept' },
    ]);
    prismaMock.orgUnit.findMany.mockResolvedValue([
      { id: 'seg', displayValue: 'Group', orgLevelType: { levelNumber: 1 } },
      { id: 'div', displayValue: 'Operations', orgLevelType: { levelNumber: 2 } },
      { id: 'dept', displayValue: 'Claims Ops', orgLevelType: { levelNumber: 3 } },
    ]);

    const out = await ancestorNames(['t1']);
    expect(out.get('t1')).toEqual({
      valueStreamId: 'vs',
      valueStreamName: 'Claims',
      domain: 'Insurance',
      l3: 'Intake',
      l4: 'Triage',
      division: 'Operations',
      department: 'Claims Ops',
    });
  });

  it('dedupes input ids and batches each table read into a single {in: ids} query', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue(T1_EDGES);
    prismaMock.nodeRole.findMany.mockResolvedValue([]);
    prismaMock.processNode.findMany.mockResolvedValue(PROCESS_ANCESTORS);

    await ancestorNames(['t1', 't1', '', 't1']);

    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.processNodeClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { descendantId: { in: ['t1'] } } }),
    );
    expect(prismaMock.nodeRole.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.nodeRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processNodeId: { in: ['t1'] }, role_: 'Owner' }),
      }),
    );
    expect(prismaMock.processNode.findMany).toHaveBeenCalledTimes(1);
    // No owner → the org chain is never queried.
    expect(prismaMock.orgUnitClosure.findMany).not.toHaveBeenCalled();
    expect(prismaMock.orgUnit.findMany).not.toHaveBeenCalled();
  });

  it('returns all-null names for a node with no closure rows', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([]);
    prismaMock.nodeRole.findMany.mockResolvedValue([]);
    prismaMock.processNode.findMany.mockResolvedValue([]);

    const out = await ancestorNames(['orphan']);
    expect(out.get('orphan')).toEqual({
      valueStreamId: null,
      valueStreamName: null,
      domain: null,
      l3: null,
      l4: null,
      division: null,
      department: null,
    });
  });

  it('keeps the first Owner org unit when a node has several owners', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue([]);
    prismaMock.nodeRole.findMany.mockResolvedValue([
      { processNodeId: 't1', role: { orgUnitId: 'ou-first' } },
      { processNodeId: 't1', role: { orgUnitId: 'ou-second' } },
    ]);
    prismaMock.processNode.findMany.mockResolvedValue([]);
    prismaMock.orgUnitClosure.findMany.mockResolvedValue([
      { ancestorId: 'ou-first', descendantId: 'ou-first' },
    ]);
    prismaMock.orgUnit.findMany.mockResolvedValue([
      { id: 'ou-first', displayValue: 'First Division', orgLevelType: { levelNumber: 2 } },
    ]);

    const out = await ancestorNames(['t1']);
    // Only the FIRST owner's org unit is kept per node, so the org closure read
    // never even includes the second owner's unit.
    expect(prismaMock.orgUnitClosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { descendantId: { in: ['ou-first'] } } }),
    );
    expect(out.get('t1')?.division).toBe('First Division');
    expect(out.get('t1')?.department).toBeNull();
  });
});

describe('streamAncestry', () => {
  it('returns only value stream + domain in two queries', async () => {
    prismaMock.processNodeClosure.findMany.mockResolvedValue(T1_EDGES);
    prismaMock.processNode.findMany.mockResolvedValue([
      { id: 'dom', displayValue: 'Insurance', processLevelType: { levelNumber: 1 } },
      { id: 'vs', displayValue: 'Claims', processLevelType: { levelNumber: 2 } },
    ]);

    const out = await streamAncestry(['t1', 't1']);
    expect(out.get('t1')).toEqual({ valueStreamId: 'vs', valueStreamName: 'Claims', domain: 'Insurance' });

    // Lean variant: never touches roles or the org spine.
    expect(prismaMock.nodeRole.findMany).not.toHaveBeenCalled();
    expect(prismaMock.orgUnitClosure.findMany).not.toHaveBeenCalled();
    // Ancestor read is restricted to L1/L2.
    expect(prismaMock.processNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processLevelType: { levelNumber: { in: [1, 2] } } }),
      }),
    );
  });

  it('short-circuits on empty input', async () => {
    const out = await streamAncestry([]);
    expect(out.size).toBe(0);
    expect(prismaMock.processNodeClosure.findMany).not.toHaveBeenCalled();
  });
});
