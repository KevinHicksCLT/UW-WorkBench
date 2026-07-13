import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, ErrorMessage, EmptyState } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import LensBar, { LegendItem, type WorkspaceLens } from '../LensBar';
import { FlowEdges, useEdges, type EdgeSpec } from '../FlowEdges';
import { GREEN, AMBER } from '../types';
import ProductComparePanel from './ProductComparePanel';
import ProductNormalizeColumn from './ProductNormalizeColumn';
import ProductGreenfieldColumn from './ProductGreenfieldColumn';
import { MATCH_META, buildComparison, lobOptions } from './spine';
import type { ElementGroup, LobOption, MatchStatus, SpineTable, VersionColumn } from './spine';

// The Products lens of the Workspace — comparison over the REAL product spine:
// pick an LOB (L2), pick which of its versions (L4) to compare, and the board
// derives what is common across the versions, what varies, and what a single
// normalized greenfield product model for that LOB looks like. Everything is
// computed on read from /product-spine/table — no illustrative tables.

function TraceBreadcrumb({
  group,
  versionCount,
  lobName,
}: {
  group: ElementGroup;
  versionCount: number;
  lobName: string;
}) {
  const meta = MATCH_META[group.status];
  const review = group.status === 'PARTIAL' || group.status === 'UNIQUE';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        padding: '5px 8px 5px 12px',
        marginBottom: 10,
        alignSelf: 'flex-start',
      }}
    >
      <span
        style={{
          padding: '1px 8px',
          borderRadius: 999,
          background: meta.fg,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {meta.label}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{group.name}</span>
      <span style={{ fontSize: 11, color: '#525252' }}>
        in <b style={{ fontWeight: 600 }}>{group.component}</b> ·{' '}
        {group.presentIn === versionCount
          ? `all ${versionCount} versions`
          : `${group.presentIn} of ${versionCount} versions`}
      </span>
      <span style={{ color: '#a3a3a3', fontSize: 12 }}>→</span>
      <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>{lobName} model</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 9px',
          borderRadius: 999,
          background: review ? '#fffbeb' : '#dcfce7',
          border: `1px solid ${review ? '#fde68a' : '#a7f3d0'}`,
          fontSize: 11,
          fontWeight: 600,
          color: review ? '#92400e' : '#047857',
        }}
      >
        {review ? 'DECIDE — ADOPT OR VARIANT' : 'FOLDS TO ONE ELEMENT'}
      </span>
    </div>
  );
}

/** Which versions of the LOB sit on the board — 1..N, last chip can't drop. */
function VersionPicker({
  versions,
  versionLevelName,
  selectedIds,
  onToggle,
  onAll,
}: {
  versions: VersionColumn[];
  versionLevelName: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
}) {
  const allOn = selectedIds.size === versions.length;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252', marginRight: 2 }}>
        Compare
      </span>
      {versions.map((v) => {
        const on = selectedIds.has(v.id);
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onToggle(v.id)}
            title={`${v.productName} — ${v.name}${v.status ? ` · ${v.status}` : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 11px',
              borderRadius: 999,
              border: `1px solid ${on ? '#171717' : '#e5e5e5'}`,
              background: on ? '#171717' : '#fff',
              color: on ? '#fff' : '#525252',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
              font: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: 4,
                border: `1px solid ${on ? '#fff' : '#d4d4d4'}`,
                background: on ? '#fff' : 'transparent',
                color: '#171717',
                fontSize: 9,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on ? '✓' : ''}
            </span>
            {v.productName} · {v.name}
          </button>
        );
      })}
      {!allOn && (
        <button
          type="button"
          onClick={onAll}
          style={{
            border: 'none',
            background: 'none',
            color: '#525252',
            fontSize: 11.5,
            cursor: 'pointer',
            textDecoration: 'underline',
            font: 'inherit',
          }}
        >
          compare all
        </button>
      )}
      <span style={{ fontSize: 11, color: '#a3a3a3', marginLeft: 4 }}>
        {selectedIds.size === 1
          ? `one ${versionLevelName.toLowerCase()} — its own decomposition`
          : `${selectedIds.size} side by side`}
      </span>
    </div>
  );
}

export default function ProductBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: table, loading, error } = useApi<SpineTable>('/product-spine/table');
  const lobs: LobOption[] = useMemo(() => (table ? lobOptions(table) : []), [table]);

  const [lobId, setLobId] = useState<string | null>(null);
  const [pickedVersionIds, setPickedVersionIds] = useState<Set<string> | null>(null);
  const [matchFilter, setMatchFilter] = useState<MatchStatus | null>(null);
  const [selected, setSelected] = useState<ElementGroup | null>(null);
  const [zoom, setZoom] = useState(1);

  // Default to the first LOB where a comparison exists (2+ versions).
  useEffect(() => {
    if (lobs.length > 0 && (!lobId || !lobs.some((l) => l.id === lobId))) {
      setLobId((lobs.find((l) => l.versions.length > 1) ?? lobs[0]).id);
    }
  }, [lobs, lobId]);

  useEffect(() => {
    setPickedVersionIds(null);
    setMatchFilter(null);
    setSelected(null);
  }, [lobId]);

  const lob = lobs.find((l) => l.id === lobId) ?? null;
  const versionLevelName =
    table?.levels.find((l) => l.levelNumber === 4)?.name ?? 'Version / Jurisdiction';
  const lobLevelName = table?.levels.find((l) => l.levelNumber === 2)?.name ?? 'LOB';

  const selectedVersionIds = useMemo(
    () => pickedVersionIds ?? new Set((lob?.versions ?? []).map((v) => v.id)),
    [pickedVersionIds, lob],
  );
  const versions = useMemo(
    () => (lob?.versions ?? []).filter((v) => selectedVersionIds.has(v.id)),
    [lob, selectedVersionIds],
  );
  const comparison = useMemo(() => buildComparison(versions), [versions]);

  const toggleVersion = (id: string) => {
    const next = new Set(selectedVersionIds);
    if (next.has(id)) {
      if (next.size === 1) return; // at least one version stays on the board
      next.delete(id);
    } else {
      next.add(id);
    }
    setPickedVersionIds(next);
    setSelected(null);
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeComponent = selected ? selected.component : null;

  // Fit-to-frame per LOB AND per comparison width.
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const fitKey = lob ? `${lob.id}:${selectedVersionIds.size}` : null;
  useEffect(() => {
    if (!fitKey || fittedFor.current === fitKey) return;
    const canvas = canvasRef.current;
    const scroller = canvas?.parentElement;
    if (!canvas || !scroller) return;
    const rect = canvas.getBoundingClientRect();
    const naturalW = rect.width / (zoomRef.current || 1);
    const naturalH = rect.height / (zoomRef.current || 1);
    if (naturalW <= 0) return;
    fittedFor.current = fitKey;
    const fit = Math.min(
      1,
      (scroller.clientWidth - 8) / naturalW,
      (scroller.clientHeight - 8) / naturalH,
    );
    setZoom(Math.max(0.3, Math.round(fit * 100) / 100));
  }, [fitKey]);

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
          y1Offset: both ? -8 : 0,
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
          y1Offset: both ? 10 : 0,
          lane: both ? base + 1 : base,
        });
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
  }, [comparison, matchFilter, activeComponent]);

  const edges = useEdges(canvasRef, specs, zoom);

  if (loading) return <LoadingState message="Loading the product spine…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const legend = (
    <>
      <LegendItem color={MATCH_META.COMMON.fg} label="common — every version" />
      <LegendItem color={MATCH_META.PARTIAL.fg} label="varies — review" />
      <LegendItem color={MATCH_META.UNIQUE.fg} label="unique — one version" />
    </>
  );

  const lensBar = (
    <LensBar
      lens={lens}
      onLens={onLens}
      boards={lobs.map((l) => ({ id: l.id, name: `${l.segmentName} — ${l.name}` }))}
      boardId={lobId}
      onBoard={(id) => setLobId(id)}
      legend={legend}
    />
  );

  if (!lob)
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lensBar}
        <EmptyState
          message={`No ${lobLevelName} in the product model carries versions with model components yet.`}
        />
      </div>
    );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      {lensBar}
      <VersionPicker
        versions={lob.versions}
        versionLevelName={versionLevelName}
        selectedIds={selectedVersionIds}
        onToggle={toggleVersion}
        onAll={() => {
          setPickedVersionIds(null);
          setSelected(null);
        }}
      />
      {selected && (
        <TraceBreadcrumb group={selected} versionCount={versions.length} lobName={lob.name} />
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
              padding: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 120,
            }}
          >
            <FlowEdges edges={edges} />
            <ProductComparePanel
              title={lob.name}
              versionLevelName={versionLevelName}
              versions={versions}
              comparison={comparison}
              matchFilter={matchFilter}
              onMatchFilter={(s) => {
                setMatchFilter(s);
                setSelected(null);
              }}
              selectedKey={selected?.key ?? null}
              onSelect={setSelected}
            />
            <ProductNormalizeColumn
              versions={versions}
              comparison={comparison}
              matchFilter={matchFilter}
              activeComponent={activeComponent}
            />
            <ProductGreenfieldColumn
              lobName={lob.name}
              versions={versions}
              comparison={comparison}
              matchFilter={matchFilter}
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

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: '1px solid #eaeaea',
        borderRadius: 6,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.05)',
        fontSize: label === '⛶' ? 13 : 16,
        color: '#525252',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
