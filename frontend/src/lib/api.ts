const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('cascade.token');
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Multipart body (file upload) — sent as-is, browser sets the boundary header. */
  form?: FormData;
  headers?: Record<string, string>;
};

// One-shot 403 hook: the AuthProvider registers refreshMe here so a permission
// revoked mid-session re-syncs the client's view. Throttled — a burst of 403s
// (one stale page firing several requests) triggers a single refresh.
let forbiddenHandler: (() => void) | null = null;
let lastForbiddenRefresh = 0;
export function setForbiddenHandler(fn: (() => void) | null): void {
  forbiddenHandler = fn;
}

async function request(
  path: string,
  { method = 'GET', body, form, headers = {} }: RequestOptions = {},
) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(form === undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401) {
    localStorage.removeItem('cascade.token');
    localStorage.removeItem('cascade.user');
    if (location.pathname !== '/login') location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 403 && forbiddenHandler && Date.now() - lastForbiddenRefresh > 30_000) {
    lastForbiddenRefresh = Date.now();
    forbiddenHandler();
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
  const p = request(path).catch((e) => {
    getCache.delete(path);
    throw e;
  });
  getCache.set(path, p);
  return p;
}

// invalidate:'none' exists for high-frequency auto-save writes (the preference
// store PATCHes every ~800ms while the user drags things around) — those must
// NOT wipe the app's warm GET cache.
type MutateOptions = { invalidate?: 'all' | 'none' };

function mutate(path: string, method: string, body?: unknown, opts?: MutateOptions) {
  return request(path, { method, body }).finally(() => {
    if (opts?.invalidate !== 'none') getCache.clear();
  });
}

export const api = {
  // Generic so call sites can type the payload: api.get<Foo[]>('/foos').
  get: <T = unknown>(p: string) => cachedGet(p) as Promise<T>,
  post: (p: string, body?: unknown, opts?: MutateOptions) => mutate(p, 'POST', body, opts),
  put: (p: string, body?: unknown, opts?: MutateOptions) => mutate(p, 'PUT', body, opts),
  patch: (p: string, body?: unknown, opts?: MutateOptions) => mutate(p, 'PATCH', body, opts),
  delete: (p: string, opts?: MutateOptions) => mutate(p, 'DELETE', undefined, opts),
  // Multipart upload (spreadsheet import). Clears the GET cache like any write.
  upload: (p: string, form: FormData) =>
    request(p, { method: 'POST', form }).finally(() => getCache.clear()),
  // Warm the cache for a path the user is likely to visit next (e.g. on nav
  // hover). Fire-and-forget; a failed warm is swallowed and evicted by cachedGet.
  prefetch: (p: string) => {
    cachedGet(p).catch(() => {});
  },
  // Drop cached GETs — one path, or all when omitted.
  invalidate: (p?: string) => {
    if (p) getCache.delete(p);
    else getCache.clear();
  },
};
