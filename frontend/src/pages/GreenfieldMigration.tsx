import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType, Handle, Position,
  useNodesState, useEdgesState, addEdge, reconnectEdge,
  type Node, type Edge, type NodeProps, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { withCompany } from '../lib/portfolio';
import PageHeader from '../components/PageHeader';
import {
  LAYERS, pct, statusDot, STATUS_META, CAPDAN_META, categoryTags,
  type StageListItem, type StageDetail, type Layer, type Capdan, type CategoryTag, type Finding, type BoardLayout,
} from '../lib/rationalization';

const belongsHere = (c: Capdan) => c === 'Common' || c === 'Different';
type DrillFn = (appId: string, layer: Layer, category: string) => void;
// What the side drawer is showing.
type Drill =
  | { kind: 'cell'; appId: string; layer: Layer; category: string }
  | { kind: 'capdan'; layer: Layer }
  | { kind: 'service'; serviceId: string };

// A change-log entry (audit row scoped to the workspace).
type LogEntry = { id: string; action: string; actorEmail: string; createdAt: string; diff: string | null };

// ── Value-stream lens cascade (L3 → L4 dropdowns) ───────────────────────────
// The canonical L3 value streams and their L4 processes come from the unified
// Level tree (GET /explorer/tree: division → value_stream → areas). The
// rationalization stages carry no FK into that tree, so each stage (lens) is
// matched to its closest L4 process by name-token overlap. Only L3 streams and
// L4 processes that resolve to an existing board are listed (no dead picks);
// picking an L3 repopulates the L4 dropdown and opens its first board. Stages
// with no match stay reachable via an "Application lenses" group in the L4
// dropdown.
type LensL4 = { id: string; name: string };
type LensL3 = { id: string; name: string; l4s: LensL4[] };

const LENS_STOP = new Set(['and', 'the', 'for', 'with', 'mgmt', 'management']);
// Lowercased, lightly-stemmed name tokens ("Channels" matches "channel").
const lensTokens = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).map((t) => t.replace(/s$/, '')).filter((t) => t.length >= 3 && !LENS_STOP.has(t));
// Overlap score — hits on the L4 name count double vs hits on its parent L3.
function lensScore(stage: string[], l4: string[], l3: string[]): number {
  const s = new Set(stage);
  let n = 0;
  for (const t of l4) if (s.has(t)) n += 2;
  for (const t of l3) if (s.has(t)) n += 1;
  return n;
}

// Tiny labelled control for the cascade row.
function LensField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</span>
      {children}
    </label>
  );
}
const LENS_SELECT_CLS = 'h-7 rounded-md border border-[#eaeaea] bg-white px-1.5 text-[12px] text-[#171717] max-w-[240px] focus:outline-none focus:border-[#d4d4d4]';

// ── Custom React Flow nodes ─────────────────────────────────────────────────
// Handles are hidden in read mode and revealed via the `.board-editing` CSS
// class on the canvas when editing; connectability follows the global
// `nodesConnectable` flag, so no per-handle override is needed.
const sideHandles = (
  <>
    <Handle id="l" type="target" position={Position.Left} className="board-handle" />
    <Handle id="r" type="source" position={Position.Right} className="board-handle" />
  </>
);

function CellNode({ data }: NodeProps) {
  const d = data as { layer: Layer; appId: string; tags: CategoryTag[]; onDrill: DrillFn };
  return (
    <div className="rounded-lg border-2 border-[#e7d3b5] bg-[#fdf8f0] shadow-sm px-2.5 py-2" style={{ width: 230 }}>
      {sideHandles}
      <div className="text-[14px] font-bold text-[#8a5a1a] mb-1.5">{d.layer}</div>
      <div className="flex flex-wrap gap-1">
        {d.tags.length === 0 ? <span className="text-[11px] text-[#cfcfcf]">—</span> : d.tags.map((t) => {
          const ok = belongsHere(t.capdan);
          const cls = ok ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]' : 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]';
          return (
            <button key={`${t.category}-${t.capdan}`} onClick={(e) => { e.stopPropagation(); d.onDrill(d.appId, d.layer, t.category); }}
              className={`inline-flex items-center gap-1 rounded-md border pl-1.5 pr-1 py-0.5 text-[11px] font-medium hover:shadow-sm ${cls}`}
              title={`${t.count} ${t.category} · ${ok ? 'belongs here' : t.capdan === 'Relocate' ? `move to ${t.targetLayer}` : 'eliminate'} — click for detail`}>
              <span className="truncate max-w-[120px]">{t.category}</span>
              {t.capdan === 'Relocate' && t.targetLayer && <span className="opacity-80">→ {t.targetLayer}</span>}
              <span className="inline-flex items-center justify-center min-w-[15px] h-[14px] rounded-full bg-white/70 text-[10px] font-semibold px-0.5">{t.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CapdanNode({ data }: NodeProps) {
  const d = data as { name: string; destination: string | null; targetTech: string | null; count: number };
  return (
    <div className="rounded-lg border-2 border-[#c7d2fe] bg-[#f5f7ff] shadow-sm px-3 py-2.5 cursor-pointer hover:border-[#a5b4fc]" style={{ width: 214 }} title="Click for the normalized findings">
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4f46e5]">Normalize</div>
        <div className="text-[10px] text-[#a3a3a3] tnum">{d.count} ›</div>
      </div>
      <div className="text-[15px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {d.destination && <div className="text-[11px] text-[#0f766e] mt-1">→ {d.destination}</div>}
    </div>
  );
}

function ServiceNode({ data }: NodeProps) {
  const d = data as { name: string; status: string; tech: string | null; layers: Layer[]; count: number };
  return (
    <div className="rounded-xl border-2 border-[#a7f3d0] bg-[#ecfdf5] shadow-sm px-3 py-2.5 cursor-pointer hover:border-[#6ee7b7]" style={{ width: 236 }} title="Click for the granular detail of this green-field service">
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">Green-field · {d.status}</div>
        <div className="text-[10px] text-[#0f766e] tnum">{d.count} ›</div>
      </div>
      <div className="text-[16px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {/* IT layers this service owns — aligns the green-field app to the stack */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {d.layers.map((l) => (
          <span key={l} className="inline-flex items-center rounded border border-[#99f6e4] bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#0f766e]">{l}</span>
        ))}
      </div>
      {d.tech && <div className="text-[10px] text-[#a3a3a3] mt-1.5 leading-snug">{d.tech}</div>}
    </div>
  );
}

function HeaderNode({ data }: NodeProps) {
  const d = data as { title: string; sub?: string; tone?: 'brown' | 'indigo' | 'teal' };
  return (
    <div style={{ width: 236 }}>
      <div className="text-[19px] font-bold text-[#171717] leading-tight">{d.title}</div>
      {d.sub && <div className="text-[19px] font-bold text-[#171717] leading-tight truncate">{d.sub}</div>}
    </div>
  );
}

function LayerLabelNode({ data }: NodeProps) {
  const d = data as { layer: string };
  return (
    <div className="text-[19px] font-bold text-[#171717] text-right leading-tight" style={{ width: 120 }}>
      {d.layer}
    </div>
  );
}

const nodeTypes = { cell: CellNode, capdan: CapdanNode, service: ServiceNode, header: HeaderNode, layerLabel: LayerLabelNode };

const X = { label: -130, app0: 0, app1: 260, capdan: 600, service: 900 };
const ROW_H = 150;

// ── Board overlay (user-curated drag/connect layer) ──────────────────────────
type Overlay = {
  positions: Record<string, { x: number; y: number }>;
  addedEdges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[];
  removedEdges: string[];
};
const EMPTY_OVERLAY: Overlay = { positions: {}, addedEdges: [], removedEdges: [] };

type StagedChange = { type: 'move' | 'connect' | 'reconnect' | 'disconnect'; label: string };
const CHANGE_DOT: Record<StagedChange['type'], string> = { move: '#a3a3a3', connect: '#10b981', reconnect: '#4f46e5', disconnect: '#be123c' };

// Visual style for any arrow the user has drawn or re-pointed.
const USER_EDGE = {
  type: 'default' as const,
  style: { stroke: '#4f46e5', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5', width: 16, height: 16 },
  reconnectable: true as const,
};

function normalizeOverlay(layout: BoardLayout | null | undefined): Overlay {
  if (!layout) return EMPTY_OVERLAY;
  return {
    positions: layout.positions ?? {},
    addedEdges: layout.addedEdges ?? [],
    removedEdges: layout.removedEdges ?? [],
  };
}

// Lay the saved/user overlay on top of the data-derived board.
function applyOverlay(base: { nodes: Node[]; edges: Edge[] }, ov: Overlay): { nodes: Node[]; edges: Edge[] } {
  const nodes = base.nodes.map((n) => (ov.positions[n.id] ? { ...n, position: ov.positions[n.id] } : n));
  const removed = new Set(ov.removedEdges);
  const kept = base.edges.filter((e) => !removed.has(e.id));
  const added: Edge[] = ov.addedEdges.map((e) => ({ ...USER_EDGE, id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'r', targetHandle: e.targetHandle ?? 'l' }));
  return { nodes, edges: [...kept, ...added] };
}

function boardNodeLabel(id: string, detail: StageDetail): string {
  if (id.startsWith('cell:')) { const [, appId, layer] = id.split(':'); const app = detail.apps.find((a) => a.id === appId)?.name ?? 'App'; return `${app} · ${layer}`; }
  if (id.startsWith('cap:')) { const layer = id.slice(4); return detail.components.find((c) => c.layer === layer)?.name ?? `Normalize ${layer}`; }
  if (id.startsWith('svc:')) { return detail.microservices.find((m) => m.id === id.slice(4))?.name ?? 'Green-field service'; }
  return id;
}

// Diff a working board against a reference: which positions moved, which arrows
// were added / re-pointed / removed. Drives both the overlay to persist and the
// human-readable staged-change list.
function diffBoard(
  ref: { nodes: Node[]; edges: Edge[] },
  work: { nodes: Node[]; edges: Edge[] },
  detail: StageDetail,
): { overlay: Overlay; changes: StagedChange[] } {
  const positions: Overlay['positions'] = {};
  const addedEdges: Overlay['addedEdges'] = [];
  const removedEdges: string[] = [];
  const changes: StagedChange[] = [];

  const refPos = new Map(ref.nodes.map((n) => [n.id, n.position]));
  for (const n of work.nodes) {
    const p = refPos.get(n.id);
    if (!p) continue;
    if (Math.round(p.x) !== Math.round(n.position.x) || Math.round(p.y) !== Math.round(n.position.y)) {
      positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      changes.push({ type: 'move', label: `Moved ${boardNodeLabel(n.id, detail)}` });
    }
  }

  const serialize = (e: Edge) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'r', targetHandle: e.targetHandle ?? 'l' });
  const refById = new Map(ref.edges.map((e) => [e.id, e]));
  const workById = new Map(work.edges.map((e) => [e.id, e]));
  for (const [id, e] of workById) {
    const b = refById.get(id);
    if (!b) {
      addedEdges.push(serialize(e));
      changes.push({ type: 'connect', label: `Connected ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}` });
    } else if (b.source !== e.source || b.target !== e.target || (b.sourceHandle ?? 'r') !== (e.sourceHandle ?? 'r') || (b.targetHandle ?? 'l') !== (e.targetHandle ?? 'l')) {
      removedEdges.push(id);
      addedEdges.push(serialize(e));
      changes.push({ type: 'reconnect', label: `Re-pointed ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}` });
    }
  }
  for (const [id, e] of refById) {
    if (!workById.has(id)) {
      removedEdges.push(id);
      changes.push({ type: 'disconnect', label: `Removed ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}` });
    }
  }
  return { overlay: { positions, addedEdges, removedEdges }, changes };
}

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

  const onDrill = useCallback<DrillFn>((appId, layer, category) => { if (editingRef.current) return; setDrill({ kind: 'cell', appId, layer, category }); }, []);
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
    const d = node.data as { appId?: string; componentId?: string; sub?: string };
    if (node.id.startsWith('cell:') && d.appId) setEditTarget({ kind: 'app', id: d.appId });
    else if (node.id.startsWith('hdr:') && d.sub) setEditTarget({ kind: 'app', id: node.id.slice(4) });
    else if (node.id.startsWith('cap:') && d.componentId) setEditTarget({ kind: 'component', id: d.componentId });
    else if (node.id.startsWith('svc:')) setEditTarget({ kind: 'service', id: node.id.slice(4) });
  }, []);

  // The data-derived board (before any user overlay). Headers and layer labels
  // are scaffolding — always locked; the cell / CAPDAN / service boxes follow
  // the global `nodesDraggable` flag so they can be dragged in edit mode.
  const base = useMemo(() => {
    if (!detail) return { nodes: [] as Node[], edges: [] as Edge[] };
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const appX = [X.app0, X.app1];
    const layerIndex = Object.fromEntries(LAYERS.map((l, i) => [l, i])) as Record<Layer, number>;
    const lock = { draggable: false, selectable: false } as const;

    // layers owned by each green-field service + kept-finding counts
    const layersByService = new Map<string, Layer[]>();
    for (const c of detail.components) if (c.microserviceId) {
      const arr = layersByService.get(c.microserviceId) ?? []; arr.push(c.layer); layersByService.set(c.microserviceId, arr);
    }
    const keptCountByLayer = (layer: Layer) => detail.findings.filter((f) => f.layer === layer && belongsHere(f.capdan)).length;

    // Headers
    nodes.push({ id: 'hdr:cap', type: 'header', position: { x: X.capdan, y: -78 }, data: { title: 'CAPDAN — Normalize', tone: 'indigo' }, ...lock });
    nodes.push({ id: 'hdr:svc', type: 'header', position: { x: X.service, y: -78 }, data: { title: 'Green-field', tone: 'teal' }, ...lock });
    detail.apps.slice(0, 2).forEach((a, i) => {
      nodes.push({ id: `hdr:${a.id}`, type: 'header', position: { x: appX[i], y: -86 }, data: { title: 'Brown-field', sub: a.name, tone: 'brown' }, ...lock });
    });

    LAYERS.forEach((layer, li) => {
      const y = li * ROW_H;
      nodes.push({ id: `lbl:${layer}`, type: 'layerLabel', position: { x: X.label, y: y + 18 }, data: { layer }, ...lock });

      detail.apps.slice(0, 2).forEach((a, i) => {
        const tags = categoryTags(detail.findings, layer, a.id);
        nodes.push({ id: `cell:${a.id}:${layer}`, type: 'cell', position: { x: appX[i], y }, data: { layer, appId: a.id, tags, onDrill }, selectable: false });
        if (tags.some((t) => belongsHere(t.capdan))) {
          edges.push({ id: `c-${a.id}-${layer}`, source: `cell:${a.id}:${layer}`, target: `cap:${layer}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', style: { stroke: '#cbd5e1', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 } });
        }
        const seen = new Set<string>();
        for (const t of tags) {
          if (t.capdan !== 'Relocate' || !t.targetLayer) continue;
          const key = `${a.id}-${layer}-${t.targetLayer}`;
          if (seen.has(key)) continue; seen.add(key);
          edges.push({ id: `r-${key}`, source: `cell:${a.id}:${layer}`, target: `cap:${t.targetLayer}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', animated: true, style: { stroke: '#7c3aed', strokeWidth: 1.75, strokeDasharray: '5 3' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed', width: 16, height: 16 }, label: `→ ${t.targetLayer}`, labelStyle: { fill: '#7c3aed', fontSize: 10, fontWeight: 600 }, labelBgStyle: { fill: '#f5f3ff' } });
        }
      });

      const comp = detail.components.find((c) => c.layer === layer);
      if (comp) {
        nodes.push({ id: `cap:${layer}`, type: 'capdan', position: { x: X.capdan, y: y + 8 }, data: { name: comp.name, destination: comp.destination, targetTech: comp.targetTech, count: keptCountByLayer(layer), componentId: comp.id } });
      }
    });

    // Green-field services — positioned at the centre of the layers they own.
    const span = (LAYERS.length - 1) * ROW_H;
    detail.microservices.forEach((m) => {
      const owned = (layersByService.get(m.id) ?? []).slice().sort((a, b) => layerIndex[a] - layerIndex[b]);
      const ys = owned.length ? owned.map((l) => layerIndex[l] * ROW_H) : [span / 2];
      const y = ys.reduce((s, v) => s + v, 0) / ys.length;
      const count = owned.reduce((s, l) => s + keptCountByLayer(l), 0);
      nodes.push({ id: `svc:${m.id}`, type: 'service', position: { x: X.service, y: y + 2 }, data: { name: m.name, status: m.status, tech: m.techStack, layers: owned, count } });
    });
    for (const comp of detail.components) {
      if (!comp.microserviceId) continue;
      edges.push({ id: `d-${comp.layer}`, source: `cap:${comp.layer}`, target: `svc:${comp.microserviceId}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', style: { stroke: '#5eead4', strokeWidth: 1.75 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#14b8a6', width: 15, height: 15 } });
    }

    return { nodes, edges };
  }, [detail, onDrill]);

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

  if (loading || companyLoading) return <div className="text-sm text-[#a3a3a3]">Loading rationalization…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;

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
        <button onClick={() => { setNewName(''); setShowNew(true); }} className="btn-secondary text-[12px] flex-shrink-0">+ New application</button>
      </div>

      {stages.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">No applications yet — use “+ New application” to start one.</div>
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
              ? <button onClick={discardBoard} disabled={saving} className="btn-ghost text-[12px]">Exit</button>
              : <button onClick={() => setEditing(true)} className="btn-secondary text-[12px]">Edit board</button>}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] overflow-hidden" style={{ height: '82vh', minHeight: 640 }}>
        {!detail ? (
          <div className="h-full flex items-center justify-center text-sm text-[#a3a3a3]">Loading stage…</div>
        ) : (
          <ReactFlowProvider key={selectedId}>
            <ReactFlow
              nodes={bnodes} edges={bedges} nodeTypes={nodeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onReconnect={onReconnect} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick}
              fitView fitViewOptions={{ padding: 0.15 }}
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
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createInitiative(); }}
              placeholder="e.g. Billing & Finance Platform" className="input" />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)} disabled={creating} className="btn-ghost text-sm">Cancel</button>
              <button onClick={createInitiative} disabled={creating || !newName.trim()} className="btn-primary text-sm">{creating ? 'Creating…' : 'Create application'}</button>
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

// ── Box editor popup ─────────────────────────────────────────────────────────
// Double-clicking any box in edit mode opens this popup. It resolves the box to
// its underlying record (brown-field app · CAPDAN component · green-field
// service) and edits the right fields against the matching PATCH endpoint.
type BoxField = { key: string; label: string; placeholder?: string; multiline?: boolean };
type BoxConfig = { endpoint: string; eyebrow: string; title: string; fields: BoxField[]; values: Record<string, string> };

function buildBoxConfig(target: { kind: string; id: string }, detail: StageDetail): BoxConfig | null {
  const v = (s: string | null | undefined) => s ?? '';
  if (target.kind === 'app') {
    const a = detail.apps.find((x) => x.id === target.id);
    if (!a) return null;
    return {
      endpoint: `/rationalization/apps/${a.id}`, eyebrow: 'Brown-field · legacy app', title: 'Edit application',
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'techStack', label: 'Tech stack', placeholder: 'e.g. C# / .NET, SQL Server' },
        { key: 'disposition', label: 'Disposition', placeholder: 'Retain | Refactor | Replace | Retire' },
      ],
      values: { name: v(a.name), techStack: v(a.techStack), disposition: v(a.disposition) },
    };
  }
  if (target.kind === 'component') {
    const c = detail.components.find((x) => x.id === target.id);
    if (!c) return null;
    return {
      endpoint: `/rationalization/components/${c.id}`, eyebrow: `CAPDAN — Normalize · ${c.layer}`, title: 'Edit CAPDAN box',
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'destination', label: 'Destination', placeholder: 'green-field target' },
        { key: 'targetTech', label: 'Target tech' },
        { key: 'pattern', label: 'Pattern', placeholder: 'e.g. Strangler facade' },
        { key: 'principle', label: 'Principle (CAPDAN rationale)', multiline: true },
      ],
      values: { name: v(c.name), destination: v(c.destination), targetTech: v(c.targetTech), pattern: v(c.pattern), principle: v(c.principle) },
    };
  }
  const m = detail.microservices.find((x) => x.id === target.id);
  if (!m) return null;
  return {
    endpoint: `/rationalization/microservices/${m.id}`, eyebrow: 'Green-field · target service', title: 'Edit service',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'kind', label: 'Kind', placeholder: 'Microservice | Application' },
      { key: 'status', label: 'Status', placeholder: 'Planned | Building | Live' },
      { key: 'techStack', label: 'Tech stack' },
      { key: 'ownerRole', label: 'Owner role' },
    ],
    values: { name: v(m.name), kind: v(m.kind), status: v(m.status), techStack: v(m.techStack), ownerRole: v(m.ownerRole) },
  };
}

function EditBoxModal({ target, detail, onClose, onSaved }: { target: { kind: 'app' | 'component' | 'service'; id: string }; detail: StageDetail; onClose: () => void; onSaved: () => void }) {
  const cfg = useMemo(() => buildBoxConfig(target, detail), [target, detail]);
  const [form, setForm] = useState<Record<string, string>>(() => cfg?.values ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!cfg) return null;

  async function save() {
    if (!(form.name ?? '').trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(cfg!.endpoint, form);
      onSaved();
      onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[460px] max-h-[88vh] overflow-y-auto rounded-xl border border-[#eaeaea] bg-white shadow-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#4f46e5]">{cfg.eyebrow}</div>
            <h3 className="text-[16px] font-bold text-[#171717] mt-0.5">{cfg.title}</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="space-y-2.5">
          {cfg.fields.map((f, i) => (
            <div key={f.key}>
              <label className="block text-[11px] font-medium text-[#525252] mb-1">{f.label}</label>
              {f.multiline
                ? <textarea className="input" rows={2} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <input autoFocus={i === 0} className="input" value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </div>
          ))}
        </div>
        {error && <div className="text-[12px] text-[#be123c] mt-2">{error}</div>}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={saving} className="btn-ghost text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </>
  );
}

// ── Staged-changes commit panel ──────────────────────────────────────────────
// The pre-submit "commit": the running list of board edits the user has staged,
// shown as a commit-tree-style list with type dots, before they submit.
function CommitPanel({ changes, saving, onSubmit, onDiscard, error }: { changes: StagedChange[]; saving: boolean; onSubmit: () => void; onDiscard: () => void; error: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#c7d2fe] bg-[#f5f7ff] p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[12px] font-semibold text-[#171717]">
          Staged changes
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-white text-[11px] font-semibold text-[#4f46e5] px-1.5 tnum border border-[#c7d2fe]">{changes.length}</span>
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onDiscard} disabled={saving} className="btn-ghost text-[12px]">Discard</button>
          <button onClick={onSubmit} disabled={saving || changes.length === 0} className="btn-primary text-[12px]">{saving ? 'Submitting…' : 'Submit changes'}</button>
        </div>
      </div>
      {error && <div className="text-[12px] text-[#be123c] mb-2">{error}</div>}
      {changes.length === 0 ? (
        <div className="text-[12px] text-[#a3a3a3]">Nothing staged yet — drag a box or re-wire an arrow and it will appear here.</div>
      ) : (
        <ul className="space-y-1.5 pl-1 border-l border-[#c7d2fe]">
          {changes.map((c, i) => (
            <li key={i} className="flex items-center gap-2 -ml-[5px] text-[12px] text-[#171717]">
              <span className="inline-block w-2 h-2 rounded-full ring-2 ring-[#f5f7ff] flex-shrink-0" style={{ background: CHANGE_DOT[c.type] }} />
              <span className="truncate">{c.label}</span>
              <span className="text-[9px] uppercase tracking-[0.08em] text-[#a3a3a3] flex-shrink-0">{c.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Change log ───────────────────────────────────────────────────────────────
// Collapsed: a running total of edits. Expanded: the field-level detail.
type CapdanDiff = { subject?: string; summary?: string; layer?: string; changes?: Record<string, { from: unknown; to: unknown }> | StagedChange[] };

function ChangeLog({ entries, open, onToggle }: { entries: LogEntry[]; open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#fafafa] transition-colors duration-150">
        <span className="text-[12px] font-semibold text-[#171717]">
          Change log
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] px-1.5 tnum">{entries.length}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={'text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-180' : '')} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#eaeaea] px-4 py-3 max-h-72 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-[12px] text-[#a3a3a3]">No changes recorded yet.</div>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => <ChangeLogRow key={e.id} entry={e} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeLogRow({ entry }: { entry: LogEntry }) {
  let parsed: CapdanDiff | null = null;
  try { parsed = entry.diff ? JSON.parse(entry.diff) : null; } catch { parsed = null; }
  const boardChanges = Array.isArray(parsed?.changes) ? (parsed!.changes as StagedChange[]) : null;
  const fieldChanges = parsed?.changes && !Array.isArray(parsed.changes) ? Object.entries(parsed.changes) : [];
  const title = parsed?.subject ?? parsed?.summary ?? (entry.action === 'COMMIT_BOARD' ? 'Board changes' : entry.action);
  return (
    <li className="flex gap-3 text-[12px]">
      <div className="text-[11px] text-[#a3a3a3] w-32 flex-shrink-0 tnum">{new Date(entry.createdAt).toLocaleString()}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[#171717]">
          <span className="font-medium">{title}</span>
          {parsed?.layer && <span className="text-[#a3a3a3]"> · {parsed.layer}</span>}
          <span className="text-[#a3a3a3]"> — {entry.actorEmail}</span>
        </div>
        {boardChanges && boardChanges.length > 0 && (
          <ul className="mt-1 space-y-0.5 pl-1 border-l border-[#eaeaea]">
            {boardChanges.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 -ml-[4px] text-[11px] text-[#666666]">
                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHANGE_DOT[c.type] ?? '#a3a3a3' }} />
                <span className="truncate">{c.label}</span>
              </li>
            ))}
          </ul>
        )}
        {fieldChanges.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {fieldChanges.map(([f, v]) => (
              <div key={f} className="text-[11px] text-[#666666]">
                <span className="font-medium text-[#525252]">{f}</span>: <span className="text-[#a3a3a3] line-through">{String(v.from ?? '—')}</span> → <span className="text-[#171717]">{String(v.to ?? '—')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
