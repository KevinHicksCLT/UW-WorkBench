// inChunks — the guard against Postgres' 32,767 bind-variable cap on batched
// `{ in: ids }` reads. Pure function over an injected query runner, so no prisma.
import { describe, expect, it, vi } from 'vitest';

import { ID_CHUNK, inChunks } from '../../src/lib/inChunks.js';

const ids = (n: number, prefix = 'n') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('inChunks', () => {
  it('issues a single query when the id list fits in one chunk', async () => {
    const run = vi.fn().mockResolvedValue([{ id: 'a' }]);
    const out = await inChunks(['a', 'b'], run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(['a', 'b']);
    expect(out).toEqual([{ id: 'a' }]);
  });

  it('splits an oversized list and concatenates the rows in id order', async () => {
    const all = ids(7);
    const run = vi.fn().mockImplementation((chunk: string[]) => Promise.resolve(chunk));

    const out = await inChunks(all, run, 3);

    expect(run.mock.calls.map((c) => c[0])).toEqual([
      ['n0', 'n1', 'n2'],
      ['n3', 'n4', 'n5'],
      ['n6'],
    ]);
    expect(out).toEqual(all);
  });

  it('never sends a chunk that could exceed the bind-variable cap', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await inChunks(ids(40_000), run);

    expect(ID_CHUNK).toBeLessThan(32_767);
    for (const [chunk] of run.mock.calls) expect(chunk.length).toBeLessThanOrEqual(ID_CHUNK);
    expect(run.mock.calls.flatMap(([chunk]) => chunk as string[])).toHaveLength(40_000);
  });

  it('runs chunks sequentially so the connection pool is not starved', async () => {
    let inFlight = 0;
    let peak = 0;
    const run = vi.fn().mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
      return [];
    });

    await inChunks(ids(10), run, 2);

    expect(run).toHaveBeenCalledTimes(5);
    expect(peak).toBe(1);
  });

  it('passes an empty list straight through', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(await inChunks([], run)).toEqual([]);
    expect(run).toHaveBeenCalledWith([]);
  });
});
