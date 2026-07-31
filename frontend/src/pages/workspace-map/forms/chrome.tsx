// Forms Rationalization — shared presentational atoms (status dots, layer and
// decision chips, stat tiles, section headers). One place so every Forms view
// speaks the same status color language (spec §2).

import type { CSSProperties, ReactNode } from 'react';
import {
  DECISION_META,
  LAYER_META,
  REASON_META,
  STATE_STATUS_META,
  type ExistenceReason,
  type FormDecisionStatus,
  type FormLayer,
  type StateStatus,
} from './types';

/** Colored status dot + accessible text label (never color-only). */
export function StatusBadge({ status, compact }: { status: StateStatus; compact?: boolean }) {
  const m = STATE_STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: compact ? '1px 7px' : '2px 9px',
        borderRadius: 999,
        background: m.bg,
        border: `1px solid ${m.border}`,
        color: m.fg,
        fontSize: compact ? 10.5 : 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

/** Layer badge — the 🟢/🟡/🔴 language mapped to the three form layers. */
export function LayerBadge({ layer, compact }: { layer: FormLayer; compact?: boolean }) {
  return <StatusBadge status={LAYER_META[layer].status} compact={compact} />;
}

/** E5 decision chip; UNDECIDED renders amber "needs attention". */
export function DecisionChip({ status }: { status: FormDecisionStatus }) {
  const m = DECISION_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 999,
        background: m.bg,
        border: `1px solid ${m.border}`,
        color: m.fg,
        fontSize: 10.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

/** FR-5.1 classification chip; UNKNOWN styled as needing attention. */
export function ReasonChip({ reason }: { reason: ExistenceReason }) {
  const unknown = reason === 'UNKNOWN';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 999,
        background: unknown ? '#fffbeb' : '#f5f5f5',
        border: `1px solid ${unknown ? '#fde68a' : '#e5e5e5'}`,
        color: unknown ? '#92400e' : '#404040',
        fontSize: 10.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {REASON_META[reason].short}
    </span>
  );
}

/** Full-width stat tile: big number over its label (no wasted left margin —
 *  7/28 card feedback), high-contrast text. */
export function StatTile({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    flex: 1,
    minWidth: 130,
    border: '1px solid #eaeaea',
    borderRadius: 12,
    background: '#fff',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    textAlign: 'left',
    cursor: onClick ? 'pointer' : 'default',
  };
  const body = (
    <>
      <span style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#171717', lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#404040' }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: '#525252' }}>{sub}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...style, font: 'inherit' }}>
      {body}
    </button>
  ) : (
    <div style={style}>{body}</div>
  );
}

/** Section header used across the Forms views. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        margin: '4px 0 8px',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#171717' }}>{children}</h3>
      {right}
    </div>
  );
}

/** Inline progress bar (commonality %, decision progress). */
export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 6,
        borderRadius: 999,
        background: '#f0f0f0',
        overflow: 'hidden',
        flex: 1,
        minWidth: 60,
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          borderRadius: 999,
          background: color ?? '#16a34a',
        }}
      />
    </div>
  );
}

/** The always-visible three-status legend (FR-2.1 requirement). */
export function StatusLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <StatusBadge status="standard" compact />
      <StatusBadge status="state" compact />
      <StatusBadge status="product" compact />
    </div>
  );
}
