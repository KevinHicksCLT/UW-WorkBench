/**
 * Legacy-panel section node for the workspace board (v3 wireframe): one box
 * per layer row showing the section header (colored dot + "<layer> layer" +
 * descriptor + count + stay/move roll-up) and one compact row per finding —
 * ✓ "correct here" or ✗ with a relocation badge — with an inline
 * WHY-THIS-MOVES panel for misplaced items and a "+ N more…" fold.
 *
 * Any change to the rendered row structure must be mirrored in the height
 * ceilings in cellGeometry.ts (estimateCellHeight) or rows can overlap.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type {
  CategoryTag,
  ClassificationMeta,
  Finding,
  Layer,
  LayerMeta,
  WhyThisMoves,
} from '../../lib/rationalization';
import { BOX_W, EXPAND_ALL, VISIBLE_ROWS, whyToken } from './cellGeometry';

// Handles are hidden in read mode and revealed via the `.board-editing` CSS
// class on the canvas when editing; connectability follows the global
// `nodesConnectable` flag, so no per-handle override is needed.
export const sideHandles = (
  <>
    <Handle id="l" type="target" position={Position.Left} className="board-handle" />
    <Handle id="r" type="source" position={Position.Right} className="board-handle" />
  </>
);

export type ToggleCategoryFn = (appId: string, layer: Layer, token: string) => void;
export type CellScreen = { url: string | null; kind: string };
export type CellAnatomyRow = { name: string; description: string };
export type CellNodeData = {
  layer: Layer;
  appId: string;
  tags: CategoryTag[];
  /** Expansion tokens active in this cell (EXPAND_ALL / why:<findingId>). */
  expanded: string[];
  onToggle: ToggleCategoryFn;
  /** detail.screens by name — resolves a finding's screenRef to a link. */
  screens: Record<string, CellScreen>;
  /** Anatomy-catalog descriptions for this layer, by category name. */
  tips: Record<string, string>;
  /** Shared-service names by app id — labels shared-service relocations (WR-15). */
  sharedNames: Record<string, string>;
  /** Classification vocabulary — chip colors + stay/move (3-A). */
  classification: ClassificationMeta;
  /** Section-header meta from the LAYER vocabulary row (descriptor + dot). */
  layerMeta: LayerMeta | null;
  /** Matched anatomy sub-categories per tag key (`category␟capdan`) — 3-D. */
  anatomyByTag: Record<string, CellAnatomyRow[]>;
  /** Ribbon selection (v3 top bar) — a row click reports its finding. */
  onSelectFinding?: (finding: Finding) => void;
  /** Findings UI (PM-07): edit an expanded finding / add one to this cell. */
  onEditFinding?: (findingId: string) => void;
  onAddFinding?: (appId: string, layer: Layer) => void;
};

export const tagKey = (t: Pick<CategoryTag, 'category' | 'capdan'>) => `${t.category}␟${t.capdan}`;

/** Where a misplaced finding lands, for the red relocation badge. */
function moveDestination(f: Finding, sharedNames: Record<string, string>): string {
  if (f.deadCode) return 'Dead code';
  if (f.sharedServiceId) return sharedNames[f.sharedServiceId] ?? 'a shared service';
  return f.recommendedLayer ?? f.targetLayer ?? 'another layer';
}

function WhyThisMovesPanel({ why }: { why: WhyThisMoves }) {
  const rows: [string, string | undefined][] = [
    ['Captured', why.captured],
    ['Sent', why.sent],
    ['Processed', why.processed],
    ['Validation', why.validated],
  ];
  return (
    <div className="mt-1 mb-1 rounded-md border border-[#fecdd3] border-l-2 border-l-[#e11d48] bg-[#fff7f7] px-2.5 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#be123c]">
        Why this moves — what happens on this screen
      </div>
      <div className="mt-1 space-y-0.5">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px] leading-snug">
              <span className="w-[64px] flex-shrink-0 text-[#a3a3a3] font-medium">{k}</span>
              <span className="text-[#525252]">{v}</span>
            </div>
          ))}
        {why.lands && (
          <div className="flex gap-2 text-[11px] leading-snug">
            <span className="w-[64px] flex-shrink-0 text-[#a3a3a3] font-medium">Lands in</span>
            <span className="font-semibold text-[#0f766e]">{why.lands}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One compact finding row: ✓/✗ + category tag + name + stay/move caption. */
function ItemRow({ f, tag, d }: { f: Finding; tag: CategoryTag; d: CellNodeData }) {
  const whyOpen = d.expanded.includes(whyToken(f.id));
  const canExpand = !tag.stays && Boolean(f.whyThisMoves);
  const technical = [f.codeRef, f.rationale, f.migrationApproach]
    .filter((v): v is string => Boolean(v))
    .join('  ·  ');
  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          d.onSelectFinding?.(f);
          if (canExpand) d.onToggle(d.appId, d.layer, whyToken(f.id));
        }}
        className={`w-full flex items-center gap-1.5 rounded-md border px-2 py-1 text-left ${
          tag.stays
            ? 'border-transparent hover:border-[#e5e5e5] bg-transparent'
            : whyOpen
              ? 'border-[#fecdd3] bg-[#fff1f2]'
              : 'border-transparent hover:border-[#fecdd3] bg-transparent'
        }`}
        title={technical ? `Technical: ${technical}` : f.name}
      >
        <span
          aria-hidden="true"
          className={`text-[12px] font-bold leading-none flex-shrink-0 ${
            tag.stays ? 'text-[#10b981]' : 'text-[#e11d48]'
          }`}
        >
          {tag.stays ? '✓' : '✗'}
        </span>
        <span
          className="flex-shrink-0 max-w-[92px] truncate rounded border border-[#dbe4f0] bg-[#f0f6ff] px-1 py-px text-[10px] font-semibold text-[#1d4ed8]"
          title={tag.category}
        >
          {tag.category}
        </span>
        <span className="text-[12px] text-[#171717] leading-snug truncate flex-1 min-w-0">
          {f.name}
        </span>
        {tag.stays ? (
          <span className="flex-shrink-0 text-[10px] text-[#a3a3a3]">correct here</span>
        ) : (
          <span className="flex-shrink-0 inline-flex items-center rounded border border-[#fecdd3] bg-[#fff1f2] px-1.5 py-px text-[10px] font-bold text-[#be123c]">
            → {moveDestination(f, d.sharedNames)}
          </span>
        )}
        {d.onEditFinding && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Edit ${f.name}`}
            onClick={(e) => {
              e.stopPropagation();
              d.onEditFinding?.(f.id);
            }}
            className="flex-shrink-0 text-[11px] text-[#c9c9c9] hover:text-[#171717] leading-none"
            title="Edit finding"
          >
            ✎
          </span>
        )}
      </button>
      {whyOpen && f.whyThisMoves && <WhyThisMovesPanel why={f.whyThisMoves} />}
    </div>
  );
}

export function CellNode({ data }: NodeProps) {
  const d = data as CellNodeData;
  // Stay rows first, then movers — the wireframe's reading order.
  const rows: { f: Finding; tag: CategoryTag }[] = [];
  for (const tag of d.tags.filter((t) => t.stays))
    for (const f of tag.findings) rows.push({ f, tag });
  for (const tag of d.tags.filter((t) => !t.stays))
    for (const f of tag.findings) rows.push({ f, tag });

  const stay = rows.filter((r) => r.tag.stays).length;
  const move = rows.length - stay;
  const showAll = d.expanded.includes(EXPAND_ALL);
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  const hidden = rows.length - visible.length;
  const meta = d.layerMeta;

  return (
    <div
      className="rounded-lg border border-[#e7e2d8] bg-[#fffdf8] shadow-sm px-2.5 py-2"
      style={{ width: BOX_W }}
    >
      {sideHandles}
      {/* Section header — dot · "<layer> layer" · descriptor · count · roll-up */}
      <div className="flex items-center gap-1.5 border-b border-[#f0ece2] pb-1.5 mb-1.5">
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: meta?.dot ?? '#a3a3a3' }}
        />
        <span className="text-[12px] font-bold text-[#171717]">{d.layer} layer</span>
        {meta?.descriptor && (
          <span className="text-[10px] text-[#a3a3a3] truncate">{meta.descriptor}</span>
        )}
        <span className="inline-flex items-center justify-center min-w-[20px] h-[16px] rounded-full bg-[#f0f0f0] px-1 text-[10px] font-bold text-[#525252]">
          {rows.length}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] font-semibold tnum flex-shrink-0">
          {stay > 0 && <span className="text-[#047857]">{stay} stay</span>}
          {stay > 0 && move > 0 && <span className="text-[#d4d4d4]"> · </span>}
          {move > 0 && <span className="text-[#be123c]">{move} move</span>}
        </span>
      </div>

      {rows.length === 0 ? (
        <span className="text-[13px] text-[#cfcfcf]">—</span>
      ) : (
        <div className="space-y-px">
          {visible.map(({ f, tag }) => (
            <ItemRow key={f.id} f={f} tag={tag} d={d} />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onToggle(d.appId, d.layer, EXPAND_ALL);
              }}
              className="px-2 pt-0.5 text-[11px] font-medium text-[#8f8f8f] hover:text-[#171717]"
            >
              + {hidden} more…
            </button>
          )}
          {showAll && rows.length > VISIBLE_ROWS && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onToggle(d.appId, d.layer, EXPAND_ALL);
              }}
              className="px-2 pt-0.5 text-[11px] font-medium text-[#8f8f8f] hover:text-[#171717]"
            >
              − collapse
            </button>
          )}
        </div>
      )}
      {d.onAddFinding && (
        <div className="mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onAddFinding?.(d.appId, d.layer);
            }}
            className="text-[11px] font-medium text-[#c9c9c9] hover:text-[#171717]"
            title="Add a finding to this section"
          >
            + finding
          </button>
        </div>
      )}
    </div>
  );
}
