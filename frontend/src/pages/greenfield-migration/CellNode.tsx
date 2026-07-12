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
import { BOX_W, EXPAND_ALL, visibleCellRows, whyToken } from './cellGeometry';

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
    <div className="mt-0.5 mb-0.5 rounded border border-[#fecdd3] border-l-2 border-l-[#e11d48] bg-[#fff7f7] px-2 py-1">
      <div className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#be123c]">
        Why this moves — what happens on this screen
      </div>
      <div className="mt-0.5">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([k, v]) => (
            <div key={k} className="flex gap-1.5 text-[9.5px] leading-[13px]">
              <span className="w-[52px] flex-shrink-0 text-[#a3a3a3] font-medium">{k}</span>
              <span className="text-[#525252] truncate">{v}</span>
            </div>
          ))}
        {why.lands && (
          <div className="flex gap-1.5 text-[9.5px] leading-[13px]">
            <span className="w-[52px] flex-shrink-0 text-[#a3a3a3] font-medium">Lands in</span>
            <span className="font-semibold text-[#0f766e] truncate">{why.lands}</span>
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
        className={`w-full flex items-center gap-1 rounded border px-1.5 py-0.5 text-left ${
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
          className={`text-[10px] font-bold leading-none flex-shrink-0 ${
            tag.stays ? 'text-[#10b981]' : 'text-[#e11d48]'
          }`}
        >
          {tag.stays ? '✓' : '✗'}
        </span>
        <span
          className="flex-shrink-0 max-w-[80px] truncate rounded border border-[#dbe4f0] bg-[#f0f6ff] px-1 text-[8.5px] font-semibold text-[#1d4ed8]"
          title={tag.category}
        >
          {tag.category}
        </span>
        <span className="text-[10px] text-[#171717] leading-[13px] truncate flex-1 min-w-0">
          {f.name}
        </span>
        {tag.stays ? (
          <span className="flex-shrink-0 text-[8.5px] text-[#a3a3a3]">correct here</span>
        ) : (
          <span className="flex-shrink-0 inline-flex items-center rounded border border-[#fecdd3] bg-[#fff1f2] px-1 text-[8.5px] font-bold text-[#be123c]">
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
            className="flex-shrink-0 text-[9px] text-[#c9c9c9] hover:text-[#171717] leading-none"
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
  // The wireframe's reading order: stays first, then every mover.
  const stayRows: { f: Finding; tag: CategoryTag }[] = [];
  const moveRows: { f: Finding; tag: CategoryTag }[] = [];
  for (const tag of d.tags.filter((t) => t.stays))
    for (const f of tag.findings) stayRows.push({ f, tag });
  for (const tag of d.tags.filter((t) => !t.stays))
    for (const f of tag.findings) moveRows.push({ f, tag });
  const total = stayRows.length + moveRows.length;

  const showAll = d.expanded.includes(EXPAND_ALL);
  const { shown, hidden } = visibleCellRows(stayRows, moveRows, showAll);
  const meta = d.layerMeta;
  const dot = meta?.dot ?? '#a3a3a3';

  return (
    <div
      className="rounded-md border border-[#e8e6e1] bg-white shadow-sm px-1.5 py-1.5"
      style={{ width: BOX_W }}
    >
      {sideHandles}
      {/* Section header strip — tinted by the layer's dot color. */}
      <div
        className="flex items-center gap-1 rounded px-1.5 py-1 mb-1"
        style={{ background: `${dot}14` }}
      >
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
        <span className="text-[10.5px] font-bold text-[#171717]">{d.layer} layer</span>
        {meta?.descriptor && (
          <span className="text-[8.5px] text-[#a3a3a3] truncate">{meta.descriptor}</span>
        )}
        <span className="inline-flex items-center justify-center min-w-[16px] h-[13px] rounded-full bg-white/80 px-1 text-[8.5px] font-bold text-[#525252]">
          {total}
        </span>
        <span className="flex-1" />
        <span className="text-[8.5px] font-semibold tnum flex-shrink-0">
          {stayRows.length > 0 && <span className="text-[#047857]">{stayRows.length} stay</span>}
          {stayRows.length > 0 && moveRows.length > 0 && (
            <span className="text-[#d4d4d4]"> · </span>
          )}
          {moveRows.length > 0 && <span className="text-[#be123c]">{moveRows.length} move</span>}
        </span>
      </div>

      {total === 0 ? (
        <span className="text-[11px] text-[#cfcfcf]">—</span>
      ) : (
        <div>
          {shown.map(({ f, tag }) => (
            <ItemRow key={f.id} f={f} tag={tag} d={d} />
          ))}
          {(hidden > 0 || showAll) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onToggle(d.appId, d.layer, EXPAND_ALL);
              }}
              className="px-1.5 pt-0.5 text-[9px] font-medium text-[#8f8f8f] hover:text-[#171717]"
            >
              {showAll ? '− collapse' : `+ ${hidden} more…`}
            </button>
          )}
          {d.onAddFinding && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onAddFinding?.(d.appId, d.layer);
              }}
              className="px-1.5 pt-0.5 text-[9px] font-medium text-[#c9c9c9] hover:text-[#171717]"
              title="Add a finding to this section"
            >
              + finding
            </button>
          )}
        </div>
      )}
    </div>
  );
}
