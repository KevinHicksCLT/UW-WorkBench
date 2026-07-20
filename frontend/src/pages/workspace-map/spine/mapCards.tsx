import { AMBER, INDIGO } from '../types';

// The map's card kit, shared by the spine comparison boards (value streams
// horizontal, roles vertical): white rounded cards with thin borders, numbered
// blue badges, connector lines, and the shared/dup/unique verdict dots.

export type Mark = 'shared' | 'dup' | 'unique' | undefined;

export function NumBadge({ n }: { n: number }) {
  return (
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: 999,
        background: '#2563eb',
        color: '#fff',
        fontSize: 8.5,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

export function MapCard({
  children,
  onClick,
  selected,
  dimmed,
  tone,
  width,
  height = 64,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  tone?: string;
  width?: number | string;
  /** Fixed height — every box in a row stays the same size. */
  height?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: width ?? '100%',
        height,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '7px 10px',
        borderRadius: 10,
        background: dimmed ? '#fbfcfe' : '#ffffff',
        border: dimmed
          ? '1px dashed #dbe3ee'
          : selected
            ? '1.5px solid #2563eb'
            : `1px solid ${tone ?? '#e2e8f0'}`,
        boxShadow: dimmed ? 'none' : '0 1px 3px rgba(0,0,0,.06)',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        position: 'relative',
      }}
    >
      {children}
    </button>
  );
}

export const markDot = (mark: Mark) => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: 999,
      flexShrink: 0,
      background: mark === 'shared' ? INDIGO : mark === 'dup' ? AMBER : '#93b7e0',
    }}
  />
);

/** Two-line clamped card label. */
export const clamp2 = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
} as const;

/** Horizontal connector between sibling cards (the map's flow line). */
export const HConnector = () => (
  <span
    style={{ width: 14, height: 1.5, background: '#c7d5e8', flexShrink: 0, alignSelf: 'center' }}
  />
);
/** Vertical connector between stacked cards. */
export const VConnector = () => (
  <span
    style={{ width: 1.5, height: 12, background: '#c7d5e8', margin: '0 auto', display: 'block' }}
  />
);

/** The dark lane label pill (mirrors the map's segment chip). */
export function LaneChip({ title, meta, tone }: { title: string; meta?: string; tone?: string }) {
  return (
    <div style={{ paddingRight: 8 }}>
      <div
        style={{
          display: 'inline-block',
          background: tone ?? '#171717',
          color: '#fff',
          borderRadius: 8,
          padding: '7px 11px',
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.25,
          boxShadow: '0 2px 6px rgba(0,0,0,.18)',
        }}
      >
        {title}
      </div>
      {meta && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4 }}>{meta}</div>}
    </div>
  );
}

/** Numbered task card (an L5 atomic step) with its verdict dot. */
export function TaskCard({
  n,
  name,
  mark,
  tag,
  tone,
}: {
  n: number;
  name: string;
  mark: Mark;
  tag?: string | null;
  tone?: string;
}) {
  return (
    <div
      style={{
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: 10,
        background: '#fff',
        border: `1px solid ${tone ?? '#e2e8f0'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        textAlign: 'left',
      }}
    >
      <NumBadge n={n} />
      <span style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.3, flex: 1 }}>{name}</span>
      {tag && (
        <span style={{ fontSize: 8, color: '#94a3b8', whiteSpace: 'nowrap', marginTop: 2 }}>
          {tag}
        </span>
      )}
      <span style={{ marginTop: 3 }}>{markDot(mark)}</span>
    </div>
  );
}
