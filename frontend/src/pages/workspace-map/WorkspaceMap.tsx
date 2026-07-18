import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, ErrorMessage, EmptyState } from '../../components/ui';
import { useBoardList, useBoardDetails, type Lens } from './useBoard';
import { FlowEdges, useEdges, type EdgeSpec } from './FlowEdges';
import LensBar, { type WorkspaceLens } from './LensBar';
import AppPicker, { type AppOption } from './AppPicker';
import BrownfieldPanel from './BrownfieldPanel';
import NormalizeColumn from './NormalizeColumn';
import GreenfieldColumn from './GreenfieldColumn';
import ProductBoard from './product/ProductBoard';
import { LAYERS, findingMoves, GREEN, RED, READABLE_FIT_MIN } from './types';
import type { BoardDetail, Finding, Layer } from './types';
import { useLayerAlignment } from './useLayerAlignment';

// The Workspace map — an interactive, three-column rationalization board
// (brown-field decomposition → normalize → green-field target) rendered from
// the live APIs. The Applications / Value streams / Roles lenses share the
// /rationalization board; the Products lens renders its own comparison board
// (product/ProductBoard) over /product-models/workspaces.
//
// Like the Products lens, the board compares a PICKED SET of scanned
// applications (from any board): the Brownfield panel walks ONE of them at a
// time (app toggle + screen picker), while Normalize and Greenfield always
// aggregate every application in the comparison.

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
  // The picked comparison set (null = the active board's own apps) and which
  // of them the Brownfield panel is currently walking.
  const [pickedAppIds, setPickedAppIds] = useState<Set<string> | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [zoom, setZoom] = useState(1);
  // One expand/collapse state per LAYER, shared by all three columns: opening
  // "UI" anywhere opens the UI row in the panel, the Normalize section and the
  // Greenfield floor together, so the whole band reads as one row.
  const [expandedLayers, setExpandedLayers] = useState<Partial<Record<Layer, boolean>>>({});
  const toggleLayer = (layer: Layer) => setExpandedLayers((c) => ({ ...c, [layer]: !c[layer] }));

  const { data: boards, loading: listLoading, error: listError } = useBoardList({ lens });

  // Default the selected board to the first in the list for the active lens.
  useEffect(() => {
    if (boards && boards.length > 0 && (!boardId || !boards.some((b) => b.id === boardId))) {
      setBoardId(boards[0].id);
    }
    if (boards && boards.length === 0) setBoardId(null);
  }, [boards, boardId]);

  // Every scanned application across every board of the lens, as one FLAT
  // pool — the compare picker can mix applications from any board, and its
  // domain/value-stream filters come from the owning board's wiring.
  const pool: AppOption[] = useMemo(
    () =>
      (boards ?? []).flatMap((b) => {
        const legacy = (b.apps ?? []).filter((a) => a.kind === 'LEGACY');
        const src = legacy.length ? legacy : (b.apps ?? []);
        return src.map((a) => ({
          id: a.id,
          name: a.name,
          boardId: b.id,
          valueStream: b.valueStream,
          domain: b.valueStreamDomain,
        }));
      }),
    [boards],
  );

  // Selection defaults to the active board's own applications.
  const selectedAppIds = useMemo(
    () => pickedAppIds ?? new Set(pool.filter((o) => o.boardId === boardId).map((o) => o.id)),
    [pickedAppIds, pool, boardId],
  );
  const selectedOptions = useMemo(
    () => pool.filter((o) => selectedAppIds.has(o.id)),
    [pool, selectedAppIds],
  );
  const involvedBoardIds = useMemo(
    () => [...new Set(selectedOptions.map((o) => o.boardId))],
    [selectedOptions],
  );
  const selectionKey = useMemo(() => [...selectedAppIds].sort().join('+'), [selectedAppIds]);

  const { data: details, loading, error, refetch } = useBoardDetails(involvedBoardIds);

  // A board switch resets the whole comparison scope.
  useEffect(() => {
    setPickedAppIds(null);
    setActiveAppId(null);
    setScreenName(null);
    setSelected(null);
    setExpandedLayers({});
  }, [boardId]);

  // A different comparison (app added/removed) starts collapsed again.
  useEffect(() => {
    setSelected(null);
    setExpandedLayers({});
  }, [selectionKey]);

  // A screen switch starts collapsed again (the counts live in the headers).
  useEffect(() => {
    setExpandedLayers({});
  }, [screenName]);

  // Merge the involved boards into one comparison, scoped to the picked apps.
  // Normalize/Greenfield read this full scope; the Brownfield panel narrows
  // further to its active application.
  const merged = useMemo(() => {
    if (!details) return null;
    const list = involvedBoardIds
      .map((id) => details[id])
      .filter((b): b is BoardDetail => Boolean(b));
    if (list.length === 0) return null;
    const boardOfApp = new Map<string, string>();
    const boardOfMs = new Map<string, string>();
    const boardOfComp = new Map<string, string>();
    for (const b of list) {
      for (const a of b.apps) boardOfApp.set(a.id, b.id);
      for (const m of b.microservices) boardOfMs.set(m.id, b.id);
      for (const c of b.components) boardOfComp.set(c.id, b.id);
    }
    const apps = list.flatMap((b) => b.apps.filter((a) => selectedAppIds.has(a.id)));
    const findings = list.flatMap((b) => b.findings.filter((f) => selectedAppIds.has(f.appId)));
    const inScope = new Set(findings.map((f) => f.id));
    const normalizationEntries = list.flatMap((b) =>
      b.normalizationEntries.filter((e) => e.findingIds.some((id) => inScope.has(id))),
    );
    const title = apps.map((a) => a.name).join(' + ');
    return {
      name: title,
      application: title,
      apps,
      findings,
      normalizationEntries,
      components: list.flatMap((b) => b.components),
      microservices: list.flatMap((b) => b.microservices),
      screens: list.flatMap((b) => b.screens.filter((s) => selectedAppIds.has(s.appId))),
      boardOfApp,
      boardOfMs,
      boardOfComp,
    };
  }, [details, involvedBoardIds, selectedAppIds]);

  const addApp = (id: string) => {
    const next = new Set(selectedAppIds);
    next.add(id);
    setPickedAppIds(next);
  };
  const removeApp = (id: string) => {
    if (selectedAppIds.size === 1) return; // at least one application stays
    const next = new Set(selectedAppIds);
    next.delete(id);
    setPickedAppIds(next);
    if (activeAppId === id) setActiveAppId(null);
  };
  const replaceApp = (oldId: string, newId: string) => {
    if (oldId === newId) return;
    const next = new Set(selectedAppIds);
    next.delete(oldId);
    next.add(newId);
    setPickedAppIds(next);
    if (activeAppId === oldId) setActiveAppId(null);
  };

  // The Brownfield panel walks ONE application of the comparison at a time.
  const activeApp = merged
    ? (merged.apps.find((a) => a.id === activeAppId) ?? merged.apps[0] ?? null)
    : null;
  const activeId = activeApp?.id ?? null;

  // Switching the brownfield application restarts its screen walk.
  useEffect(() => {
    setScreenName(null);
    setSelected(null);
  }, [activeId]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeLayer = selected ? selected.layer : null;

  // Fit-to-frame: scale the canvas once per comparison so all three columns
  // are in view on load; after that the zoom buttons own the scale. Width-only
  // — the columns are tall lists, so fitting height too crushed the board to
  // the zoom floor and made it unreadable; the board scrolls vertically
  // instead. zoom is read via a ref so setting it can't re-trigger the effect.
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    if (!merged || fittedFor.current === selectionKey) return;
    const canvas = canvasRef.current;
    const scroller = canvas?.parentElement;
    if (!canvas || !scroller) return;
    // getBoundingClientRect is in screen px (post-zoom) — divide back to natural.
    const rect = canvas.getBoundingClientRect();
    const naturalW = rect.width / (zoomRef.current || 1);
    if (naturalW <= 0) return;
    fittedFor.current = selectionKey;
    const fit = Math.min(1, (scroller.clientWidth - 8) / naturalW);
    setZoom(Math.max(READABLE_FIT_MIN, Math.round(fit * 100) / 100));
  }, [merged, selectionKey]);

  // Brownfield scope: the active application's findings/screens; the connector
  // counts additionally narrow to the active screen so the map always agrees
  // with what the panel is showing.
  const bfFindings = useMemo(
    () => (merged && activeId ? merged.findings.filter((f) => f.appId === activeId) : []),
    [merged, activeId],
  );
  const bfScreens = useMemo(
    () => (merged && activeId ? merged.screens.filter((s) => s.appId === activeId) : []),
    [merged, activeId],
  );
  const scoped = useMemo(
    () => (screenName ? bfFindings.filter((f) => f.screenRef === screenName) : bfFindings),
    [bfFindings, screenName],
  );

  // Greenfield pass-through scoping: a target service only counts findings
  // from ITS OWN board's applications (cross-board findings never leak onto
  // another initiative's floors).
  const findingsByMs = useMemo(() => {
    const m = new Map<string, Finding[]>();
    if (!merged) return m;
    for (const ms of merged.microservices) {
      const bId = merged.boardOfMs.get(ms.id);
      m.set(
        ms.id,
        merged.findings.filter((f) => merged.boardOfApp.get(f.appId) === bId),
      );
    }
    return m;
  }, [merged]);

  const specs: EdgeSpec[] = useMemo(() => {
    if (!merged) return [];
    const out: EdgeSpec[] = [];
    for (const layer of LAYERS) {
      const rows = scoped.filter((f) => f.layer === layer);
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
      // One green edge per component whose floor actually renders — a merged
      // comparison can land the same layer on several boards' services.
      for (const comp of merged.components) {
        if (comp.layer !== layer || !comp.microserviceId) continue;
        const lands =
          merged.normalizationEntries.some((e) => e.componentId === comp.id) ||
          (findingsByMs.get(comp.microserviceId) ?? []).some(
            (f) => f.layer === layer && !f.deadCode && f.capdan !== 'Eliminate',
          );
        if (lands)
          out.push({
            id: `g-${comp.id}`,
            from: `nz:${layer}`,
            to: `gf:${comp.microserviceId}:${layer}`,
            color: GREEN,
            width: 2.5,
            dim,
            lane: base,
          });
      }
    }
    return out;
  }, [merged, scoped, activeLayer, findingsByMs]);

  const edges = useEdges(canvasRef, specs, zoom);
  // SCRUM-222: line each layer's rows up across the three columns so the
  // connectors run horizontally instead of criss-crossing diagonals.
  const pads = useLayerAlignment(
    canvasRef,
    merged ? selectionKey : null,
    merged?.components ?? [],
    zoom,
  );

  if (listLoading || loading) return <LoadingState message="Loading workspace board…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!boards || boards.length === 0)
    return (
      <EmptyState message="No rationalization boards for this lens yet. Switch the lens or seed a board." />
    );
  if (!merged || !activeApp) return <LoadingState message="Loading board…" />;

  const destination = selected
    ? (merged.components.find(
        (c) =>
          c.layer === selected.layer &&
          merged.boardOfComp.get(c.id) === merged.boardOfApp.get(selected.appId),
      )?.destination ?? null)
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
      {/* No board dropdown here — applications are picked flat via AppPicker;
          the board is only the data container behind each application. */}
      <LensBar
        lens={lens}
        onLens={(l) => {
          setSelected(null);
          onLens(l);
        }}
        boards={[]}
        boardId={null}
        onBoard={() => undefined}
      />
      <AppPicker
        pool={pool}
        selected={selectedOptions}
        onReplace={replaceApp}
        onAdd={addApp}
        onRemove={removeApp}
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
              title={activeApp.name}
              apps={merged.apps}
              activeAppId={activeApp.id}
              onActiveApp={setActiveAppId}
              findings={bfFindings}
              screens={bfScreens}
              screenName={screenName}
              onScreen={(n) => {
                setScreenName(n);
                setSelected(null);
              }}
              selectedFindingId={selected?.id ?? null}
              onSelectFinding={setSelected}
              layerPads={pads.bf}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
            />
            <NormalizeColumn
              board={merged}
              activeLayer={activeLayer}
              findings={merged.findings}
              onResolved={refetch}
              layerPads={pads.nz}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
            />
            <GreenfieldColumn
              microservices={merged.microservices}
              components={merged.components}
              findings={merged.findings}
              findingsByMs={findingsByMs}
              normalizationEntries={merged.normalizationEntries}
              layerPads={pads.gf}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
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
