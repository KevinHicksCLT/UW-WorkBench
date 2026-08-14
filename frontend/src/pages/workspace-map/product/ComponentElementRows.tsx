import { useApi } from '../../../lib/useApi';
import { MATCH_META } from './spine';
import { HeatGridRow, type Density } from './gridRow';
import type { BoardColumn, ReviewPayload } from './boardApi';
import type { HeatCell } from './gridModel';

// Inline element table for ONE model component (Rating, Lifecycle, …) — shown
// when the component's row expands, exactly the way the forms register lists
// its forms. Rows come lazily from the review endpoint (the same drill the
// review list uses, so the server cap applies) and render with the shared
// HeatGridRow anatomy: presence cells, coverage count, decision workload.
export default function ComponentElementRows({
  component,
  scopeQS,
  grid,
  density,
  columns,
  notesOpen,
  onOpen,
}: {
  component: string;
  scopeQS: string;
  grid: string;
  density: Density;
  columns: BoardColumn[];
  notesOpen: boolean;
  /** Opens the component's review list (any cell / row click). */
  onOpen: () => void;
}) {
  const { data, loading, error } = useApi<ReviewPayload>(
    `/product-spine/review?${scopeQS}&drill=${encodeURIComponent(component)}`,
  );
  if (loading || error || !data)
    return (
      <div
        style={{
          padding: '6px 26px',
          fontSize: 11.5,
          color: '#737373',
          borderBottom: '1px solid #f1f3f5',
          minWidth: '100%',
        }}
      >
        {error ? 'These element rows failed to load.' : 'Loading the element rows…'}
      </div>
    );
  const cols = data.columns.length === columns.length ? data.columns : columns;
  return (
    <>
      {data.truncated > 0 && (
        <div
          style={{
            padding: '4px 26px',
            fontSize: 11,
            color: '#92400e',
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            minWidth: '100%',
          }}
        >
          Showing the first {data.rows.length.toLocaleString()} of {data.total.toLocaleString()}{' '}
          elements — open the review list for the rest.
        </div>
      )}
      {data.rows.map((r) => {
        const status = r.group.status;
        const mix = status === 'PARTIAL' ? 'similar' : status === 'UNIQUE' ? 'unique' : 'common';
        const needs = r.needsDecision;
        const cells: HeatCell[] = r.presence.map((p, i) => ({
          na: !p,
          versionId: cols[i]?.id ?? String(i),
          lobId: r.lobId,
          total: p ? 1 : 0,
          auto: p && !needs ? 1 : 0,
          need: p && needs ? 1 : 0,
          decided: p && needs && r.decision ? 1 : 0,
          common: p && mix === 'common' ? 1 : 0,
          similar: p && mix === 'similar' ? 1 : 0,
          unique: p && mix === 'unique' ? 1 : 0,
        }));
        const pending = needs && !r.decision ? 1 : 0;
        const pct = needs ? (r.decision ? 100 : 0) : 100;
        const meta = MATCH_META[status];
        return (
          <HeatGridRow
            key={`${component}:${r.lobId}:${r.group.key}`}
            rowKey={`${component}:${r.group.key}`}
            grid={grid}
            density={density}
            cells={cells}
            total={1}
            pending={pending}
            pct={pct}
            rag={pct >= 100 ? 'green' : 'red'}
            note={r.decision?.comment ?? null}
            notesOpen={notesOpen}
            onOpen={onOpen}
            left={
              <button
                type="button"
                onClick={onOpen}
                title="open this element in the review list"
                style={{
                  font: 'inherit',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '5px 12px 5px 26px',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#262626',
                    lineHeight: 1.3,
                  }}
                >
                  {r.group.name}
                </span>
                <span style={{ display: 'block', fontSize: 10.5, color: meta.fg, marginTop: 1 }}>
                  {meta.label}
                  {r.lobName ? ` · ${r.lobName}` : ''}
                </span>
              </button>
            }
          />
        );
      })}
    </>
  );
}
