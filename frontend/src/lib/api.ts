const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('cascade.token');
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request(path: string, { method = 'GET', body, headers = {} }: RequestOptions = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem('cascade.token');
    localStorage.removeItem('cascade.user');
    if (location.pathname !== '/login') location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── GET response cache ────────────────────────────────────────────────────────
// Big list screens refetch their full collection on every mount, so navigating
// away and back re-pays the whole round-trip. Cache the GET promise by path so a
// repeat visit resolves instantly, and dedupe concurrent requests for the same
// path. Any mutation (POST/PUT/PATCH/DELETE) clears the cache once it settles, so
// writes are always followed by fresh reads. A failed GET is evicted to retry.
const getCache = new Map<string, Promise<unknown>>();

function cachedGet(path: string): Promise<unknown> {
  const hit = getCache.get(path);
  if (hit) return hit;
  const p = request(path).catch((e) => { getCache.delete(path); throw e; });
  getCache.set(path, p);
  return p;
}

function mutate(path: string, method: string, body?: unknown) {
  return request(path, { method, body }).finally(() => getCache.clear());
}

export const api = {
  // Generic so call sites can type the payload: api.get<Foo[]>('/foos').
  get: <T = unknown>(p: string) => cachedGet(p) as Promise<T>,
  post:   (p: string, body?: unknown) => mutate(p, 'POST', body),
  put:    (p: string, body?: unknown) => mutate(p, 'PUT', body),
  patch:  (p: string, body?: unknown) => mutate(p, 'PATCH', body),
  delete: (p: string)                => mutate(p, 'DELETE'),
  // Warm the cache for a path the user is likely to visit next (e.g. on nav
  // hover). Fire-and-forget; a failed warm is swallowed and evicted by cachedGet.
  prefetch: (p: string) => { cachedGet(p).catch(() => {}); },
  // Drop cached GETs — one path, or all when omitted.
  invalidate: (p?: string) => { if (p) getCache.delete(p); else getCache.clear(); },
};
