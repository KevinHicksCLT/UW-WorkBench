import { useMemo, useState } from 'react';
import { useViewState } from '../../../lib/viewState';
import ProductCellModal from './ProductCellModal';
import ProductReviewList, { type ReviewFilter } from './ProductReviewList';
import { buildHeatmap, type HeatRow, type Rag } from './gridModel';
import { buildComparison } from './spine';
import type { LobOption, ProductDecision, ProductDecisionStatus } from './spine';

// The Products workspace GRID — the progress board:
//   (1) an executive dashboard pinned on top (freeze-pane style): total
//       elements, items needing a decision, decided, % complete — each stat
//       drills into the filtered review list;
//   (2) the transposed heatmap below: PRODUCTS as stovepipe columns, MODEL
//       COMPONENTS as rows, RAG per row (green = rationalized, amber =
//       started, red = untouched) with per-row totals and a collapsed Notes
//       column on the far right;
//   (3) click a row (or a stat) → the drill-down review list where every
//       element is actioned (Adopt / Variant / Retire) and commented.

const RAG_META: Record<Rag, { bg: string; fg: string; label: string }> = {
  green: { bg: '#16a34a', fg: '#fff', label: 'rationalized' },
  amber: { bg: '#f59e0b', fg: '#fff', label: 'started' },
  red: { bg: '#dc2626', fg: '#fff', label: 'not started' },
};

function cellVisual(cell: { na: boolean } & { need: number; decided: number; total: number }): {
  bg: string;
  fg: string;
  label: string;
  title: string;
} {
  if (cell.na || cell.total === 0)
    return { bg: '#f5f5f5', fg: '#a3a3a3', label: '—', title: 'not in this product' };
  const pending = cell.need - cell.decided;
  if (cell.need === 0)
    return { bg: '#dcfce7', fg: '#166534', label: '✓', title: 'nothing to decide — all common' };
  if (pending === 0)
    return { bg: '#bbf7d0', fg: '#14532d', label: '✓', title: 'every element decided' };
  if (cell.decided > 0)
    return {
      bg: '#fde68a',
      fg: '#78350f',
      label: String(pending),
      title: `${pending} elements still to decide`,
    };
  return {
    bg: '#fecaca',
    fg: '#991b1b',
    label: String(pending),
    title: `${pending} elements to decide — not started`,
  };
}

function StatTile({
  label,
  value,
  tone,
  onClick,
  bar,
}: {
  label: string;
  value: string;
  tone: string;
  onClick?: () => void;
  bar?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        font: 'inherit',
        flex: 1,
        minWidth: 150,
        textAlign: 'left',
        background: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: 10,
        padding: '8px 12px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      title={onClick ? 'open the filtered review list' : undefined}
    >
      <div style={{ fontSize: 19, fontWeight: 700, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#404040', marginTop: 2 }}>{label}</div>
      {bar !== undefined && (
        <div
          style={{
            height: 5,
            background: '#e5e7eb',
            borderRadius: 9,
            marginTop: 6,
            overflow: 'hidden',
          }}
        >
          <span style={{ display: 'block', height: 5, width: `${bar}%`, background: tone }} />
        </div>
      )}
    </button>
  );
}

export default function ProductGridView({
  lobs,
  decisions,
  onDecide,
}: {
  lobs: LobOption[];
  /** All persisted decisions, keyed by decisionKey(lobId, groupKey). */
  decisions: Map<string, ProductDecision>;
  onDecide: (
    lobId: string,
    component: string,
    groupKey: string,
    status: ProductDecisionStatus,
    comment?: string,
  ) => Promise<void>;
}) {
  const heat = useMemo(() => buildHeatmap(lobs, decisions), [lobs, decisions]);
  const [drill, setDrill] = useViewState<string | null>('workspace.product.drill', null);
  const [drillFilter, setDrillFilter] = useState<ReviewFilter>('pending');
  const [notesOpen, setNotesOpen] = useState(false);
  const [cell, setCell] = useState<{ lobId: string; versionId: string; component: string } | null>(
    null,
  );

  const drillRow =
    drill && drill !== '__all__' ? heat.rows.find((r) => r.component === drill) : null;
  const allReviewRows = useMemo(() => heat.rows.flatMap((r) => r.reviewRows), [heat]);

  const cellModal = useMemo(() => {
    if (!cell) return null;
    const lob = lobs.find((l) => l.id === cell.lobId);
    const version = lob?.versions.find((v) => v.id === cell.versionId);
    if (!lob || !version) return null;
    return { lob, version, comparison: buildComparison(lob.versions) };
  }, [cell, lobs]);

  const pending = heat.totals.need - heat.totals.decided;
  const notesW = notesOpen ? 220 : 46;
  const grid = `230px repeat(${heat.columns.length}, 46px) 74px 84px 130px ${notesW}px`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* (1) Executive dashboard — pinned like a frozen header row. */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid #eaeaea',
          background: '#fafafa',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <StatTile
          label="model elements in scope"
          value={String(heat.totals.total)}
          tone="#171717"
          onClick={() => {
            setDrill('__all__');
            setDrillFilter('all');
          }}
        />
        <StatTile
          label="need a decision"
          value={String(pending)}
          tone={pending > 0 ? '#b45309' : '#16a34a'}
          onClick={() => {
            setDrill('__all__');
            setDrillFilter('pending');
          }}
        />
        <StatTile
          label="decided"
          value={String(heat.totals.decided)}
          tone="#4f46e5"
          onClick={() => {
            setDrill('__all__');
            setDrillFilter('decided');
          }}
        />
        <StatTile
          label={`complete — ${heat.totals.decided} of ${heat.totals.need} decisions made`}
          value={`${heat.totals.pct}%`}
          tone={heat.totals.pct >= 100 ? '#16a34a' : heat.totals.pct > 0 ? '#f59e0b' : '#dc2626'}
          bar={heat.totals.pct}
        />
      </div>

      {drill ? (
        <ProductReviewList
          title={drillRow ? drillRow.component : 'Every model element in scope'}
          subtitle={
            drillRow
              ? `${drillRow.total} elements · ${drillRow.need - drillRow.decided} still to decide`
              : `${heat.totals.total} elements across ${heat.rows.length} components · ${pending} still to decide`
          }
          columns={heat.columns}
          rows={drillRow ? drillRow.reviewRows : allReviewRows}
          defaultFilter={drillFilter}
          onBack={() => setDrill(null)}
          onDecide={(row, status, comment) =>
            onDecide(row.lobId, row.group.component, row.group.key, status, comment)
          }
        />
      ) : (
        <>
          {/* (2) The heatmap — products across the top, components down the side. */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}>
            <div style={{ width: 'max-content', minWidth: '100%' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: grid,
                  alignItems: 'end',
                  background: '#fafafa',
                  borderBottom: '1px solid #e5e7eb',
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#525252',
                  }}
                >
                  Model component
                </div>
                {heat.columns.map((v) => (
                  <div
                    key={v.id}
                    title={`${v.segmentName} › ${v.lobName} › ${v.productName} · ${v.name}`}
                    style={{
                      borderLeft: '1px solid #eef1f4',
                      display: 'flex',
                      justifyContent: 'center',
                      paddingBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        height: 128,
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: '#404040',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.productName} · {v.name}
                    </span>
                  </div>
                ))}
                {['Elements', 'To decide', 'Progress'].map((h) => (
                  <div
                    key={h}
                    style={{
                      padding: '8px 10px',
                      borderLeft: '1px solid #eef1f4',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#525252',
                      textAlign: h === 'Progress' ? 'left' : 'center',
                    }}
                  >
                    {h}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNotesOpen((o) => !o)}
                  title={notesOpen ? 'collapse notes' : 'expand notes'}
                  style={{
                    font: 'inherit',
                    borderLeft: '1px solid #eef1f4',
                    border: 'none',
                    background: 'transparent',
                    padding: '8px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#525252',
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {notesOpen ? 'Notes ▾' : '▸'}
                </button>
              </div>

              {heat.rows.map((row: HeatRow) => {
                const rag = RAG_META[row.rag];
                const rowPending = row.need - row.decided;
                return (
                  <div
                    key={row.component}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: grid,
                      alignItems: 'center',
                      borderBottom: '1px solid #f1f3f5',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDrill(row.component);
                        setDrillFilter(rowPending > 0 ? 'pending' : 'all');
                      }}
                      title="open this component's review list"
                      style={{
                        font: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        title={rag.label}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 9999,
                          background: rag.bg,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#171717' }}>
                        {row.component}
                      </span>
                    </button>
                    {row.cells.map((c) => {
                      const vis = cellVisual(c);
                      return (
                        <button
                          key={`${row.component}:${c.versionId}`}
                          type="button"
                          disabled={c.na || c.total === 0}
                          title={vis.title}
                          onClick={() =>
                            setCell({
                              lobId: c.lobId,
                              versionId: c.versionId,
                              component: row.component,
                            })
                          }
                          style={{
                            font: 'inherit',
                            borderLeft: '1px solid #f4f6f8',
                            borderTop: 'none',
                            borderRight: 'none',
                            borderBottom: 'none',
                            background: 'transparent',
                            padding: 4,
                            cursor: c.na || c.total === 0 ? 'default' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 32,
                              height: 22,
                              borderRadius: 5,
                              background: vis.bg,
                              color: vis.fg,
                              fontSize: 10.5,
                              fontWeight: 700,
                            }}
                          >
                            {vis.label}
                          </span>
                        </button>
                      );
                    })}
                    <div
                      style={{
                        borderLeft: '1px solid #f4f6f8',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#404040',
                        fontVariantNumeric: 'tabular-nums',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {row.total}
                    </div>
                    <div
                      style={{
                        borderLeft: '1px solid #f4f6f8',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: rowPending > 0 ? '#b45309' : '#16a34a',
                        fontVariantNumeric: 'tabular-nums',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {rowPending}
                    </div>
                    <div
                      style={{
                        borderLeft: '1px solid #f4f6f8',
                        padding: '0 10px',
                        alignSelf: 'stretch',
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
                        <span
                          style={{
                            display: 'block',
                            height: 6,
                            width: `${row.pct}%`,
                            background: rag.bg,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#404040',
                          width: 34,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        borderLeft: '1px solid #f4f6f8',
                        padding: '4px 10px',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {notesOpen ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: row.note ? '#404040' : '#a3a3a3',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {row.note ?? '—'}
                        </span>
                      ) : (
                        row.note && (
                          <span title={row.note} style={{ fontSize: 12, color: '#737373' }}>
                            💬
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '7px 14px',
              borderTop: '1px solid #eaeaea',
              background: '#fafafa',
              fontSize: 11,
              color: '#404040',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <span>
              <span style={{ color: '#16a34a' }}>●</span> rationalized ·{' '}
              <span style={{ color: '#f59e0b' }}>●</span> started ·{' '}
              <span style={{ color: '#dc2626' }}>●</span> not started
            </span>
            <span>
              cell number = elements still to decide for that product · ✓ = nothing pending
            </span>
            <span>
              click a component row for its review list · click a cell for that product's detail
            </span>
          </div>
        </>
      )}

      {cell && cellModal && (
        <ProductCellModal
          version={cellModal.version}
          component={cell.component}
          comparison={cellModal.comparison}
          lobId={cellModal.lob.id}
          lobName={cellModal.lob.name}
          onComponent={(component) => setCell({ ...cell, component })}
          onClose={() => setCell(null)}
        />
      )}
    </div>
  );
}
