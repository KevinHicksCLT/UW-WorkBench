// responseCache — a tiny in-memory GET response cache for the heavy read
// endpoints (work / explorer / applications). Those handlers fan out into several
// serial DB round-trips; against a remote Neon DB each round-trip costs real
// latency, so re-assembling the same JSON on every tab visit is the bulk of the
// load time. Caching the finished 200 body per (tenant + full URL) makes a repeat
// load within the TTL effectively free.
//
// Correctness: any mutation clears the whole cache (one global middleware in
// app.ts bumps on every non-GET request), so a write is always followed by fresh
// reads. The short TTL is only a backstop for data that changes outside the API.
//
// ⚠ Entitlements: the key is TENANT-scoped, not user-scoped. That is safe only
// while permission enforcement is router-level and runs BEFORE this middleware
// (requirePermission → cacheResponses), so every user who reaches a cached
// endpoint is entitled to the identical body. The moment row-level ABAC
// filtering (org / value-stream / geography data scoping) lands inside a cached
// endpoint, this key MUST become `${tenantId}:${userId}:${originalUrl}`.
import type { Request, Response, NextFunction } from 'express';

type Entry = { exp: number; data: unknown };
const store = new Map<string, Entry>();

// Cleared wholesale on any mutation — see app.ts. Cheap: the map only ever holds
// a handful of read endpoints × active companies.
export function clearResponseCache(): void {
  store.clear();
}

export function cacheResponses(ttlMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    const key = `${req.tenantId ?? ''}:${req.originalUrl}`;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.exp > now) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit.data);
    }
    if (hit) store.delete(key); // expired
    const orig = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode === 200) store.set(key, { exp: now + ttlMs, data: body });
      return orig(body);
    }) as Response['json'];
    next();
  };
}
