// useVocabulary — the 3-A hook: loads the domain vocabulary (fixture fallback)
// and derives every lookup the board renders from. Nothing downstream should
// need a hardcoded vocab array.
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVocabulary } from '../../../src/pages/greenfield-migration/useVocabulary';

vi.mock('../../../src/lib/company', () => ({
  useCompany: () => ({ companyId: 'hook-co', loading: false }),
}));
vi.mock('../../../src/lib/api', () => ({
  api: { get: vi.fn(() => Promise.reject(new Error('404'))), post: vi.fn(), patch: vi.fn() },
}));

describe('useVocabulary', () => {
  it('derives the application-domain lookups from the fixture fallback', async () => {
    const { result } = renderHook(() => useVocabulary('APPLICATION'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe('fixture');
    expect(result.current.layers).toEqual([
      'UI',
      'Integration',
      'Business Service',
      'Data',
      'Infrastructure',
    ]);
    expect(result.current.modes.map((m) => m.label)).toEqual([
      'Applications',
      'Value streams',
      'Roles',
    ]);
    expect(result.current.views.map((v) => v.value)).toEqual(['COMPONENT', 'BEHAVIOR']);
    expect(result.current.classification.byToken.Relocate.stays).toBe(false);
    expect(result.current.matchMeta.AUTO.legend).toContain('semantically same');
    expect(result.current.legend.length).toBeGreaterThanOrEqual(3);
  });

  it('switches the axis and modes when the domain changes', async () => {
    const { result, rerender } = renderHook(({ d }) => useVocabulary(d), {
      initialProps: { d: 'APPLICATION' as const },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ d: 'PRODUCT_MODEL' as never });
    await waitFor(() => expect(result.current.layers).toHaveLength(11));
    expect(result.current.modes.map((m) => m.label)).toEqual([
      'Legacy Product Models',
      'Segment',
      'Geography',
    ]);
    // Products define no VIEW axis — the toggle hides.
    expect(result.current.views).toEqual([]);
    expect(result.current.classification.byToken.Segment.stays).toBe(true);
  });
});
