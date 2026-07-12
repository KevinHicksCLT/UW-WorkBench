/**
 * Workspace board shell (v3): domain switch (Application ↔ Product Model
 * Rationalization, PM-04), vocabulary-driven lens + legend (3-A), board
 * state/editing, drill drawer and modals. Data loading lives in
 * useWorkspaceBoard; the drag/connect overlay in useBoardOverlay; the v3
 * actions in useBoardActions; the board builder in buildBoard.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, Controls, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../lib/api';
import { withCompany } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import {
  lensModeOf,
  pct,
  type Domain,
  type FindingView,
  type Layer,
} from '../../lib/rationalization';
import { Card, ErrorMessage, LoadingState } from '../../components/ui';
import { nodeTypes, edgeTypes } from './boardNodes';
import { buildBoardBase } from './buildBoard';
import type { ToggleCategoryFn } from './CellNode';
import { CommitPanel, ChangeLog, type LogEntry } from './BoardPanels';
import { BoardLegend } from './BoardLegend';
import { computeDrillView, DrillDrawer, type Drill } from './DrillDrawer';
import { EditBoxModal, type EditTarget } from './EditBoxModal';
import { DOMAIN_OPTIONS, LensBar, parseDomainParam } from './LensBar';
import { NewApplicationModal } from './NewApplicationModal';
import { useBoardActions } from './useBoardActions';
import { useBoardOverlay } from './useBoardOverlay';
import { useVocabulary } from './useVocabulary';
import { useWorkspaceBoard } from './useWorkspaceBoard';

// ── Board ───────────────────────────────────────────────────────────────────
// Embeddable: pass `embedded` to render inside another page (the Workspace
// tab); Agent 4's Portfolio.tsx passes the initial domain (?domain=…).
export default function ApplicationRationalization({
  embedded = false,
  initialDomain,
}: { embedded?: boolean; initialDomain?: Domain } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [domain, setDomain] = useState<Domain>(
    () => initialDomain ?? parseDomainParam(searchParams.get('domain')) ?? 'APPLICATION',
  );
  const vocab = useVocabulary(domain);

  // Lens state: MODE token per domain (vocabulary rows drive the options).
  const [modeTokens, setModeTokens] = useState<Partial<Record<Domain, string>>>({});
  const modeToken = modeTokens[domain] ?? vocab.modes[0]?.value ?? '';
  const modeKey = useMemo(
    () =>
      modeToken
        ? lensModeOf(modeToken)
        : domain === 'PRODUCT_MODEL'
          ? ('models' as const)
          : ('applications' as const),
    [modeToken, domain],
  );
  const [selApps, setSelApps] = useState<string[]>([]);
  const [selStreams, setSelStreams] = useState<string[]>([]);
  const [selRoles, setSelRoles] = useState<string[]>([]);
  const [productSelected, setProductSelected] = useState<string[]>([]);

  const board = useWorkspaceBoard({
    domain,
    modeKey,
    selApps,
    selStreams,
    selRoles,
    productSelected,
    classification: vocab.classification,
  });
  const {
    detail,
    detailSource,
    stages,
    selectedId,
    setSelectedId,
    loadDetail,
    mutateDetail,
    clearDetail,
  } = board;

  // Default/repair the app selection whenever the option set changes (WR-01).
  useEffect(() => {
    setSelApps((prev) => {
      const ids = new Set(board.appOptions.map((o) => o.id));
      const kept = prev.filter((k) => ids.has(k));
      if (kept.length > 0) return kept;
      return board.appOptions[0] ? [board.appOptions[0].id] : [];
    });
  }, [board.appOptions]);

  const [drill, setDrill] = useState<Drill | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // WR-06 view toggle + WR-10 in-box expansion (cell:appId:layer → categories).
  const [view, setView] = useState('');
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  // 3-B: which source pair frames Normalize comparisons when > 2 columns.
  const [comparePair, setComparePair] = useState<[string, string] | null>(null);
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  // Keep the anatomy view valid for the domain's VIEW rows (none → no axis).
  useEffect(() => {
    setView((prev) =>
      vocab.views.some((v) => v.value === prev) ? prev : (vocab.views[0]?.value ?? ''),
    );
  }, [vocab.views]);

  const onDomainChange = useCallback(
    (d: Domain) => {
      if (d === domain) return;
      setDomain(d);
      setSelectedId(null); // the other domain re-picks from its own stage list
      clearDetail();
      setDrill(null);
      setEditing(false);
      setExpanded({});
      setComparePair(null);
      setProductSelected([]);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (d === 'PRODUCT_MODEL') next.set('domain', 'product-models');
          else next.delete('domain');
          return next;
        },
        { replace: true },
      );
    },
    [domain, clearDetail, setSelectedId, setSearchParams],
  );

  const createInitiative = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    board.setError('');
    try {
      await api.post(withCompany('/rationalization/initiatives', board.companyId), { name });
      await board.loadList(name, setSelApps); // selects the new application
    } catch (e) {
      board.setError((e as Error).message);
    } finally {
      setCreating(false);
      setShowNew(false);
      setNewName('');
    }
  }, [newName, board]);

  const loadLog = useCallback(() => {
    if (!selectedId || domain === 'PRODUCT_MODEL') {
      setLog([]);
      return;
    }
    api
      .get<LogEntry[]>(`/audit?entityType=RationalizationWorkspace&entityId=${selectedId}`)
      .then(setLog)
      .catch(() => setLog([]));
  }, [selectedId, domain]);

  useEffect(() => {
    setDrill(null);
    setEditing(false); // leave any in-progress board edit when switching stages
    setExpanded({}); // in-box expansions are per-stage
    setComparePair(null);
    if (!selectedId) {
      clearDetail();
      setLog([]);
      return;
    }
    clearDetail();
    loadDetail();
    loadLog();
  }, [selectedId, loadDetail, loadLog, clearDetail]);

  // WR-10: a category chip toggles its in-box expansion (read mode only).
  const onToggleCategory = useCallback<ToggleCategoryFn>((appId, layer, category) => {
    if (editingRef.current) return;
    setExpanded((prev) => {
      const key = `cell:${appId}:${layer}`;
      const cur = prev[key] ?? [];
      const next = cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category];
      return { ...prev, [key]: next };
    });
  }, []);
  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    if (editingRef.current) return;
    if (node.id.startsWith('cap:')) setDrill({ kind: 'capdan', layer: node.id.slice(4) });
    else if (node.id.startsWith('svc:')) setDrill({ kind: 'service', serviceId: node.id.slice(4) });
    else if (node.id.startsWith('shared:')) setDrill({ kind: 'shared', appId: node.id.slice(7) });
  }, []);
  // In edit mode, double-clicking a box opens its edit popup.
  const onNodeDoubleClick = useCallback((_e: unknown, node: Node) => {
    if (!editingRef.current) return;
    const d = node.data as { appId?: string; componentId?: string };
    if ((node.id.startsWith('cell:') || node.id.startsWith('hdr:')) && d.appId)
      setEditTarget({ kind: 'app', id: d.appId });
    else if (node.id.startsWith('cap:') && d.componentId)
      setEditTarget({ kind: 'component', id: d.componentId });
    else if (node.id.startsWith('svc:')) setEditTarget({ kind: 'service', id: node.id.slice(4) });
    // Shared services are RationalizationApp rows — same editor (WR-15).
    else if (node.id.startsWith('shared:')) setEditTarget({ kind: 'app', id: node.id.slice(7) });
  }, []);

  // v3 actions (3-B/3-D) — dialogs-confirmed; local on fixture boards.
  const reload = useCallback(() => {
    loadDetail();
    loadLog();
  }, [loadDetail, loadLog]);
  const actions = useBoardActions({ detail, detailSource, domain, mutateDetail, reload });
  const onEditFinding = useCallback(
    (findingId: string) => setEditTarget({ kind: 'finding', id: findingId }),
    [],
  );
  const onAddFinding = useCallback(
    (appId: string, layer: Layer) => setEditTarget({ kind: 'newFinding', appId, layer }),
    [],
  );

  // The data-derived board (before any user overlay) — ONE builder, both
  // domains: the axis + all meta come from the vocabulary (3-A/3-C).
  const legacyApps = useMemo(
    () => (detail?.apps ?? []).filter((a) => a.kind !== 'SHARED_SERVICE'),
    [detail],
  );
  const effectivePair = useMemo<[string, string] | null>(() => {
    if (legacyApps.length <= 2) return null;
    return comparePair ?? [legacyApps[0].id, legacyApps[1].id];
  }, [legacyApps, comparePair]);
  const base = useMemo(
    () =>
      buildBoardBase(detail, {
        view: vocab.views.length > 0 && view ? (view as FindingView) : null,
        expanded,
        onToggleCategory,
        catalog: board.catalog,
        layers: vocab.layers,
        layerHints: vocab.layerHints,
        classification: vocab.classification,
        matchMeta: vocab.matchMeta,
        domain,
        comparePair: effectivePair,
        onEntryAction: actions.onEntryAction,
        onRetireFinding: actions.onRetireFinding,
        onEditFinding: editing ? undefined : onEditFinding,
        onAddFinding: editing ? undefined : onAddFinding,
      }),
    [
      detail,
      view,
      expanded,
      onToggleCategory,
      board.catalog,
      vocab,
      domain,
      effectivePair,
      actions,
      onEditFinding,
      onAddFinding,
      editing,
    ],
  );

  const overlay = useBoardOverlay(base, detail, editing);

  const submitBoard = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    board.setError('');
    try {
      await api.post(`/rationalization/${selectedId}/layout`, {
        layout: overlay.saveOverlay,
        changes: overlay.session.changes,
      });
      setEditing(false);
      reload();
    } catch (e) {
      board.setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedId, overlay.saveOverlay, overlay.session.changes, reload, board]);

  const discardBoard = useCallback(() => {
    setEditing(false);
  }, []); // sync effect re-seeds from effective

  const drillView = useMemo(
    () => computeDrillView(detail, drill, vocab.classification),
    [detail, drill, vocab.classification],
  );

  if (board.loading || board.companyLoading || vocab.loading)
    return <LoadingState message="Loading rationalization…" />;
  if (board.error) return <ErrorMessage>{board.error}</ErrorMessage>;

  const selectedStage = stages.find((s) => s.id === selectedId);
  const isProducts = domain === 'PRODUCT_MODEL';

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={
            isProducts
              ? 'Product Model Rationalization Workspace'
              : 'Application Rationalization Workspace'
          }
        />
      )}

      {/* PM-04 domain switch + WR-01 lens — modes/views from vocabulary rows. */}
      <LensBar
        domain={domain}
        domainOptions={DOMAIN_OPTIONS}
        onDomainChange={onDomainChange}
        modeOptions={vocab.modes}
        modeToken={modeToken}
        onModeToken={(t) => setModeTokens((m) => ({ ...m, [domain]: t }))}
        appOptions={board.appOptions}
        selApps={selApps}
        onAppsChange={setSelApps}
        selStreams={selStreams}
        onStreamsChange={setSelStreams}
        selRoles={selRoles}
        onRolesChange={setSelRoles}
        productOptions={board.productOptions}
        productSelected={productSelected}
        onProductSelected={setProductSelected}
        stages={stages}
        selectedId={selectedId}
        onSelectStage={setSelectedId}
        cascade={board.cascade}
        viewOptions={vocab.views}
        view={view}
        onViewChange={setView}
        hasDetail={detail !== null}
        editing={editing}
        saving={saving}
        onStartEdit={() => {
          // Expansion is a read-mode feature — collapse everything so
          // the edit overlay's drag positions stay sane (WR-10).
          setExpanded({});
          setEditing(true);
        }}
        onExitEdit={discardBoard}
        onNew={() => {
          setNewName('');
          setShowNew(true);
        }}
        newTitle={`${selectedStage?.name ?? ''} · ${detail ? pct(detail.progress) : ''} migrated`}
      />

      {stages.length === 0 ? (
        <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">
          {board.filterActive
            ? 'No boards match the selected filter yet.'
            : isProducts
              ? 'No product-model workspaces yet.'
              : 'Nothing to inspect yet — use “+ New…” to start a board.'}
        </Card>
      ) : (
        <>
          {/* v3 legend + roll-ups (vocabulary meta) + comparison pair. */}
          <BoardLegend
            legend={vocab.legend}
            detail={detail}
            source={detailSource}
            comparePair={effectivePair}
            onComparePair={setComparePair}
          />

          {editing && detail && (
            <div className="text-[11px] text-[#a3a3a3] mb-2">
              Editing: drag boxes · drag edge dots to draw arrows · Delete removes a selected arrow
              · double-click a box to edit it
            </div>
          )}

          <div
            className="rounded-xl border border-[#eaeaea] bg-[#fafafa] overflow-hidden"
            style={{ height: '82vh', minHeight: 640 }}
          >
            {!detail ? (
              <LoadingState
                baseClassName="h-full flex items-center justify-center text-sm text-[#a3a3a3]"
                message="Loading stage…"
              />
            ) : (
              <ReactFlowProvider key={`${domain}:${selectedId}`}>
                <ReactFlow
                  nodes={overlay.bnodes}
                  edges={overlay.bedges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={overlay.onNodesChange}
                  onEdgesChange={overlay.onEdgesChange}
                  onConnect={overlay.onConnect}
                  onReconnect={overlay.onReconnect}
                  onNodeClick={onNodeClick}
                  onNodeDoubleClick={onNodeDoubleClick}
                  fitView
                  fitViewOptions={{ padding: 0.04 }}
                  nodesDraggable={editing}
                  nodesConnectable={editing}
                  elementsSelectable={editing}
                  edgesReconnectable={editing}
                  deleteKeyCode={editing ? ['Backspace', 'Delete'] : null}
                  panOnDrag
                  zoomOnScroll={false}
                  zoomOnPinch
                  zoomOnDoubleClick={false}
                  minZoom={0.3}
                  maxZoom={1.6}
                  proOptions={{ hideAttribution: true }}
                  className={editing ? 'board-editing' : undefined}
                >
                  <Background color="#e5e5e5" gap={20} />
                  {/* Top-right so zoom is visible without scrolling the tall canvas. */}
                  <Controls showInteractive={false} position="top-right" />
                </ReactFlow>
              </ReactFlowProvider>
            )}
          </div>

          {/* Staged-changes commit panel — visible while editing, before submit. */}
          {editing && (
            <CommitPanel
              changes={overlay.session.changes}
              saving={saving}
              onSubmit={submitBoard}
              onDiscard={discardBoard}
              error={board.error}
            />
          )}

          {/* Change log — running total of committed edits (app domain). */}
          {!isProducts && (
            <ChangeLog entries={log} open={showLog} onToggle={() => setShowLog((v) => !v)} />
          )}
        </>
      )}

      {/* Drill-down drawer — granular detail for normalized components, services */}
      {drillView && (
        <DrillDrawer
          view={drillView}
          statusMeta={vocab.statusMeta}
          classification={vocab.classification}
          onClose={() => setDrill(null)}
        />
      )}

      {/* New initiative modal (application domain) */}
      {showNew && !isProducts && (
        <NewApplicationModal
          name={newName}
          onNameChange={setNewName}
          creating={creating}
          onCreate={createInitiative}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Box / finding editor popup (edit-mode double-click; PM-07 finding UI) */}
      {editTarget && detail && (
        <EditBoxModal
          target={editTarget}
          detail={detail}
          ctx={{
            domain,
            source: detailSource,
            classification: vocab.classification,
            layers: vocab.layers,
            onLocalPatch: actions.onLocalPatch,
          }}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            if (detailSource !== 'fixture') reload();
          }}
        />
      )}
    </div>
  );
}
