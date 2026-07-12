/**
 * React Flow node components + the node/edge type registries for the
 * workspace board. The data→board builder lives in buildBoard.ts; the
 * legacy-cell node in CellNode.tsx; the Normalize box in normalizeNodes.tsx;
 * edge components/factories in edges.tsx; geometry in cellGeometry.ts.
 */
import type { NodeProps } from '@xyflow/react';
import type { Layer } from '../../lib/rationalization';
import { BOX_W, PANEL_W, HEADER_H } from './cellGeometry';
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
  return (
    <div
      className="rounded-xl border-2 border-[#a7f3d0] bg-[#ecfdf5] shadow-sm px-4 py-3 cursor-pointer hover:border-[#6ee7b7]"
      style={{ width: BOX_W }}
      title="Click for the granular detail of this greenfield target"
    >
      {sideHandles}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">
          {d.status}
        </div>
        <div className="text-[12px] text-[#0f766e] tnum">{d.count} in ›</div>
      </div>
      <div className="text-[18px] font-bold text-[#171717] leading-tight mt-0.5">{d.name}</div>
      {/* Rows this target owns — only worth showing when it spans more than
          the row it sits on (a single row is already given by alignment) */}
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

/** Column header band: title + the v3 roll-up line (…43 correct · 17 move). */
function HeaderNode({ data }: NodeProps) {
  const d = data as { title: string; stats?: string | null; appId?: string };
  return (
    <div style={{ width: BOX_W }} title={d.title}>
      <div className="text-[15px] font-bold text-[#171717] leading-tight truncate text-center">
        {d.title}
      </div>
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
 * Full-width red band listing `deadCode` findings across all sources —
 * unreachable / superseded code retired with sign-off (the retire button
 * confirms through useDialogs in the shell).
 */
function DeadLaneNode({ data }: NodeProps) {
  const d = data as {
    items: DeadItem[];
    width: number;
    appCount: number;
    onRetire?: (findingId: string) => void;
  };
  return (
    <div
      className="rounded-xl border-2 border-dashed border-[#fecdd3] bg-[#fff7f7] px-4 py-3"
      style={{ width: d.width }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-[#be123c]">Dead code · {d.items.length}</span>
        <span className="text-[11px] text-[#a3a3a3]">
          across {d.appCount === 1 ? 'one source' : `${d.appCount} sources`} — unreachable /
          superseded, retire with sign-off
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {d.items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-2 rounded-md border border-[#fecdd3] bg-white/70 px-2 py-1"
          >
            <span aria-hidden="true" className="text-[12px] font-bold text-[#e11d48] flex-shrink-0">
              ✗
            </span>
            <span
              className="text-[12px] font-medium text-[#171717] truncate flex-1 min-w-0"
              title={it.name}
            >
              {it.name}
            </span>
            <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 truncate max-w-[180px]">
              {it.appName}
            </span>
            {it.retired ? (
              <span className="inline-flex items-center rounded border border-[#e2e8f0] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569] flex-shrink-0">
                Retired
              </span>
            ) : (
              d.onRetire && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    d.onRetire?.(it.id);
                  }}
                  className="rounded border border-[#fecdd3] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#be123c] hover:shadow-sm flex-shrink-0"
                >
                  Retire
                </button>
              )
            )}
          </div>
        ))}
      </div>
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
};
export const edgeTypes = { relocate: RelocateEdge };
