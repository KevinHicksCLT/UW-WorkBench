import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingState, ErrorMessage, EmptyState } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { FlowEdges, useEdges, type EdgeSpec } from '../FlowEdges';
import { GREEN, AMBER, RED, READABLE_FIT_MIN } from '../types';
import { useRowAlignment, type AlignRow } from '../useLayerAlignment';
import ProductComparePanel from './ProductComparePanel';
import ProductNormalizeColumn from './ProductNormalizeColumn';
import ProductGreenfieldColumn from './ProductGreenfieldColumn';
import ProductGridView from './ProductGridView';
import {
  compareVersions,
  leanLobOptions,
  scopeQuery,
  type BoardPayload,
  type ComparePayload,
} from './boardApi';
import SpineFilterBar, {
  EMPTY_FILTERS,
  normalizeFilters,
  scopeVersions,
  type SpineFilters,
} from './SpineFilterBar';
import { TraceBreadcrumb, ZoomBtn } from './boardChrome';
import ImpactPanel from '../impact/ImpactPanel';
import { useImpactGate } from '../impact/useImpactGate';
import { buildComparison, allVersions } from './spine';
import type {
  ElementGroup,
  LobOption,
  MatchStatus,
  ProductDecision,
  ProductDecisionStatus,
} from './spine';

// The Products lens of the Workspace — comparison over the REAL product spine,
// DERIVED SERVER-SIDE (lib/resolvers/productBoard): the board fetches
// render-ready aggregates from /product-spine/board, the review list fetches
// one drill at a time from /product-spine/review, and only the ≤5-version
// detail face downloads element payloads (/product-spine/compare, capped at
// 12 versions). The client never receives the whole spine again — that design
// collapsed at 381 versions / 5,789 elements.
//
// ONE filtering system drives both faces: the spine sort chain as cascading
// dropdowns — whatever the cascade leaves in scope is what the board shows.
//
// Two faces, picked automatically by scope size:
//   • DETAIL — the three-column current → normalize → greenfield board
//     whenever the scope is 5 or fewer versions.
//   • GRID — the portfolio board past the 5-version threshold.

/** Auto view boundary: ≤ this many versions renders the detail board. */
export const DETAIL_THRESHOLD = 5;

export default function ProductBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const [rawFilters, setFilters] = useViewState<SpineFilters>(
    'workspace.product.filters',
    EMPTY_FILTERS,
  );
  // Older sessions persisted a single-version shape — normalize on read.
  const filters = useMemo(() => normalizeFilters(rawFilters), [rawFilters]);
  // Bumped after every decision write so the server-derived counts refetch.
  const [nonce, setNonce] = useState(0);
  const scopeQS = useMemo(() => scopeQuery(filters, nonce), [filters, nonce]);

  const { data: board, loading, error } = useApi<BoardPayload>(`/product-spine/board?${scopeQS}`);

  // Lean spine (names/ids, no elements) — the filter bar cascade + scoping.
  const lobs: LobOption[] = useMemo(() => (board ? leanLobOptions(board.spine) : []), [board]);
  const pool = useMemo(() => allVersions(lobs), [lobs]);
  const versions = useMemo(() => scopeVersions(pool, filters), [pool, filters]);
  const crossLob = useMemo(() => new Set(versions.map((v) => v.lobId)).size > 1, [versions]);
  // The scope's home LOB: the first scoped version's line. Decisions and the
  // greenfield label follow it (cross-LOB scopes read "… + other lines").
  const lob = useMemo(
    () => (versions.length ? (lobs.find((l) => l.id === versions[0].lobId) ?? null) : null),
    [versions, lobs],
  );

  // View state persists per session (lib/viewState) so leaving the tab and
  // returning restores the exact scope, view and expansion.
  const [view, setView] = useViewState<'auto' | 'detail' | 'grid'>(
    'workspace.product.view',
    'auto',
  );
  const [search, setSearch] = useViewState<string>('workspace.product.search', '');
  const [matchFilter, setMatchFilter] = useViewState<MatchStatus | null>(
    'workspace.product.matchFilter',
    null,
  );
  const [selected, setSelected] = useState<ElementGroup | null>(null);
  const [zoom, setZoom] = useState(1);
  const [expandedComponents, setExpandedComponents] = useViewState<Record<string, boolean>>(
    'workspace.product.expanded',
    {},
  );
  const toggleComponent = (component: string) =>
    setExpandedComponents((c) => ({ ...c, [component]: !c[component] }));

  // Default by scope (grid past the threshold, detail at or under it); the
  // Detail/Grid selector overrides until the scope changes again.
  const autoView: 'detail' | 'grid' = versions.length > DETAIL_THRESHOLD ? 'grid' : 'detail';
  const effectiveView = view === 'auto' ? autoView : view;

  // DETAIL face data: full element payloads for the few scoped versions only.
  const detailIds = useMemo(
    () =>
      effectiveView === 'detail' && versions.length > 0 && versions.length <= 12
        ? versions.map((v) => v.id).join(',')
        : null,
    [effectiveView, versions],
  );
  const { data: compareData, loading: compareLoading } = useApi<ComparePayload>(
    detailIds ? `/product-spine/compare?ids=${detailIds}&d=${nonce}` : null,
  );
  const detailVersions = useMemo(
    () => (compareData ? compareVersions(compareData) : []),
    [compareData],
  );
  const comparison = useMemo(() => buildComparison(detailVersions), [detailVersions]);

  const versionLevelName =
    board?.levels.find((l) => l.levelNumber === 4)?.name ?? 'Version / Jurisdiction';

  const { data: decisionRows, refetch: refetchDecisions } = useApi<ProductDecision[]>(
    lob ? `/product-spine/decisions?lobId=${lob.id}` : null,
  );
  const decisions = useMemo(() => {
    const m: Record<string, ProductDecisionStatus> = {};
    for (const d of decisionRows ?? []) m[d.groupKey] = d.status;
    return m;
  }, [decisionRows]);

  // Every decision routes through the common change-impact gate: the element
  // is assessed against the product spine and the estate (versions carrying
  // it, source systems its livesIn names, prior sign-offs) and the PUT only
  // fires on confirm. The returned promise settles on confirm OR cancel so a
  // caller's saving spinner always releases.
  const gate = useImpactGate();
  const applyDecision = async (
    lobId: string,
    component: string,
    groupKey: string,
    status: ProductDecisionStatus,
    comment?: string,
  ) => {
    await api.put('/product-spine/decisions', { lobId, component, groupKey, status, comment });
    setNonce((n) => n + 1); // server-derived board/review counts refetch
    refetchDecisions();
  };
  const decide = (
    lobId: string,
    component: string,
    groupKey: string,
    status: ProductDecisionStatus | null,
    comment?: string,
    meta?: { elementName?: string; componentNodeIds?: string[] },
  ) => {
    // Withdrawing (status null) reverts to "needs a decision" — an undo, not a
    // change to the model, so it skips the impact gate.
    if (status === null) {
      return api
        .delete(
          `/product-spine/decisions?lobId=${encodeURIComponent(lobId)}&groupKey=${encodeURIComponent(groupKey)}`,
        )
        .then(() => {
          setNonce((n) => n + 1);
          refetchDecisions();
        });
    }
    return new Promise<void>((resolve) => {
      gate.run(
        {
          changeType: status === 'APPROVED' ? 'ADOPT' : status === 'HELD' ? 'HOLD' : 'RETIRE',
          label: meta?.elementName,
          subject: {
            kind: 'product-element',
            lobId,
            component,
            elementName: meta?.elementName,
            componentNodeIds: meta?.componentNodeIds,
          },
        },
        async () => {
          try {
            await applyDecision(lobId, component, groupKey, status, comment);
          } finally {
            resolve();
          }
        },
        () => resolve(),
      );
    });
  };

  // A different scope starts collapsed again — change-only, undefined while
  // the spine loads so the loading→loaded transition never counts.
  const scopeKey = useMemo(
    () => (board ? versions.map((v) => v.id).join('+') : undefined),
    [board, versions],
  );
  const [, setSearchParams] = useSearchParams();
  useOnChange(scopeKey, () => {
    setExpandedComponents({});
    setMatchFilter(null);
    setSelected(null);
    // A new scope re-arms the default: detail ≤5 versions, grid past that —
    // and drops any open drill, whose row set belonged to the old scope.
    setView('auto');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('pmDrill');
      return next;
    });
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeComponent = selected ? selected.component : null;

  // Fit-to-frame per scope width.
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const fitKey = scopeKey ? `${scopeKey}|${effectiveView}` : null;
  useEffect(() => {
    if (!fitKey || effectiveView !== 'detail' || fittedFor.current === fitKey) return;
    const canvas = canvasRef.current;
    const scroller = canvas?.parentElement;
    if (!canvas || !scroller) return;
    const rect = canvas.getBoundingClientRect();
    const naturalW = rect.width / (zoomRef.current || 1);
    if (naturalW <= 0) return;
    fittedFor.current = fitKey;
    const fit = Math.min(1, (scroller.clientWidth - 8) / naturalW);
    setZoom(Math.max(READABLE_FIT_MIN, Math.round(fit * 100) / 100));
  }, [fitKey, effectiveView, compareData]);

  const specs: EdgeSpec[] = useMemo(() => {
    const out: EdgeSpec[] = [];
    const mid = Math.floor(comparison.rows.length / 2);
    comparison.rows.forEach((row, i) => {
      const groups = matchFilter ? row.groups.filter((g) => g.status === matchFilter) : row.groups;
      if (groups.length === 0) return;
      const settled = groups.filter((g) => g.status === 'COMMON' || g.status === 'SINGLE').length;
      const review = groups.length - settled;
      const dim = activeComponent != null && activeComponent !== row.component;
      const both = settled > 0 && review > 0;
      const base = (i - mid) * 2;
      if (expandedComponents[row.component]) {
        groups.forEach((g, gi) => {
          const folds = g.status === 'COMMON' || g.status === 'SINGLE';
          out.push({
            id: `row-${row.component}-${g.key}`,
            from: `bf:${row.component}:${g.key}`,
            to: `nz:${row.component}:${g.key}`,
            color: folds ? GREEN : RED,
            width: 2,
            dim,
            lane: (gi % 3) - 1,
          });
          if (folds || decisions[g.key] === 'APPROVED')
            out.push({
              id: `grow-${row.component}-${g.key}`,
              from: `nz:${row.component}:${g.key}`,
              to: `gf:model:${row.component}:${g.key}`,
              color: GREEN,
              width: 2,
              dim,
              lane: (gi % 3) - 1,
            });
        });
      } else {
        if (settled > 0)
          out.push({
            id: `s-${row.component}`,
            from: `bf:${row.component}`,
            to: `nz:${row.component}`,
            color: GREEN,
            width: 2.5,
            count: settled,
            dim,
            y0Offset: both ? -12 : 0,
            y1Offset: both ? -12 : 0,
            lane: both ? base - 1 : base,
          });
        if (review > 0)
          out.push({
            id: `r-${row.component}`,
            from: `bf:${row.component}`,
            to: `nz:${row.component}`,
            color: AMBER,
            width: 2.5,
            count: review,
            dim,
            y0Offset: both ? 14 : 0,
            y1Offset: both ? 14 : 0,
            lane: both ? base + 1 : base,
          });
      }
      if (!expandedComponents[row.component])
        out.push({
          id: `g-${row.component}`,
          from: `nz:${row.component}`,
          to: `gf:model:${row.component}`,
          color: GREEN,
          width: 2.5,
          dim,
          lane: base,
        });
    });
    return out;
  }, [comparison, matchFilter, activeComponent, expandedComponents, decisions]);

  const alignRows: AlignRow[] = useMemo(
    () =>
      comparison.rows.flatMap((r) => [
        {
          key: r.component,
          bf: `bf:${r.component}`,
          nz: `nz:${r.component}`,
          gf: `gf:model:${r.component}`,
        },
        ...(expandedComponents[r.component]
          ? (matchFilter ? r.groups.filter((g) => g.status === matchFilter) : r.groups).map(
              (g) => ({
                key: `${r.component}:${g.key}`,
                bf: `bf:${r.component}:${g.key}`,
                nz: `nz:${r.component}:${g.key}`,
                gf:
                  g.status === 'COMMON' || g.status === 'SINGLE' || decisions[g.key] === 'APPROVED'
                    ? `gf:model:${r.component}:${g.key}`
                    : null,
              }),
            )
          : []),
      ]),
    [comparison, expandedComponents, matchFilter, decisions],
  );
  // effectiveView is part of both keys: mounted in grid view the canvas ref is
  // null and the effects exit without observers, so the switch to detail must
  // re-trigger them or the connectors/alignment stay permanently empty.
  const pads = useRowAlignment(canvasRef, fitKey, alignRows, zoom);
  const edges = useEdges(canvasRef, specs, zoom, `${JSON.stringify(pads)}|${effectiveView}`);

  if (loading && !board) return <LoadingState message="Loading the product board…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!board) return <ErrorMessage>The product board returned nothing.</ErrorMessage>;

  const lensBar = (
    <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
  );

  const filterRow = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <SpineFilterBar
        lobs={lobs}
        filters={filters}
        onChange={setFilters}
        search={search}
        onSearch={setSearch}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <span style={{ fontSize: 11, color: '#525252' }}>View</span>
        <div
          style={{
            display: 'flex',
            height: 26,
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {(
            [
              ['detail', 'Detail'],
              ['grid', 'Grid'],
            ] as ['detail' | 'grid', string][]
          ).map(([key, label], i) => {
            const on = effectiveView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                style={{
                  font: 'inherit',
                  padding: '0 12px',
                  fontSize: 11.5,
                  lineHeight: '26px',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
                  background: on ? '#171717' : '#fff',
                  color: on ? '#fff' : '#404040',
                  fontWeight: on ? 600 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (versions.length === 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lensBar}
        {filterRow}
        <EmptyState message="Nothing in scope — widen the spine filters above." />
      </div>
    );

  if (effectiveView === 'grid')
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 178px)',
          // Low floor on purpose: a 480px floor pushed the board past the fold
          // on half-height windows, and with the wheel captured by the inner
          // scroller the clipped bottom was unreachable (scroll bug).
          minHeight: 300,
        }}
      >
        {lensBar}
        {filterRow}
        <div
          style={{
            border: '1px solid #eaeaea',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ProductGridView board={board} scopeQS={scopeQS} onDecide={decide} search={search} />
        </div>
        <ImpactPanel gate={gate} />
      </div>
    );

  if (compareLoading || (detailIds && !compareData))
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lensBar}
        {filterRow}
        <LoadingState message="Loading the detail comparison…" />
      </div>
    );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 178px)',
        minHeight: 300,
      }}
    >
      {lensBar}
      {filterRow}
      {selected && lob && (
        <TraceBreadcrumb group={selected} versionCount={detailVersions.length} lobName={lob.name} />
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          style={{
            border: '1px solid #eaeaea',
            borderRadius: 12,
            background: '#fff',
            backgroundImage: 'radial-gradient(circle,#ececec 1px,transparent 1px)',
            backgroundSize: '24px 24px',
            overflow: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={canvasRef}
            style={{
              position: 'relative',
              zoom,
              width: 'max-content',
              padding: 18,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 92,
            }}
          >
            <FlowEdges edges={edges} />
            <ProductComparePanel
              title={crossLob ? `${lob?.name ?? ''} + other lines` : (lob?.name ?? '')}
              versionLevelName={versionLevelName}
              versions={detailVersions}
              comparison={comparison}
              matchFilter={matchFilter}
              onMatchFilter={(s) => {
                setMatchFilter(s);
                setSelected(null);
              }}
              selectedKey={selected?.key ?? null}
              onSelect={setSelected}
              rowPads={pads.bf}
              expandedComponents={expandedComponents}
              onToggleComponent={toggleComponent}
            />
            <ProductNormalizeColumn
              lobName={crossLob ? `${lob?.name ?? ''} + other lines` : (lob?.name ?? '')}
              versions={detailVersions}
              comparison={comparison}
              matchFilter={matchFilter}
              activeComponent={activeComponent}
              lobId={lob?.id ?? ''}
              decisions={decisions}
              onResolved={() => {
                setNonce((n) => n + 1);
                refetchDecisions();
              }}
              rowPads={pads.nz}
              expandedComponents={expandedComponents}
              onToggleComponent={toggleComponent}
            />
            <ProductGreenfieldColumn
              lobName={lob?.name ?? ''}
              versions={detailVersions}
              comparison={comparison}
              matchFilter={matchFilter}
              decisions={decisions}
              rowPads={pads.gf}
              expandedComponents={expandedComponents}
              onToggleComponent={toggleComponent}
            />
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 18,
            top: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 2,
          }}
        >
          <ZoomBtn label="+" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} />
          <ZoomBtn label="−" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))} />
          <ZoomBtn label="⛶" onClick={() => setZoom(1)} />
        </div>
      </div>
    </div>
  );
}
