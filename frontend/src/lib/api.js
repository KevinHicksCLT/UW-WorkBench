const BASE = '/api';

function getToken() {
  return localStorage.getItem('cascade.token');
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
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
  get:    (p)            => request(p),
  post:   (p, body)      => request(p, { method: 'POST', body }),
  patch:  (p, body)      => request(p, { method: 'PATCH', body }),
  delete: (p)            => request(p, { method: 'DELETE' }),
};
