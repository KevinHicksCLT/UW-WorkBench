// valueStreamAdmin — the generic level-admin handler set over the two spines
// (ProcessNode / OrgUnit). prisma, the audit service, closure maintenance, and
// the count invalidator are all mocked; assertions cover row mapping, level
// resolution, closure hooks, cycle guards, and the http-error contract.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  processNode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  orgUnit: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  processLevelType: { findFirst: vi.fn() },
  orgLevelType: { findFirst: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const auditMock = vi.hoisted(() => ({
  logAudit: vi.fn(),
  computeDiff: vi.fn(() => ({ name: { from: 'Old', to: 'New' } })),
}));
vi.mock('../../src/services/audit.js', () => auditMock);

const closureServiceMock = vi.hoisted(() => ({
  insertNode: vi.fn(async () => undefined),
  moveSubtree: vi.fn(async () => undefined),
  deleteSubtree: vi.fn(async () => 1),
  rebuildClosure: vi.fn(async () => 0),
}));
vi.mock('../../src/lib/closure.js', () => ({ closureFor: vi.fn(() => closureServiceMock) }));

const invalidateMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/resolvers/index.js', () => ({ invalidateStructureCounts: invalidateMock }));

import { LEVEL_HANDLERS, ORG_MODEL, ORGANIZATION, VALUE_STREAMS, VS_MODEL } from '../../src/lib/valueStreamAdmin.js';

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  displayValue: 'Claims',
  dbValue: 'Claims',
  parentId: null,
  sortOrder: 0,
  attributes: { description: 'Handles claims' },
  processLevelType: { levelNumber: 2 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registry', () => {
  it('exposes both level entities keyed by their pseudo-models', () => {
    expect(LEVEL_HANDLERS[VS_MODEL]).toBe(VALUE_STREAMS);
    expect(LEVEL_HANDLERS[ORG_MODEL]).toBe(ORGANIZATION);
    expect(VALUE_STREAMS.entity.slug).toBe('valueStreams');
    expect(ORGANIZATION.entity.slug).toBe('organization');
  });
});

describe('list', () => {
  it('maps spine rows to level rows and re-sorts by (levelNumber, sortOrder, name)', async () => {
    prismaMock.processNode.findMany.mockResolvedValue([
      raw({ id: 'l3', displayValue: 'Intake', parentId: 'n1', processLevelType: { levelNumber: 3 }, attributes: null }),
      raw(),
    ]);
    prismaMock.processNode.count.mockResolvedValue(2);

    const out = (await VALUE_STREAMS.list('t1', 'c1', '', 50, 0)) as {
      rows: { id: string; name: string; level: string; optionLabel: string; description: string | null }[];
      total: number;
    };
    expect(out.total).toBe(2);
    expect(out.rows.map((r) => r.id)).toEqual(['n1', 'l3']); // level 2 before level 3
    expect(out.rows[0]).toMatchObject({
      name: 'Claims',
      level: 'Level 2',
      optionLabel: 'Level 2 — Claims',
      description: 'Handles claims',
    });
    expect(out.rows[1].description).toBeNull();
  });

  it('applies the case-insensitive name filter when searching', async () => {
    prismaMock.processNode.findMany.mockResolvedValue([]);
    prismaMock.processNode.count.mockResolvedValue(0);
    await VALUE_STREAMS.list('t1', 'c1', 'claims', 10, 5);
    expect(prismaMock.processNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'c1', displayValue: { contains: 'claims', mode: 'insensitive' } },
        take: 10,
        skip: 5,
      }),
    );
  });
});

describe('getOne', () => {
  it('returns the mapped row or null when not in this company', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce(raw());
    expect((await VALUE_STREAMS.getOne('t1', 'c1', 'n1'))?.name).toBe('Claims');

    prismaMock.processNode.findFirst.mockResolvedValueOnce(null);
    expect(await VALUE_STREAMS.getOne('t1', 'c1', 'other')).toBeNull();
  });
});

describe('create', () => {
  it('rejects a missing name with a 400 http error', async () => {
    await expect(VALUE_STREAMS.create('t1', 'c1', 'a@b.c', {})).rejects.toMatchObject({
      message: 'name is required',
      status: 400,
    });
  });

  it('creates a root node at level 1 and maintains the closure + memo + audit', async () => {
    prismaMock.processLevelType.findFirst.mockResolvedValue({ id: 'lt1' });
    prismaMock.processNode.create.mockResolvedValue(raw({ processLevelType: { levelNumber: 1 } }));

    const row = await VALUE_STREAMS.create('t1', 'c1', 'a@b.c', { name: 'Claims', description: 'Top' });
    expect(row.level).toBe('Level 1');

    expect(prismaMock.processLevelType.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c1', levelNumber: 1 },
      select: { id: true },
    });
    const data = (prismaMock.processNode.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      companyId: 'c1',
      dbValue: 'Claims',
      displayValue: 'Claims',
      parentId: null,
      processLevelTypeId: 'lt1',
    });
    expect(data.attributes).toMatchObject({ description: 'Top' });
    expect(closureServiceMock.insertNode).toHaveBeenCalledWith({ nodeId: 'n1', parentId: null });
    expect(invalidateMock).toHaveBeenCalledWith('c1');
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entityType: 'ProcessNode', entityId: 'n1' }),
    );
  });

  it('creates a child one level below its parent', async () => {
    prismaMock.processNode.findFirst.mockResolvedValue({ id: 'p1', processLevelType: { levelNumber: 2 } });
    prismaMock.processLevelType.findFirst.mockResolvedValue({ id: 'lt3' });
    prismaMock.processNode.create.mockResolvedValue(raw({ id: 'c1', parentId: 'p1', processLevelType: { levelNumber: 3 } }));

    await VALUE_STREAMS.create('t1', 'c1', 'a@b.c', { name: 'Intake', parentId: 'p1' });
    expect(prismaMock.processLevelType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', levelNumber: 3 } }),
    );
    expect(closureServiceMock.insertNode).toHaveBeenCalledWith({ nodeId: 'c1', parentId: 'p1' });
  });

  it('rejects an unknown parent, over-deep nesting, and a missing level type', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce(null);
    await expect(
      VALUE_STREAMS.create('t1', 'c1', 'a@b.c', { name: 'X', parentId: 'ghost' }),
    ).rejects.toMatchObject({ status: 400, message: 'Parent node not found in this company' });

    prismaMock.processNode.findFirst.mockResolvedValueOnce({ id: 'p6', processLevelType: { levelNumber: 6 } });
    await expect(
      VALUE_STREAMS.create('t1', 'c1', 'a@b.c', { name: 'X', parentId: 'p6' }),
    ).rejects.toMatchObject({ status: 400, message: 'Cannot nest deeper than Level 6' });

    prismaMock.processLevelType.findFirst.mockResolvedValueOnce(null);
    await expect(VALUE_STREAMS.create('t1', 'c1', 'a@b.c', { name: 'X' })).rejects.toMatchObject({
      status: 400,
      message: 'This company has no level 1 configured',
    });
  });

  it('uses the org delegate + org level types for the ORGANIZATION spine (no attributes)', async () => {
    prismaMock.orgLevelType.findFirst.mockResolvedValue({ id: 'olt1' });
    prismaMock.orgUnit.create.mockResolvedValue({
      id: 'ou1',
      displayValue: 'Ops',
      dbValue: 'Ops',
      parentId: null,
      sortOrder: 0,
      orgLevelType: { levelNumber: 1 },
    });

    const row = await ORGANIZATION.create('t1', 'c1', 'a@b.c', { name: 'Ops' });
    expect(row).toMatchObject({ name: 'Ops', level: 'Level 1', description: null });
    const data = (prismaMock.orgUnit.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.orgLevelTypeId).toBe('olt1');
    expect(data).not.toHaveProperty('attributes');
    expect(prismaMock.processNode.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('returns null for a node outside this company', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce(null);
    expect(await VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'ghost', { name: 'X' })).toBeNull();
  });

  it('renames + merges detail attributes and audits the diff', async () => {
    prismaMock.processNode.findFirst
      .mockResolvedValueOnce(raw()) // before
      .mockResolvedValueOnce(raw({ displayValue: 'Claims v2' })); // after
    prismaMock.processNode.update.mockResolvedValue(raw());

    const row = await VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { name: 'Claims v2', notes: 'reworked' });
    expect(row?.name).toBe('Claims v2');

    const args = prismaMock.processNode.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.displayValue).toBe('Claims v2');
    // Detail merge keeps existing attribute keys and adds the edited one.
    expect(args.data.attributes).toMatchObject({ description: 'Handles claims', notes: 'reworked' });
    expect(closureServiceMock.moveSubtree).not.toHaveBeenCalled();
    expect(auditMock.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }));
  });

  it('rejects making a node its own parent', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce(raw());
    await expect(
      VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { parentId: 'n1' }),
    ).rejects.toMatchObject({ status: 400, message: 'A node cannot be its own parent' });
  });

  it('reparents via closure.moveSubtree, updating the level-type FK and the memo', async () => {
    prismaMock.processNode.findFirst
      .mockResolvedValueOnce(raw()) // before
      .mockResolvedValueOnce({ id: 'p2', processLevelType: { levelNumber: 1 } }) // new parent
      .mockResolvedValueOnce(raw({ parentId: 'p2' })); // after
    prismaMock.processLevelType.findFirst.mockResolvedValue({ id: 'lt2' });
    prismaMock.processNode.findUnique.mockResolvedValueOnce({ parentId: null }); // cycle-guard walk ends
    prismaMock.processNode.update.mockResolvedValue(raw());

    const row = await VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { parentId: 'p2' });
    expect(row?.parentId).toBe('p2');

    const args = prismaMock.processNode.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.processLevelTypeId).toBe('lt2');
    expect(closureServiceMock.moveSubtree).toHaveBeenCalledWith({ nodeId: 'n1', newParentId: 'p2' });
    expect(invalidateMock).toHaveBeenCalledWith('c1');
  });

  it('rejects moving a node under its own descendant (cycle guard)', async () => {
    prismaMock.processNode.findFirst
      .mockResolvedValueOnce(raw()) // before
      .mockResolvedValueOnce({ id: 'child', processLevelType: { levelNumber: 2 } }); // new parent = descendant
    prismaMock.processLevelType.findFirst.mockResolvedValue({ id: 'lt3' });
    // Walking up from "child" reaches n1 itself.
    prismaMock.processNode.findUnique.mockResolvedValueOnce({ parentId: 'n1' });

    await expect(
      VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { parentId: 'child' }),
    ).rejects.toMatchObject({ status: 400, message: 'Cannot move a node under its own descendant' });
    expect(closureServiceMock.moveSubtree).not.toHaveBeenCalled();
  });

  it('rejects a reparent that would exceed the maximum level', async () => {
    prismaMock.processNode.findFirst
      .mockResolvedValueOnce(raw())
      .mockResolvedValueOnce({ id: 'p6', processLevelType: { levelNumber: 6 } });
    await expect(
      VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { parentId: 'p6' }),
    ).rejects.toMatchObject({ status: 400, message: 'Cannot nest deeper than Level 6' });
  });

  it('moves to root (parentId: null) without touching the level-type FK', async () => {
    prismaMock.processNode.findFirst
      .mockResolvedValueOnce(raw({ parentId: 'p1' })) // before
      .mockResolvedValueOnce(raw({ parentId: null })); // after
    const row = await VALUE_STREAMS.update('t1', 'c1', 'a@b.c', 'n1', { parentId: null });
    expect(row?.parentId).toBeNull();
    expect(prismaMock.processNode.update).not.toHaveBeenCalled(); // no data fields changed
    expect(closureServiceMock.moveSubtree).toHaveBeenCalledWith({ nodeId: 'n1', newParentId: null });
  });
});

describe('remove', () => {
  it('deletes the whole subtree through the closure service and audits', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce({ id: 'n1', displayValue: 'Claims' });
    expect(await VALUE_STREAMS.remove('t1', 'c1', 'a@b.c', 'n1')).toBe(true);
    expect(closureServiceMock.deleteSubtree).toHaveBeenCalledWith({ nodeId: 'n1' });
    expect(invalidateMock).toHaveBeenCalledWith('c1');
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', diff: { name: 'Claims' } }),
    );
  });

  it('returns false (no delete) for a node outside this company', async () => {
    prismaMock.processNode.findFirst.mockResolvedValueOnce(null);
    expect(await VALUE_STREAMS.remove('t1', 'c1', 'a@b.c', 'ghost')).toBe(false);
    expect(closureServiceMock.deleteSubtree).not.toHaveBeenCalled();
  });
});
