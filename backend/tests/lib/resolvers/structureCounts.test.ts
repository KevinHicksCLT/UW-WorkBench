// structureCounts — level-keyed groupBy aggregation + the per-company TTL memo
// (fake timers), against a mocked prisma client.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  processNode: { groupBy: vi.fn(), count: vi.fn() },
  orgUnit: { groupBy: vi.fn() },
  processLevelType: { findMany: vi.fn() },
  orgLevelType: { findMany: vi.fn() },
  role: { count: vi.fn() },
  application: { count: vi.fn() },
  portfolioInitiative: { count: vi.fn() },
  program: { count: vi.fn() },
  standard: { count: vi.fn() },
  deliverable: { count: vi.fn() },
  metric: { count: vi.fn() },
  scenario: { count: vi.fn() },
  externalParty: { count: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import {
  invalidateStructureCounts,
  structureCounts,
} from '../../../src/lib/resolvers/structureCounts.js';

function primeMocks() {
  prismaMock.processNode.count.mockResolvedValue(3811);
  prismaMock.processNode.groupBy.mockResolvedValue([
    { processLevelTypeId: 'p1', _count: { _all: 3 } },
    { processLevelTypeId: 'p2', _count: { _all: 17 } },
    { processLevelTypeId: 'p3', _count: { _all: 135 } },
    { processLevelTypeId: 'p4', _count: { _all: 867 } },
    { processLevelTypeId: 'p5', _count: { _all: 3811 } },
    { processLevelTypeId: 'unknown', _count: { _all: 99 } }, // no level type → ignored
  ]);
  prismaMock.orgUnit.groupBy.mockResolvedValue([
    { orgLevelTypeId: 'o2', _count: { _all: 9 } },
    { orgLevelTypeId: 'o3', _count: { _all: 31 } },
  ]);
  prismaMock.processLevelType.findMany.mockResolvedValue([
    { id: 'p1', levelNumber: 1 },
    { id: 'p2', levelNumber: 2 },
    { id: 'p3', levelNumber: 3 },
    { id: 'p4', levelNumber: 4 },
    { id: 'p5', levelNumber: 5 },
  ]);
  prismaMock.orgLevelType.findMany.mockResolvedValue([
    { id: 'o2', levelNumber: 2 },
    { id: 'o3', levelNumber: 3 },
  ]);
  prismaMock.role.count.mockResolvedValue(200);
  prismaMock.application.count.mockResolvedValue(40);
  prismaMock.portfolioInitiative.count.mockResolvedValue(12);
  prismaMock.program.count.mockResolvedValue(4);
  prismaMock.standard.count.mockResolvedValue(1010);
  prismaMock.deliverable.count.mockResolvedValue(899);
  prismaMock.metric.count.mockResolvedValue(154);
  prismaMock.scenario.count.mockResolvedValue(2);
  prismaMock.externalParty.count.mockResolvedValue(7);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  invalidateStructureCounts(); // reset the module-level memo between tests
  primeMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('structureCounts', () => {
  it('maps level-type groupBy rows to the canonical count shape', async () => {
    const c = await structureCounts('company-1');
    expect(c).toEqual({
      segments: 3,
      domains: 3,
      valueStreams: 17,
      processAreas: 135,
      subProcesses: 867,
      steps: 3811,
      tasksL6: 0,
      leafTasks: 3811,
      divisions: 9,
      departments: 31,
      roles: 200,
      applications: 40,
      initiatives: 12,
      programs: 4,
      standards: 1010,
      deliverables: 899,
      ioItems: 899, // deliverables stand in for the legacy IoItem tile
      metrics: 154,
      scenarios: 2,
      externalParties: 7,
    });
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['processLevelTypeId'], where: { companyId: 'company-1' } }),
    );
  });

  it('defaults missing levels to zero', async () => {
    prismaMock.processNode.groupBy.mockResolvedValue([]);
    prismaMock.orgUnit.groupBy.mockResolvedValue([]);
    const c = await structureCounts('company-empty');
    expect(c.segments).toBe(0);
    expect(c.valueStreams).toBe(0);
    expect(c.steps).toBe(0);
    expect(c.divisions).toBe(0);
    expect(c.departments).toBe(0);
  });

  it('memoizes per company within the 30s TTL', async () => {
    await structureCounts('company-1');
    await structureCounts('company-1');
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(1);

    // A different company is a separate memo entry.
    await structureCounts('company-2');
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(2);
  });

  it('re-queries after the TTL elapses', async () => {
    await structureCounts('company-1');
    vi.advanceTimersByTime(30_001);
    await structureCounts('company-1');
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(2);
  });

  it('invalidateStructureCounts(companyId) drops one memo entry; no-arg drops all', async () => {
    await structureCounts('company-1');
    await structureCounts('company-2');
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(2);

    invalidateStructureCounts('company-1');
    await structureCounts('company-1'); // refetched
    await structureCounts('company-2'); // still cached
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(3);

    invalidateStructureCounts();
    await structureCounts('company-2');
    expect(prismaMock.processNode.groupBy).toHaveBeenCalledTimes(4);
  });
});
