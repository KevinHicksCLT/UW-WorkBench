import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { withCompany } from '../lib/portfolio';
import PageHeader from '../components/PageHeader';
import {
  LAYERS, pct, statusDot, STATUS_META, CAPDAN_META, categoryTags,
  type StageListItem, type StageDetail, type Layer, type Capdan, type CategoryTag, type Finding,
} from '../lib/rationalization';

const belongsHere = (c: Capdan) => c === 'Common' || c === 'Different';
type DrillFn = (appId: string, layer: Layer, category: string) => void;
// What the side drawer is showing.
type Drill =
  | { kind: 'cell'; appId: string; layer: Layer; category: string }
  | { kind: 'capdan'; layer: Layer }
  | { kind: 'service'; serviceId: string };

// ── Custom React Flow nodes ─────────────────────────────────────────────────
const sideHandles = (
  <>
    <Handle id="l" type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
    <Handle id="r" type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} />
  </>
);

function CellNode({ data }: NodeProps) {
  const d = data as { layer: Layer; appId: string; tags: CategoryTag[]; onDrill: DrillFn };
  return (
    <div className="rounded-lg border border-[#eaeaea] bg-white shadow-sm px-2.5 py-2" style={{ width: 230 }}>
      {sideHandles}
      <div className="text-[11px] font-semibold text-[#171717] mb-1.5">{d.layer}</div>
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
      <div className="text-[12px] font-semibold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {d.destination && <div className="text-[10px] text-[#0f766e] mt-1">→ {d.destination}</div>}
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
      <div className="text-[13px] font-semibold text-[#171717] leading-tight mt-0.5">{d.name}</div>
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
  const tone = d.tone === 'brown' ? 'text-[#8a5a1a]' : d.tone === 'teal' ? 'text-[#0f766e]' : 'text-[#4f46e5]';
  return (
    <div style={{ width: 236 }}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.10em] ${tone}`}>{d.title}</div>
      {d.sub && <div className="text-[12px] font-semibold text-[#171717] leading-tight truncate">{d.sub}</div>}
    </div>
  );
}

function LayerLabelNode({ data }: NodeProps) {
  const d = data as { layer: string };
  return <div className="text-[12px] font-semibold text-[#171717] text-right" style={{ width: 100 }}>{d.layer}</div>;
}

const nodeTypes = { cell: CellNode, capdan: CapdanNode, service: ServiceNode, header: HeaderNode, layerLabel: LayerLabelNode };

const X = { label: -130, app0: 0, app1: 260, capdan: 600, service: 900 };
const ROW_H = 150;

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

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetail(null); setDrill(null);
    api.get(`/rationalization/${selectedId}`).then(setDetail).catch((e) => setError(e.message));
  }, [selectedId]);

  const onDrill = useCallback<DrillFn>((appId, layer, category) => setDrill({ kind: 'cell', appId, layer, category }), []);
  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    if (node.id.startsWith('cap:')) setDrill({ kind: 'capdan', layer: node.id.slice(4) as Layer });
    else if (node.id.startsWith('svc:')) setDrill({ kind: 'service', serviceId: node.id.slice(4) });
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!detail) return { nodes: [] as Node[], edges: [] as Edge[] };
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const appX = [X.app0, X.app1];
    const layerIndex = Object.fromEntries(LAYERS.map((l, i) => [l, i])) as Record<Layer, number>;
    const noDrag = { draggable: false } as const;

    // layers owned by each green-field service + kept-finding counts
    const layersByService = new Map<string, Layer[]>();
    for (const c of detail.components) if (c.microserviceId) {
      const arr = layersByService.get(c.microserviceId) ?? []; arr.push(c.layer); layersByService.set(c.microserviceId, arr);
    }
    const keptCountByLayer = (layer: Layer) => detail.findings.filter((f) => f.layer === layer && belongsHere(f.capdan)).length;

    // Headers
    nodes.push({ id: 'hdr:cap', type: 'header', position: { x: X.capdan, y: -78 }, data: { title: 'CAPDAN — Normalize', tone: 'indigo' }, selectable: false, ...noDrag });
    nodes.push({ id: 'hdr:svc', type: 'header', position: { x: X.service, y: -78 }, data: { title: 'Green-field', tone: 'teal' }, selectable: false, ...noDrag });
    detail.apps.slice(0, 2).forEach((a, i) => {
      nodes.push({ id: `hdr:${a.id}`, type: 'header', position: { x: appX[i], y: -86 }, data: { title: 'Brown-field', sub: a.name, tone: 'brown' }, selectable: false, ...noDrag });
    });

    LAYERS.forEach((layer, li) => {
      const y = li * ROW_H;
      nodes.push({ id: `lbl:${layer}`, type: 'layerLabel', position: { x: X.label, y: y + 18 }, data: { layer }, selectable: false, ...noDrag });

      detail.apps.slice(0, 2).forEach((a, i) => {
        const tags = categoryTags(detail.findings, layer, a.id);
        nodes.push({ id: `cell:${a.id}:${layer}`, type: 'cell', position: { x: appX[i], y }, data: { layer, appId: a.id, tags, onDrill }, selectable: false, ...noDrag });
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
        nodes.push({ id: `cap:${layer}`, type: 'capdan', position: { x: X.capdan, y: y + 8 }, data: { name: comp.name, destination: comp.destination, targetTech: comp.targetTech, count: keptCountByLayer(layer) }, ...noDrag });
      }
    });

    // Green-field services — positioned at the centre of the layers they own.
    const span = (LAYERS.length - 1) * ROW_H;
    detail.microservices.forEach((m) => {
      const owned = (layersByService.get(m.id) ?? []).slice().sort((a, b) => layerIndex[a] - layerIndex[b]);
      const ys = owned.length ? owned.map((l) => layerIndex[l] * ROW_H) : [span / 2];
      const y = ys.reduce((s, v) => s + v, 0) / ys.length;
      const count = owned.reduce((s, l) => s + keptCountByLayer(l), 0);
      nodes.push({ id: `svc:${m.id}`, type: 'service', position: { x: X.service, y: y + 2 }, data: { name: m.name, status: m.status, tech: m.techStack, layers: owned, count }, ...noDrag });
    });
    for (const comp of detail.components) {
      if (!comp.microserviceId) continue;
      edges.push({ id: `d-${comp.layer}`, source: `cap:${comp.layer}`, target: `svc:${comp.microserviceId}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', style: { stroke: '#5eead4', strokeWidth: 1.75 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#14b8a6', width: 15, height: 15 } });
    }

    return { nodes, edges };
  }, [detail, onDrill]);

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

  const application = selectedApp ?? detail?.application ?? undefined;
  const belongCount = detail ? detail.counts.Common + detail.counts.Different : 0;
  const subtitle = application
    ? `${application} — drag to pan, zoom with the controls. Flow left → right: legacy apps → CAPDAN normalization → green-field. Click any tag, component or service for the granular detail.`
    : 'Decompose legacy applications and re-platform onto green-field.';

  return (
    <div>
      {embedded ? (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#4f46e5]">“Evergreen” Portfolio Rationalization</div>
            <h2 className="text-lg font-semibold text-[#171717] mt-0.5">Application Rationalization</h2>
            <p className="text-[13px] text-[#666666] mt-0.5">{subtitle}</p>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Application Rationalization"
          subtitle={subtitle}
          eyebrow="“Evergreen” Portfolio Rationalization"
        />
      )}

      {/* Application selector — the company runs many rationalization initiatives */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mr-1">Application</span>
          {initiatives.length === 0 && <span className="text-[12px] text-[#a3a3a3]">None yet</span>}
          {initiatives.map((app) => {
            const active = app === selectedApp;
            return (
              <button key={app} onClick={() => setSelectedApp(app)}
                className={'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ' +
                  (active ? 'bg-[#171717] text-white border-[#171717]' : 'bg-white text-[#525252] border-[#eaeaea] hover:border-[#d4d4d4]')}>
                {app}
              </button>
            );
          })}
        </div>
        <button onClick={() => { setNewName(''); setShowNew(true); }} className="btn-secondary text-[12px] flex-shrink-0">+ New application</button>
      </div>

      {stages.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">No applications yet — use “+ New application” to start one.</div>
      ) : (
       <>
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">Value stream — pick a lens</div>
      <div className="flex items-stretch overflow-x-auto pb-1 mb-5">
        {stages.map((s, i) => {
          const active = s.id === selectedId;
          const notchLeft = i > 0;
          const clip = notchLeft
            ? 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)'
            : 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)';
          return (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className={`relative flex-shrink-0 text-left pr-7 py-2.5 transition-colors duration-150 ${notchLeft ? 'pl-9 -ml-3' : 'pl-4'} ` +
                (active ? 'bg-[#171717] text-white' : 'bg-white text-[#525252] hover:bg-[#fafafa] border border-[#eaeaea]')}
              style={{ clipPath: clip, minWidth: 168, zIndex: stages.length - i }}>
              <div className="text-[10px] uppercase tracking-[0.08em] opacity-60">Stage {i + 1}</div>
              <div className={'text-[13px] leading-tight ' + (active ? 'font-semibold' : 'font-medium')}>{s.name}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-20"><div className="h-1 rounded-full bg-[#e5e5e5] overflow-hidden"><div className="h-full bg-[#10b981]" style={{ width: `${s.progress * 100}%` }} /></div></div>
                <span className={'text-[11px] tnum ' + (active ? 'text-white/80' : 'text-[#a3a3a3]')}>{pct(s.progress)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {detail && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-[12px]">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Belongs here <span className="tnum font-semibold text-[#171717]">{belongCount}</span></span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#be123c]" /> Move <span className="tnum font-semibold text-[#171717]">{detail.counts.Relocate}</span></span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#be123c]" /> Eliminate <span className="tnum font-semibold text-[#171717]">{detail.counts.Eliminate}</span></span>
          <span className="text-[#d4d4d4]">·</span>
          <span className="text-[#525252]">{detail.counts.findings} findings · {detail.name} {pct(detail.progress)} migrated</span>
        </div>
      )}

      <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] overflow-hidden" style={{ height: '64vh', minHeight: 460 }}>
        {!detail ? (
          <div className="h-full flex items-center justify-center text-sm text-[#a3a3a3]">Loading stage…</div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onNodeClick}
              fitView fitViewOptions={{ padding: 0.15 }}
              nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
              panOnDrag zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} minZoom={0.3} maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e5e5e5" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#666666] mt-3">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded border bg-[#ecfdf5] border-[#a7f3d0]" /> <span className="font-medium">Belongs here</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded border bg-[#fff1f2] border-[#fecdd3]" /> <span className="font-medium">Move / eliminate</span></span>
        <span className="inline-flex items-center gap-1.5 text-[#94a3b8]"><svg width="20" height="6"><path d="M1 3h13" stroke="#94a3b8" strokeWidth="1.5" /><path d="M20 3 L14 1 L14 5 Z" fill="#94a3b8" /></svg> normalize</span>
        <span className="inline-flex items-center gap-1.5 text-[#7c3aed]"><svg width="20" height="6"><path d="M1 3h13" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2" /><path d="M20 3 L14 1 L14 5 Z" fill="#7c3aed" /></svg> relocate to correct layer</span>
        <span className="inline-flex items-center gap-1.5 text-[#14b8a6]"><svg width="20" height="6"><path d="M1 3h13" stroke="#14b8a6" strokeWidth="1.5" /><path d="M20 3 L14 1 L14 5 Z" fill="#14b8a6" /></svg> → green-field service</span>
      </div>
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
    </div>
  );
}
