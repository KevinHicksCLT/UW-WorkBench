/**
 * Shared building blocks for the map node cards — card dimensions, the
 * sentence-case display normalizer, focus/edit style helpers, the hidden
 * handle set, and every node's data type. Extracted verbatim from MapNode.tsx.
 */
import { type CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { type NodeFocusState } from '../model';

// ── Map card dimensions ───────────────────────────────────────────────────────
// Deliberately smaller than the shared CARD_W/CARD_H in model.ts (220×96), per
// defect backlog 02, D3.2 — the map was mostly blank space. Long names wrap
// (and clamp) inside the fixed box instead of widening it. MapCanvas imports
// these for its layout math so geometry and rendering stay in lockstep.
export const MAP_CARD_W = 150;
export const MAP_CARD_H = 68;

// Wrap-then-clamp for labels inside the fixed-size cards: wrap to multiple
// lines, then ellipsize past the line budget so text never spills the box.
export const CLAMP3: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// ── Display-time casing normalizer (defect backlog 02, D3.4) ─────────────────
// Node names come from the DB with mixed casing. We normalize at render time
// only — never in the database — because the role/step joins match on the raw
// names (see roleMatch.ts). Sentence case = uppercase the first letter and
// leave the rest untouched, so acronyms (AIOps, KPI) survive.
export function sentenceCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ── Focus class helper ────────────────────────────────────────────────────────

export function focusClass(s: NodeFocusState | undefined): string {
  switch (s) {
    case 'dimmed':
      return 'node-dimmed';
    case 'focused':
      return 'node-focused';
    case 'expanded':
      return 'node-expanded';
    default:
      return 'node-neutral';
  }
}

// Edit-mode visual overrides for a draggable process card. `editable` → grab
// cursor + subtle dashed outline; `dropTarget` → a prominent teal ring while a
// node is being dragged over it (Apple-folder "this is where it'll land" cue).
// Returns a partial style merged into the card; empty in normal view.
export function editStyle(d: EditAffordance): CSSProperties {
  if (d.dropTarget) {
    return {
      cursor: 'grabbing',
      outline: '2px solid #0d9488',
      outlineOffset: 2,
      boxShadow: '0 0 0 4px rgba(13,148,136,0.18), 0 4px 14px rgba(13,148,136,0.25)',
    };
  }
  if (d.editable) {
    return {
      cursor: 'grab',
      outline: '1.5px dashed #cbd5e1',
      outlineOffset: 2,
    };
  }
  return {};
}

// ── Shared handle set (hidden, all four sides) ────────────────────────────────

export function AllHandles() {
  return (
    <>
      <Handle
        id="t"
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
      <Handle
        id="b"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
      <Handle
        id="l"
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
      <Handle
        id="r"
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none' }}
        isConnectable={false}
      />
    </>
  );
}

// ── Node data types ───────────────────────────────────────────────────────────

export type CompanyNodeData = {
  name: string;
  focusState?: NodeFocusState;
};

export type CoreNodeData = {
  label: string;
  category: string; // 'Core Business' | 'Corporate Function' | 'IT'
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

export type DivisionNodeData = {
  name: string;
  category: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

// ── Edit-mode affordance (shared) ─────────────────────────────────────────────
// In the map's edit mode, draggable process nodes get a "grab" cursor + dashed
// outline; the node currently hovered as a valid drop target gets an Apple-folder
// style ring. Both are optional and absent (no visual change) in normal view.
export type EditAffordance = {
  editable?: boolean; // draggable in edit mode → grab cursor + dashed outline
  dropTarget?: boolean; // currently the hovered valid drop target → ring
  staged?: boolean; // has an unsaved pending move/reorder → amber corner dot
  // Hover-only add/remove badges (edit mode). "+" sits in the gutter after this
  // card and inserts a sibling there; hovering it opens the insertion slot
  // (onPlusHover drives the canvas gap state). "×" sits on the card's top-right
  // corner and deletes the node and its whole subtree — the canvas guards it
  // behind a confirm modal.
  onAddAfter?: () => void;
  onRemove?: () => void;
  onPlusHover?: (hovering: boolean) => void;
  plusSide?: 'right' | 'bottom'; // trailing edge: horizontal rows → right, vertical columns → bottom
};

// The "+ Add …" placeholder card shown under a focused node that has no
// children yet (edit mode only) — the only way to seed a first child in place.
export type AddNodeData = { label: string; onClick: () => void };

// Hover-revealed "+" / "×" badges on an editable card (cards keep overflow
// visible so these can straddle the edges). "×" pins to the card's top-right
// corner; "+" sits centered in the sibling gutter after the card, and hovering
// it opens the insertion slot via onPlusHover. Revealed by the .map-edit-badge
// CSS hover rule. data-edit-btn marks them so the drag hooks ignore
// pointer-downs on them.
export function EditBadges({ d }: { d: EditAffordance }) {
  if (!d.onAddAfter && !d.onRemove) return null;
  const badge: CSSProperties = {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: '50%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    background: '#ffffff',
    border: '1px solid #d4d4d4',
    color: '#525252',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    zIndex: 3,
    userSelect: 'none',
  };
  // Hovering "+" spreads the siblings by PLUS_GAP_SPREAD (30px), growing the
  // 12px gutter to 42px; the badge sits at that opened gap's midpoint (center
  // 21px past the card edge → trailing edge at 34px for the 26px badge) so it
  // reads as "the plus goes right here, between these two cards".
  const plusPos: CSSProperties =
    d.plusSide === 'bottom'
      ? { bottom: -34, left: '50%', transform: 'translateX(-50%)' }
      : { right: -34, top: '50%', transform: 'translateY(-50%)' };
  return (
    <>
      {d.onRemove && (
        <button
          type="button"
          data-edit-btn
          aria-label="Remove this step and all steps beneath it"
          title="Remove (children removed too)"
          className="map-edit-badge"
          style={{ ...badge, top: -10, right: -10 }}
          onClick={(e) => {
            e.stopPropagation();
            d.onRemove?.();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          ×
        </button>
      )}
      {d.onAddAfter && (
        <button
          type="button"
          data-edit-btn
          aria-label="Add a step here"
          title="Add a step here"
          className="map-edit-badge"
          style={{ ...badge, ...plusPos }}
          onClick={(e) => {
            e.stopPropagation();
            d.onPlusHover?.(false);
            d.onAddAfter?.();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseEnter={() => d.onPlusHover?.(true)}
          onMouseLeave={() => d.onPlusHover?.(false)}
        >
          +
        </button>
      )}
    </>
  );
}

// Small amber corner dot marking a node with unsaved staged edits.
export function StagedDot() {
  return (
    <div
      title="Unsaved change"
      style={{
        position: 'absolute',
        top: -5,
        right: -5,
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: '#f59e0b',
        border: '2px solid #ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        zIndex: 2,
      }}
    />
  );
}

export type ValueStreamNodeData = {
  name: string;
  category: string; // L1 segment of this branch — drives the domain color
  participationType: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

export type StepNodeData = {
  step: number;
  name: string;
  category: string; // L1 segment — drives the domain color across every level
  primaryCategory: string | null;
  categories: string[];
  subStepCount: number;
  unowned: boolean;
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

export type SubStepNodeData = {
  step: number;
  name: string;
  l5Count?: number; // # of L5 process steps that drill open underneath
  focusState?: NodeFocusState;
  pieceIndex?: number;
} & EditAffordance;

// Deepest flow node — an L5 Process Step (v15) under an L4 sub-process.
export type LeafStepNodeData = {
  step: number;
  name: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
};
