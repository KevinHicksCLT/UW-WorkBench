import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useViewState } from '../../../lib/viewState';
import ProductReviewList, { type ReviewFilter } from './ProductReviewList';
import { abbrevVersion, buildHeatmap, type HeatCell, type HeatRow, type Rag } from './gridModel';
import {
  MATCH_META,
  type LobOption,
  type ProductDecision,
  type ProductDecisionStatus,
} from './spine';

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

// Cell color = the status mix inside it (traffic light): any Unique element →
// red, else any Similar → amber, else all-Common → green. The figure inside
// stays the decision workload (pending count, ✓ when nothing is left).
function cellVisual(cell: HeatCell): { bg: string; fg: string; pending: number } {
  const pending = cell.need - cell.decided;
  if (cell.na || cell.total === 0) return { bg: '#f5f5f5', fg: '#737373', pending: 0 };
  if (cell.unique > 0) return { bg: '#fecaca', fg: '#7f1d1d', pending };
  if (cell.similar > 0) return { bg: '#fde68a', fg: '#78350f', pending };
  return { bg: '#bbf7d0', fg: '#14532d', pending };
}

function cellTitle(cell: HeatCell): string {
  const pending = cell.need - cell.decided;
  return (
    `${cell.total} elements — ${cell.common} common · ${cell.similar} similar · ${cell.unique} unique` +
    ` · ${pending > 0 ? `${pending} still to decide` : 'no decisions outstanding'} — open the review list`
  );
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
      <div style={{ fontSize: 20, fontWeight: 700, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginTop: 2 }}>{label}</div>
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
  onImmersive,
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
  /** Mirrors table scroll depth so the board can hide ITS chrome too. */
  onImmersive?: (deep: boolean) => void;
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
  // Collapse product names to initials — the full name pops on hover (title).
  const [abbr, setAbbr] = useViewState<boolean>('workspace.product.abbrCols', true);
  const labelOf = (v: (typeof heat.columns)[number]) =>
    abbr ? abbrevVersion(v) : `${v.productName} · ${v.name}`;
  // Table scrolled away from the top → every chrome row hides (restored the
  // moment the user scrolls back up).
  const [immersive, setImmersive] = useState(false);
  const setDepth = (deep: boolean) => {
    setImmersive((cur) => {
      if (cur !== deep) onImmersive?.(deep);
      return deep;
    });
  };
  // Direction-based with hysteresis: hide only after a real downward scroll,
  // reappear after ~24px of deliberate upward scroll (or near the top). A bare
  // position threshold jitters because hiding the chrome itself reflows the
  // scroller and can swallow the show/hide transitions.
  const scrollMem = useRef({ y: 0, up: 0 });
  const handleScrollDepth = (y: number, overflow = Infinity) => {
    const m = scrollMem.current;
    const dy = y - m.y;
    m.y = y;
    // Only a real downward move resets the upward accumulator — zero-delta
    // events (layout reflow, scroll anchoring) must not break a slow up-drag.
    if (dy < 0) m.up -= dy;
    else if (dy > 0) m.up = 0;
    if (y < 8 || m.up > 24) setDepth(false);
    // Hide the chrome only when there is substantially more to scroll than
    // the chrome itself is tall. On short windows with a small overflow,
    // hiding the chrome makes the content FIT, the browser clamps scrollTop
    // back to 0, the chrome pops back — an oscillation that reads as "the
    // page won't scroll". The guard keeps the chrome put in that regime.
    else if (dy > 0 && y > 60 && overflow > 240) setDepth(true);
  };

  const drillRow =
    drill && drill !== '__all__' ? (heat.rows.find((r) => r.component === drill) ?? null) : null;
  const allReviewRows = useMemo(() => heat.rows.flatMap((r) => r.reviewRows), [heat]);

  const pending = heat.totals.need - heat.totals.decided;
  const colCount = heat.columns.length;
  const pctOfTotal = (n: number) =>
    heat.totals.total === 0 ? 0 : Math.round((n / heat.totals.total) * 100);
  // Density steps: slightly richer cells while the scope is small, bare counts
  // at scale — but always FIXED widths (never minmax/1fr): a 2-product scope
  // renders the same compact cells as a 26-product one instead of stretching.
  const density: 'rich' | 'medium' | 'tiny' =
    colCount <= 8 ? 'rich' : colCount <= 18 ? 'medium' : 'tiny';
  const colW = density === 'rich' ? 104 : density === 'medium' ? 68 : 48;
  const notesW = notesOpen ? 220 : 44;
  const grid = `250px repeat(${colCount}, ${colW}px) 22px 76px 84px 128px ${notesW}px`;
  // The header is exactly tall enough for the LONGEST angled label — every
  // label fully visible, nothing spilling out of the header band.
  const maxLabelChars = heat.columns.reduce((n, v) => Math.max(n, labelOf(v).length), 0);
  // 6.6px/char is deliberately generous for the 11px label font — labels must
  // never ellipsize unless the 400px hard cap is hit.
  const headerH = Math.min(400, Math.max(96, Math.round(maxLabelChars * 6.6 * 0.79) + 34));

  const openDrill = (component: string, filter: ReviewFilter) => {
    setDrillFilter(filter);
    setDepth(false);
    setDrill(component);
  };

  // Stats for the open drill — the DRILLED component's own numbers when one
  // is open, the whole scope's when reviewing everything. Rendered by the
  // review list directly under its toolbar as one organized band.
  const scope = drillRow ?? heat.totals;
  const scopePct = drillRow ? drillRow.pct : heat.totals.pct;
  const scopePending = scope.need - scope.decided;
  const statPill = (
    label: string,
    fg: string,
    bg: string,
    border: string,
    f: ReviewFilter,
  ): JSX.Element => (
    <button
      key={label}
      type="button"
      onClick={() => openDrill(drill ?? '__all__', f)}
      title="filter the list"
      style={{
        font: 'inherit',
        fontSize: 11.5,
        fontWeight: 700,
        color: fg,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: '2px 10px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
  const statsBand = immersive ? null : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        borderBottom: '1px solid #eaeaea',
        background: '#fafafa',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#171717', whiteSpace: 'nowrap' }}>
        {colCount} products
      </span>
      <span style={{ color: '#9ca3af' }}>·</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#171717', whiteSpace: 'nowrap' }}>
        {scope.total} elements
      </span>
      <span style={{ width: 1, height: 16, background: '#d4d4d4', margin: '0 4px' }} />
      {statPill(
        `${scope.common} common`,
        MATCH_META.COMMON.fg,
        MATCH_META.COMMON.bg,
        MATCH_META.COMMON.border,
        'auto',
      )}
      {statPill(
        `${scope.similar} similar`,
        MATCH_META.PARTIAL.fg,
        MATCH_META.PARTIAL.bg,
        MATCH_META.PARTIAL.border,
        'similar',
      )}
      {statPill(
        `${scope.unique} unique`,
        MATCH_META.UNIQUE.fg,
        MATCH_META.UNIQUE.bg,
        MATCH_META.UNIQUE.border,
        'unique',
      )}
      <span style={{ width: 1, height: 16, background: '#d4d4d4', margin: '0 4px' }} />
      {statPill(
        `${scopePending} to decide`,
        scopePending > 0 ? '#92400e' : '#166534',
        scopePending > 0 ? '#fef3c7' : '#dcfce7',
        scopePending > 0 ? '#fcd34d' : '#86efac',
        'pending',
      )}
      {statPill(`${scope.decided} decided`, '#3730a3', '#eef2ff', '#d6dcff', 'decided')}
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: 140,
          flexShrink: 0,
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
            width: `${scopePct}%`,
            background: scopePct >= 100 ? '#16a34a' : scopePct > 0 ? '#f59e0b' : '#dc2626',
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>
        {scopePct}% complete
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* (1) Executive dashboard — pinned like a frozen header row. Hidden
          while a review list is open (the list carries the stats band) and
          once the table scrolls (back at the top it returns). */}
      {immersive || drill ? null : (
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
          <StatTile label="products in scope" value={String(colCount)} tone="#171717" />
          <StatTile
            label={`coverage elements across ${heat.rows.length} sections`}
            value={String(heat.totals.total)}
            tone="#171717"
            onClick={() => openDrill('__all__', 'all')}
          />
          <StatTile
            label={`common — in every product (${heat.totals.common})`}
            value={`${pctOfTotal(heat.totals.common)}%`}
            tone={MATCH_META.COMMON.fg}
            onClick={() => openDrill('__all__', 'auto')}
          />
          <StatTile
            label={`similar — configured differently (${heat.totals.similar})`}
            value={`${pctOfTotal(heat.totals.similar)}%`}
            tone={MATCH_META.PARTIAL.fg}
            onClick={() => openDrill('__all__', 'similar')}
          />
          <StatTile
            label={`unique — in 1–2 products (${heat.totals.unique})`}
            value={`${pctOfTotal(heat.totals.unique)}%`}
            tone={MATCH_META.UNIQUE.fg}
            onClick={() => openDrill('__all__', 'unique')}
          />
          <StatTile
            label="decisions required"
            value={String(pending)}
            tone={pending > 0 ? '#b45309' : '#16a34a'}
            onClick={() => openDrill('__all__', 'pending')}
          />
          <StatTile
            label={`normalization — ${heat.totals.decided} of ${heat.totals.need} decisions made`}
            value={`${heat.totals.pct}%`}
            tone={heat.totals.pct >= 100 ? '#16a34a' : heat.totals.pct > 0 ? '#f59e0b' : '#dc2626'}
            bar={heat.totals.pct}
          />
        </div>
      )}

      {drill ? (
        <ProductReviewList
          // Keyed by drill + filter so a stats-pill click re-arms the filter.
          key={`${drill}|${drillFilter}`}
          title={drillRow ? drillRow.component : 'Every model element in scope'}
          columns={heat.columns}
          rows={drillRow ? drillRow.reviewRows : allReviewRows}
          defaultFilter={drillFilter}
          stats={statsBand}
          onBack={() => {
            setDepth(false);
            setDrill(null);
          }}
          onDecide={(row, status, comment) =>
            onDecide(row.lobId, row.group.component, row.group.key, status, comment)
          }
          onScrollDepth={handleScrollDepth}
          labelOf={labelOf}
          abbr={abbr}
          onToggleAbbr={() => setAbbr((a) => !a)}
        />
      ) : (
        <>
          {/* (2) The heatmap — products angled across the top, components down the side. */}
          <div
            style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}
            onScroll={(e) =>
              handleScrollDepth(
                e.currentTarget.scrollTop,
                e.currentTarget.scrollHeight - e.currentTarget.clientHeight,
              )
            }
          >
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
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#374151',
                    alignSelf: 'end',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>Model component</span>
                  <button
                    type="button"
                    onClick={() => setAbbr((a) => !a)}
                    title={
                      abbr
                        ? 'show full product names'
                        : 'collapse product names to initials — hover a column for the full name'
                    }
                    style={{
                      font: 'inherit',
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      color: abbr ? '#fff' : '#525252',
                      background: abbr ? '#171717' : '#fff',
                      border: '1px solid #d4d4d4',
                      borderRadius: 5,
                      padding: '2px 7px',
                      cursor: 'pointer',
                    }}
                  >
                    {abbr ? '⌄' : '⌃'}
                  </button>
                </div>
                {heat.columns.map((v) => (
                  <div
                    key={v.id}
                    title={`${v.segmentName} › ${v.lobName} › ${v.productName} · ${v.name}`}
                    style={{
                      height: headerH,
                      position: 'relative',
                      overflow: 'visible',
                    }}
                  >
                    {/* Divider parallel with the labels. */}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: Math.round(headerH / 0.788),
                        height: 1,
                        background: '#dbe1e8',
                        transformOrigin: 'left bottom',
                        transform: 'rotate(-52deg)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        // One line over: rise from the column's RIGHT divider
                        // so the text hangs over its own column of cells.
                        left: 'calc(100% + 4px)',
                        transformOrigin: 'left bottom',
                        transform: 'rotate(-52deg)',
                        whiteSpace: 'nowrap',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#262626',
                        // Clamp only when the header hit its hard cap — below
                        // it, headerH is sized so every label fits in full.
                        ...(headerH >= 400
                          ? {
                              maxWidth: Math.round((headerH - 18) / 0.79),
                              overflow: 'hidden' as const,
                              textOverflow: 'ellipsis' as const,
                            }
                          : null),
                      }}
                    >
                      {labelOf(v)}
                    </span>
                  </div>
                ))}
                <span aria-hidden style={{ alignSelf: 'end' }} />
                {/* Solid chips ABOVE the angled labels so a leaning product
                    name can never run over these headings. */}
                {['Elements', 'To decide', 'Progress'].map((h) => (
                  <div
                    key={h}
                    style={{
                      padding: '8px 10px',
                      borderLeft: '1px solid #e2e8f0',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#374151',
                      textAlign: h === 'Progress' ? 'left' : 'center',
                      alignSelf: 'end',
                      position: 'relative',
                      zIndex: 2,
                      background: '#fafafa',
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
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#171717',
                            lineHeight: 1.25,
                          }}
                        >
                          {row.component}
                        </span>
                        {/* Coverage counts for the section — the same traffic
                            light the cells use, so the row reads at a glance. */}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            fontWeight: 600,
                            marginTop: 1,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span style={{ color: MATCH_META.COMMON.fg }}>{row.common} common</span>
                          <span style={{ color: '#9ca3af' }}> · </span>
                          <span style={{ color: MATCH_META.PARTIAL.fg }}>
                            {row.similar} similar
                          </span>
                          <span style={{ color: '#9ca3af' }}> · </span>
                          <span style={{ color: MATCH_META.UNIQUE.fg }}>{row.unique} unique</span>
                        </span>
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
                          title={na ? 'not in this product' : cellTitle(c)}
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
                              <span style={{ fontSize: 11, fontWeight: 700 }}>—</span>
                            ) : density === 'rich' ? (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>
                                  {vis.pending === 0 ? '✓' : vis.pending}
                                </span>
                                <span style={{ fontSize: 9.5, fontWeight: 600 }}>
                                  {vis.pending === 0
                                    ? `${c.total} elements in`
                                    : `to decide of ${c.total}`}
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
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#262626',
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
              fontSize: 11.5,
              color: '#374151',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <span>
              cells: <span style={{ color: MATCH_META.COMMON.fg, fontWeight: 600 }}>■ common</span>{' '}
              — in every product ·{' '}
              <span style={{ color: MATCH_META.PARTIAL.fg, fontWeight: 600 }}>■ similar</span> —
              configured differently ·{' '}
              <span style={{ color: MATCH_META.UNIQUE.fg, fontWeight: 600 }}>■ unique</span> — in
              1–2 products
            </span>
          </div>
        </>
      )}
    </div>
  );
}
