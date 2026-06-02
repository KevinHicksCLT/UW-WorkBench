import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT,
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

// ── companyNode ──────────────────────────────────────────────────────────────
// The enterprise root. Click to reveal the three domains.

const CompanyNodeImpl = memo(function CompanyNodeImpl({ data }: NodeProps) {
  const d = data as CompanyNodeData;
  const fc = focusClass(d.focusState);
  return (
    <div
      className={fc}
      style={{
        width: 220,
        padding: '12px 16px',
        borderRadius: 12,
        background: '#171717',
        border: '1px solid #171717',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a3a3a3', marginBottom: 2 }}>
        Enterprise
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
        width: 200,
        padding: '10px 14px',
        borderRadius: 10,
        background: bg,
        border: `1.5px solid ${border}`,
        borderTop: `3px solid ${hex}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        ...animStyle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: hex,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: text,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {d.label}
        </span>
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
        width: 210,
        minHeight: 78,
        boxSizing: 'border-box',
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
      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#171717', lineHeight: 1.3, marginBottom: 5 }}>
        {d.name}
      </div>
      {/* Domain tag */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          borderRadius: 5,
          padding: '2px 7px',
          fontSize: 10,
          fontWeight: 600,
          background: bg,
          color: text,
          border: `1px solid ${border}`,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0 }} />
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
  Core:  '#4f46e5',
  Support: '#94a3b8',
  Control: '#d97706',
  Oversight: '#a3a3a3',
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
        width: 188,
        padding: '10px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid #eaeaea',
        borderLeft: '3px solid #0d9488',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        position: 'relative',
        ...animStyle,
      }}
    >
      {/* Participation badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 99,
            padding: '1px 6px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#fff',
            background: partColor,
            lineHeight: 1.4,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {d.participationType}
        </span>
      </div>
      {/* Name */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#171717', lineHeight: 1.35 }}>
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

function domainDotClass(cat: string): string {
  if (cat === 'Core Business') return 'dot-core';
  if (cat === 'Corporate Function') return 'dot-corp';
  if (cat === 'IT') return 'dot-it';
  return '';
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
        width: 172,
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
        <span style={{ fontSize: 12, fontWeight: 600, color: '#171717', lineHeight: 1.35 }}>
          {d.name}
        </span>
      </div>
      {/* Domain tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {d.primaryCategory && (
          <span className={domainTagClass(d.primaryCategory)} style={{ fontSize: 9, padding: '2px 5px' }}>
            <span className={domainDotClass(d.primaryCategory)} style={{ marginRight: 2 }} />
            {d.primaryCategory === 'Corporate Function' ? 'Corp' : d.primaryCategory === 'Core Business' ? 'Core' : 'IT'}
          </span>
        )}
        {secondary.map((cat) => (
          <span key={cat} className={domainTagClass(cat)} style={{ fontSize: 9, padding: '2px 5px' }}>
            <span className={domainDotClass(cat)} style={{ marginRight: 2 }} />
            {cat === 'Corporate Function' ? 'Corp' : cat === 'Core Business' ? 'Core' : 'IT'}
          </span>
        ))}
        {d.unowned && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', borderRadius: 5,
            padding: '2px 5px', fontSize: 9, fontWeight: 600,
            background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3',
          }}>
            No owner
          </span>
        )}
        {d.subStepCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', borderRadius: 5,
            padding: '2px 5px', fontSize: 9, fontWeight: 600,
            background: '#fafafa', color: '#525252', border: '1px solid #eaeaea',
          }}>
            {d.subStepCount} sub
          </span>
        )}
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
};
