// govRollup — governance rollups derived from raw SQL, with prisma.$queryRaw
// mocked (Prisma.sql template building stays real).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { subtreeRegulations, subtreeStandards, vsForRegulations, vsForStandards } from '../../src/lib/govRollup.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('vsForStandards', () => {
  it('groups value-stream refs per standard id', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { eid: 'std-1', id: 'vs-1', name: 'Claims', domain: 'Insurance' },
      { eid: 'std-1', id: 'vs-2', name: 'Underwriting', domain: 'Insurance' },
      { eid: 'std-2', id: 'vs-1', name: 'Claims', domain: null },
    ]);

    const out = await vsForStandards(['std-1', 'std-2']);
    expect(out.get('std-1')).toEqual([
      { id: 'vs-1', name: 'Claims', domain: 'Insurance' },
      { id: 'vs-2', name: 'Underwriting', domain: 'Insurance' },
    ]);
    expect(out.get('std-2')).toEqual([{ id: 'vs-1', name: 'Claims', domain: null }]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns an empty map without querying for an empty id list', async () => {
    const out = await vsForStandards([]);
    expect(out.size).toBe(0);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('vsForRegulations', () => {
  it('groups value-stream refs per regulation id', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { eid: 'reg-1', id: 'vs-1', name: 'Claims', domain: 'Insurance' },
    ]);
    const out = await vsForRegulations(['reg-1']);
    expect(out.get('reg-1')).toEqual([{ id: 'vs-1', name: 'Claims', domain: 'Insurance' }]);
  });

  it('short-circuits on empty input', async () => {
    expect((await vsForRegulations([])).size).toBe(0);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('subtreeStandards / subtreeRegulations', () => {
  it('passes the raw rows through', async () => {
    const stdRows = [{ standardId: 's1', name: 'Coding Standard' }];
    prismaMock.$queryRaw.mockResolvedValueOnce(stdRows);
    expect(await subtreeStandards('root-1')).toBe(stdRows);

    const regRows = [{ regId: 'r1', title: 'GDPR Art. 5' }];
    prismaMock.$queryRaw.mockResolvedValueOnce(regRows);
    expect(await subtreeRegulations('root-1')).toBe(regRows);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
