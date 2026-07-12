/**
 * Thin data layer for the workspace board. Every read tries the real endpoint
 * first and falls back to the §6.2 contract fixtures while Agent 2's routes
 * are still landing — so integration is a data-source swap, not a rewrite.
 * Reads report their `source` so the shell can badge demo data and route
 * mutations locally when the board came from a fixture.
 */
import { api } from '../../lib/api';
import { withCompany } from '../../lib/portfolio';
import type {
  AnatomyCategory,
  Domain,
  Finding,
  MatchStatus,
  ProductModel,
  StageDetail,
  StageListItem,
  VocabularyRow,
} from '../../lib/rationalization';
import {
  fixtureProductAnatomy,
  fixtureProductModels,
  fixtureProductWorkspace,
  fixtureVocabulary,
} from './fixtures';

export type BoardSource = 'live' | 'fixture';
export type Sourced<T> = { data: T; source: BoardSource };

// ── Vocabulary (3-A) ────────────────────────────────────────────────────────

const vocabCache = new Map<string, Sourced<VocabularyRow[]>>();

/** GET /rationalization/vocabulary?domain= with the §6.4 fixture fallback. */
export async function fetchVocabulary(
  domain: Domain,
  companyId: string | null,
): Promise<Sourced<VocabularyRow[]>> {
  const key = `${companyId ?? ''}:${domain}`;
  const hit = vocabCache.get(key);
  if (hit) return hit;
  let out: Sourced<VocabularyRow[]>;
  try {
    const res = await api.get<{ vocabulary: VocabularyRow[] }>(
      withCompany(`/rationalization/vocabulary?domain=${domain}`, companyId),
    );
    out = { data: res.vocabulary, source: 'live' };
  } catch {
    out = { data: fixtureVocabulary(domain), source: 'fixture' };
  }
  vocabCache.set(key, out);
  return out;
}

// ── Product-model domain reads (3-C) ────────────────────────────────────────

/** GET /product-models (master list) with the fixture fallback. */
export async function fetchProductModels(
  companyId: string | null,
): Promise<Sourced<ProductModel[]>> {
  try {
    const res = await api.get<{ productModels: ProductModel[] }>(
      withCompany('/product-models', companyId),
    );
    return { data: res.productModels, source: 'live' };
  } catch {
    return { data: fixtureProductModels(), source: 'fixture' };
  }
}

/** Product board list rows for the picker (workspace id + name). */
export async function fetchProductWorkspaces(
  companyId: string | null,
): Promise<Sourced<StageListItem[]>> {
  try {
    const rows = await api.get<StageListItem[]>(
      withCompany('/product-models/workspaces', companyId),
    );
    return { data: rows, source: 'live' };
  } catch {
    const w = fixtureProductWorkspace();
    return {
      data: [
        {
          id: w.id,
          name: w.name,
          application: w.application,
          stageOrder: w.stageOrder,
          businessProcess: w.businessProcess,
          status: w.status,
          illustrative: w.illustrative,
          findings: w.findings.length,
          byCapdan: w.counts,
          progress: w.progress,
        },
      ],
      source: 'fixture',
    };
  }
}

/** PM-05 inspection-mode filters (server half is Agent 2's; the fixture path
 *  applies them client-side so the lens works on demo data too). */
export type ProductBoardFilters = {
  legacyModelIds?: string[];
  segments?: string[];
  geographies?: string[];
};

function filterFixtureWorkspace(detail: StageDetail, filters: ProductBoardFilters): StageDetail {
  const models = fixtureProductModels();
  const keep = (appId: string): boolean => {
    const m = models.find((x) => x.id === appId);
    if (filters.legacyModelIds?.length && !filters.legacyModelIds.includes(appId)) return false;
    if (filters.segments?.length && !(m?.segment && filters.segments.includes(m.segment)))
      return false;
    if (filters.geographies?.length && !(m?.geography && filters.geographies.includes(m.geography)))
      return false;
    return true;
  };
  const apps = detail.apps.filter((a) => keep(a.id));
  const appIds = new Set(apps.map((a) => a.id));
  const findings = detail.findings.filter((f) => appIds.has(f.appId));
  const findingIds = new Set(findings.map((f) => f.id));
  const normalizationEntries = (detail.normalizationEntries ?? [])
    .map((e) => ({ ...e, findingIds: e.findingIds.filter((id) => findingIds.has(id)) }))
    .filter((e) => e.findingIds.length > 0);
  return { ...detail, apps, findings, normalizationEntries };
}

/** GET /product-models/workspaces/:id?legacyModelIds=&segments=&geographies=. */
export async function fetchProductWorkspaceDetail(
  id: string,
  filters: ProductBoardFilters,
  companyId: string | null,
): Promise<Sourced<StageDetail>> {
  const params = new URLSearchParams();
  if (filters.legacyModelIds?.length)
    params.set('legacyModelIds', filters.legacyModelIds.join(','));
  if (filters.segments?.length) params.set('segments', filters.segments.join(','));
  if (filters.geographies?.length) params.set('geographies', filters.geographies.join(','));
  const qs = params.toString();
  try {
    const detail = await api.get<StageDetail>(
      withCompany(`/product-models/workspaces/${id}${qs ? `?${qs}` : ''}`, companyId),
    );
    return { data: detail, source: 'live' };
  } catch {
    return { data: filterFixtureWorkspace(fixtureProductWorkspace(), filters), source: 'fixture' };
  }
}

/** GET /product-models/anatomy-catalog with the fixture fallback. */
export async function fetchProductAnatomy(
  companyId: string | null,
): Promise<Sourced<AnatomyCategory[]>> {
  try {
    const rows = await api.get<AnatomyCategory[]>(
      withCompany('/product-models/anatomy-catalog', companyId),
    );
    return { data: rows, source: 'live' };
  } catch {
    return { data: fixtureProductAnatomy(), source: 'fixture' };
  }
}

// ── Mutations (live endpoints; the shell falls back to local state on
//    fixture-sourced boards) ─────────────────────────────────────────────────

/** PATCH /rationalization/normalization-entries/:id — approve / hold / re-map. */
export const patchNormalizationEntry = (
  id: string,
  body: { matchStatus: MatchStatus },
): Promise<unknown> => api.patch(`/rationalization/normalization-entries/${id}`, body);

/** Findings CRUD (PM-07) — the app-domain and product-domain twins. */
export const patchFinding = (
  domain: Domain,
  id: string,
  body: Partial<Finding>,
): Promise<unknown> =>
  api.patch(
    domain === 'PRODUCT_MODEL'
      ? `/product-models/findings/${id}`
      : `/rationalization/findings/${id}`,
    body,
  );

export const createFinding = (
  domain: Domain,
  workspaceId: string,
  body: Partial<Finding>,
): Promise<unknown> =>
  api.post(
    domain === 'PRODUCT_MODEL'
      ? `/product-models/workspaces/${workspaceId}/findings`
      : `/rationalization/${workspaceId}/findings`,
    body,
  );
