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

// Cell color = the status mix inside it (traffic light): any Unique element →
// red, else any Similar → amber, else all-Common → green. The figure inside
// stays the decision workload (pending count, ✓ when nothing is left).
export function cellVisual(cell: HeatCell): { bg: string; fg: string; pending: number } {
  const pending = cell.need - cell.decided;
  if (cell.na || cell.total === 0) return { bg: '#f5f5f5', fg: '#737373', pending: 0 };
  if (cell.unique > 0) return { bg: '#fecaca', fg: '#7f1d1d', pending };
  if (cell.similar > 0) return { bg: '#fde68a', fg: '#78350f', pending };
  return { bg: '#bbf7d0', fg: '#14532d', pending };
}

export function cellTitle(cell: HeatCell): string {
  const pending = cell.need - cell.decided;
  return (
    `${cell.total} coverages — ${cell.common} common · ${cell.similar} similar · ${cell.unique} unique` +
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
                <>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {vis.pending === 0 ? '✓' : vis.pending}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 600 }}>
                    {vis.pending === 0 ? `${c.total} coverages in` : `to decide of ${c.total}`}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>
                    {c.common}C · {c.similar}S · {c.unique}U
                  </span>
                </>
              ) : density === 'medium' ? (
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {vis.pending === 0 ? '✓' : `${vis.pending}/${c.need}`}
                </span>
              ) : (
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>
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
export function SectionBand({ label, detail }: { label: string; detail?: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '7px 12px 5px',
        background: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        minWidth: '100%',
      }}
    >
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
