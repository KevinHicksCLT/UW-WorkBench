// responseCache — TTL hit/miss + clearResponseCache semantics, exercised with
// fake timers and hand-rolled Express req/res doubles (no network).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { cacheResponses, clearResponseCache } from '../../src/lib/responseCache.js';

type ResDouble = Response & { sent: unknown[]; headers: Record<string, string> };

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/work?limit=10',
    tenantId: 't1',
    ...overrides,
  } as Request;
}

function makeRes(statusCode = 200): ResDouble {
  const res = {
    statusCode,
    sent: [] as unknown[],
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    json(body: unknown) {
      res.sent.push(body);
      return res;
    },
  };
  return res as unknown as ResDouble;
}

function run(mw: ReturnType<typeof cacheResponses>, req: Request, res: Response): boolean {
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  mw(req, res, next);
  return nextCalled;
}

describe('cacheResponses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearResponseCache();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('misses on first GET, stores the 200 body, and serves the second GET from cache', () => {
    const mw = cacheResponses(1000);

    const res1 = makeRes();
    expect(run(mw, makeReq(), res1)).toBe(true); // miss → next()
    res1.json({ rows: [1, 2] }); // handler responds; body captured

    const res2 = makeRes();
    expect(run(mw, makeReq(), res2)).toBe(false); // hit → short-circuits
    expect(res2.headers['X-Cache']).toBe('HIT');
    expect(res2.sent).toEqual([{ rows: [1, 2] }]);
  });

  it('expires entries after the TTL', () => {
    const mw = cacheResponses(1000);
    const res1 = makeRes();
    run(mw, makeReq(), res1);
    res1.json({ v: 1 });

    vi.advanceTimersByTime(1001);
    const res2 = makeRes();
    expect(run(mw, makeReq(), res2)).toBe(true); // expired → treated as miss
    expect(res2.headers['X-Cache']).toBeUndefined();
  });

  it('keys entries by tenant + full URL', () => {
    const mw = cacheResponses(1000);
    const res1 = makeRes();
    run(mw, makeReq({ tenantId: 'tenant-a' } as Partial<Request>), res1);
    res1.json({ tenant: 'a' });

    // Different tenant, same URL → miss.
    const res2 = makeRes();
    expect(run(mw, makeReq({ tenantId: 'tenant-b' } as Partial<Request>), res2)).toBe(true);

    // Different URL, same tenant → miss.
    const res3 = makeRes();
    expect(run(mw, makeReq({ tenantId: 'tenant-a', originalUrl: '/other' } as Partial<Request>), res3)).toBe(true);
  });

  it('does not cache non-200 responses', () => {
    const mw = cacheResponses(1000);
    const res1 = makeRes(404);
    run(mw, makeReq(), res1);
    res1.json({ error: 'not found' });

    const res2 = makeRes();
    expect(run(mw, makeReq(), res2)).toBe(true); // still a miss
  });

  it('skips non-GET requests entirely', () => {
    const mw = cacheResponses(1000);
    const res = makeRes();
    expect(run(mw, makeReq({ method: 'POST' } as Partial<Request>), res)).toBe(true);
    res.json({ ok: true });

    // The POST body must not have been stored under the GET key.
    const res2 = makeRes();
    expect(run(mw, makeReq(), res2)).toBe(true);
  });

  it('clearResponseCache drops every entry', () => {
    const mw = cacheResponses(60_000);
    const res1 = makeRes();
    run(mw, makeReq(), res1);
    res1.json({ v: 1 });

    clearResponseCache();
    const res2 = makeRes();
    expect(run(mw, makeReq(), res2)).toBe(true);
  });
});
