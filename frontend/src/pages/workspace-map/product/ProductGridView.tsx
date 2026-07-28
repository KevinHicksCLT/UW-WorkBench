import { useMemo, useState } from 'react';
import { useViewState } from '../../../lib/viewState';
import ProductCellModal from './ProductCellModal';
import {
  GRID_REC_META,
  buildGridModel,
  groupGridRows,
  type GridGroupMode,
  type GridRow,
} from './gridModel';
import type { LobOption, VersionColumn } from './spine';

// The Products lens GRID view — every offering a row, every model component a
// column, every difference against the LOB's canonical version countable.
// Sorted Segment › LOB › Product offering › Version (or clustered by variance
// band); click any cell for its element-level model detail.

const NAME_W = 250;
const CELL_W = 64;
const MATCH_W = 84;
const REC_W = 138;

function cellStyle(delta: number | null): { label: string; bg: string; fg: string } {
  if (delta === null) return { label: '—', bg: '#fafafa', fg: '#cbd5e1' };
  if (delta === 0) return { label: '✓', bg: '#eff6ff', fg: '#1d4ed8' };
  if (delta <= 1) return { label: `Δ1`, bg: '#fef3c7', fg: '#92400e' };
  if (delta <= 3) return { label: `Δ${delta}`, bg: '#fde68a', fg: '#78350f' };
  return { label: `Δ${delta}`, bg: '#fecaca', fg: '#991b1b' };
}

export default function ProductGridView({
  lobs,
  onOpenDetail,
}: {
  lobs: LobOption[];
  /** Drop back into the ≤threshold detail board on this version's LOB. */
  onOpenDetail: (version: VersionColumn) => void;
}) {
  const model = useMemo(() => buildGridModel(lobs), [lobs]);
  const [groupMode, setGroupMode] = useViewState<GridGroupMode>(
    'workspace.product.gridGroup',
    'spine',
  );
  const [selId, setSelId] = useViewState<string | null>('workspace.product.gridSel', null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [cell, setCell] = useState<{ row: GridRow; component: string } | null>(null);

  const groups = useMemo(() => groupGridRows(model.rows, groupMode), [model, groupMode]);
  const sel = model.rows.find((r) => r.version.id === selId) ?? model.rows[0] ?? null;
  const gridCols = `${NAME_W}px repeat(${model.components.length}, ${CELL_W}px) ${MATCH_W}px ${REC_W}px`;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderBottom: '1px solid #eaeaea',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: '#a3a3a3',
              flexShrink: 0,
            }}
          >
            Sort
          </span>
          {['Segment', 'Line of business', 'Product offering', 'Version / scope'].map(
            (label, i) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 24,
                  padding: '0 8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  background: '#fff',
                  fontSize: 10.5,
                  color: '#171717',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 999,
                    background: '#171717',
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 800,
                    lineHeight: '13px',
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </span>
                {label}
              </span>
            ),
          )}
          <span style={{ width: 1, height: 18, background: '#eaeaea', margin: '0 4px' }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: '#a3a3a3',
              flexShrink: 0,
            }}
          >
            Group
          </span>
          <div
            style={{
              display: 'flex',
              height: 24,
              border: '1px solid #eaeaea',
              borderRadius: 6,
              overflow: 'hidden',
              background: '#fff',
              flexShrink: 0,
            }}
          >
            {(
              [
                ['spine', 'Segment › LOB › Offering'],
                ['variance', 'Variance band'],
              ] as [GridGroupMode, string][]
            ).map(([key, label], i) => {
              const on = groupMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroupMode(key)}
                  style={{
                    font: 'inherit',
                    padding: '0 10px',
                    fontSize: 10.5,
                    lineHeight: '24px',
                    cursor: 'pointer',
                    border: 'none',
                    borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
                    background: on ? '#171717' : '#fff',
                    color: on ? '#fff' : '#525252',
                    fontWeight: on ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>
            ✓ identical to canonical · Δn = n element groups differ · click a cell for its model
            detail
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ width: 'max-content', minWidth: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                background: '#fafafa',
                borderBottom: '1px solid #e5e7eb',
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  padding: '7px 10px',
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: '#a3a3a3',
                }}
              >
                Product offering · version
              </div>
              {model.components.map((c) => (
                <div
                  key={c}
                  title={c}
                  style={{
                    padding: '7px 4px',
                    borderLeft: '1px solid #e5e7eb',
                    fontSize: 9,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: '#525252',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {c.length > 10 ? `${c.slice(0, 9)}…` : c}
                </div>
              ))}
              <div
                style={{
                  padding: '7px 6px',
                  borderLeft: '1px solid #e5e7eb',
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#525252',
                  textAlign: 'center',
                }}
              >
                Match
              </div>
              <div
                style={{
                  padding: '7px 8px',
                  borderLeft: '1px solid #e5e7eb',
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#525252',
                }}
              >
                Recommendation
              </div>
            </div>

            {groups.map((g) => {
              const open = !closed[g.key];
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => setClosed((c) => ({ ...c, [g.key]: open }))}
                    style={{
                      font: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      background: '#f4f6f8',
                      border: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{open ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#171717' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>
                      {g.count} {g.count === 1 ? 'offering' : 'offerings'}
                    </span>
                    <div style={{ flex: 1 }} />
                    {g.canonNote && (
                      <span style={{ fontSize: 10, color: '#4f46e5' }}>{g.canonNote}</span>
                    )}
                  </button>
                  {open &&
                    g.subs.map((sub) => (
                      <div key={sub.key}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 10px 4px 22px',
                            background: '#fafbfc',
                            borderBottom: '1px solid #eef1f4',
                          }}
                        >
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#334155' }}>
                            {sub.name}
                          </span>
                          <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                            {sub.rows.length} {sub.rows.length === 1 ? 'offering' : 'offerings'} ·{' '}
                            {new Set(sub.rows.map((r) => r.productName)).size} product offerings
                          </span>
                        </div>
                        {sub.rows.map((r) => {
                          const meta = GRID_REC_META[r.rec];
                          const on = sel?.version.id === r.version.id;
                          return (
                            <div
                              key={r.version.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: gridCols,
                                borderBottom: '1px solid #f4f6f8',
                                background: on ? '#f5f7ff' : '#fff',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setSelId(r.version.id)}
                                style={{
                                  font: 'inherit',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  padding: '5px 10px',
                                  minWidth: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 999,
                                    flexShrink: 0,
                                    background: meta.dot,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#171717',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {r.productName} · {r.version.name}
                                </span>
                              </button>
                              {r.cells.map((c) => {
                                const s = cellStyle(c.delta);
                                return (
                                  <button
                                    key={c.component}
                                    type="button"
                                    disabled={c.delta === null}
                                    onClick={() => setCell({ row: r, component: c.component })}
                                    style={{
                                      font: 'inherit',
                                      borderLeft: '1px solid #f4f6f8',
                                      borderTop: 'none',
                                      borderRight: 'none',
                                      borderBottom: 'none',
                                      padding: 3,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: c.delta === null ? 'default' : 'pointer',
                                      background: 'transparent',
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: 20,
                                        borderRadius: 4,
                                        background: s.bg,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: s.fg,
                                      }}
                                    >
                                      {s.label}
                                    </span>
                                  </button>
                                );
                              })}
                              <div
                                style={{
                                  borderLeft: '1px solid #f4f6f8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  fontFamily: 'ui-monospace, monospace',
                                  color:
                                    r.match >= 85
                                      ? '#1d4ed8'
                                      : r.match >= 60
                                        ? '#b45309'
                                        : '#dc2626',
                                }}
                              >
                                {r.match}%
                              </div>
                              <div
                                style={{
                                  borderLeft: '1px solid #f4f6f8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 8px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: meta.fg,
                                    background: meta.bg,
                                    border: `1px solid ${meta.border}`,
                                    borderRadius: 5,
                                    padding: '2px 6px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {meta.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderLeft: '1px solid #eaeaea',
          background: '#fafafa',
          padding: 14,
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#ecfdf5',
            border: '2px solid #a7f3d0',
            borderRadius: 11,
            padding: '11px 13px',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#171717' }}>
            Rationalization at {model.rows.length} offerings
          </div>
          <div style={{ fontSize: 12, color: '#525252', marginTop: 4 }}>
            <b style={{ color: '#171717', fontSize: 15 }}>{model.totals.raw}</b> elements →{' '}
            <b style={{ color: '#16a34a', fontSize: 15 }}>{model.totals.normalized}</b> normalized
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 9,
              marginTop: 8,
              fontSize: 10,
              color: '#525252',
            }}
          >
            <span>
              <b style={{ color: '#16a34a' }}>{model.totals.byRec.canonical}</b> keep as canonical
            </span>
            <span>
              <b style={{ color: '#4f46e5' }}>{model.totals.byRec.merge}</b> merge into a canonical
            </span>
            <span>
              <b style={{ color: '#b45309' }}>{model.totals.byRec.decide}</b> need a decision
            </span>
            <span>
              <b style={{ color: '#dc2626' }}>{model.totals.byRec.retire}</b> retire candidates
            </span>
          </div>
        </div>

        {sel && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                color: '#a3a3a3',
                margin: '14px 0 8px',
              }}
            >
              Selected version
            </div>
            <div
              style={{
                background: '#fff',
                border: '1px solid #eaeaea',
                borderRadius: 10,
                padding: 11,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#171717' }}>
                {sel.productName} · {sel.version.name}
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                {sel.segmentName} › {sel.lobName} › {sel.productName}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#171717' }}>
                    {sel.elements}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8' }}>elements</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>
                    {sel.match}%
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8' }}>match canonical</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#b45309' }}>
                    {sel.deltas}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8' }}>deltas</div>
                </div>
              </div>
              {sel.deltas > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: '#a3a3a3',
                      margin: '11px 0 6px',
                    }}
                  >
                    Where it differs
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sel.cells
                      .filter((c) => (c.delta ?? 0) > 0)
                      .slice(0, 4)
                      .map((c) => (
                        <button
                          key={c.component}
                          type="button"
                          onClick={() => setCell({ row: sel, component: c.component })}
                          style={{
                            font: 'inherit',
                            border: '1px solid #f1f3f5',
                            borderLeft: `3px solid ${(c.delta ?? 0) > 3 ? '#dc2626' : '#b45309'}`,
                            borderRadius: 7,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            background: '#fff',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#171717' }}>
                            {c.component}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              lineHeight: 1.4,
                              color: '#525252',
                              marginTop: 2,
                            }}
                          >
                            {c.delta} element {c.delta === 1 ? 'group differs' : 'groups differ'} —
                            open the detail
                          </div>
                        </button>
                      ))}
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 11 }}>
                <button
                  type="button"
                  onClick={() => onOpenDetail(sel.version)}
                  style={{
                    font: 'inherit',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#fff',
                    background: '#171717',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 11px',
                    cursor: 'pointer',
                  }}
                >
                  Compare in detail
                </button>
              </div>
            </div>
          </>
        )}
        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: '#94a3b8', marginTop: 12 }}>
          Open the detail view on any LOB with 5 or fewer versions to see the full three-column
          current → normalize → greenfield board.
        </div>
      </div>

      {cell && (
        <ProductCellModal
          version={cell.row.version}
          component={cell.component}
          comparison={model.comparisons.get(cell.row.lobId) ?? buildGridFallback()}
          lobId={cell.row.lobId}
          lobName={cell.row.lobName}
          onComponent={(component) => setCell({ row: cell.row, component })}
          onClose={() => setCell(null)}
        />
      )}
    </div>
  );
}

function buildGridFallback() {
  return { axis: [], rows: [], rawCount: 0, normalizedCount: 0, reviewCount: 0 };
}
