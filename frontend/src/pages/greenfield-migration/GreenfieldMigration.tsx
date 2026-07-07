/**
 * Application Rationalization Workspace (green-field migration board) — page
 * shell: lens state (WR-01 tri-mode filters), board state/editing, drill
 * drawer and modals. The selector row lives in LensBar.tsx; the board node
 * components, data→board builder, overlay/diff model and panels live in
 * sibling modules (pure code motion split; behavior unchanged).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import {
  pct,
  statusDot,
  STATUS_META,
  CAPDAN_META,
  type AnatomyCategory,
  type FindingView,
  type StageDetail,
  type Layer,
} from '../../lib/rationalization';
import { Card, ErrorMessage, LoadingState } from '../../components/ui';
import {
  belongsHere,
  buildBoardBase,
  nodeTypes,
  edgeTypes,
  type ToggleCategoryFn,
} from './boardNodes';
import {
  EMPTY_OVERLAY,
  USER_EDGE,
  normalizeOverlay,
  applyOverlay,
  diffBoard,
} from './boardOverlay';
import { CommitPanel, ChangeLog, type LogEntry } from './BoardPanels';
import { EditBoxModal } from './EditBoxModal';
import { LensBar, type LensMode, type StageRow } from './LensBar';
import { NewApplicationModal } from './NewApplicationModal';

// What the side drawer is showing. Legacy-cell categories no longer drill to
// the drawer — they expand inside their box (WR-10); the drawer stays for the
// Normalize / Greenfield / shared-service boxes.
type Drill =
  | { kind: 'capdan'; layer: Layer }
  | { kind: 'service'; serviceId: string }
  | { kind: 'shared'; appId: string };

// A stage's application display label / stable multi-select key (WR-01).
const appLabel = (s: StageRow) => s.application ?? 'Unassigned';
const appKeyOf = (s: StageRow) => s.applicationId ?? appLabel(s);

// ── Board ───────────────────────────────────────────────────────────────────
// Embeddable: pass `embedded` to render inside another page (Initiatives tab)
// with a section header instead of a full PageHeader.
export default function ApplicationRationalization({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const { companyId, loading: companyLoading } = useCompany();
  const [list, setList] = useState<StageRow[]>([]);
  // WR-01 lens: mode + per-mode selections; VS/Roles filter server-side.
  const [mode, setMode] = useState<LensMode>('applications');
  const [selApps, setSelApps] = useState<string[]>([]);
  const [selStreams, setSelStreams] = useState<string[]>([]);
  const [selRoles, setSelRoles] = useState<string[]>([]);
  const [serverList, setServerList] = useState<StageRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StageDetail | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    kind: 'app' | 'component' | 'service';
    id: string;
  } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // WR-06 view toggle + WR-10 in-box expansion (cell:appId:layer → categories).
  const [view, setView] = useState<FindingView>('COMPONENT');
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  const [catalog, setCatalog] = useState<AnatomyCategory[]>([]);
  const [bnodes, setBNodes, onNodesChange] = useNodesState<Node>([]);
  const [bedges, setBEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const loadList = useCallback(
    (preferApp?: string) => {
      return api.get<StageRow[]>(withCompany('/rationalization', companyId)).then((rows) => {
        setList(rows);
        // Keep the application selection valid: prefer the just-created app,
        // else keep whatever survives, else default to the first application.
        const keys = new Map<string, string>(); // key → label
        for (const r of rows) if (!keys.has(appKeyOf(r))) keys.set(appKeyOf(r), appLabel(r));
        setSelApps((prev) => {
          const preferred = preferApp
            ? [...keys.entries()].find(([, label]) => label === preferApp)?.[0]
            : undefined;
          if (preferred) return [preferred];
          const kept = prev.filter((k) => keys.has(k));
          if (kept.length > 0) return kept;
          const first = keys.keys().next().value;
          return first ? [first] : [];
        });
      });
    },
    [companyId],
  );

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    loadList()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyLoading, loadList]);

  // Anatomy reference taxonomy — powers the category chip tooltips (WR-06).
  useEffect(() => {
    if (companyLoading) return;
    api
      .get<AnatomyCategory[]>(withCompany('/rationalization/anatomy-catalog', companyId))
      .then(setCatalog)
      .catch(() => setCatalog([])); // tooltips degrade to the built-in hint
  }, [companyId, companyLoading]);

  // Application options — distinct (applicationId ?? label) pairs from the
  // unfiltered stage list (WR-01 multi-select in Applications mode).
  const appOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of list) if (!seen.has(appKeyOf(s))) seen.set(appKeyOf(s), appLabel(s));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [list]);

  // VS/Roles lenses filter server-side (roles resolve to streams in the API);
  // Applications mode filters the already-loaded list client-side.
  useEffect(() => {
    if (mode === 'applications') {
      setServerList(null);
      return;
    }
    const sel = mode === 'valueStreams' ? selStreams : selRoles;
    if (sel.length === 0) {
      setServerList(null); // no filter → the full list
      return;
    }
    const param = mode === 'valueStreams' ? 'valueStreamIds' : 'roleIds';
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
  }, [mode, selStreams, selRoles, companyId]);

  // The filtered stage list the board picker operates on, grouped-sort by
  // application then stage order. An empty selection means "no filter".
  const stages = useMemo(() => {
    let rows: StageRow[];
    if (mode === 'applications')
      rows = selApps.length === 0 ? list : list.filter((s) => selApps.includes(appKeyOf(s)));
    else {
      const sel = mode === 'valueStreams' ? selStreams : selRoles;
      rows = sel.length === 0 ? list : (serverList ?? []);
    }
    return [...rows].sort(
      (a, b) => appLabel(a).localeCompare(appLabel(b)) || a.stageOrder - b.stageOrder,
    );
  }, [mode, list, selApps, selStreams, selRoles, serverList]);

  // Exactly one application selected → today's L3/L4 cascade; otherwise the
  // grouped Board select (LensBar). A VS/Roles filter can come up empty.
  const cascade = mode === 'applications' && selApps.length === 1;
  const filterActive =
    mode !== 'applications' && (mode === 'valueStreams' ? selStreams : selRoles).length > 0;

  // Keep the selected stage valid for the filtered list (survive or reset).
  useEffect(() => {
    if (stages.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && stages.some((s) => s.id === prev) ? prev : stages[0].id));
  }, [stages]);

  const createInitiative = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      await api.post(withCompany('/rationalization/initiatives', companyId), { name });
      await loadList(name); // selects the new application…
      setMode('applications'); // …so surface it regardless of the active lens
      setShowNew(false);
      setNewName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }, [newName, companyId, loadList]);

  const loadDetail = useCallback(() => {
    if (!selectedId) return;
    api
      .get<StageDetail>(`/rationalization/${selectedId}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId]);
  const loadLog = useCallback(() => {
    if (!selectedId) {
      setLog([]);
      return;
    }
    api
      .get<LogEntry[]>(`/audit?entityType=RationalizationWorkspace&entityId=${selectedId}`)
      .then(setLog)
      .catch(() => setLog([]));
  }, [selectedId]);

  useEffect(() => {
    setDrill(null);
    setEditing(false); // leave any in-progress board edit when switching stages
    setExpanded({}); // in-box expansions are per-stage
    if (!selectedId) {
      setDetail(null);
      setLog([]);
      return;
    }
    setDetail(null);
    loadDetail();
    loadLog();
  }, [selectedId, loadDetail, loadLog]);

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
    if (node.id.startsWith('cap:')) setDrill({ kind: 'capdan', layer: node.id.slice(4) as Layer });
    else if (node.id.startsWith('svc:')) setDrill({ kind: 'service', serviceId: node.id.slice(4) });
    else if (node.id.startsWith('shared:')) setDrill({ kind: 'shared', appId: node.id.slice(7) });
  }, []);
  // In edit mode, double-clicking a box opens its edit popup. Brown-field cells
  // (and their column header) edit the app; CAPDAN boxes edit the component;
  // green-field boxes edit the service.
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

  // The data-derived board (before any user overlay) — see greenfield/boardNodes.
  // View + expansion reshape the cell tags and the slot heights (WR-06/WR-10).
  const base = useMemo(
    () => buildBoardBase(detail, { view, expanded, onToggleCategory, catalog }),
    [detail, view, expanded, onToggleCategory, catalog],
  );

  // Saved overlay + the effective (data + saved overlay) board shown read-only.
  const savedOverlay = useMemo(() => normalizeOverlay(detail?.layout), [detail]);
  const effective = useMemo(() => applyOverlay(base, savedOverlay), [base, savedOverlay]);

  // Keep the live board synced to the effective board while NOT editing; when
  // editing, leave it under the user's control (their staged edits live here).
  useEffect(() => {
    if (editing) return;
    setBNodes(effective.nodes);
    setBEdges(effective.edges);
  }, [effective, editing, setBNodes, setBEdges]);

  // Edit interactions: draw a new arrow, or re-point an existing one. The id is
  // deterministic per connection so it survives remounts without colliding.
  const onConnect = useCallback(
    (c: Connection) => {
      const id = `u:${c.source}.${c.sourceHandle ?? 'r'}-${c.target}.${c.targetHandle ?? 'l'}`;
      setBEdges((eds) => addEdge({ ...USER_EDGE, ...c, id }, eds));
    },
    [setBEdges],
  );
  const onReconnect = useCallback(
    (oldEdge: Edge, newConn: Connection) => {
      setBEdges((eds) => reconnectEdge(oldEdge, newConn, eds));
    },
    [setBEdges],
  );

  // Staged (this session, vs the effective board) and the absolute overlay to save (vs base).
  const session = useMemo(
    () =>
      detail
        ? diffBoard(effective, { nodes: bnodes, edges: bedges }, detail)
        : { overlay: EMPTY_OVERLAY, changes: [] },
    [effective, bnodes, bedges, detail],
  );
  const saveOverlay = useMemo(
    () =>
      detail ? diffBoard(base, { nodes: bnodes, edges: bedges }, detail).overlay : EMPTY_OVERLAY,
    [base, bnodes, bedges, detail],
  );

  const submitBoard = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/rationalization/${selectedId}/layout`, {
        layout: saveOverlay,
        changes: session.changes,
      });
      setEditing(false);
      loadDetail();
      loadLog();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedId, saveOverlay, session.changes, loadDetail, loadLog]);

  const discardBoard = useCallback(() => {
    setEditing(false);
  }, []); // sync effect re-seeds from effective

  // What the drawer shows for the current drill subject (Normalize / Greenfield
  // boxes only — legacy-cell categories expand in place instead, WR-10).
  const drillView = useMemo(() => {
    if (!detail || !drill) return null;
    if (drill.kind === 'capdan') {
      const comp = detail.components.find((c) => c.layer === drill.layer);
      const findings = detail.findings.filter(
        (f) => f.layer === drill.layer && belongsHere(f.capdan),
      );
      const meta = [comp?.destination ? `→ ${comp.destination}` : '', comp?.targetTech ?? '']
        .filter(Boolean)
        .join(' · ');
      return {
        eyebrow: `Normalized · ${drill.layer}`,
        title: comp?.name ?? drill.layer,
        meta: meta || undefined,
        findings,
      };
    }
    // A shared service absorbs the Relocate findings pointing at it (WR-15).
    if (drill.kind === 'shared') {
      const a = detail.apps.find((x) => x.id === drill.appId);
      return {
        eyebrow: 'Shared service',
        title: a?.name ?? 'Shared service',
        meta: a?.techStack ?? undefined,
        findings: detail.findings.filter((f) => f.sharedServiceId === drill.appId),
      };
    }
    const m = detail.microservices.find((x) => x.id === drill.serviceId);
    const layers = detail.components
      .filter((c) => c.microserviceId === drill.serviceId)
      .map((c) => c.layer);
    const findings = detail.findings.filter(
      (f) => layers.includes(f.layer) && belongsHere(f.capdan),
    );
    const meta = [
      m?.techStack ?? '',
      m?.ownerRole ?? '',
      layers.length ? `Layers: ${layers.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      eyebrow: `Greenfield${m ? ` · ${m.status}` : ''}`,
      title: m?.name ?? 'Service',
      meta: meta || undefined,
      findings,
    };
  }, [detail, drill]);

  if (loading || companyLoading) return <LoadingState message="Loading rationalization…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const selectedStage = stages.find((s) => s.id === selectedId);

  return (
    <div>
      {!embedded && <PageHeader title="Application Rationalization Workspace" />}

      {/* WR-01 tri-mode lens — mode switch, per-mode multi-select, board picker
          (single-app L3/L4 cascade or grouped Board select) and row actions. */}
      <LensBar
        mode={mode}
        onModeChange={setMode}
        appOptions={appOptions}
        selApps={selApps}
        onAppsChange={setSelApps}
        selStreams={selStreams}
        onStreamsChange={setSelStreams}
        selRoles={selRoles}
        onRolesChange={setSelRoles}
        stages={stages}
        selectedId={selectedId}
        onSelectStage={setSelectedId}
        cascade={cascade}
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
          {filterActive
            ? `No boards touch the selected ${mode === 'roles' ? 'roles' : 'value streams'} yet.`
            : 'Nothing to inspect yet — use “+ New…” to start a board.'}
        </Card>
      ) : (
        <>
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
              <ReactFlowProvider key={selectedId}>
                <ReactFlow
                  nodes={bnodes}
                  edges={bedges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onReconnect={onReconnect}
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
              changes={session.changes}
              saving={saving}
              onSubmit={submitBoard}
              onDiscard={discardBoard}
              error={error}
            />
          )}

          {/* Change log — running total of committed edits, expandable to the detail. */}
          <ChangeLog entries={log} open={showLog} onToggle={() => setShowLog((v) => !v)} />
        </>
      )}

      {/* Drill-down drawer — granular detail for tags, normalized components, services */}
      {drillView && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setDrill(null)}
            aria-hidden="true"
          />
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#eaeaea]">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                  {drillView.eyebrow}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-[15px] font-semibold text-[#171717]">{drillView.title}</h3>
                </div>
                {drillView.meta && (
                  <div className="text-[11px] text-[#0f766e] mt-1 leading-snug">
                    {drillView.meta}
                  </div>
                )}
                <div className="text-[11px] text-[#a3a3a3] tnum mt-0.5">
                  {drillView.findings.length}{' '}
                  {drillView.findings.length === 1 ? 'finding' : 'findings'}
                </div>
              </div>
              <button
                onClick={() => setDrill(null)}
                className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]"
                aria-label="Close"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {drillView.findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-[#eaeaea] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-semibold text-[#171717] leading-snug">
                      {f.name}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#525252] flex-shrink-0">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusDot(f.migrationStatus) }}
                      />
                      {STATUS_META[f.migrationStatus]?.label ?? f.migrationStatus}
                    </span>
                  </div>
                  {/* layer context helps when drilling a component / service across cells */}
                  <div className="text-[10px] text-[#a3a3a3] mt-0.5">{f.layer}</div>
                  {f.codeRef && (
                    <div className="mt-2 rounded bg-[#f7f7f8] border border-[#eee] px-2 py-1.5 font-mono text-[11px] text-[#444] break-all">
                      {f.codeRef}
                    </div>
                  )}
                  {f.rationale && (
                    <p className="text-[12px] text-[#666666] mt-2 leading-snug">{f.rationale}</p>
                  )}
                  {f.migrationApproach && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#10b981] mt-px flex-shrink-0">
                        Migrate
                      </span>
                      <span className="text-[12px] text-[#171717] leading-snug">
                        {f.migrationApproach}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-[10px] text-[#a3a3a3] tnum">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-medium ${CAPDAN_META[f.capdan].chip}`}
                    >
                      {CAPDAN_META[f.capdan].label}
                    </span>
                    {f.capdan === 'Relocate' && f.targetLayer && (
                      <span className="text-[#7c3aed]">→ {f.targetLayer} layer</span>
                    )}
                    {f.effort && <span>· Effort {f.effort}</span>}
                    {f.complexity && <span>· {f.complexity}</span>}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}

      {/* New initiative modal */}
      {showNew && (
        <NewApplicationModal
          name={newName}
          onNameChange={setNewName}
          creating={creating}
          onCreate={createInitiative}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Box editor popup — opened by double-clicking a box in edit mode */}
      {editTarget && detail && (
        <EditBoxModal
          target={editTarget}
          detail={detail}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            loadDetail();
            loadLog();
          }}
        />
      )}
    </div>
  );
}
