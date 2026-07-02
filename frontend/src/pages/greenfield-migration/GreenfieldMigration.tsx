/**
 * Application Rationalization Workspace (green-field migration board) — page
 * shell: lens cascade, board state/editing, drill drawer and modals. The board
 * node components, data→board builder, overlay/diff model and panels live in
 * pages/greenfield/ (pure code motion split; behavior unchanged).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, addEdge, reconnectEdge,
  type Node, type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import {
  pct, statusDot, STATUS_META, CAPDAN_META,
  type StageListItem, type StageDetail, type Layer, type Capdan,
} from '../../lib/rationalization';
import { Button, Card, ErrorMessage, Input, LoadingState } from '../../components/ui';
import { belongsHere, buildBoardBase, nodeTypes, edgeTypes, type DrillFn } from './boardNodes';
import { EMPTY_OVERLAY, USER_EDGE, normalizeOverlay, applyOverlay, diffBoard } from './boardOverlay';
import { CommitPanel, ChangeLog, type LogEntry } from './BoardPanels';
import { EditBoxModal } from './EditBoxModal';
import { lensTokens, lensScore, LensField, LENS_SELECT_CLS, type LensL3 } from './lens';

// What the side drawer is showing.
type Drill =
  | { kind: 'cell'; appId: string; layer: Layer; category: string }
  | { kind: 'capdan'; layer: Layer }
  | { kind: 'service'; serviceId: string };

// ── Board ───────────────────────────────────────────────────────────────────
// Embeddable: pass `embedded` to render inside another page (Initiatives tab)
// with a section header instead of a full PageHeader.
export default function ApplicationRationalization({ embedded = false }: { embedded?: boolean } = {}) {
  const { companyId, loading: companyLoading } = useCompany();
  const [list, setList] = useState<StageListItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StageDetail | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<{ kind: 'app' | 'component' | 'service'; id: string } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bnodes, setBNodes, onNodesChange] = useNodesState<Node>([]);
  const [bedges, setBEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  const appOf = (s: StageListItem) => s.application ?? 'Unassigned';

  const loadList = useCallback((preferApp?: string) => {
    return api.get(`/rationalization${companyId ? `?companyId=${companyId}` : ''}`)
      .then((rows: StageListItem[]) => {
        setList(rows);
        const apps = [...new Set(rows.map(appOf))];
        setSelectedApp((prev) => (preferApp && apps.includes(preferApp) ? preferApp : prev && apps.includes(prev) ? prev : apps[0] ?? null));
      });
  }, [companyId]);

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true); setError('');
    loadList().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [companyLoading, loadList]);

  // Initiatives (unique applications) + the selected initiative's stages.
  const initiatives = useMemo(() => [...new Set(list.map(appOf))], [list]);
  const stages = useMemo(
    () => list.filter((s) => appOf(s) === selectedApp).sort((a, b) => a.stageOrder - b.stageOrder),
    [list, selectedApp],
  );
  // Keep the selected stage valid for the chosen initiative.
  useEffect(() => {
    if (stages.length === 0) { setSelectedId(null); return; }
    setSelectedId((prev) => (prev && stages.some((s) => s.id === prev) ? prev : stages[0].id));
  }, [stages]);

  // ── L3 → L4 lens cascade ──────────────────────────────────────────────────
  const [lensTree, setLensTree] = useState<LensL3[]>([]);
  const [selL3, setSelL3] = useState('');
  // '' (placeholder) | an L4 id | `stage:<id>` for an unmatched application lens.
  const [selL4, setSelL4] = useState('');

  useEffect(() => {
    api.get('/explorer/tree')
      .then((t: { divisions: { valueStreams: { id: string; name: string; areas: { id: string; name: string }[] }[] }[] }) => {
        const seen = new Set<string>();
        const l3s: LensL3[] = [];
        for (const d of t.divisions) for (const vs of d.valueStreams) {
          if (seen.has(vs.name)) continue;
          seen.add(vs.name);
          l3s.push({ id: vs.id, name: vs.name, l4s: vs.areas.map((a) => ({ id: a.id, name: a.name })) });
        }
        setLensTree(l3s.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setLensTree([])); // cascade degrades to the app dropdown only
  }, []);

  // Match each stage (lens) of the selected application to its closest L4.
  const lensIndex = useMemo(() => {
    const byStage = new Map<string, { l3Id: string; l4Id: string }>();
    const byL4 = new Map<string, string>(); // l4Id → stageId (first match wins)
    for (const s of stages) {
      const st = lensTokens(`${s.name} ${s.businessProcess ?? ''}`);
      let best: { l3Id: string; l4Id: string; score: number } | null = null;
      for (const l3 of lensTree) {
        const l3t = lensTokens(l3.name);
        for (const l4 of l3.l4s) {
          const score = lensScore(st, lensTokens(l4.name), l3t);
          if (score > 0 && (!best || score > best.score)) best = { l3Id: l3.id, l4Id: l4.id, score };
        }
      }
      if (best && !byL4.has(best.l4Id)) { byStage.set(s.id, { l3Id: best.l3Id, l4Id: best.l4Id }); byL4.set(best.l4Id, s.id); }
    }
    return { byStage, byL4 };
  }, [stages, lensTree]);

  // Only L3 value streams / L4 processes that resolve to an existing analysis
  // board (a matched stage) are offered in the cascade — everything else is hidden.
  const boardTree = useMemo(
    () => lensTree
      .map((l3) => ({ ...l3, l4s: l3.l4s.filter((l4) => lensIndex.byL4.has(l4.id)) }))
      .filter((l3) => l3.l4s.length > 0),
    [lensTree, lensIndex],
  );

  // Reflect the selected stage back into the dropdowns (app switch, load, …).
  useEffect(() => {
    if (lensTree.length === 0 || !selectedId) return;
    const mapped = lensIndex.byStage.get(selectedId);
    if (mapped) { setSelL3(mapped.l3Id); setSelL4(mapped.l4Id); }
    else { setSelL3((p) => (boardTree.some((x) => x.id === p) ? p : boardTree[0]?.id ?? '')); setSelL4(`stage:${selectedId}`); }
  }, [selectedId, lensIndex, lensTree, boardTree]);

  const onPickL3 = useCallback((id: string) => {
    setSelL3(id);
    // Every listed L4 has a board — selecting a stream opens its first one.
    const next = boardTree.find((x) => x.id === id)?.l4s[0];
    setSelL4(next?.id ?? '');
    const stage = next ? lensIndex.byL4.get(next.id) : undefined;
    if (stage) setSelectedId(stage);
  }, [boardTree, lensIndex]);

  const onPickL4 = useCallback((v: string) => {
    setSelL4(v);
    if (v.startsWith('stage:')) { setSelectedId(v.slice(6)); return; }
    const stage = lensIndex.byL4.get(v);
    if (stage) setSelectedId(stage);
  }, [lensIndex]);

  const curL3 = boardTree.find((x) => x.id === selL3);
  const unmappedStages = stages.filter((s) => !lensIndex.byStage.has(s.id));

  const createInitiative = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true); setError('');
    try {
      await api.post(withCompany('/rationalization/initiatives', companyId), { name });
      await loadList(name);
      setShowNew(false); setNewName('');
    } catch (e) { setError((e as Error).message); }
    finally { setCreating(false); }
  }, [newName, companyId, loadList]);

  const loadDetail = useCallback(() => {
    if (!selectedId) return;
    api.get(`/rationalization/${selectedId}`).then(setDetail).catch((e) => setError(e.message));
  }, [selectedId]);
  const loadLog = useCallback(() => {
    if (!selectedId) { setLog([]); return; }
    api.get(`/audit?entityType=RationalizationWorkspace&entityId=${selectedId}`).then(setLog).catch(() => setLog([]));
  }, [selectedId]);

  useEffect(() => {
    setDrill(null);
    setEditing(false); // leave any in-progress board edit when switching stages
    if (!selectedId) { setDetail(null); setLog([]); return; }
    setDetail(null);
    loadDetail();
    loadLog();
  }, [selectedId, loadDetail, loadLog]);

  const onDrill = useCallback<DrillFn>((appId, layer, category) => { if (editingRef.current) { return; } setDrill({ kind: 'cell', appId, layer, category }); }, []);
  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    if (editingRef.current) return;
    if (node.id.startsWith('cap:')) setDrill({ kind: 'capdan', layer: node.id.slice(4) as Layer });
    else if (node.id.startsWith('svc:')) setDrill({ kind: 'service', serviceId: node.id.slice(4) });
  }, []);
  // In edit mode, double-clicking a box opens its edit popup. Brown-field cells
  // (and their column header) edit the app; CAPDAN boxes edit the component;
  // green-field boxes edit the service.
  const onNodeDoubleClick = useCallback((_e: unknown, node: Node) => {
    if (!editingRef.current) return;
    const d = node.data as { appId?: string; componentId?: string };
    if ((node.id.startsWith('cell:') || node.id.startsWith('hdr:')) && d.appId) setEditTarget({ kind: 'app', id: d.appId });
    else if (node.id.startsWith('cap:') && d.componentId) setEditTarget({ kind: 'component', id: d.componentId });
    else if (node.id.startsWith('svc:')) setEditTarget({ kind: 'service', id: node.id.slice(4) });
  }, []);

  // The data-derived board (before any user overlay) — see greenfield/boardNodes.
  const base = useMemo(() => buildBoardBase(detail, onDrill), [detail, onDrill]);

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
  const onConnect = useCallback((c: Connection) => {
    const id = `u:${c.source}.${c.sourceHandle ?? 'r'}-${c.target}.${c.targetHandle ?? 'l'}`;
    setBEdges((eds) => addEdge({ ...USER_EDGE, ...c, id }, eds));
  }, [setBEdges]);
  const onReconnect = useCallback((oldEdge: Edge, newConn: Connection) => {
    setBEdges((eds) => reconnectEdge(oldEdge, newConn, eds));
  }, [setBEdges]);

  // Staged (this session, vs the effective board) and the absolute overlay to save (vs base).
  const session = useMemo(
    () => (detail ? diffBoard(effective, { nodes: bnodes, edges: bedges }, detail) : { overlay: EMPTY_OVERLAY, changes: [] }),
    [effective, bnodes, bedges, detail],
  );
  const saveOverlay = useMemo(
    () => (detail ? diffBoard(base, { nodes: bnodes, edges: bedges }, detail).overlay : EMPTY_OVERLAY),
    [base, bnodes, bedges, detail],
  );

  const submitBoard = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true); setError('');
    try {
      await api.post(`/rationalization/${selectedId}/layout`, { layout: saveOverlay, changes: session.changes });
      setEditing(false);
      loadDetail(); loadLog();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }, [selectedId, saveOverlay, session.changes, loadDetail, loadLog]);

  const discardBoard = useCallback(() => { setEditing(false); }, []); // sync effect re-seeds from effective

  // What the drawer shows for the current drill subject.
  const drillView = useMemo(() => {
    if (!detail || !drill) return null;
    if (drill.kind === 'cell') {
      const findings = detail.findings.filter((f) => f.appId === drill.appId && f.layer === drill.layer && (f.category ?? 'Other') === drill.category);
      const app = detail.apps.find((a) => a.id === drill.appId)?.name ?? '';
      return { eyebrow: `${app} · ${drill.layer}`, title: drill.category, capdan: findings[0]?.capdan as Capdan | undefined, meta: undefined as string | undefined, findings };
    }
    if (drill.kind === 'capdan') {
      const comp = detail.components.find((c) => c.layer === drill.layer);
      const findings = detail.findings.filter((f) => f.layer === drill.layer && belongsHere(f.capdan));
      const meta = [comp?.destination ? `→ ${comp.destination}` : '', comp?.targetTech ?? ''].filter(Boolean).join(' · ');
      return { eyebrow: `Normalized · ${drill.layer}`, title: comp?.name ?? drill.layer, capdan: undefined, meta: meta || undefined, findings };
    }
    const m = detail.microservices.find((x) => x.id === drill.serviceId);
    const layers = detail.components.filter((c) => c.microserviceId === drill.serviceId).map((c) => c.layer);
    const findings = detail.findings.filter((f) => layers.includes(f.layer) && belongsHere(f.capdan));
    const meta = [m?.techStack ?? '', m?.ownerRole ?? '', layers.length ? `Layers: ${layers.join(', ')}` : ''].filter(Boolean).join(' · ');
    return { eyebrow: `Green-field${m ? ` · ${m.status}` : ''}`, title: m?.name ?? 'Service', capdan: undefined, meta: meta || undefined, findings };
  }, [detail, drill]);

  if (loading || companyLoading) return <LoadingState message="Loading rationalization…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const selectedStage = stages.find((s) => s.id === selectedId);

  return (
    <div>
      {!embedded && <PageHeader title="Application Rationalization Workspace" />}

      {/* Lens cascade — Application → L3 value stream → L4 process (dependent selects) */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <LensField label="Application">
          <select value={selectedApp ?? ''} onChange={(e) => setSelectedApp(e.target.value)} className={LENS_SELECT_CLS}>
            {initiatives.length === 0 && <option value="">None yet</option>}
            {initiatives.map((app) => <option key={app} value={app}>{app}</option>)}
          </select>
        </LensField>
        {lensTree.length > 0 && stages.length > 0 && (
          <>
            {boardTree.length > 0 && (
              <LensField label="Value stream (L3)">
                <select value={selL3} onChange={(e) => onPickL3(e.target.value)} className={LENS_SELECT_CLS}>
                  {boardTree.map((l3) => <option key={l3.id} value={l3.id}>{l3.name}</option>)}
                </select>
              </LensField>
            )}
            <LensField label="Process (L4)">
              <select value={selL4} onChange={(e) => onPickL4(e.target.value)} className={LENS_SELECT_CLS}>
                {selL4 === '' && <option value="">Select a process…</option>}
                {(curL3?.l4s ?? []).map((l4) => (
                  <option key={l4.id} value={l4.id}>{l4.name}</option>
                ))}
                {unmappedStages.length > 0 && (
                  <optgroup label="Application lenses">
                    {unmappedStages.map((s) => <option key={s.id} value={`stage:${s.id}`}>{s.name}</option>)}
                  </optgroup>
                )}
              </select>
            </LensField>
          </>
        )}
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => { setNewName(''); setShowNew(true); }} className="text-[12px] flex-shrink-0">+ New application</Button>
      </div>

      {stages.length === 0 ? (
        <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">No applications yet — use “+ New application” to start one.</Card>
      ) : (
       <>
      {detail && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-[11px] text-[#666666] min-w-0">
            <span className="font-semibold text-[#171717]">{selectedStage?.name ?? detail.name}</span>
            <span className="text-[#a3a3a3] tnum"> · {pct(detail.progress)} migrated</span>
            <span className="text-[#a3a3a3]"> — {editing
              ? 'editing: drag boxes; drag edge dots to draw arrows; Delete removes a selected arrow; double-click a box to edit it'
              : 'read-only; use Edit board to rearrange, re-wire and edit boxes'}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing
              ? <Button variant="ghost" onClick={discardBoard} disabled={saving} className="text-[12px]">Exit</Button>
              : <Button variant="secondary" onClick={() => setEditing(true)} className="text-[12px]">Edit board</Button>}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] overflow-hidden" style={{ height: '82vh', minHeight: 640 }}>
        {!detail ? (
          <LoadingState baseClassName="h-full flex items-center justify-center text-sm text-[#a3a3a3]" message="Loading stage…" />
        ) : (
          <ReactFlowProvider key={selectedId}>
            <ReactFlow
              nodes={bnodes} edges={bedges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onReconnect={onReconnect} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick}
              fitView fitViewOptions={{ padding: 0.04 }}
              nodesDraggable={editing} nodesConnectable={editing} elementsSelectable={editing}
              edgesReconnectable={editing}
              deleteKeyCode={editing ? ['Backspace', 'Delete'] : null}
              panOnDrag zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} minZoom={0.3} maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              className={editing ? 'board-editing' : undefined}
            >
              <Background color="#e5e5e5" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>

      {/* Staged-changes commit panel — visible while editing, before submit. */}
      {editing && (
        <CommitPanel changes={session.changes} saving={saving} onSubmit={submitBoard} onDiscard={discardBoard} error={error} />
      )}

      {/* Change log — running total of committed edits, expandable to the detail. */}
      <ChangeLog entries={log} open={showLog} onToggle={() => setShowLog((v) => !v)} />
       </>
      )}

      {/* Drill-down drawer — granular detail for tags, normalized components, services */}
      {drillView && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDrill(null)} aria-hidden="true" />
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#eaeaea]">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">{drillView.eyebrow}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-[15px] font-semibold text-[#171717]">{drillView.title}</h3>
                  {drillView.capdan && <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${CAPDAN_META[drillView.capdan].chip}`}>{CAPDAN_META[drillView.capdan].label}</span>}
                </div>
                {drillView.meta && <div className="text-[11px] text-[#0f766e] mt-1 leading-snug">{drillView.meta}</div>}
                <div className="text-[11px] text-[#a3a3a3] tnum mt-0.5">{drillView.findings.length} {drillView.findings.length === 1 ? 'finding' : 'findings'}</div>
              </div>
              <button onClick={() => setDrill(null)} className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {drillView.findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-[#eaeaea] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-semibold text-[#171717] leading-snug">{f.name}</div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#525252] flex-shrink-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusDot(f.migrationStatus) }} />
                      {STATUS_META[f.migrationStatus]?.label ?? f.migrationStatus}
                    </span>
                  </div>
                  {/* layer context helps when drilling a component / service across cells */}
                  <div className="text-[10px] text-[#a3a3a3] mt-0.5">{f.layer}</div>
                  {f.codeRef && <div className="mt-2 rounded bg-[#f7f7f8] border border-[#eee] px-2 py-1.5 font-mono text-[11px] text-[#444] break-all">{f.codeRef}</div>}
                  {f.rationale && <p className="text-[12px] text-[#666666] mt-2 leading-snug">{f.rationale}</p>}
                  {f.migrationApproach && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#10b981] mt-px flex-shrink-0">Migrate</span>
                      <span className="text-[12px] text-[#171717] leading-snug">{f.migrationApproach}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-[10px] text-[#a3a3a3] tnum">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-medium ${CAPDAN_META[f.capdan].chip}`}>{CAPDAN_META[f.capdan].label}</span>
                    {f.capdan === 'Relocate' && f.targetLayer && <span className="text-[#7c3aed]">→ {f.targetLayer} layer</span>}
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
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => !creating && setShowNew(false)} aria-hidden="true" />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[420px] rounded-xl border border-[#eaeaea] bg-white shadow-xl p-5">
            <h3 className="text-[15px] font-semibold text-[#171717]">New application to rationalize</h3>
            <p className="text-[12px] text-[#666666] mt-1 leading-snug">Creates an application with a starter stage, two legacy-app columns, the five CAPDAN components and five layer-aligned green-field targets. Add findings and more stages in Data Admin.</p>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#525252] mt-4 mb-1.5">Application name</label>
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createInitiative(); }}
              placeholder="e.g. Billing & Finance Platform" />
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setShowNew(false)} disabled={creating} className="text-sm">Cancel</Button>
              <Button onClick={createInitiative} disabled={creating || !newName.trim()} className="text-sm">{creating ? 'Creating…' : 'Create application'}</Button>
            </div>
          </div>
        </>
      )}

      {/* Box editor popup — opened by double-clicking a box in edit mode */}
      {editTarget && detail && (
        <EditBoxModal
          target={editTarget}
          detail={detail}
          onClose={() => setEditTarget(null)}
          onSaved={() => { loadDetail(); loadLog(); }}
        />
      )}
    </div>
  );
}
