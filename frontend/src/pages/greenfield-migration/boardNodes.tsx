/**
 * React Flow node/edge components and the data-derived board builder for the
 * Application Rationalization (green-field migration) board. Extracted
 * verbatim from GreenfieldMigration.tsx — layout constants, custom nodes,
 * the relocation edge, and buildBoardBase (data → nodes/edges).
 */
import { MarkerType, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, type Node, type Edge, type NodeProps, type EdgeProps } from '@xyflow/react';
import {
  LAYERS, categoryTags,
  type StageDetail, type Layer, type Capdan, type CategoryTag,
} from '../../lib/rationalization';

export const belongsHere = (c: Capdan) => c === 'Common' || c === 'Different';
export type DrillFn = (appId: string, layer: Layer, category: string) => void;

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
    <div className="rounded-lg border-2 border-[#e7d3b5] bg-[#fdf8f0] shadow-sm px-3 py-2.5" style={{ width: 250 }}>
      {sideHandles}
      <div className="flex flex-wrap gap-1.5">
        {d.tags.length === 0 ? <span className="text-[13px] text-[#cfcfcf]">—</span> : d.tags.map((t) => {
          const ok = belongsHere(t.capdan);
          const cls = ok ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]' : 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]';
          return (
            <button key={`${t.category}-${t.capdan}`} onClick={(e) => { e.stopPropagation(); d.onDrill(d.appId, d.layer, t.category); }}
              className={`inline-flex items-center gap-1 rounded-md border pl-2 pr-1 py-0.5 text-[13px] font-medium hover:shadow-sm ${cls}`}
              title={`${t.count} ${t.category} · ${ok ? 'belongs here' : t.capdan === 'Relocate' ? `move to ${t.targetLayer}` : 'eliminate'} — click for detail`}>
              <span className="truncate max-w-[150px]">{t.category}</span>
              {t.capdan === 'Relocate' && t.targetLayer && <span className="opacity-80">→ {t.targetLayer}</span>}
              <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] rounded-full bg-white/70 text-[12px] font-semibold px-0.5">{t.count}</span>
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
    <div className="rounded-lg border-2 border-[#c7d2fe] bg-[#f5f7ff] shadow-sm px-3 py-2.5 cursor-pointer hover:border-[#a5b4fc]" style={{ width: 240 }} title="Click for the normalized findings">
      {sideHandles}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[17px] font-bold text-[#171717] leading-tight">{d.name}</div>
        <div className="text-[12px] text-[#a3a3a3] tnum flex-shrink-0 mt-0.5">{d.count} ›</div>
      </div>
      {d.destination && <div className="text-[13px] text-[#0f766e] mt-1">→ {d.destination}</div>}
    </div>
  );
}

function ServiceNode({ data }: NodeProps) {
  const d = data as { name: string; status: string; tech: string | null; layers: Layer[]; count: number };
  return (
    <div className="rounded-xl border-2 border-[#a7f3d0] bg-[#ecfdf5] shadow-sm px-3 py-2.5 cursor-pointer hover:border-[#6ee7b7]" style={{ width: 260 }} title="Click for the granular detail of this green-field service">
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">{d.status}</div>
        <div className="text-[12px] text-[#0f766e] tnum">{d.count} ›</div>
      </div>
      <div className="text-[18px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {/* IT layers this service owns — only worth showing when it spans more than
          the row it sits on (a single layer is already given by row alignment) */}
      {d.layers.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {d.layers.map((l) => (
            <span key={l} className="inline-flex items-center rounded border border-[#99f6e4] bg-white/70 px-1.5 py-0.5 text-[12px] font-medium text-[#0f766e]">{l}</span>
          ))}
        </div>
      )}
      {d.tech && <div className="text-[12px] text-[#a3a3a3] mt-1.5 leading-snug">{d.tech}</div>}
    </div>
  );
}

function HeaderNode({ data }: NodeProps) {
  const d = data as { title: string; appId?: string };
  return (
    <div className="text-[19px] font-bold text-[#171717] leading-tight truncate" style={{ maxWidth: 270 }}>
      {d.title}
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

// Smooth bezier relocation arrow. The curve lives entirely in the lane between
// the brown-field and CAPDAN columns; the label is pinned to the empty
// horizontal gap just before the target row (the path midpoint can land on a
// box, the row gap never does).
function RelocateEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.4 });
  const dir = targetY >= sourceY ? 1 : -1;
  const lx = (sourceX + targetX) / 2;
  const ly = targetY - dir * (ROW_H * 0.52);
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, pointerEvents: 'none' }}
          className="rounded bg-[#f5f3ff] px-1 text-[12px] font-semibold text-[#7c3aed] whitespace-nowrap"
        >
          {(data as { label?: string })?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const nodeTypes = { cell: CellNode, capdan: CapdanNode, service: ServiceNode, header: HeaderNode, layerLabel: LayerLabelNode };
export const edgeTypes = { relocate: RelocateEdge };

export const X = { label: -130, app0: 0, app1: 280, capdan: 600, service: 910 };
export const ROW_H = 155;

// The data-derived board (before any user overlay). Headers and layer labels
// are scaffolding — always locked; the cell / CAPDAN / service boxes follow
// the global `nodesDraggable` flag so they can be dragged in edit mode.
export function buildBoardBase(detail: StageDetail | null, onDrill: DrillFn): { nodes: Node[]; edges: Edge[] } {
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

  // Headers — one top row: the legacy app names (no "Brown-field" section
  // label) followed by the CAPDAN and Green-field labels; all the same style.
  nodes.push({ id: 'hdr:cap', type: 'header', position: { x: X.capdan, y: -54 }, data: { title: 'CAPDAN — Normalize' }, ...lock });
  nodes.push({ id: 'hdr:svc', type: 'header', position: { x: X.service, y: -54 }, data: { title: 'Green-field' }, ...lock });
  const headApps = detail.apps.slice(0, 2);
  headApps.forEach((a, i) => {
    nodes.push({ id: `hdr:${a.id}`, type: 'header', position: { x: appX[i], y: -54 }, data: { title: a.name, appId: a.id }, ...lock });
  });

  LAYERS.forEach((layer, li) => {
    const y = li * ROW_H;
    nodes.push({ id: `lbl:${layer}`, type: 'layerLabel', position: { x: X.label, y: y + 18 }, data: { layer }, ...lock });

    // Edges flow strictly left → right so nothing crosses a box: app0 chains
    // into app1, and only the LAST app column connects across to CAPDAN
    // (kept + relocate findings of both apps are unioned onto that edge).
    const two = detail.apps.slice(0, 2);
    const tagsByApp = two.map((a) => categoryTags(detail.findings, layer, a.id));
    two.forEach((a, i) => {
      nodes.push({ id: `cell:${a.id}:${layer}`, type: 'cell', position: { x: appX[i], y }, data: { layer, appId: a.id, tags: tagsByApp[i], onDrill }, selectable: false });
    });
    if (two.length === 2 && tagsByApp[0].length > 0) {
      edges.push({ id: `f-${layer}`, source: `cell:${two[0].id}:${layer}`, target: `cell:${two[1].id}:${layer}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', style: { stroke: '#cbd5e1', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 } });
    }
    const lastCell = two.length ? `cell:${two[two.length - 1].id}:${layer}` : null;
    if (lastCell && tagsByApp.some((tags) => tags.some((t) => belongsHere(t.capdan)))) {
      edges.push({ id: `c-${layer}`, source: lastCell, target: `cap:${layer}`, sourceHandle: 'r', targetHandle: 'l', type: 'default', style: { stroke: '#cbd5e1', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 } });
    }
    // Relocations leave this layer for another — drawn as right-angle paths
    // that travel down the empty lane between the columns (never through boxes).
    const relocateTargets = [...new Set(tagsByApp.flat().filter((t) => t.capdan === 'Relocate' && t.targetLayer).map((t) => t.targetLayer as Layer))];
    for (const target of relocateTargets) {
      if (!lastCell) continue;
      edges.push({ id: `r-${layer}-${target}`, source: lastCell, target: `cap:${target}`, sourceHandle: 'r', targetHandle: 'l', type: 'relocate', data: { label: `→ ${target}` }, animated: true, style: { stroke: '#7c3aed', strokeWidth: 1.75, strokeDasharray: '5 3' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed', width: 16, height: 16 } });
    }

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
}
