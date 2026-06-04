import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT,
  CARD_W, CARD_H,
  type NodeFocusState,
} from '../model';

// ── Focus class helper ────────────────────────────────────────────────────────

function focusClass(s: NodeFocusState | undefined): string {
  switch (s) {
    case 'dimmed':   return 'node-dimmed';
    case 'focused':  return 'node-focused';
    case 'expanded': return 'node-expanded';
    default:         return 'node-neutral';
  }
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

export type ValueStreamNodeData = {
  name: string;
  participationType: string;
  focusState?: NodeFocusState;
  pieceIndex?: number;
};

export type StepNodeData = {
  step: number;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  subStepCount: number;
  unowned: boolean;
  focusState?: NodeFocusState;
  pieceIndex?: number;
};

export type SubStepNodeData = {
  step: number;
  name: string;
  l5Count?: number; // # of L5 process steps that drill open underneath
  focusState?: NodeFocusState;
  pieceIndex?: number;
};

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
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '12px 16px',
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
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 2 }}>
        PL0
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.25 }}>
        {d.name}
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
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '10px 14px',
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
        ...animStyle,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: text,
          opacity: 0.6,
          marginBottom: 3,
        }}
      >
        PL1
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: text,
          letterSpacing: '-0.011em',
          lineHeight: 1.25,
        }}
      >
        {d.label}
      </div>
      <AllHandles />
    </div>
  );
});

// ── divisionNode ──────────────────────────────────────────────────────────────

const DivisionNodeImpl = memo(function DivisionNodeImpl({ data }: NodeProps) {
  const d = data as DivisionNodeData;
  const hex    = DOMAIN_HEX[d.category]    ?? '#94a3b8';
  const bg     = DOMAIN_BG[d.category]     ?? '#f8fafc';
  const border = DOMAIN_BORDER[d.category] ?? '#e2e8f0';
  const text   = DOMAIN_TEXT[d.category]   ?? '#475569';
  const fc     = focusClass(d.focusState);
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`group ${fc}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '12px 30px 12px 14px',
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
        ...animStyle,
      }}
    >
      {/* Level tag */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 3 }}>
        PL2
      </div>
      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, marginBottom: 6 }}>
        {d.name}
      </div>
      {/* Domain tag */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: 5,
          padding: '2px 8px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.01em',
          background: bg,
          color: text,
          border: `1px solid ${border}`,
        }}
      >
        {d.category === 'Corporate Function' ? 'Corp Func' : d.category}
      </span>
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

const PART_COLOR: Record<string, string> = {
  Lead:  '#0d9488',
  Core:  '#2563eb',
  Support: '#64748b',
  Control: '#d97706',
  Oversight: '#6b7280',
};

const ValueStreamNodeImpl = memo(function ValueStreamNodeImpl({ data }: NodeProps) {
  const d = data as ValueStreamNodeData;
  const fc = focusClass(d.focusState);
  const partColor = PART_COLOR[d.participationType] ?? '#94a3b8';
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '10px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: `3px solid ${partColor}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        ...animStyle,
      }}
    >
      {/* Level tag */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 4 }}>
        PL3
      </div>
      {/* Name */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35 }}>
        {d.name}
      </div>
      <AllHandles />
    </div>
  );
});

// ── stepNode ──────────────────────────────────────────────────────────────────

function domainTagClass(cat: string): string {
  if (cat === 'Core Business') return 'tag-core';
  if (cat === 'Corporate Function') return 'tag-corp';
  if (cat === 'IT') return 'tag-it';
  return 'chip-soft';
}

const StepNodeImpl = memo(function StepNodeImpl({ data }: NodeProps) {
  const d = data as StepNodeData;
  const fc = focusClass(d.focusState);
  const accent = d.primaryCategory ? (DOMAIN_HEX[d.primaryCategory] ?? '#a3a3a3') : '#a3a3a3';
  const secondary = d.categories.filter((c) => c !== d.primaryCategory);
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '11px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: `1px solid #eaeaea`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        ...animStyle,
      }}
    >
      {/* Level tag */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 3 }}>
        PL4
      </div>
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
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
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35 }}>
          {d.name}
        </span>
      </div>
      {/* Domain tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {d.primaryCategory && (
          <span className={domainTagClass(d.primaryCategory)} style={{ fontSize: 9, padding: '2px 6px' }}>
            {d.primaryCategory === 'Corporate Function' ? 'Corp' : d.primaryCategory === 'Core Business' ? 'Core' : 'IT'}
          </span>
        )}
        {secondary.map((cat) => (
          <span key={cat} className={domainTagClass(cat)} style={{ fontSize: 9, padding: '2px 6px' }}>
            {cat === 'Corporate Function' ? 'Corp' : cat === 'Core Business' ? 'Core' : 'IT'}
          </span>
        ))}
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
  const animStyle = d.pieceIndex != null ? { animationDelay: `${d.pieceIndex * 40}ms` } : undefined;

  return (
    <div
      className={`animate-piece-arrive ${fc}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '11px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #64748b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        ...animStyle,
      }}
    >
      {/* Level tag */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 3 }}>
        PL5
      </div>
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
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
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35 }}>
          {d.name}
        </span>
      </div>
      {/* L5 drill affordance */}
      {!!d.l5Count && (
        <span className="chip-soft" style={{ fontSize: 9, padding: '2px 6px' }}>
          {d.l5Count} PL6 step{d.l5Count === 1 ? '' : 's'} ›
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
        width: CARD_W,
        height: CARD_H,
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '11px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #94a3b8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'default',
        position: 'relative',
        ...animStyle,
      }}
    >
      {/* Level tag */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 3 }}>
        PL6
      </div>
      {/* Step number + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
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
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.35 }}>
          {d.name}
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
