/**
 * useWorkspaceBoard — list + detail data for the workspace board across both
 * domains (PM-04/05). Application domain keeps the WR-01 behavior (list from
 * GET /rationalization, VS/Roles filtered server-side); the product domain
 * loads models/workspaces/detail through data.ts, which falls back to the
 * §6.2 fixtures until Agent 2's endpoints land. The detail is always
 * normalized through withV3Defaults so the v3 board can rely on the contract
 * fields regardless of the payload's age.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import {
  withV3Defaults,
  type AnatomyCategory,
  type ClassificationMeta,
  type Domain,
  type LensModeKey,
  type ProductModel,
  type StageDetail,
} from '../../lib/rationalization';
import type { MultiSelectOption } from './MultiSelect';
import type { StageRow } from './LensBar';
import {
  fetchProductAnatomy,
  fetchProductModels,
  fetchProductWorkspaceDetail,
  fetchProductWorkspaces,
  type BoardSource,
  type ProductBoardFilters,
} from './data';

// A stage's application display label / stable multi-select key (WR-01).
const appLabel = (s: StageRow) => s.application ?? 'Unassigned';
const appKeyOf = (s: StageRow) => s.applicationId ?? appLabel(s);

export type UseWorkspaceBoardArgs = {
  domain: Domain;
  modeKey: LensModeKey;
  selApps: string[];
  selStreams: string[];
  selRoles: string[];
  /** Product-domain multi-select (model ids or segment/geography values). */
  productSelected: string[];
  classification: ClassificationMeta;
};

export function useWorkspaceBoard(args: UseWorkspaceBoardArgs) {
  const { domain, modeKey, selApps, selStreams, selRoles, productSelected, classification } = args;
  const { companyId, loading: companyLoading } = useCompany();
  const isProducts = domain === 'PRODUCT_MODEL';

  const [list, setList] = useState<StageRow[]>([]);
  const [serverList, setServerList] = useState<StageRow[] | null>(null);
  const [productModels, setProductModels] = useState<ProductModel[]>([]);
  const [productList, setProductList] = useState<StageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawDetail, setRawDetail] = useState<StageDetail | null>(null);
  const [detailSource, setDetailSource] = useState<BoardSource>('live');
  const [catalog, setCatalog] = useState<AnatomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Application-domain list (WR-01, unchanged behavior) ───────────────────
  const loadList = useCallback(
    (preferApp?: string, appsChange?: (next: string[]) => void) => {
      return api.get<StageRow[]>(withCompany('/rationalization', companyId)).then((rows) => {
        setList(rows);
        if (!appsChange) return;
        // Keep the application selection valid: prefer the just-created app.
        const keys = new Map<string, string>();
        for (const r of rows) if (!keys.has(appKeyOf(r))) keys.set(appKeyOf(r), appLabel(r));
        const preferred = preferApp
          ? [...keys.entries()].find(([, label]) => label === preferApp)?.[0]
          : undefined;
        if (preferred) appsChange([preferred]);
      });
    },
    [companyId],
  );

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    loadList()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [companyLoading, loadList]);

  // Anatomy reference taxonomy — chip tooltips (WR-06) + product in-box
  // anatomy (3-D). Domain-specific source.
  useEffect(() => {
    if (companyLoading) return;
    if (isProducts) {
      fetchProductAnatomy(companyId).then(({ data }) => setCatalog(data));
      return;
    }
    api
      .get<AnatomyCategory[]>(withCompany('/rationalization/anatomy-catalog', companyId))
      .then(setCatalog)
      .catch(() => setCatalog([])); // tooltips degrade to the built-in hint
  }, [companyId, companyLoading, isProducts]);

  // Product-domain master data (models list + workspaces).
  useEffect(() => {
    if (companyLoading || !isProducts) return;
    let cancelled = false;
    Promise.all([fetchProductModels(companyId), fetchProductWorkspaces(companyId)]).then(
      ([models, workspaces]) => {
        if (cancelled) return;
        setProductModels(models.data);
        setProductList(
          workspaces.data.map((w) => ({ ...w, applicationId: null, valueStreamNodeId: null })),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [companyId, companyLoading, isProducts]);

  // Application options — distinct (applicationId ?? label) pairs (WR-01).
  const appOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of list) if (!seen.has(appKeyOf(s))) seen.set(appKeyOf(s), appLabel(s));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [list]);

  // Product filter options depend on the active mode (PM-05).
  const productOptions = useMemo<MultiSelectOption[]>(() => {
    if (modeKey === 'segment' || modeKey === 'geography') {
      const values = new Set<string>();
      for (const m of productModels) {
        const v = modeKey === 'segment' ? m.segment : m.geography;
        if (v) values.add(v);
      }
      return [...values].sort().map((v) => ({ id: v, name: v }));
    }
    return productModels.map((m) => ({ id: m.id, name: m.name }));
  }, [modeKey, productModels]);

  // VS/Roles lenses filter server-side (roles resolve to streams in the API);
  // Applications mode filters the already-loaded list client-side.
  useEffect(() => {
    if (isProducts || modeKey === 'applications') {
      setServerList(null);
      return;
    }
    const sel = modeKey === 'valueStreams' ? selStreams : selRoles;
    if (sel.length === 0) {
      setServerList(null); // no filter → the full list
      return;
    }
    const param = modeKey === 'valueStreams' ? 'valueStreamIds' : 'roleIds';
    let cancelled = false;
    api
      .get<StageRow[]>(withCompany(`/rationalization?${param}=${sel.join(',')}`, companyId))
      .then((rows) => {
        if (!cancelled) setServerList(rows);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isProducts, modeKey, selStreams, selRoles, companyId]);

  // The filtered stage list the board picker operates on.
  const stages = useMemo(() => {
    if (isProducts) return productList;
    let rows: StageRow[];
    if (modeKey === 'applications')
      rows = selApps.length === 0 ? list : list.filter((s) => selApps.includes(appKeyOf(s)));
    else {
      const sel = modeKey === 'valueStreams' ? selStreams : selRoles;
      rows = sel.length === 0 ? list : (serverList ?? []);
    }
    return [...rows].sort(
      (a, b) => appLabel(a).localeCompare(appLabel(b)) || a.stageOrder - b.stageOrder,
    );
  }, [isProducts, productList, modeKey, list, selApps, selStreams, selRoles, serverList]);

  // Exactly one application selected → the L3/L4 cascade; otherwise the
  // grouped Board select. A VS/Roles filter can come up empty.
  const cascade = !isProducts && modeKey === 'applications' && selApps.length === 1;
  const filterActive = isProducts
    ? productSelected.length > 0
    : modeKey !== 'applications' && (modeKey === 'valueStreams' ? selStreams : selRoles).length > 0;

  // Keep the selected stage valid for the filtered list (survive or reset).
  useEffect(() => {
    if (stages.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && stages.some((s) => s.id === prev) ? prev : stages[0].id));
  }, [stages]);

  // ── Detail ─────────────────────────────────────────────────────────────────
  const productFilters = useMemo<ProductBoardFilters>(() => {
    if (!isProducts || productSelected.length === 0) return {};
    if (modeKey === 'segment') return { segments: productSelected };
    if (modeKey === 'geography') return { geographies: productSelected };
    return { legacyModelIds: productSelected };
  }, [isProducts, modeKey, productSelected]);

  const loadDetail = useCallback(() => {
    if (!selectedId) return;
    if (isProducts) {
      fetchProductWorkspaceDetail(selectedId, productFilters, companyId)
        .then(({ data, source }) => {
          setRawDetail(data);
          setDetailSource(source);
        })
        .catch((e) => setError((e as Error).message));
      return;
    }
    api
      .get<StageDetail>(`/rationalization/${selectedId}`)
      .then((d) => {
        setRawDetail(d);
        setDetailSource('live');
      })
      .catch((e) => setError((e as Error).message));
  }, [selectedId, isProducts, productFilters, companyId]);

  /** Local mutation for fixture-sourced boards (approve/hold, retire, PM-07). */
  const mutateDetail = useCallback((fn: (d: StageDetail) => StageDetail) => {
    setRawDetail((d) => (d ? fn(d) : d));
  }, []);

  const clearDetail = useCallback(() => setRawDetail(null), []);

  // The v3-normalized detail the board renders (contract fields guaranteed).
  const detail = useMemo(
    () => (rawDetail ? withV3Defaults(rawDetail, classification) : null),
    [rawDetail, classification],
  );

  return {
    companyLoading,
    companyId,
    loading,
    error,
    setError,
    stages,
    appOptions,
    productOptions,
    productModels,
    selectedId,
    setSelectedId,
    detail,
    detailSource,
    catalog,
    cascade,
    filterActive,
    loadList,
    loadDetail,
    mutateDetail,
    clearDetail,
  };
}
