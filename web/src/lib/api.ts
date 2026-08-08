const BASE = '/api';

const TOKEN_KEY = 'uw.token';
const USER_KEY = 'uw.user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, email);
}

export function getSessionEmail(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/** Server error contract: 422 validation_failed carries per-field violations;
 *  403/409 semantic gates carry the violated invariant. Render both readably. */
function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    const p = payload as {
      error?: unknown;
      invariant?: unknown;
      violations?: { field?: string; message?: string }[];
    };
    if (p.error === 'validation_failed' && Array.isArray(p.violations)) {
      return p.violations
        .map((v) => (v.field ? `${v.field}: ${v.message ?? 'invalid'}` : (v.message ?? 'invalid')))
        .join('; ');
    }
    if (typeof p.error === 'string' && p.error) {
      return typeof p.invariant === 'string' ? `${p.error} (${p.invariant})` : p.error;
    }
  }
  return `HTTP ${status}`;
}

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
    clearSession();
    if (location.pathname !== '/login' && location.pathname !== '/signup') {
      location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorMessage(payload, res.status));
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── GET response cache ────────────────────────────────────────────────────────
// List screens refetch their full collection on every mount; cache the GET
// promise by path so a repeat visit resolves instantly, and dedupe concurrent
// requests. Any mutation clears the cache once it settles, so writes are
// always followed by fresh reads. A failed GET is evicted to retry.
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

function mutate(path: string, method: string, body?: unknown) {
  return request(path, { method, body }).finally(() => getCache.clear());
}

export const api = {
  // Generic so call sites can type the payload: api.get<Foo[]>('/foos').
  get: <T = unknown>(p: string) => cachedGet(p) as Promise<T>,
  post: (p: string, body?: unknown) => mutate(p, 'POST', body),
  put: (p: string, body?: unknown) => mutate(p, 'PUT', body),
  patch: (p: string, body?: unknown) => mutate(p, 'PATCH', body),
  delete: (p: string) => mutate(p, 'DELETE'),
  // Drop cached GETs — one path, or all when omitted.
  invalidate: (p?: string) => {
    if (p) getCache.delete(p);
    else getCache.clear();
  },
};
