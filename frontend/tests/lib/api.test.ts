// api — the fetch wrapper: auth header injection, 401 → /login redirect +
// token cleanup, GET promise cache/dedupe, mutation cache clearing, and
// invalidate/prefetch. fetch and location are stubbed; localStorage is jsdom's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/lib/api';

type FetchArgs = { url: string; init: RequestInit };

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
const locationStub = { pathname: '/roles', href: '' };

function lastCall(): FetchArgs {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: call[0], init: call[1] };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  locationStub.pathname = '/roles';
  locationStub.href = '';
  vi.stubGlobal('location', locationStub);
  localStorage.clear();
  api.invalidate(); // the GET cache is module-level state
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request shaping', () => {
  it('prefixes /api and sends JSON headers without Authorization when logged out', async () => {
    await api.get('/roles');
    const { url, init } = lastCall();
    expect(url).toBe('/api/roles');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBeUndefined();
  });

  it('adds the Bearer token from localStorage when present', async () => {
    localStorage.setItem('cascade.token', 'tok-123');
    await api.get('/work');
    expect((lastCall().init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('serializes mutation bodies as JSON', async () => {
    await api.post('/roles', { name: 'Adjuster' });
    const { init } = lastCall();
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Adjuster' }));
  });

  it('returns the parsed JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ rows: [1] }));
    expect(await api.get('/rows')).toEqual({ rows: [1] });
  });

  it('returns null for 204 No Content', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => {
        throw new Error('no body');
      },
    } as unknown as Response);
    expect(await api.delete('/roles/r1')).toBeNull();
  });
});

describe('401 handling', () => {
  it('clears the session, redirects to /login, and throws Unauthorized', async () => {
    localStorage.setItem('cascade.token', 'tok');
    localStorage.setItem('cascade.user', '{"id":"u1"}');
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    await expect(api.get('/secure')).rejects.toThrow('Unauthorized');
    expect(localStorage.getItem('cascade.token')).toBeNull();
    expect(localStorage.getItem('cascade.user')).toBeNull();
    expect(locationStub.href).toBe('/login');
  });

  it('does not redirect again when already on /login', async () => {
    locationStub.pathname = '/login';
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    await expect(api.post('/auth/login', {})).rejects.toThrow('Unauthorized');
    expect(locationStub.href).toBe('');
  });
});

describe('error handling', () => {
  it('throws the server-provided error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Name is required' }, 400));
    await expect(api.post('/roles', {})).rejects.toThrow('Name is required');
  });

  it('falls back to HTTP <status> when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(api.get('/boom')).rejects.toThrow('Internal Server Error');
  });
});

describe('GET cache', () => {
  it('serves a repeat GET for the same path from the cached promise', async () => {
    await api.get('/roles');
    await api.get('/roles');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await api.get('/other');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent GETs for the same path', async () => {
    const [a, b] = await Promise.all([api.get('/roles'), api.get('/roles')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('evicts a failed GET so the next call retries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 500));
    await expect(api.get('/flaky')).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(api.get('/flaky')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears the whole cache after any mutation settles', async () => {
    await api.get('/roles');
    await api.put('/roles/r1', { name: 'x' });
    await api.get('/roles'); // must refetch
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears the cache even when the mutation fails', async () => {
    await api.get('/roles');
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 400));
    await expect(api.delete('/roles/r1')).rejects.toThrow('bad');
    await api.get('/roles');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('invalidate(path) drops one entry; invalidate() drops all', async () => {
    await api.get('/a');
    await api.get('/b');
    api.invalidate('/a');
    await api.get('/a'); // refetch
    await api.get('/b'); // still cached
    expect(fetchMock).toHaveBeenCalledTimes(3);

    api.invalidate();
    await api.get('/b');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('prefetch warms the cache and swallows failures', async () => {
    api.prefetch('/warm');
    await Promise.resolve(); // let the fire-and-forget promise start
    await api.get('/warm');
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from the warmed entry

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    api.prefetch('/warm-fail'); // must not produce an unhandled rejection
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('PATCH goes through the mutation path (no caching)', async () => {
    await api.patch('/roles/r1', { name: 'y' });
    await api.patch('/roles/r1', { name: 'y' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastCall().init.method).toBe('PATCH');
  });
});
