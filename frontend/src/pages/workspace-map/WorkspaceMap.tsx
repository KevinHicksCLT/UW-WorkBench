import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, ErrorMessage, EmptyState } from '../../components/ui';
import { useBoardList, useBoardDetail, type Lens } from './useBoard';
import { FlowEdges, useEdges, type EdgeSpec } from './FlowEdges';
import LensBar, { LegendItem, type WorkspaceLens } from './LensBar';
import BrownfieldPanel from './BrownfieldPanel';
import NormalizeColumn from './NormalizeColumn';
import GreenfieldColumn from './GreenfieldColumn';
import ProductBoard from './product/ProductBoard';
import { LAYERS, findingMoves, GREEN, RED, READABLE_FIT_MIN } from './types';
import type { Finding } from './types';

// The Workspace map — an interactive, three-column rationalization board
// (brown-field decomposition → normalize → green-field target) rendered from
// the live APIs. The Applications / Value streams / Roles lenses share the
// /rationalization board; the Products lens renders its own comparison board
// (product/ProductBoard) over /product-models/workspaces.

function TraceBreadcrumb({
  finding,
  destination,
}: {
  finding: Finding;
  destination: string | null;
}) {
  const moved = findingMoves(finding);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: `1px solid ${moved ? '#fecaca' : '#a7f3d0'}`,
        borderRadius: 999,
        background: '#fff',
        boxShadow: `0 2px 8px ${moved ? 'rgba(220,38,38,.12)' : 'rgba(16,185,129,.12)'}`,
        padding: '5px 8px 5px 12px',
        marginBottom: 10,
        alignSelf: 'flex-start',
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 999,
          background: moved ? '#fee2e2' : '#dcfce7',
          border: `1px solid ${moved ? '#fca5a5' : '#86efac'}`,
          color: moved ? RED : GREEN,
          fontSize: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
      >
        {moved ? '✕' : '✓'}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{finding.name}</span>
      <span style={{ fontSize: 11, color: '#525252' }}>
        in the <b style={{ fontWeight: 600, color: moved ? RED : GREEN }}>{finding.layer}</b> layer
      </span>
      {moved && (finding.targetLayer || finding.recommendedLayer) && (
        <>
          <span style={{ color: '#a3a3a3', fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>
            {finding.targetLayer ?? finding.recommendedLayer}
          </span>
        </>
      )}
      {destination && (
        <>
          <span style={{ color: '#a3a3a3', fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: '#525252' }}>{destination}</span>
        </>
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 9px',
          borderRadius: 999,
          background: moved ? '#ecfdf5' : '#dcfce7',
          border: '1px solid #a7f3d0',
          fontSize: 11,
          fontWeight: 600,
          color: '#047857',
        }}
      >
        {moved ? 'MAPPED' : 'STAYS'}
      </span>
    </div>
  );
}

function lensFromDomain(d?: string): WorkspaceLens {
  if (d === 'value-streams' || d === 'roles' || d === 'products') return d;
  if (d === 'product-models') return 'products'; // e2e / legacy deep-link alias
  return 'applications';
}

export default function WorkspaceMap({ initialDomain }: { initialDomain?: string }) {
  const [lens, setLens] = useState<WorkspaceLens>(lensFromDomain(initialDomain));
  if (lens === 'products') return <ProductBoard lens={lens} onLens={setLens} />;
  return <AppBoard lens={lens} onLens={setLens} />;
}

function AppBoard({ lens, onLens }: { lens: Lens; onLens: (l: WorkspaceLens) => void }) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [zoom, setZoom] = useState(1);

  const { data: boards, loading: listLoading, error: listError } = useBoardList({ lens });
  const { data: board, loading, error } = useBoardDetail(boardId);

  // Default the selected board to the first in the list for the active lens.
  useEffect(() => {
    if (boards && boards.length > 0 && (!boardId || !boards.some((b) => b.id === boardId))) {
      setBoardId(boards[0].id);
    }
    if (boards && boards.length === 0) setBoardId(null);
  }, [boards, boardId]);

  // A board switch resets the current-state scope.
  useEffect(() => {
    setScreenName(null);
    setSelected(null);
  }, [board]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeLayer = selected ? selected.layer : null;

  // Fit-to-frame: scale the canvas once per board so all three columns are in
  // view on load; after that the zoom buttons own the scale. Width-only — the
  // columns are tall lists, so fitting height too crushed the board to the
  // zoom floor and made it unreadable; the board scrolls vertically instead.
  // zoom is read via a ref so setting it here can never re-trigger this effect.
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    if (!board || fittedFor.current === board.id) return;
    const canvas = canvasRef.current;
    const scroller = canvas?.parentElement;
    if (!canvas || !scroller) return;
    // getBoundingClientRect is in screen px (post-zoom) — divide back to natural.
    const rect = canvas.getBoundingClientRect();
    const naturalW = rect.width / (zoomRef.current || 1);
    if (naturalW <= 0) return;
    fittedFor.current = board.id;
    const fit = Math.min(1, (scroller.clientWidth - 8) / naturalW);
    setZoom(Math.max(READABLE_FIT_MIN, Math.round(fit * 100) / 100));
  }, [board]);

  const legacyApps = useMemo(() => {
    if (!board) return [];
    const legacy = board.apps.filter((a) => a.kind === 'LEGACY');
    return legacy.length ? legacy : board.apps;
  }, [board]);

  // App-scoped findings feed the panel (it does its own per-screen grouping);
  // the connector counts additionally narrow to the active screen so the map
  // always agrees with what the panel is showing.
  const appScoped = useMemo(() => {
    if (!board) return [];
    const ids = new Set(legacyApps.map((a) => a.id));
    return board.findings.filter((f) => ids.has(f.appId));
  }, [board, legacyApps]);

  const scoped = useMemo(
    () => (screenName ? appScoped.filter((f) => f.screenRef === screenName) : appScoped),
    [appScoped, screenName],
  );

  const specs: EdgeSpec[] = useMemo(() => {
    if (!board) return [];
    const mine = scoped;
    const componentByLayer = new Map(board.components.map((c) => [c.layer, c]));
    const out: EdgeSpec[] = [];
    for (const layer of LAYERS) {
      const rows = mine.filter((f) => f.layer === layer);
      if (rows.length === 0) continue;
      const stays = rows.filter((f) => !findingMoves(f)).length;
      const moves = rows.length - stays;
      const dim = activeLayer != null && activeLayer !== layer;
      const both = stays > 0 && moves > 0;
      // Every layer gets its own gutter lane so verticals never stack; a
      // stay/move pair splits one lane further apart.
      const base = (LAYERS.indexOf(layer) - 2) * 2;
      if (stays > 0)
        out.push({
          id: `s-${layer}`,
          from: `bf:${layer}`,
          to: `nz:${layer}`,
          color: GREEN,
          width: 2.5,
          count: stays,
          dim,
          y0Offset: both ? -12 : 0,
          y1Offset: both ? -8 : 0,
          lane: both ? base - 1 : base,
        });
      if (moves > 0)
        out.push({
          id: `m-${layer}`,
          from: `bf:${layer}`,
          to: `nz:${layer}`,
          color: RED,
          width: 2.5,
          count: moves,
          dim,
          y0Offset: both ? 14 : 0,
          y1Offset: both ? 10 : 0,
          lane: both ? base + 1 : base,
        });
      const comp = componentByLayer.get(layer);
      if (comp?.microserviceId)
        out.push({
          id: `g-${layer}`,
          from: `nz:${layer}`,
          to: `gf:${comp.microserviceId}:${layer}`,
          color: GREEN,
          width: 2.5,
          dim,
          lane: base,
        });
    }
    return out;
  }, [board, scoped, activeLayer]);

  const edges = useEdges(canvasRef, specs, zoom);

  if (listLoading || loading) return <LoadingState message="Loading workspace board…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!boards || boards.length === 0)
    return (
      <EmptyState message="No rationalization boards for this lens yet. Switch the lens or seed a board." />
    );
  if (!board) return <LoadingState message="Loading board…" />;

  const destination = selected
    ? (board.components.find((c) => c.layer === selected.layer)?.destination ?? null)
    : null;

  return (
    // Fill the viewport below the app chrome (header + tabs + breadcrumb +
    // page padding ≈ 156px): toolbar and trace take their height, the map
    // canvas flexes into everything left.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      <LensBar
        lens={lens}
        onLens={(l) => {
          setSelected(null);
          onLens(l);
        }}
        boards={boards}
        boardId={boardId}
        onBoard={(id) => {
          setBoardId(id);
          setSelected(null);
        }}
        legend={
          <>
            <LegendItem color={GREEN} label="correct — stays" />
            <LegendItem color={RED} label="needs to move" />
          </>
        }
      />
      {selected && <TraceBreadcrumb finding={selected} destination={destination} />}

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
              // CSS zoom (not transform) so the scaled size IS the layout size —
              // fit-to-frame leaves no phantom scroll range.
              zoom,
              width: 'max-content',
              padding: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 120,
            }}
          >
            <FlowEdges edges={edges} />
            <BrownfieldPanel
              title={board.application || board.name}
              findings={appScoped}
              screens={board.screens}
              screenName={screenName}
              onScreen={(n) => {
                setScreenName(n);
                setSelected(null);
              }}
              selectedFindingId={selected?.id ?? null}
              onSelectFinding={setSelected}
            />
            <NormalizeColumn board={board} activeLayer={activeLayer} findings={scoped} />
            <GreenfieldColumn
              microservices={board.microservices}
              components={board.components}
              findings={appScoped}
            />
          </div>
        </div>

        {/* Zoom controls float over the scroller's top-right corner. */}
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
          <ZoomBtn label="−" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} />
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
