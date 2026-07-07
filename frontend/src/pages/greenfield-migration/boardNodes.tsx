/**
 * React Flow node/edge components and the data-derived board builder for the
 * Application Rationalization (green-field migration) board. Layout constants
 * and the cell height estimator live in cellGeometry.ts; the legacy-cell node
 * (with WR-10 in-box expansion) lives in CellNode.tsx.
 */
import {
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import {
  LAYERS,
  categoryTags,
  type AnatomyCategory,
  type FindingView,
  type StageDetail,
  type Layer,
} from '../../lib/rationalization';
import {
  BOX_W,
  PANEL_PAD,
  PANEL_W,
  PANEL_GAP,
  HEADER_H,
  LANE_GAP,
  LANE_H,
  ROW_H,
  X,
  belongsHere,
  estimateCellHeight,
  panelX,
  slotHeightFor,
  slotOffsets,
} from './cellGeometry';
import { CellNode, sideHandles, type CellScreen, type ToggleCategoryFn } from './CellNode';

export { belongsHere, BOX_W, PANEL_PAD, PANEL_W, PANEL_GAP, HEADER_H, panelX };
export type { ToggleCategoryFn };

// ── Custom React Flow nodes ─────────────────────────────────────────────────

function CapdanNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    destination: string | null;
    targetTech: string | null;
    count: number;
  };
  return (
    <div
      className="rounded-lg border-2 border-[#c7d2fe] bg-[#f5f7ff] shadow-sm px-4 py-3 cursor-pointer hover:border-[#a5b4fc]"
      style={{ width: BOX_W }}
      title="Click for the normalized findings"
    >
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
  const d = data as {
    name: string;
    status: string;
    tech: string | null;
    layers: Layer[];
    count: number;
  };
  return (
    <div
      className="rounded-xl border-2 border-[#a7f3d0] bg-[#ecfdf5] shadow-sm px-4 py-3 cursor-pointer hover:border-[#6ee7b7]"
      style={{ width: BOX_W }}
      title="Click for the granular detail of this greenfield service"
    >
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">
          {d.status}
        </div>
        <div className="text-[12px] text-[#0f766e] tnum">{d.count} ›</div>
      </div>
      <div className="text-[18px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {/* IT layers this service owns — only worth showing when it spans more than
          the row it sits on (a single layer is already given by row alignment) */}
      {d.layers.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {d.layers.map((l) => (
            <span
              key={l}
              className="inline-flex items-center rounded border border-[#99f6e4] bg-white/70 px-1.5 py-0.5 text-[12px] font-medium text-[#0f766e]"
            >
              {l}
            </span>
          ))}
        </div>
      )}
      {d.tech && <div className="text-[12px] text-[#a3a3a3] mt-1.5 leading-snug">{d.tech}</div>}
    </div>
  );
}

// A shared application/service (WR-15) — MDM/RDM, auth, document services.
// Lives in its own lane below the layer grid; Relocate findings whose local
// implementation a call to it replaces point at it.
function SharedServiceNode({ data }: NodeProps) {
  const d = data as { name: string; tech: string | null; count: number };
  return (
    <div
      className="rounded-xl border-2 border-[#bae6fd] bg-[#f0f9ff] shadow-sm px-4 py-3 cursor-pointer hover:border-[#7dd3fc]"
      style={{ width: BOX_W }}
      title="Click for the findings this shared service absorbs"
    >
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0369a1]">
          Shared service
        </div>
        <div className="text-[12px] text-[#0369a1] tnum">{d.count} ›</div>
      </div>
      <div className="text-[18px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {d.tech && <div className="text-[12px] text-[#a3a3a3] mt-1.5 leading-snug">{d.tech}</div>}
    </div>
  );
}

// Option C (WR-03): each stage — every legacy app, Normalize, Greenfield — is
// a framed panel; the header lives INSIDE the panel band so it can never
// drift from its column. The panel itself is pointer-transparent scaffolding
// (pan/zoom passes through); the interactive header text is a separate locked
// node overlaid on the band, keeping double-click-to-edit-app behavior.
// The shared-services lane (WR-15) reuses it with a width override.
function PanelNode({ data }: NodeProps) {
  const d = data as { height: number; width?: number };
  return (
    <div
      className="rounded-xl border border-[#e3e6e8] bg-[#f7f8f9]"
      style={{ width: d.width ?? PANEL_W, height: d.height }}
    >
      <div
        className="bg-white border-b border-[#e3e6e8] rounded-t-xl"
        style={{ height: HEADER_H }}
      />
    </div>
  );
}

function HeaderNode({ data }: NodeProps) {
  const d = data as { title: string; appId?: string };
  return (
    <div
      className="text-[15px] font-bold text-[#171717] leading-tight truncate text-center"
      style={{ width: BOX_W }}
      title={d.title}
    >
      {d.title}
    </div>
  );
}

function LayerLabelNode({ data }: NodeProps) {
  const d = data as { layer: string };
  return (
    <div
      className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#68727a] text-right leading-tight"
      style={{ width: 140 }}
    >
      {d.layer}
    </div>
  );
}

// Smooth bezier relocation arrow. The curve lives entirely in the lane between
// the brown-field and CAPDAN columns; the label is pinned to the empty
// horizontal gap just before the target row (the path midpoint can land on a
// box, the row gap never does).
function RelocateEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.4,
  });
  const dir = targetY >= sourceY ? 1 : -1;
  const lx = (sourceX + targetX) / 2;
  const ly = targetY - dir * (ROW_H * 0.52);
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
            pointerEvents: 'none',
          }}
          className="rounded bg-[#f5f3ff] px-1 text-[12px] font-semibold text-[#7c3aed] whitespace-nowrap"
        >
          {(data as { label?: string })?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const nodeTypes = {
  panel: PanelNode,
  cell: CellNode,
  capdan: CapdanNode,
  service: ServiceNode,
  shared: SharedServiceNode,
  header: HeaderNode,
  layerLabel: LayerLabelNode,
};
export const edgeTypes = { relocate: RelocateEdge };

// ── Data → board ────────────────────────────────────────────────────────────

/** Inputs that shape the derived board beyond the stage detail itself. */
export type BoardBuildOptions = {
  /** WR-06 anatomy lens — which findings feed the legacy cells. */
  view: FindingView;
  /** WR-10 in-box expansion state: `cell:<appId>:<layer>` → expanded categories. */
  expanded: Record<string, string[]>;
  onToggleCategory: ToggleCategoryFn;
  /** Anatomy-catalog rows for category chip tooltips (optional — degrades). */
  catalog?: AnatomyCategory[];
};

// The data-derived board (before any user overlay). Panels, headers and layer
// labels are scaffolding — always locked; the cell / CAPDAN / service boxes
// follow the global `nodesDraggable` flag so they can be dragged in edit mode.
export function buildBoardBase(
  detail: StageDetail | null,
  opts: BoardBuildOptions,
): { nodes: Node[]; edges: Edge[] } {
  if (!detail) return { nodes: [] as Node[], edges: [] as Edge[] };
  const { view, expanded, onToggleCategory, catalog } = opts;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const layerIndex = Object.fromEntries(LAYERS.map((l, i) => [l, i])) as Record<Layer, number>;
  const lock = { draggable: false, selectable: false } as const;

  // Shared services (WR-15) live in their own lane, not the legacy columns.
  const legacyApps = detail.apps.filter((a) => a.kind !== 'SHARED_SERVICE');
  const sharedApps = detail.apps.filter((a) => a.kind === 'SHARED_SERVICE');

  // layers owned by each green-field service + kept-finding counts.
  // Normalize/Greenfield counts stay based on ALL findings (view-independent).
  const layersByService = new Map<string, Layer[]>();
  for (const c of detail.components)
    if (c.microserviceId) {
      const arr = layersByService.get(c.microserviceId) ?? [];
      arr.push(c.layer);
      layersByService.set(c.microserviceId, arr);
    }
  const keptCountByLayer = (layer: Layer) =>
    detail.findings.filter((f) => f.layer === layer && belongsHere(f.capdan)).length;

  // Screen lookup + per-layer catalog tooltips for the cell nodes.
  const screenByName: Record<string, CellScreen> = {};
  for (const s of detail.screens) screenByName[s.name] = { url: s.url, kind: s.kind };
  const tipsByLayer: Record<string, Record<string, string>> = {};
  for (const row of catalog ?? []) {
    const forLayer = (tipsByLayer[row.layer] ??= {});
    if (row.description && !forLayer[row.name]) forLayer[row.name] = row.description;
  }
  const sharedNameById = Object.fromEntries(sharedApps.map((s) => [s.id, s.name]));

  // Variable slot heights (WR-10): tags per layer × app are view-filtered, the
  // estimator turns tags + expansion into a deterministic per-cell height, and
  // each layer's slot grows to fit its tallest box so rows stay aligned
  // across panels.
  const two = legacyApps.slice(0, 2);
  const expandedFor = (appId: string, layer: Layer) => expanded[`cell:${appId}:${layer}`] ?? [];
  const tagsByLayerApp = LAYERS.map((layer) =>
    two.map((a) => categoryTags(detail.findings, layer, a.id, view)),
  );
  const slotHeights = LAYERS.map((layer, li) =>
    slotHeightFor(
      two.map((a, i) => estimateCellHeight(tagsByLayerApp[li][i], expandedFor(a.id, layer))),
    ),
  );
  const offsets = slotOffsets(slotHeights);
  const slotY = (li: number) => offsets[li] + PANEL_PAD;
  const boardHeight = slotHeights.reduce((s, h) => s + h, 0);

  // Panels — one framed column per stage (each legacy app, Normalize,
  // Greenfield); header text is a separate node ON the band so the panel can
  // stay pointer-transparent (pan/zoom passes through, dblclick-app works).
  const headApps = two;
  const appXs = headApps.map((_, i) => panelX(i));
  const capX = panelX(headApps.length);
  const svcX = panelX(headApps.length + 1);
  const panelHeight = HEADER_H + boardHeight + PANEL_PAD;
  const columns: { key: string; x: number; title: string; appId?: string }[] = [
    ...headApps.map((a, i) => ({ key: `app${i}`, x: appXs[i], title: a.name, appId: a.id })),
    { key: 'cap', x: capX, title: 'Normalize' },
    { key: 'svc', x: svcX, title: 'Greenfield' },
  ];
  for (const col of columns) {
    nodes.push({
      id: `panel:${col.key}`,
      type: 'panel',
      position: { x: col.x, y: -HEADER_H },
      data: { height: panelHeight },
      zIndex: -10,
      focusable: false,
      style: { pointerEvents: 'none' },
      ...lock,
    });
    nodes.push({
      id: col.appId ? `hdr:${col.appId}` : `hdr:${col.key}`,
      type: 'header',
      position: { x: col.x + PANEL_PAD, y: -HEADER_H + 14 },
      data: { title: col.title, ...(col.appId ? { appId: col.appId } : {}) },
      ...lock,
    });
  }

  LAYERS.forEach((layer, li) => {
    nodes.push({
      id: `lbl:${layer}`,
      type: 'layerLabel',
      position: { x: X.label, y: offsets[li] + slotHeights[li] / 2 - 8 },
      data: { layer },
      ...lock,
    });

    // Edges flow strictly left → right so nothing crosses a box: app0 chains
    // into app1, and only the LAST app column connects across to CAPDAN
    // (kept + relocate findings of both apps are unioned onto that edge).
    const tagsByApp = tagsByLayerApp[li];
    two.forEach((a, i) => {
      nodes.push({
        id: `cell:${a.id}:${layer}`,
        type: 'cell',
        position: { x: appXs[i] + PANEL_PAD, y: slotY(li) },
        data: {
          layer,
          appId: a.id,
          tags: tagsByApp[i],
          expanded: expandedFor(a.id, layer),
          onToggle: onToggleCategory,
          screens: screenByName,
          tips: tipsByLayer[layer] ?? {},
          sharedNames: sharedNameById,
        },
        selectable: false,
      });
    });
    if (two.length === 2 && tagsByApp[0].length > 0) {
      edges.push({
        id: `f-${layer}`,
        source: `cell:${two[0].id}:${layer}`,
        target: `cell:${two[1].id}:${layer}`,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'default',
        style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
      });
    }
    const lastCell = two.length ? `cell:${two[two.length - 1].id}:${layer}` : null;
    if (lastCell && tagsByApp.some((tags) => tags.some((t) => belongsHere(t.capdan)))) {
      edges.push({
        id: `c-${layer}`,
        source: lastCell,
        target: `cap:${layer}`,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'default',
        style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
      });
    }
    // Relocations leave this layer for another — drawn as right-angle paths
    // that travel down the empty lane between the columns (never through boxes).
    const relocateTargets = [
      ...new Set(
        tagsByApp
          .flat()
          .filter((t) => t.capdan === 'Relocate' && t.targetLayer)
          .map((t) => t.targetLayer as Layer),
      ),
    ];
    for (const target of relocateTargets) {
      if (!lastCell) continue;
      edges.push({
        id: `r-${layer}-${target}`,
        source: lastCell,
        target: `cap:${target}`,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'relocate',
        data: { label: `→ ${target}` },
        animated: true,
        style: { stroke: '#7c3aed', strokeWidth: 1.75, strokeDasharray: '5 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed', width: 16, height: 16 },
      });
    }

    const comp = detail.components.find((c) => c.layer === layer);
    if (comp) {
      nodes.push({
        id: `cap:${layer}`,
        type: 'capdan',
        position: { x: capX + PANEL_PAD, y: slotY(li) },
        data: {
          name: comp.name,
          destination: comp.destination,
          targetTech: comp.targetTech,
          count: keptCountByLayer(layer),
          componentId: comp.id,
        },
      });
    }
  });

  // Greenfield services — slotted onto the shared baseline grid at the slot
  // nearest the centre of the layers they own (multi-layer ownership shows as
  // chips on the box, per the Option C trade-off). Collisions advance to the
  // nearest free slot; overflow stacks within the slot.
  const usedSlots = new Map<number, number>();
  const pickSlot = (want: number) => {
    const clamp = Math.min(Math.max(want, 0), LAYERS.length - 1);
    if (!usedSlots.has(clamp)) return clamp;
    for (let d = 1; d < LAYERS.length; d++) {
      if (clamp + d < LAYERS.length && !usedSlots.has(clamp + d)) return clamp + d;
      if (clamp - d >= 0 && !usedSlots.has(clamp - d)) return clamp - d;
    }
    return clamp;
  };
  detail.microservices.forEach((m) => {
    const owned = (layersByService.get(m.id) ?? [])
      .slice()
      .sort((a, b) => layerIndex[a] - layerIndex[b]);
    const idxs = owned.length ? owned.map((l) => layerIndex[l]) : [Math.floor(LAYERS.length / 2)];
    const slot = pickSlot(Math.round(idxs.reduce((s, v) => s + v, 0) / idxs.length));
    const stack = usedSlots.get(slot) ?? 0;
    usedSlots.set(slot, stack + 1);
    const count = owned.reduce((s, l) => s + keptCountByLayer(l), 0);
    nodes.push({
      id: `svc:${m.id}`,
      type: 'service',
      position: { x: svcX + PANEL_PAD, y: slotY(slot) + stack * 92 },
      data: { name: m.name, status: m.status, tech: m.techStack, layers: owned, count },
    });
  });
  for (const comp of detail.components) {
    if (!comp.microserviceId) continue;
    edges.push({
      id: `d-${comp.layer}`,
      source: `cap:${comp.layer}`,
      target: `svc:${comp.microserviceId}`,
      sourceHandle: 'r',
      targetHandle: 'l',
      type: 'default',
      style: { stroke: '#5eead4', strokeWidth: 1.75 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#14b8a6', width: 15, height: 15 },
    });
  }

  // Shared-services lane (WR-15) — shared applications (MDM/RDM, auth,
  // document services) render in a full-width band below the layer grid;
  // Relocate findings that a call to one of them replaces point at its box.
  if (sharedApps.length > 0) {
    const laneTop = boardHeight + PANEL_PAD + LANE_GAP;
    const columnsW = panelX(headApps.length + 1) + PANEL_W; // span all stage columns
    const boxesW = PANEL_PAD * 2 + sharedApps.length * BOX_W + (sharedApps.length - 1) * PANEL_GAP;
    nodes.push({
      id: 'panel:sharedLane',
      type: 'panel',
      position: { x: 0, y: laneTop },
      data: { height: LANE_H, width: Math.max(columnsW, boxesW) },
      zIndex: -10,
      focusable: false,
      style: { pointerEvents: 'none' },
      ...lock,
    });
    nodes.push({
      id: 'hdr:sharedLane',
      type: 'header',
      position: { x: PANEL_PAD, y: laneTop + 14 },
      data: { title: 'Shared services' },
      ...lock,
    });
    const countByService = new Map<string, number>();
    for (const f of detail.findings)
      if (f.sharedServiceId)
        countByService.set(f.sharedServiceId, (countByService.get(f.sharedServiceId) ?? 0) + 1);
    sharedApps.forEach((s, i) => {
      nodes.push({
        id: `shared:${s.id}`,
        type: 'shared',
        position: { x: PANEL_PAD + i * (BOX_W + PANEL_GAP), y: laneTop + HEADER_H + PANEL_PAD },
        data: { name: s.name, tech: s.techStack, count: countByService.get(s.id) ?? 0 },
      });
    });
    // One arrow per (cell → shared service) pair with relocating findings.
    const pairs = new Set<string>();
    for (const f of detail.findings) {
      if (!f.sharedServiceId || !two.some((a) => a.id === f.appId)) continue;
      const key = `${f.appId}:${f.layer}:${f.sharedServiceId}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      const svcName = sharedApps.find((s) => s.id === f.sharedServiceId)?.name;
      edges.push({
        id: `sh-${key}`,
        source: `cell:${f.appId}:${f.layer}`,
        target: `shared:${f.sharedServiceId}`,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'relocate',
        data: { label: `→ ${svcName ?? 'shared service'}` },
        animated: true,
        style: { stroke: '#0284c7', strokeWidth: 1.75, strokeDasharray: '5 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0284c7', width: 16, height: 16 },
      });
    }
  }

  return { nodes, edges };
}
