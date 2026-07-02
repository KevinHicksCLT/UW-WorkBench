// closure.ts — transactional closure-table maintenance, exercised against a
// mocked prisma whose $transaction hands the callback a capturing tx double.
// Assertions cover the generated SQL (table identifiers + bound values) and the
// row math each primitive is responsible for.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TxDouble = {
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
};

const { tx, prismaMock } = vi.hoisted(() => {
  const txDouble = {
    $executeRawUnsafe: vi.fn(async (..._args: unknown[]): Promise<number> => 0),
    $queryRawUnsafe: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
  };
  return {
    tx: txDouble,
    prismaMock: {
      $transaction: vi.fn(async (fn: (t: typeof txDouble) => Promise<unknown>) => fn(txDouble)),
    },
  };
});
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { closureFor, moveProcessSubtreeTx, moveSubtreeWithRelevel, orgClosure, processClosure } from '../../src/lib/closure.js';

// The tx double stands in for Prisma's interactive-transaction client.
const txArg = tx as unknown as Parameters<typeof moveProcessSubtreeTx>[0];

/** All (sql, params) pairs captured by $executeRawUnsafe, normalized. */
function execCalls(t: TxDouble): { sql: string; params: unknown[] }[] {
  return t.$executeRawUnsafe.mock.calls.map((c: unknown[]) => ({
    sql: String(c[0]).replace(/\s+/g, ' ').trim(),
    params: c.slice(1),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.$queryRawUnsafe.mockResolvedValue([]);
});

describe('insertNode', () => {
  it('writes only the self-row for a root node', async () => {
    await processClosure.insertNode({ nodeId: 'n1', parentId: null });

    const calls = execCalls(tx);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('INSERT INTO "ProcessNodeClosure"');
    expect(calls[0].sql).toContain('VALUES ($1, $1, 0)');
    expect(calls[0].params).toEqual(['n1']);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('writes the self-row plus one row per parent ancestor at depth+1', async () => {
    await processClosure.insertNode({ nodeId: 'child', parentId: 'parent' });

    const calls = execCalls(tx);
    expect(calls).toHaveLength(2);
    // Ancestor rows are derived from the parent's own closure chain.
    expect(calls[1].sql).toContain('SELECT c."ancestorId", $1, c."depth" + 1');
    expect(calls[1].sql).toContain('WHERE c."descendantId" = $2');
    expect(calls[1].params).toEqual(['child', 'parent']);
  });

  it('targets the OrgUnitClosure tables for the org spine', async () => {
    await orgClosure.insertNode({ nodeId: 'ou1', parentId: null });
    expect(execCalls(tx)[0].sql).toContain('INSERT INTO "OrgUnitClosure"');
  });
});

describe('moveSubtree', () => {
  it('drops external cross-edges, relinks to the new parent chain, then updates parentId', async () => {
    await processClosure.moveSubtree({ nodeId: 'n1', newParentId: 'p2' });

    const calls = execCalls(tx);
    expect(calls).toHaveLength(3);
    // (a) delete: descendants inside the subtree, ancestors outside it.
    expect(calls[0].sql).toContain('DELETE FROM "ProcessNodeClosure"');
    expect(calls[0].sql).toContain('AND "ancestorId" NOT IN');
    expect(calls[0].params).toEqual(['n1']);
    // (b) relink: cross join of new-parent ancestors × subtree descendants.
    expect(calls[1].sql).toContain('SELECT a."ancestorId", d."descendantId", a."depth" + d."depth" + 1');
    expect(calls[1].params).toEqual(['p2', 'n1']);
    // (c) persist the parent pointer.
    expect(calls[2].sql).toContain('UPDATE "ProcessNode" SET "parentId" = $1');
    expect(calls[2].params).toEqual(['p2', 'n1']);
  });

  it('skips the relink step when the node becomes a root', async () => {
    await processClosure.moveSubtree({ nodeId: 'n1', newParentId: null });
    const calls = execCalls(tx);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain('DELETE FROM');
    expect(calls[1].sql).toContain('UPDATE "ProcessNode" SET "parentId" = $1');
    expect(calls[1].params).toEqual([null, 'n1']);
  });
});

describe('moveProcessSubtreeTx (re-level)', () => {
  it('rewrites processLevelTypeId per relative depth after the move', async () => {
    const levelByDepth = new Map([
      [0, 'lt-4'],
      [1, 'lt-5'],
    ]);
    await moveProcessSubtreeTx(txArg, 'n1', 'p2', levelByDepth);

    const calls = execCalls(tx);
    // 3 move statements + one UPDATE per distinct depth.
    expect(calls).toHaveLength(5);
    expect(calls[3].sql).toContain('SET "processLevelTypeId" = $1');
    expect(calls[3].sql).toContain('AND "depth" = $3');
    expect(calls[3].params).toEqual(['lt-4', 'n1', 0]);
    expect(calls[4].params).toEqual(['lt-5', 'n1', 1]);
  });

  it('leaves levels untouched when levelByDepth is empty', async () => {
    await moveProcessSubtreeTx(txArg, 'n1', null, new Map());
    expect(execCalls(tx)).toHaveLength(2); // delete + parentId update only
  });
});

describe('moveSubtreeWithRelevel (own transaction)', () => {
  it('runs move + re-level inside one $transaction on the requested spine', async () => {
    await moveSubtreeWithRelevel({
      spine: 'orgUnit',
      nodeId: 'ou1',
      newParentId: 'ou2',
      levelByDepth: new Map([[0, 'olt-3']]),
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const calls = execCalls(tx);
    expect(calls[0].sql).toContain('"OrgUnitClosure"');
    expect(calls[3].sql).toContain('SET "orgLevelTypeId" = $1');
  });
});

describe('deleteSubtree', () => {
  it('deletes closure rows touching any subtree id and the node rows, returning the count', async () => {
    tx.$queryRawUnsafe.mockResolvedValueOnce([{ descendantId: 'n1' }, { descendantId: 'c1' }]);

    const removed = await processClosure.deleteSubtree({ nodeId: 'n1' });
    expect(removed).toBe(2);

    expect(tx.$queryRawUnsafe.mock.calls[0][1]).toBe('n1');
    const calls = execCalls(tx);
    expect(calls[0].sql).toContain('DELETE FROM "ProcessNodeClosure"');
    expect(calls[0].sql).toContain('"ancestorId" = ANY($1::text[]) OR "descendantId" = ANY($1::text[])');
    expect(calls[0].params).toEqual([['n1', 'c1']]);
    expect(calls[1].sql).toContain('DELETE FROM "ProcessNode" WHERE "id" = ANY($1::text[])');
    expect(calls[1].params).toEqual([['n1', 'c1']]);
  });

  it('falls back to the node itself when the closure has no rows', async () => {
    tx.$queryRawUnsafe.mockResolvedValueOnce([]);
    const removed = await processClosure.deleteSubtree({ nodeId: 'legacy' });
    expect(removed).toBe(1);
    expect(execCalls(tx)[1].params).toEqual([['legacy']]);
  });
});

describe('rebuildClosure', () => {
  it('wipes the company closure, regenerates via recursive CTE, and returns the row count', async () => {
    tx.$queryRawUnsafe.mockResolvedValueOnce([{ n: 42n }]);

    const count = await processClosure.rebuildClosure({ companyId: 'co1' });
    expect(count).toBe(42);

    const calls = execCalls(tx);
    expect(calls[0].sql).toContain('DELETE FROM "ProcessNodeClosure"');
    expect(calls[0].params).toEqual(['co1']);
    expect(calls[1].sql).toContain('WITH RECURSIVE cte AS');
    expect(calls[1].params).toEqual(['co1']);
  });

  it('returns 0 when the count query yields no rows', async () => {
    tx.$queryRawUnsafe.mockResolvedValueOnce([]);
    expect(await orgClosure.rebuildClosure({ companyId: 'co1' })).toBe(0);
  });
});

describe('closureFor', () => {
  it('maps spine names to the matching service', () => {
    expect(closureFor('processNode')).toBe(processClosure);
    expect(closureFor('orgUnit')).toBe(orgClosure);
  });
});
