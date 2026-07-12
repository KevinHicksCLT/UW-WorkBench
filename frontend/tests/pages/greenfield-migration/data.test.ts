// data — the live→fixture data-source seam: every read tries the endpoint
// and falls back to the §6.2 contract fixtures, so Agent 2 landing the routes
// is a data-source swap, not a rewrite. PM-05 filters apply client-side on
// the fixture path.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../src/lib/api';
import {
  fetchProductModels,
  fetchProductWorkspaceDetail,
  fetchProductWorkspaces,
  fetchVocabulary,
} from '../../../src/pages/greenfield-migration/data';
import { fixtureProductModels } from '../../../src/pages/greenfield-migration/fixtures';

vi.mock('../../../src/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const mockedGet = vi.mocked(api.get);

beforeEach(() => {
  mockedGet.mockReset();
});

describe('fetchVocabulary', () => {
  it('returns live rows when the endpoint responds', async () => {
    const rows = [
      {
        domain: 'APPLICATION',
        kind: 'LAYER',
        token: 'UI',
        label: 'UI',
        color: null,
        sortOrder: 0,
        meta: null,
      },
    ];
    mockedGet.mockResolvedValueOnce({ vocabulary: rows });
    const res = await fetchVocabulary('APPLICATION', 'live-co');
    expect(res.source).toBe('live');
    expect(res.data).toEqual(rows);
    expect(mockedGet).toHaveBeenCalledWith(
      '/rationalization/vocabulary?domain=APPLICATION&companyId=live-co',
    );
  });

  it('falls back to the §6.4 fixture (and caches) when the endpoint is missing', async () => {
    mockedGet.mockRejectedValueOnce(new Error('404'));
    const res = await fetchVocabulary('PRODUCT_MODEL', 'fallback-co');
    expect(res.source).toBe('fixture');
    expect(res.data.every((r) => r.domain === 'PRODUCT_MODEL')).toBe(true);
    // Cached — a second call must not re-hit the API.
    const again = await fetchVocabulary('PRODUCT_MODEL', 'fallback-co');
    expect(again.source).toBe('fixture');
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});

describe('product-model reads', () => {
  it('falls back to fixture models and a single fixture workspace row', async () => {
    mockedGet.mockRejectedValue(new Error('404'));
    const models = await fetchProductModels('c1');
    expect(models.source).toBe('fixture');
    expect(models.data.map((m) => m.id)).toEqual(fixtureProductModels().map((m) => m.id));
    const list = await fetchProductWorkspaces('c1');
    expect(list.source).toBe('fixture');
    expect(list.data).toHaveLength(1);
    expect(list.data[0].id).toBe('pmw-fixture-1');
  });

  it('prefers the live board detail when the endpoint responds', async () => {
    const live = { id: 'pmw-1', findings: [], apps: [] };
    mockedGet.mockResolvedValueOnce(live);
    const res = await fetchProductWorkspaceDetail('pmw-1', {}, 'c1');
    expect(res.source).toBe('live');
    expect(res.data).toBe(live);
    expect(mockedGet).toHaveBeenCalledWith('/product-models/workspaces/pmw-1?companyId=c1');
  });

  it('sends the PM-05 filters as query params on the live path', async () => {
    mockedGet.mockResolvedValueOnce({});
    await fetchProductWorkspaceDetail(
      'pmw-1',
      { segments: ['SMB Commercial'], geographies: ['UK'] },
      null,
    );
    expect(mockedGet).toHaveBeenCalledWith(
      '/product-models/workspaces/pmw-1?segments=SMB+Commercial&geographies=UK',
    );
  });

  it('applies the PM-05 filters client-side on the fixture path', async () => {
    mockedGet.mockRejectedValue(new Error('404'));
    const res = await fetchProductWorkspaceDetail('pmw-fixture-1', { segments: ["Lloyd's"] }, 'c1');
    expect(res.source).toBe('fixture');
    expect(res.data.apps.map((a) => a.id)).toEqual(['pm-binder']);
    // Findings and entries shrink to the surviving sources.
    expect(res.data.findings.every((f) => f.appId === 'pm-binder')).toBe(true);
    const entries = res.data.normalizationEntries ?? [];
    expect(entries.length).toBeGreaterThan(0);
    const findingIds = new Set(res.data.findings.map((f) => f.id));
    for (const e of entries) for (const id of e.findingIds) expect(findingIds.has(id)).toBe(true);
  });

  it('filters by legacy model ids on the fixture path', async () => {
    mockedGet.mockRejectedValue(new Error('404'));
    const res = await fetchProductWorkspaceDetail(
      'pmw-fixture-1',
      { legacyModelIds: ['pm-policypro', 'pm-quotemaster'] },
      'c1',
    );
    expect(res.data.apps.map((a) => a.id).sort()).toEqual(['pm-policypro', 'pm-quotemaster']);
  });
});
