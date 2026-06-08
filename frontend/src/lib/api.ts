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

export const api = {
  get:    (p: string)                => request(p),
  post:   (p: string, body?: unknown) => request(p, { method: 'POST', body }),
  put:    (p: string, body?: unknown) => request(p, { method: 'PUT', body }),
  patch:  (p: string, body?: unknown) => request(p, { method: 'PATCH', body }),
  delete: (p: string)                => request(p, { method: 'DELETE' }),
};
