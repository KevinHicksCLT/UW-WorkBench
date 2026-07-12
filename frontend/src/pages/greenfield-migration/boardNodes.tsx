/**
 * React Flow node components + the node/edge type registries for the
 * workspace board. The data→board builder lives in buildBoard.ts; the
 * legacy-cell node in CellNode.tsx; the Normalize box in normalizeNodes.tsx;
 * edge components/factories in edges.tsx; geometry in cellGeometry.ts.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Layer } from '../../lib/rationalization';
import { GF_W, PANEL_W, HEADER_H } from './cellGeometry';
import { CellNode, sideHandles } from './CellNode';
import { NormalizeNode } from './normalizeNodes';
import { RelocateEdge } from './edges';

/** Greenfield target service — status chip, tech stack, inbound count (v3). */
function ServiceNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    status: string;
    tech: string | null;
    layers: Layer[];
    count: number;
  };
  const building = d.status.toLowerCase() === 'building' || d.status.toLowerCase() === 'live';
  return (
    <div
      className={`rounded-xl border-2 shadow-sm px-4 py-3 cursor-pointer ${
        building
          ? 'border-[#a7f3d0] bg-[#ecfdf5] hover:border-[#6ee7b7]'
          : 'border-[#d1fae5] bg-[#f4fdf9] hover:border-[#a7f3d0]'
      }`}
      style={{ width: GF_W }}
      title="Click for the granular detail of this greenfield target"
    >
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#0f766e]">
          {d.status}
        </div>
        <div className="text-[9.5px] text-[#0f766e] tnum">{d.count} in ›</div>
      </div>
      <div className="text-[12px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {d.tech && <div className="text-[9px] text-[#8f8f8f] mt-0.5 leading-snug">{d.tech}</div>}
    </div>
  );
}

// A shared application/service (WR-15) — MDM/RDM, auth, document services.
function SharedServiceNode({ data }: NodeProps) {
  const d = data as { name: string; tech: string | null; count: number };
  return (
    <div
      className="rounded-xl border-2 border-[#bae6fd] bg-[#f0f9ff] shadow-sm px-4 py-3 cursor-pointer hover:border-[#7dd3fc]"
      style={{ width: GF_W }}
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

// Option C (WR-03): each stage is a framed panel; the header lives INSIDE the
// panel band so it can never drift from its column. The panel itself is
// pointer-transparent scaffolding; the interactive header text is a separate
// locked node overlaid on the band. Lanes reuse it with a width override.
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

/**
 * Column header band: title + subtitle + the v3 roll-up line
 * (…43 correct · 17 move) + the legacy panel's source-switcher chips.
 */
function HeaderNode({ data }: NodeProps) {
  const d = data as {
    title: string;
    sub?: string | null;
    stats?: string | null;
    width?: number;
    appId?: string;
    sources?: { id: string; name: string }[];
    selectedId?: string;
    onSelect?: (appId: string) => void;
  };
  return (
    <div style={{ width: d.width ?? GF_W }} title={d.title}>
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[15px] font-bold text-[#171717] leading-tight truncate">
          {d.title}
        </span>
        {d.sources?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onSelect?.(s.id);
            }}
            className={`rounded px-1.5 py-px text-[10px] font-semibold border truncate max-w-[110px] ${
              s.id === d.selectedId
                ? 'bg-[#171717] text-white border-[#171717]'
                : 'bg-white text-[#525252] border-[#e5e5e5] hover:border-[#a3a3a3]'
            }`}
            title={`Show ${s.name}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {d.sub && (
        <div className="text-[9.5px] text-[#a3a3a3] leading-tight text-center truncate mt-0.5">
          {d.sub}
        </div>
      )}
      {d.stats && (
        <div className="text-[10.5px] text-[#68727a] tnum leading-tight text-center truncate mt-0.5">
          {d.stats}
        </div>
      )}
    </div>
  );
}

function LayerLabelNode({ data }: NodeProps) {
  const d = data as { layer: string; hint?: string | null };
  return (
    <div className="text-right leading-tight" style={{ width: 150 }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#68727a]">
        {d.layer}
      </div>
      {d.hint && <div className="text-[10px] text-[#a3a3a3] mt-0.5">{d.hint}</div>}
    </div>
  );
}

// ── Dead-code lane (v3) ─────────────────────────────────────────────────────

export type DeadItem = { id: string; name: string; appName: string; retired: boolean };

/**
 * Full-width red band — the wireframe's single-line dead-code lane:
 * `Dead code 7 · across both apps — unreachable / superseded, retire with
 * sign-off`. The item names ride in the band's tooltip; retirement runs from
 * the drill-down (the first unretired item keeps a compact Retire affordance).
 */
function DeadLaneNode({ data }: NodeProps) {
  const d = data as {
    items: DeadItem[];
    width: number;
    appCount: number;
    onRetire?: (findingId: string) => void;
  };
  const open = d.items.filter((it) => !it.retired);
  return (
    <div
      className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 flex items-center gap-2"
      style={{ width: d.width }}
      title={d.items.map((it) => `${it.name} — ${it.appName}`).join('\n')}
    >
      <Handle id="l" type="target" position={Position.Left} className="board-handle" />
      <span className="text-[11px] font-bold text-[#be123c] flex-shrink-0">
        Dead code <span className="tnum">{d.items.length}</span>
      </span>
      <span className="text-[10px] text-[#8f8f8f] truncate">
        across {d.appCount === 1 ? 'one source' : `${d.appCount === 2 ? 'both' : d.appCount} apps`}{' '}
        — unreachable / superseded, retire with sign-off
      </span>
      <span className="flex-1" />
      {open.length > 0 && d.onRetire && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            d.onRetire?.(open[0].id);
          }}
          className="flex-shrink-0 rounded border border-[#fecdd3] bg-white px-1.5 py-px text-[9px] font-semibold text-[#be123c] hover:shadow-sm"
          title={`Retire "${open[0].name}"`}
        >
          Retire next ({open.length})
        </button>
      )}
    </div>
  );
}

/** The wireframe's panel-footer legend line under the legacy column. */
function NoteNode({ data }: NodeProps) {
  const d = data as { width: number };
  return (
    <div className="text-[8.5px] leading-snug text-[#8f8f8f]" style={{ width: d.width }}>
      <span className="font-semibold text-[#047857]">Green line</span> = in the right layer.{' '}
      <span className="font-semibold text-[#be123c]">Red line</span> = misplaced, shows where it
      goes. Every section collapses with its counts.
    </div>
  );
}

export const nodeTypes = {
  panel: PanelNode,
  cell: CellNode,
  capdan: NormalizeNode,
  service: ServiceNode,
  shared: SharedServiceNode,
  header: HeaderNode,
  layerLabel: LayerLabelNode,
  deadLane: DeadLaneNode,
  note: NoteNode,
};
export const edgeTypes = { relocate: RelocateEdge };
