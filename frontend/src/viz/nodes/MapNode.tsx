import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT,
  type NodeFocusState,
} from '../model';

// ── Map card dimensions ───────────────────────────────────────────────────────
// Deliberately smaller than the shared CARD_W/CARD_H in model.ts (220×96), per
// defect backlog 02, D3.2 — the map was mostly blank space. Long names wrap
// (and clamp) inside the fixed box instead of widening it. MapCanvas imports
// these for its layout math so geometry and rendering stay in lockstep.
export const MAP_CARD_W = 150;
export const MAP_CARD_H = 68;

// Wrap-then-clamp for labels inside the fixed-size cards: wrap to multiple
// lines, then ellipsize past the line budget so text never spills the box.
const CLAMP3: CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
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

function focusClass(s: NodeFocusState | undefined): string {
  switch (s) {
    case 'dimmed':   return 'node-dimmed';
    case 'focused':  return 'node-focused';
    case 'expanded': return 'node-expanded';
    default:         return 'node-neutral';
  }
}

// Edit-mode visual overrides for a draggable process card. `editable` → grab
// cursor + subtle dashed outline; `dropTarget` → a prominent teal ring while a
// node is being dragged over it (Apple-folder "this is where it'll land" cue).
// Returns a partial style merged into the card; empty in normal view.
function editStyle(d: EditAffordance): CSSProperties {
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

function AllHandles() {
  return (
    <>
      <Handle id="t" type="target"  position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
      <Handle id="b" type="source"  position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
      <Handle id="l" type="target"  position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
      <Handle id="r" type="source"  position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
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
};

export type DivisionNodeData = {
  name: string;
  category: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
};

// ── Edit-mode affordance (shared) ─────────────────────────────────────────────
// In the map's edit mode, draggable process nodes get a "grab" cursor + dashed
// outline; the node currently hovered as a valid drop target gets an Apple-folder
// style ring. Both are optional and absent (no visual change) in normal view.
export type EditAffordance = {
  editable?: boolean;   // draggable in edit mode → grab cursor + dashed outline
  dropTarget?: boolean; // currently the hovered valid drop target → ring
};

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

// ── companyNode ──────────────────────────────────────────────────────────────
// The enterprise root. Click to reveal the three domains.

const CompanyNodeImpl = memo(function CompanyNodeImpl({ data }: NodeProps) {
  const d = data as CompanyNodeData;
  const fc = focusClass(d.focusState);
  return (
    <div
      className={fc}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '10px 12px',
        borderRadius: 12,
        background: '#171717',
        border: '1px solid #171717',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.25, ...CLAMP3 }}>
        {sentenceCase(d.name)}
      </div>
      <AllHandles />
    </div>
  );
});

// ── coreNode ─────────────────────────────────────────────────────────────────
// The 3 top-level domain headers — clickable; selecting one reveals its divisions.

const CoreNodeImpl = memo(function CoreNodeImpl({ data }: NodeProps) {
  const d = data as CoreNodeData;
  const hex   = DOMAIN_HEX[d.category]    ?? '#94a3b8';
  const bg    = DOMAIN_BG[d.category]     ?? '#f8fafc';
  const border = DOMAIN_BORDER[d.category] ?? '#e2e8f0';
  const text  = DOMAIN_TEXT[d.category]   ?? '#475569';
  const fc    = focusClass(d.focusState);
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={fc}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '8px 12px',
        borderRadius: 10,
        background: bg,
        border: `1.5px solid ${border}`,
        borderTop: `3px solid ${hex}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        ...animStyle,
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: text,
          letterSpacing: '-0.011em',
          lineHeight: 1.25,
          ...CLAMP3,
        }}
      >
        {sentenceCase(d.label)}
      </div>
      <AllHandles />
    </div>
  );
});

// ── divisionNode ──────────────────────────────────────────────────────────────

const DivisionNodeImpl = memo(function DivisionNodeImpl({ data }: NodeProps) {
  const d = data as DivisionNodeData;
  const hex    = DOMAIN_HEX[d.category]    ?? '#94a3b8';
  const border = DOMAIN_BORDER[d.category] ?? '#e2e8f0';
  const fc     = focusClass(d.focusState);
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`group ${fc}`}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '10px 26px 10px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${hex}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        ...animStyle,
      }}
    >
      {/* Name */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP3 }}>
        {sentenceCase(d.name)}
      </div>
      {/* Arrow affordance */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 13 13"
        fill="none"
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.3,
          flexShrink: 0,
        }}
      >
        <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke={hex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <AllHandles />
    </div>
  );
});

// ── valueStreamNode ───────────────────────────────────────────────────────────

const ValueStreamNodeImpl = memo(function ValueStreamNodeImpl({ data }: NodeProps) {
  const d = data as ValueStreamNodeData;
  const fc = focusClass(d.focusState);
  // Domain color (green/orange/blue) applied at every level; only the task leaf
  // stays gray. (Participation type is still carried in data for tooltips/logic.)
  const hex = DOMAIN_HEX[d.category] ?? '#94a3b8';
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '8px 10px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${hex}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        ...animStyle,
        ...editStyle(d),
      }}
    >
      {/* Name */}
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35, ...CLAMP3 }}>
        {sentenceCase(d.name)}
      </div>
      <AllHandles />
    </div>
  );
});

// ── stepNode ──────────────────────────────────────────────────────────────────

const StepNodeImpl = memo(function StepNodeImpl({ data }: NodeProps) {
  const d = data as StepNodeData;
  const fc = focusClass(d.focusState);
  // Domain color from the L1 segment — consistent green/orange/blue at this level
  // (was primaryCategory, which fell back to gray when unset).
  const accent = DOMAIN_HEX[d.category] ?? (d.primaryCategory ? DOMAIN_HEX[d.primaryCategory] : undefined) ?? '#a3a3a3';
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '9px 10px',
        borderRadius: 10,
        background: '#ffffff',
        border: `1px solid #eaeaea`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...animStyle,
        ...editStyle(d),
      }}
    >
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: accent,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {d.step}
        </span>
        {/* 3-line clamp: the sub-process tag chip was removed, so the name can
            use the full card height. */}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35, ...CLAMP3 }}>
          {sentenceCase(d.name)}
        </span>
      </div>
      <AllHandles />
    </div>
  );
});

// ── subStepNode ───────────────────────────────────────────────────────────────
// L4 sub-processes that sit under a selected process area. Clickable — drilling in
// reveals their L5 process steps (v15). The count chip signals how many.

const SubStepNodeImpl = memo(function SubStepNodeImpl({ data }: NodeProps) {
  const d = data as SubStepNodeData;
  const fc = focusClass(d.focusState);
  // This is the L5 task leaf — stays gray on purpose (every higher level carries
  // the domain color; the task does not).
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '9px 10px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #64748b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...animStyle,
        ...editStyle(d),
      }}
    >
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#64748b',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {d.step}
        </span>
        {/* 3-line clamp — match the other levels. The l5Count chip is vestigial
            (sub.l5 is always empty), so the name gets the full card height. */}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35, ...CLAMP3 }}>
          {sentenceCase(d.name)}
        </span>
      </div>
      {/* L5 drill affordance */}
      {!!d.l5Count && (
        <span className="chip-soft" style={{ fontSize: 9, padding: '2px 6px' }}>
          {d.l5Count} step{d.l5Count === 1 ? '' : 's'} ›
        </span>
      )}
      <AllHandles />
    </div>
  );
});

// ── leafStepNode ──────────────────────────────────────────────────────────────
// L5 Process Step (v15) — the deepest flow node, opened under an L4 sub-process.

const LeafStepNodeImpl = memo(function LeafStepNodeImpl({ data }: NodeProps) {
  const d = data as LeafStepNodeData;
  const fc = focusClass(d.focusState);
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: MAP_CARD_W,
        height: MAP_CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '9px 10px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #94a3b8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'default',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...animStyle,
      }}
    >
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#94a3b8',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {d.step}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35, ...CLAMP3 }}>
          {sentenceCase(d.name)}
        </span>
      </div>
      <AllHandles />
    </div>
  );
});

// ── Export ────────────────────────────────────────────────────────────────────

export const mapNodeTypes = {
  companyNode:     CompanyNodeImpl,
  coreNode:        CoreNodeImpl,
  divisionNode:    DivisionNodeImpl,
  valueStreamNode: ValueStreamNodeImpl,
  stepNode:        StepNodeImpl,
  subStepNode:     SubStepNodeImpl,
  leafStepNode:    LeafStepNodeImpl,
};
