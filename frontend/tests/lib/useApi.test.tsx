// useApi — loading/data/error state machine + refetch, with the api module mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../src/lib/api', () => ({ api: apiMock }));

import { useApi } from '../../src/lib/useApi';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useApi', () => {
  it('starts loading, then exposes the data', async () => {
    apiMock.get.mockResolvedValue({ rows: [1, 2] });
    const { result } = renderHook(() => useApi<{ rows: number[] }>('/roles'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ rows: [1, 2] });
    expect(result.current.error).toBe('');
    expect(apiMock.get).toHaveBeenCalledWith('/roles');
  });

  it('exposes the error message on failure', async () => {
    apiMock.get.mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(() => useApi('/boom'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.data).toBeNull();
  });

  it('skips fetching for a null path', async () => {
    const { result } = renderHook(() => useApi(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('refetch() re-runs the request and clears a previous error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('boom'));
    apiMock.get.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useApi('/retry'));

    await waitFor(() => expect(result.current.error).toBe('boom'));
    result.current.refetch();
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBe('');
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });

  it('refetches when the path changes', async () => {
    apiMock.get.mockResolvedValue({ ok: true });
    const { rerender } = renderHook(({ path }: { path: string }) => useApi(path), {
      initialProps: { path: '/a' },
    });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/a'));
    rerender({ path: '/b' });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/b'));
  });

  it('ignores a stale response after unmount (no state update)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolve: (v: unknown) => void = () => {};
    apiMock.get.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderHook(() => useApi('/slow'));
    unmount();
    resolve({ late: true }); // must not warn about post-unmount setState
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
