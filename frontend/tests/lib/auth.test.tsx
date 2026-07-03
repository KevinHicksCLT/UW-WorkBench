// auth — AuthProvider session lifecycle: localStorage bootstrap, /auth/me
// validation, login persistence, and logout cleanup. api is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), invalidate: vi.fn() }));
const setForbiddenHandlerMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/api', () => ({
  api: apiMock,
  setForbiddenHandler: setForbiddenHandlerMock,
}));

import { AuthProvider, useAuth } from '../../src/lib/auth';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const me = {
  id: 'u1',
  email: 'kevin.hicks@capgemini.com',
  name: 'Kevin',
  role: 'ADMIN',
  tenantId: 't1',
};
// cascade.user stores the whole /auth/me payload (identity + entitlements).
const meResponse = {
  user: me,
  permissions: { menus: ['home'] },
  attributes: {},
  startPage: 'home',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useAuth', () => {
  it('throws outside an <AuthProvider>', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
  });
});

describe('AuthProvider', () => {
  it('starts logged out (no token) and finishes loading without calling the API', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('hydrates the user from localStorage and revalidates via /auth/me', async () => {
    localStorage.setItem('cascade.token', 'tok');
    localStorage.setItem(
      'cascade.user',
      JSON.stringify({ ...meResponse, user: { ...me, name: 'Stale Name' } }),
    );
    apiMock.get.mockResolvedValue(meResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?.name).toBe('Stale Name'); // synchronous bootstrap

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.get).toHaveBeenCalledWith('/auth/me');
    expect(result.current.user).toEqual(me); // refreshed
    expect(JSON.parse(localStorage.getItem('cascade.user') ?? '')).toEqual(meResponse);
  });

  it('clears the session when /auth/me rejects', async () => {
    localStorage.setItem('cascade.token', 'bad-tok');
    localStorage.setItem('cascade.user', JSON.stringify(me));
    apiMock.get.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('cascade.token')).toBeNull();
    expect(localStorage.getItem('cascade.user')).toBeNull();
  });

  it('login stores the token + me payload and updates state', async () => {
    apiMock.post.mockResolvedValue({ token: 'fresh-tok' });
    apiMock.get.mockResolvedValue(meResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.login('kevin.hicks@capgemini.com', 'demo1234');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/auth/login', {
      email: 'kevin.hicks@capgemini.com',
      password: 'demo1234',
    });
    expect(apiMock.get).toHaveBeenCalledWith('/auth/me');
    expect(returned).toEqual(meResponse);
    expect(result.current.user).toEqual(me);
    expect(localStorage.getItem('cascade.token')).toBe('fresh-tok');
    expect(JSON.parse(localStorage.getItem('cascade.user') ?? '')).toEqual(meResponse);
  });

  it('logout clears storage and state', async () => {
    apiMock.post.mockResolvedValue({ token: 'tok' });
    apiMock.get.mockResolvedValue(meResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login(me.email, 'demo1234');
    });

    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('cascade.token')).toBeNull();
    expect(localStorage.getItem('cascade.user')).toBeNull();
  });
});
