import type { ReactNode } from 'react';

// One slim overview card per board column — Normalize (indigo) and Greenfield
// (green), sized to EXACTLY match the Current column's version-identification
// strip so the three column headers read as one row. No title (the LOB is
// already the board context) and no collapse — the card is a fixed-height
// summary: state tag + headline stat, one detail line, and a distribution bar
// drawn as the card's bottom edge.

export interface OverviewTone {
  border: string;
  background: string;
  tag: string;
  shadow: string;
}

export const OVERVIEW_TONES: Record<'current' | 'normalize' | 'greenfield', OverviewTone> = {
  current: {
    border: '#94a3b8',
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

/** Rendered height of the Current column's version strip (border-box px) —
 *  the overview cards pin to it so all three column heads are the same size. */
export const OVERVIEW_CARD_H = 51;

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
  tag,
  right,
  track,
  segments,
  children,
}: {
  tone: OverviewTone;
  /** Uppercase state chip: NORMALIZING · PROPOSED. */
  tag: string;
  /** Right-hand headline stat (e.g. "23%", "22 elements"). */
  right: ReactNode;
  /** Bottom-edge distribution bar. */
  track: string;
  segments: { value: number; color: string }[];
  /** The single detail line under the tag row. */
  children: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div
      style={{
        height: OVERVIEW_CARD_H,
        boxSizing: 'border-box',
        position: 'relative',
        border: `2px solid ${tone.border}`,
        borderRadius: 12,
        background: tone.background,
        boxShadow: tone.shadow,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '7px 11px 0',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '.08em',
            color: tone.tag,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {tag}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10.5,
            color: '#525252',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {right}
        </span>
      </div>
      <div
        style={{
          padding: '2px 11px 0',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '15px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {children}
      </div>
      {/* distribution bar = the card's bottom edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          display: 'flex',
          background: track,
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
    </div>
  );
}
