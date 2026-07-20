import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, ErrorMessage, EmptyState, Select } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { FlowEdges, useEdges, type EdgeSpec } from '../FlowEdges';
import { GREEN, AMBER, RED, READABLE_FIT_MIN } from '../types';
import { useRowAlignment, type AlignRow } from '../useLayerAlignment';
import ProductComparePanel from './ProductComparePanel';
import ProductNormalizeColumn from './ProductNormalizeColumn';
import ProductGreenfieldColumn from './ProductGreenfieldColumn';
import { MATCH_META, buildComparison, lobOptions, allVersions } from './spine';
import type {
  ElementGroup,
  LobOption,
  MatchStatus,
  ProductDecision,
  ProductDecisionStatus,
  SpineTable,
  VersionColumn,
} from './spine';

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

/** Pool versions grouped by LOB for a <select>'s optgroups. */
function poolByLob(pool: VersionColumn[]): { label: string; versions: VersionColumn[] }[] {
  const byLob = new Map<string, { label: string; versions: VersionColumn[] }>();
  for (const v of pool) {
    const g = byLob.get(v.lobId) ?? { label: `${v.segmentName} · ${v.lobName}`, versions: [] };
    g.versions.push(v);
    byLob.set(v.lobId, g);
  }
  return [...byLob.values()];
}

const VERSION_SELECT_STYLE: React.CSSProperties = {
  width: 'auto',
  minWidth: 150,
  maxWidth: 260,
  height: 26,
  padding: '0 24px 0 9px',
  fontSize: 11.5,
};

/** Compare picker as compact dropdowns — one per version slot (grouped by LOB),
 *  plus an add-dropdown. Small and clear, and versions from any LOB are one
 *  option list apart (compare a Home policy against an Auto policy). */
function VersionPicker({
  pool,
  versionLevelName,
  selected,
  onReplace,
  onAdd,
  onRemove,
}: {
  pool: VersionColumn[];
  versionLevelName: string;
  selected: VersionColumn[];
  onReplace: (oldId: string, newId: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selectedIds = new Set(selected.map((v) => v.id));
  const addable = pool.filter((v) => !selectedIds.has(v.id));
  const groups = poolByLob(pool);
  const addGroups = poolByLob(addable);

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252', marginRight: 2 }}>
        Compare
      </span>
      {selected.map((v, i) => (
        <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <span style={{ fontSize: 11, color: '#a3a3a3', marginRight: 2 }}>vs</span>}
          <Select
            aria-label={`Version ${i + 1}`}
            value={v.id}
            onChange={(e) => e.target.value && onReplace(v.id, e.target.value)}
            style={VERSION_SELECT_STYLE}
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.versions.map((o) => (
                  // Keep this slot's own value plus versions not on another slot.
                  <option key={o.id} value={o.id} disabled={o.id !== v.id && selectedIds.has(o.id)}>
                    {o.lobName} › {o.productName} · {o.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {selected.length > 1 && (
            <button
              type="button"
              aria-label="Remove version"
              title="Remove"
              onClick={() => onRemove(v.id)}
              style={{
                border: 'none',
                background: 'none',
                color: '#a3a3a3',
                fontSize: 14,
                lineHeight: 1,
                cursor: 'pointer',
                padding: '0 2px',
                font: 'inherit',
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {addable.length > 0 && (
        <Select
          aria-label="Add a version to compare"
          value=""
          onChange={(e) => e.target.value && onAdd(e.target.value)}
          style={VERSION_SELECT_STYLE}
        >
          <option value="">＋ Add version…</option>
          {addGroups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.versions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.lobName} › {o.productName} · {o.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
      <span style={{ fontSize: 11, color: '#a3a3a3', marginLeft: 4 }}>
        {selected.length === 1
          ? `one ${versionLevelName.toLowerCase()} — its own decomposition`
          : `${selected.length} side by side`}
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
  // One expand/collapse state per model COMPONENT, shared by the Normalize
  // section and the Greenfield slot — an aligned band opens as one row
  // (mirrors the application board's synced layer expansion).
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
  const toggleComponent = (component: string) =>
    setExpandedComponents((c) => ({ ...c, [component]: !c[component] }));

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
    setExpandedComponents({});
  }, [lobId]);

  const lob = lobs.find((l) => l.id === lobId) ?? null;
  const versionLevelName =
    table?.levels.find((l) => l.levelNumber === 4)?.name ?? 'Version / Jurisdiction';
  const lobLevelName = table?.levels.find((l) => l.levelNumber === 2)?.name ?? 'LOB';

  // The full cross-LOB version pool — a comparison can pull versions from any
  // LOB (Home vs Auto), not just the home LOB. The home LOB seeds the default.
  const pool = useMemo(() => allVersions(lobs), [lobs]);

  const selectedVersionIds = useMemo(
    () => pickedVersionIds ?? new Set((lob?.versions ?? []).map((v) => v.id)),
    [pickedVersionIds, lob],
  );
  // Keep spine order (segment → LOB → product → version), so cross-LOB picks
  // stay grouped by their line on the board.
  const versions = useMemo(
    () => pool.filter((v) => selectedVersionIds.has(v.id)),
    [pool, selectedVersionIds],
  );
  const crossLob = useMemo(() => new Set(versions.map((v) => v.lobId)).size > 1, [versions]);
  const comparison = useMemo(() => buildComparison(versions), [versions]);

  // Reviewer sign-off for this LOB's varies/unique groups (spine-derived groups
  // have no persisted row, so the decision is stored + fetched by group key).
  const { data: decisionRows, refetch: refetchDecisions } = useApi<ProductDecision[]>(
    lob ? `/product-spine/decisions?lobId=${lob.id}` : null,
  );
  const decisions = useMemo(() => {
    const m: Record<string, ProductDecisionStatus> = {};
    for (const d of decisionRows ?? []) m[d.groupKey] = d.status;
    return m;
  }, [decisionRows]);

  // A different comparison (version added/removed) starts collapsed again.
  useEffect(() => {
    setExpandedComponents({});
  }, [selectedVersionIds]);

  const addVersion = (id: string) => {
    const next = new Set(selectedVersionIds);
    next.add(id);
    setPickedVersionIds(next);
    setSelected(null);
  };
  const removeVersion = (id: string) => {
    if (selectedVersionIds.size === 1) return; // at least one version stays
    const next = new Set(selectedVersionIds);
    next.delete(id);
    setPickedVersionIds(next);
    setSelected(null);
  };
  const replaceVersion = (oldId: string, newId: string) => {
    if (oldId === newId) return;
    const next = new Set(selectedVersionIds);
    next.delete(oldId);
    next.add(newId);
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
    if (naturalW <= 0) return;
    fittedFor.current = fitKey;
    // Width-only fit: the columns are tall lists, so fitting height crushed
    // the board to an unreadable scale. Vertical (and, past the readable
    // floor, horizontal) overflow scrolls instead.
    const fit = Math.min(1, (scroller.clientWidth - 8) / naturalW);
    setZoom(Math.max(READABLE_FIT_MIN, Math.round(fit * 100) / 100));
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
      if (expandedComponents[row.component]) {
        // Expanded component: one connector PER CONCEPT ROW — the matrix row on
        // the left to its normalize card. Green = common/single (folds in),
        // red = varies/unique (needs a decision). Rows that made it into the
        // model continue with a second green connector into their greenfield
        // row (held/open reviews stop at Normalize — they aren't in the model).
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
        // A settled/review pair splits SYMMETRICALLY (same offset both ends)
        // so the two connectors run parallel and horizontal, never at a slant.
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
      // Collapsed bands wire header→header; an expanded band's rows carry
      // their own connectors instead.
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

  // Align each component band across the three columns (straight connectors).
  // SCRUM-259: inside an EXPANDED band, every concept row also aligns with its
  // normalize card so the per-row connectors run dead horizontal — both
  // columns render the same (filtered) group list, so the orders match.
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
                // In-model rows also level with their greenfield row.
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
  const pads = useRowAlignment(canvasRef, fitKey, alignRows, zoom);
  const edges = useEdges(canvasRef, specs, zoom, JSON.stringify(pads));

  if (loading) return <LoadingState message="Loading the product spine…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const lensBar = (
    <LensBar
      lens={lens}
      onLens={onLens}
      boards={lobs.map((l) => ({ id: l.id, name: `${l.segmentName} — ${l.name}` }))}
      boardId={lobId}
      onBoard={(id) => setLobId(id)}
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
        pool={pool}
        versionLevelName={versionLevelName}
        selected={versions}
        onReplace={replaceVersion}
        onAdd={addVersion}
        onRemove={removeVersion}
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
              title={crossLob ? `${lob.name} + other lines` : lob.name}
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
              rowPads={pads.bf}
              expandedComponents={expandedComponents}
              onToggleComponent={toggleComponent}
            />
            <ProductNormalizeColumn
              lobName={crossLob ? `${lob.name} + other lines` : lob.name}
              versions={versions}
              comparison={comparison}
              matchFilter={matchFilter}
              activeComponent={activeComponent}
              lobId={lob.id}
              decisions={decisions}
              onResolved={refetchDecisions}
              rowPads={pads.nz}
              expandedComponents={expandedComponents}
              onToggleComponent={toggleComponent}
            />
            <ProductGreenfieldColumn
              lobName={lob.name}
              versions={versions}
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
