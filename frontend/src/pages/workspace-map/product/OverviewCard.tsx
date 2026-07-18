import { useState, type ReactNode } from 'react';

// One collapsible overview card per board column — Current (slate), Normalize
// (indigo), Greenfield (green). Same anatomy everywhere: chevron · title ·
// uppercase state tag · right-hand stat, expanding to a short detail block, so
// the three columns read as the same entity in three states.

export interface OverviewTone {
  border: string;
  background: string;
  tag: string;
  shadow: string;
}

export const OVERVIEW_TONES: Record<'current' | 'normalize' | 'greenfield', OverviewTone> = {
  current: {
    border: '#cbd5e1',
    background: '#f8fafc',
    tag: '#475569',
    shadow: '0 2px 8px rgba(100,116,139,.10)',
  },
  normalize: {
    border: '#c7d2fe',
    background: '#eef2ff',
    tag: '#4f46e5',
    shadow: '0 2px 8px rgba(79,70,229,.10)',
  },
  greenfield: {
    border: '#6ee7b7',
    background: '#ecfdf5',
    tag: '#047857',
    shadow: '0 2px 8px rgba(16,185,129,.10)',
  },
};

/** A slim distribution bar; segments render left→right, zero-width ones skip. */
export function SegmentBar({
  track,
  segments,
}: {
  track: string;
  segments: { value: number; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div
      style={{
        display: 'flex',
        height: 5,
        borderRadius: 999,
        background: track,
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={i}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
                transition: 'width .3s',
              }}
            />
          ))}
    </div>
  );
}

export default function OverviewCard({
  tone,
  title,
  tag,
  right,
  children,
}: {
  tone: OverviewTone;
  title: string;
  /** Uppercase state chip: CURRENT · NORMALIZING · PROPOSED. */
  tag: string;
  /** Right-hand headline stat (e.g. "2 versions", "23%"). */
  right: ReactNode;
  /** Expanded detail block. */
  children: ReactNode;
}) {
  // Open by default — the card IS each column's summary; collapsing it is the
  // space-saving opt-in. The alignment pads absorb the height difference.
  const [open, setOpen] = useState(true);
  return (
    <div
      style={{
        border: `2px solid ${tone.border}`,
        borderRadius: 12,
        background: tone.background,
        boxShadow: tone.shadow,
        boxSizing: 'border-box',
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 11px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            color: tone.tag,
            fontSize: 9,
            display: 'inline-block',
            transform: open ? 'none' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            minWidth: 0,
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '.08em',
            color: tone.tag,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {tag}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: '#525252',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {right}
        </span>
      </button>
      {open && <div style={{ padding: '0 13px 9px' }}>{children}</div>}
    </div>
  );
}
