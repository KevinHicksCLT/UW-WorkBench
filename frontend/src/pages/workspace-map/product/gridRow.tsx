// The Products heatmap's shared row renderer — extracted from ProductGridView
// so the forms-first section renders its core/child rows with EXACTLY the same
// cell, count and progress anatomy as the model-component rows. Markup is the
// grid row verbatim; only the left label cell is caller-supplied.

import type { ReactNode } from 'react';
import type { HeatCell, Rag } from './gridModel';

export const RAG_META: Record<Rag, { bg: string; label: string }> = {
  green: { bg: '#16a34a', label: 'rationalized' },
  amber: { bg: '#f59e0b', label: 'started' },
  red: { bg: '#dc2626', label: 'not started' },
};

// Cell color follows the legend's three states (one rule at every level of
// the board): green = everything common, RED only when unique dominates
// (half or more of the cell), amber for everything between — so a "similar"
// row (configured differently, but the concern is shared) reads amber, never
// red. The figure inside stays the decision workload (pending count, ✓ when
// nothing is left).
export function cellVisual(cell: HeatCell): { bg: string; fg: string; pending: number } {
  const pending = cell.need - cell.decided;
  if (cell.na || cell.total === 0) return { bg: '#f5f5f5', fg: '#737373', pending: 0 };
  if (cell.common === cell.total) return { bg: '#bbf7d0', fg: '#14532d', pending };
  if (cell.unique * 2 >= cell.total) return { bg: '#fecaca', fg: '#7f1d1d', pending };
  return { bg: '#fde68a', fg: '#78350f', pending };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function cellTitle(cell: HeatCell): string {
  const pending = cell.need - cell.decided;
  return (
    `${plural(cell.total, 'coverage')} — ${cell.common} common · ${cell.similar} similar · ${cell.unique} unique` +
    ` · ${pending > 0 ? `${pending} still to decide` : 'no decisions outstanding'} — open the review list`
  );
}

export type Density = 'rich' | 'medium' | 'tiny';

/** One heatmap grid row: caller-supplied left cell, then the traffic-light
 *  cells, Elements / To decide / Progress columns and the notes cell. */
export function HeatGridRow({
  rowKey,
  grid,
  density,
  left,
  cells,
  total,
  pending,
  pct,
  rag,
  note,
  notesOpen,
  onOpen,
  background,
}: {
  rowKey: string;
  grid: string;
  density: Density;
  left: ReactNode;
  cells: HeatCell[];
  total: number;
  pending: number;
  pct: number;
  rag: Rag;
  note: string | null;
  notesOpen: boolean;
  onOpen: () => void;
  background?: string;
}) {
  const ragMeta = RAG_META[rag];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
        alignItems: 'stretch',
        borderBottom: '1px solid #f1f3f5',
        minWidth: '100%',
        background,
      }}
    >
      {left}
      {cells.map((c) => {
        const vis = cellVisual(c);
        const na = c.na || c.total === 0;
        return (
          <button
            key={`${rowKey}:${c.versionId}`}
            type="button"
            disabled={na}
            title={na ? 'not in this product' : cellTitle(c)}
            onClick={onOpen}
            style={{
              font: 'inherit',
              borderLeft: '1px solid #e2e8f0',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              background: 'transparent',
              padding: 3,
              cursor: na ? 'default' : 'pointer',
              display: 'flex',
            }}
          >
            <span
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 5,
                background: vis.bg,
                color: vis.fg,
                minHeight: density === 'rich' ? 38 : 24,
                padding: density === 'rich' ? '3px 4px' : 0,
                lineHeight: 1.15,
              }}
            >
              {na ? (
                <span style={{ fontSize: 11, fontWeight: 700 }}>—</span>
              ) : density === 'rich' ? (
                // Big figure = decisions still open (✓ when none); the line
                // under it says so in words. Composition detail lives in the
                // hover title, not crammed into the cell.
                <>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {vis.pending === 0 ? '✓' : vis.pending}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 600 }}>
                    {vis.pending === 0
                      ? `${c.total} coverage${c.total === 1 ? '' : 's'}`
                      : 'to decide'}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: density === 'medium' ? 11 : 10.5, fontWeight: 700 }}>
                  {vis.pending === 0 ? '✓' : vis.pending}
                </span>
              )}
            </span>
          </button>
        );
      })}
      <span aria-hidden />
      <div
        style={{
          borderLeft: '1px solid #e2e8f0',
          fontSize: 12.5,
          fontWeight: 600,
          color: '#262626',
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {total}
      </div>
      <div
        style={{
          borderLeft: '1px solid #e2e8f0',
          fontSize: 12,
          fontWeight: 700,
          color: pending > 0 ? '#b45309' : '#16a34a',
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {pending}
      </div>
      <div
        style={{
          borderLeft: '1px solid #e2e8f0',
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 6,
            background: '#e5e7eb',
            borderRadius: 9,
            overflow: 'hidden',
          }}
        >
          <span style={{ display: 'block', height: 6, width: `${pct}%`, background: ragMeta.bg }} />
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: '#262626',
            width: 34,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        style={{
          borderLeft: '1px solid #e2e8f0',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {notesOpen ? (
          <span
            style={{
              fontSize: 11,
              color: note ? '#404040' : '#a3a3a3',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {note ?? '—'}
          </span>
        ) : (
          note && (
            <span title={note} style={{ fontSize: 12, color: '#737373' }}>
              💬
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Full-width section band separating the Forms section from the other model
 *  components (spans every grid column). */
export function SectionBand({
  label,
  detail,
  collapsed,
  onToggle,
}: {
  label: string;
  detail?: string;
  /** When onToggle is set the band is collapsible — the chevron reflects
   *  `collapsed` and the whole band toggles on click. */
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      role={onToggle ? 'button' : undefined}
      onClick={onToggle}
      title={onToggle ? (collapsed ? `expand ${label}` : `collapse ${label}`) : undefined}
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '7px 12px 5px',
        background: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        minWidth: '100%',
        cursor: onToggle ? 'pointer' : undefined,
      }}
    >
      {onToggle && (
        <span aria-hidden style={{ fontSize: 10, color: '#525252', alignSelf: 'center' }}>
          {collapsed ? '▸' : '▾'}
        </span>
      )}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#111827',
        }}
      >
        {label}
      </span>
      {detail && <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{detail}</span>}
    </div>
  );
}
