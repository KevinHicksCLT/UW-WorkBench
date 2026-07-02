/**
 * The seven map card components (company / core domain / division / value
 * stream / L4 step / L5 sub-process / leaf step) and the mapNodeTypes registry.
 * Extracted verbatim from MapNode.tsx.
 */
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT,
} from '../model';
import { Chip } from '../../components/ui';
import {
  MAP_CARD_W, MAP_CARD_H, CLAMP3, sentenceCase, focusClass, editStyle, AllHandles, StagedDot,
  type CompanyNodeData, type CoreNodeData, type DivisionNodeData, type ValueStreamNodeData,
  type StepNodeData, type SubStepNodeData, type LeafStepNodeData,
} from './mapNodeShared';

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
        ...editStyle(d),
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
      {d.staged && <StagedDot />}
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
        ...editStyle(d),
      }}
    >
      {/* Name */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#171717', letterSpacing: '-0.011em', lineHeight: 1.3, ...CLAMP3 }}>
        {sentenceCase(d.name)}
      </div>
      {d.staged && <StagedDot />}
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
      {d.staged && <StagedDot />}
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
      {d.staged && <StagedDot />}
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
        <Chip style={{ fontSize: 9, padding: '2px 6px' }}>
          {d.l5Count} step{d.l5Count === 1 ? '' : 's'} ›
        </Chip>
      )}
      {d.staged && <StagedDot />}
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
