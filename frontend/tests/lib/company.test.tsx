// company — CompanyProvider: company list loading, stored-choice persistence
// with fallback to the first company, and cache invalidation on switch.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../src/lib/api', () => ({ api: apiMock }));

import { CompanyProvider, useCompany } from '../../src/lib/company';

const wrapper = ({ children }: { children: ReactNode }) => <CompanyProvider>{children}</CompanyProvider>;
const LIST = [
  { id: 'c1', name: 'Acme Insurance', extra: 'dropped' },
  { id: 'c2', name: 'Globex' },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  apiMock.get.mockResolvedValue(LIST);
});

describe('useCompany', () => {
  it('throws outside a <CompanyProvider>', () => {
    expect(() => renderHook(() => useCompany())).toThrow('useCompany must be used within a CompanyProvider');
  });
});

describe('CompanyProvider', () => {
  it('loads companies and defaults to the first when nothing is stored', async () => {
    const { result } = renderHook(() => useCompany(), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiMock.get).toHaveBeenCalledWith('/companies');
    expect(result.current.companies).toEqual([
      { id: 'c1', name: 'Acme Insurance' },
      { id: 'c2', name: 'Globex' },
    ]);
    expect(result.current.companyId).toBe('c1');
    expect(result.current.company).toEqual({ id: 'c1', name: 'Acme Insurance' });
    expect(localStorage.getItem('cascade.companyId')).toBe('c1');
  });

  it('keeps a stored choice that is still valid', async () => {
    localStorage.setItem('cascade.companyId', 'c2');
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companyId).toBe('c2');
    expect(result.current.company?.name).toBe('Globex');
  });

  it('falls back to the first company when the stored id is stale', async () => {
    localStorage.setItem('cascade.companyId', 'deleted-co');
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companyId).toBe('c1');
    expect(localStorage.getItem('cascade.companyId')).toBe('c1');
  });

  it('setCompanyId persists the choice and drops cached GETs', async () => {
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setCompanyId('c2'));
    expect(result.current.companyId).toBe('c2');
    expect(localStorage.getItem('cascade.companyId')).toBe('c2');
    expect(apiMock.invalidate).toHaveBeenCalledTimes(1);
  });

  it('refresh() reloads the list; a failed load leaves state usable', async () => {
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiMock.get.mockRejectedValueOnce(new Error('network down'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companies).toHaveLength(2); // previous list retained
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });

  it('handles an empty company list (companyId null)', async () => {
    apiMock.get.mockResolvedValue([]);
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.companyId).toBeNull();
    expect(result.current.company).toBeNull();
  });
});
