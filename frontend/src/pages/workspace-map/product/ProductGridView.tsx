import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductReviewList, { type ReviewFilter } from './ProductReviewList';
import { buildHeatmap, type HeatRow, type Rag } from './gridModel';
import type { LobOption, ProductDecision, ProductDecisionStatus } from './spine';

// The Products workspace GRID — the progress board:
//   (1) an executive dashboard pinned on top: total elements, items needing a
//       decision, decided, % complete — each stat drills into the filtered
//       review list;
//   (2) the transposed heatmap below: PRODUCTS as angled column headers
//       (never truncated), MODEL COMPONENTS as rows, RAG per row, cells that
//       stretch to the page and carry real insight while few products are in
//       scope (shrinking to bare counts as the scope grows);
//   (3) any click — component row, cell or dashboard stat — lands on the
//       drill-down review list. The drill lives in the URL (?pmDrill=…), so
//       the browser back button pops it like any navigation.

const RAG_META: Record<Rag, { bg: string; label: string }> = {
  green: { bg: '#16a34a', label: 'rationalized' },
  amber: { bg: '#f59e0b', label: 'started' },
  red: { bg: '#dc2626', label: 'not started' },
};

const DRILL_PARAM = 'pmDrill';

function cellVisual(cell: { na: boolean; need: number; decided: number; total: number }): {
  bg: string;
  fg: string;
  pending: number;
} {
  const pending = cell.need - cell.decided;
  if (cell.na || cell.total === 0) return { bg: '#f5f5f5', fg: '#a3a3a3', pending: 0 };
  if (cell.need === 0 || pending === 0) return { bg: '#bbf7d0', fg: '#14532d', pending: 0 };
  if (cell.decided > 0) return { bg: '#fde68a', fg: '#78350f', pending };
  return { bg: '#fecaca', fg: '#991b1b', pending };
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
  /** status null = withdraw the decision (undo). */
  onDecide: (
    lobId: string,
    component: string,
    groupKey: string,
    status: ProductDecisionStatus | null,
    comment?: string,
  ) => Promise<void>;
}) {
  const heat = useMemo(() => buildHeatmap(lobs, decisions), [lobs, decisions]);
  // The drill is URL state: pushing it creates a history entry, so the
  // browser back button (and the header Back) pops out of the list.
  const [searchParams, setSearchParams] = useSearchParams();
  const drill = searchParams.get(DRILL_PARAM);
  const setDrill = (value: string | null) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(DRILL_PARAM, value);
      else next.delete(DRILL_PARAM);
      return next;
    });
  const [drillFilter, setDrillFilter] = useState<ReviewFilter>('all');
  const [notesOpen, setNotesOpen] = useState(false);

  const drillRow =
    drill && drill !== '__all__' ? (heat.rows.find((r) => r.component === drill) ?? null) : null;
  const allReviewRows = useMemo(() => heat.rows.flatMap((r) => r.reviewRows), [heat]);

  const pending = heat.totals.need - heat.totals.decided;
  const colCount = heat.columns.length;
  // Density steps: rich cells while the scope is small, bare counts at scale.
  const density: 'rich' | 'medium' | 'tiny' =
    colCount <= 8 ? 'rich' : colCount <= 18 ? 'medium' : 'tiny';
  const colMin = density === 'rich' ? 110 : density === 'medium' ? 64 : 40;
  const notesW = notesOpen ? 220 : 44;
  const grid = `220px repeat(${colCount}, minmax(${colMin}px, 1fr)) 76px 84px 128px ${notesW}px`;
  // The header is exactly tall enough for the LONGEST angled label — every
  // label fully visible, nothing spilling out of the header band.
  const maxLabelChars = heat.columns.reduce(
    (n, v) => Math.max(n, `${v.productName} · ${v.name}`.length),
    0,
  );
  const headerH = Math.min(330, Math.max(96, Math.round(maxLabelChars * 5.6 * 0.79) + 30));

  const openDrill = (component: string, filter: ReviewFilter) => {
    setDrillFilter(filter);
    setDrill(component);
  };

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
          onClick={() => openDrill('__all__', 'all')}
        />
        <StatTile
          label="need a decision"
          value={String(pending)}
          tone={pending > 0 ? '#b45309' : '#16a34a'}
          onClick={() => openDrill('__all__', 'pending')}
        />
        <StatTile
          label="decided"
          value={String(heat.totals.decided)}
          tone="#4f46e5"
          onClick={() => openDrill('__all__', 'decided')}
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
              ? `${drillRow.total} elements · ${drillRow.decided} decided · ${drillRow.need - drillRow.decided} still to decide`
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
          {/* (2) The heatmap — products angled across the top, components down the side. */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}>
            <div style={{ minWidth: '100%', width: 'max-content' }}>
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
                  minWidth: '100%',
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
                    alignSelf: 'end',
                  }}
                >
                  Model component
                </div>
                {heat.columns.map((v) => (
                  <div
                    key={v.id}
                    title={`${v.segmentName} › ${v.lobName} › ${v.productName} · ${v.name}`}
                    style={{
                      borderLeft: '1px solid #e2e8f0',
                      height: headerH,
                      position: 'relative',
                      overflow: 'visible',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        transformOrigin: 'left bottom',
                        transform: 'rotate(-52deg)',
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#404040',
                        maxWidth: Math.round((headerH - 18) / 0.79),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
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
                      borderLeft: '1px solid #e2e8f0',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#525252',
                      textAlign: h === 'Progress' ? 'left' : 'center',
                      alignSelf: 'end',
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
                    alignSelf: 'end',
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
                      alignItems: 'stretch',
                      borderBottom: '1px solid #f1f3f5',
                      minWidth: '100%',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openDrill(row.component, 'all')}
                      title="open this component's review list"
                      style={{
                        font: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
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
                      const na = c.na || c.total === 0;
                      return (
                        <button
                          key={`${row.component}:${c.versionId}`}
                          type="button"
                          disabled={na}
                          title={
                            na
                              ? 'not in this product'
                              : `${c.total} elements · ${c.decided} of ${c.need} decisions made — open the review list`
                          }
                          onClick={() => openDrill(row.component, 'all')}
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
                              <span style={{ fontSize: 10.5, fontWeight: 700 }}>—</span>
                            ) : density === 'rich' ? (
                              <>
                                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                                  {vis.pending === 0 ? '✓' : vis.pending}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 500 }}>
                                  {vis.pending === 0
                                    ? `${c.total} elements in`
                                    : `to decide of ${c.total}`}
                                </span>
                              </>
                            ) : density === 'medium' ? (
                              <span style={{ fontSize: 10.5, fontWeight: 700 }}>
                                {vis.pending === 0 ? '✓' : `${vis.pending}/${c.need}`}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700 }}>
                                {vis.pending === 0 ? '✓' : vis.pending}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                    <div
                      style={{
                        borderLeft: '1px solid #e2e8f0',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#404040',
                        fontVariantNumeric: 'tabular-nums',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {row.total}
                    </div>
                    <div
                      style={{
                        borderLeft: '1px solid #e2e8f0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: rowPending > 0 ? '#b45309' : '#16a34a',
                        fontVariantNumeric: 'tabular-nums',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {rowPending}
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
            <span>every click lands on the review list — decisions and comments live there</span>
          </div>
        </>
      )}
    </div>
  );
}
