import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingState } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import { versionPlaceLabel } from '../../../lib/usStates';
import { useViewState } from '../../../lib/viewState';
import ProductReviewList, { type ReviewFilter } from './ProductReviewList';
import { columnLabel, type BoardColumn, type BoardPayload, type ReviewPayload } from './boardApi';
import ComponentElementRows from './ComponentElementRows';
import FormsSection from './FormsSection';
import GoalBanner from './GoalBanner';
import { SectionBand } from './gridRow';
import { MATCH_META, type ProductDecisionStatus } from './spine';

// The Products workspace GRID — the progress board, FORMS-FIRST (Form
// rationalization design), rendered from the SERVER-DERIVED board payload:
//   (1) an executive dashboard pinned on top: total coverages, items needing a
//       decision, decided, % complete — each stat drills into the filtered
//       review list;
//   (2) the transposed heatmap below in two sections sharing one grid:
//       FORMS first — the three-layer register (state-required variations
//       aggregate to one row per LOB at scale) — then the other model
//       components. Columns are versions while the scope is small and FOLD to
//       one per product past 48 versions (the server picks; `members` carries
//       the fold count);
//   (3) any click lands on the drill-down review list, fetched LAZILY from
//       /product-spine/review — one drill's rows, capped server-side. The
//       drill lives in the URL (?pmDrill=…) so the browser back button pops it.

const DRILL_PARAM = 'pmDrill';
/** Forms drills are namespaced so they can't collide with component names. */
const FORMS_DRILL = 'forms:';

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

/** Small debounce so the review drill doesn't refetch per keystroke. */
function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ProductGridView({
  board,
  scopeQS,
  onDecide,
  search = '',
  chromeHidden = false,
  onDeepScroll,
}: {
  board: BoardPayload;
  /** The scope + nonce query string — review drills refetch on the same key. */
  scopeQS: string;
  /** status null = withdraw the decision (undo). */
  onDecide: (
    lobId: string,
    component: string,
    groupKey: string,
    status: ProductDecisionStatus | null,
    comment?: string,
  ) => Promise<void>;
  /** Free-text search from the spine filter bar — narrows the register rows
   *  and the drill review list. */
  search?: string;
  /** True while the board chrome (lens tabs + filter bar) is scroll-hidden —
   *  the dashboard strip and legend hide with it so only the table shows. */
  chromeHidden?: boolean;
  /** Deep grid scroll → true (hide the chrome); back at the top → false. */
  onDeepScroll?: (hidden: boolean) => void;
}) {
  const heat = board.heat;
  const columns = board.columns;
  const fullModel = board.forms;
  // The filter-bar search narrows the register (form label/sub match) and the
  // components below (name match); the drill list filters server-side.
  const q = search.trim().toLowerCase();
  const model = useMemo(() => {
    if (!fullModel || !q) return fullModel;
    return {
      ...fullModel,
      sections: fullModel.sections.map((s) => ({
        ...s,
        rows: s.rows.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            (r.sub ?? '').toLowerCase().includes(q) ||
            r.lobName.toLowerCase().includes(q),
        ),
      })),
    };
  }, [fullModel, q]);
  const otherRows = useMemo(() => {
    const rows = model ? heat.rows.filter((r) => !board.rolledUp.includes(r.component)) : heat.rows;
    return q ? rows.filter((r) => r.component.toLowerCase().includes(q)) : rows;
  }, [heat, model, q, board.rolledUp]);
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
  const labelOf = (v: BoardColumn) => columnLabel(v, abbr);
  // The FORMS register collapses behind its band; each model component row
  // expands to its element table (fetched lazily), the way forms list theirs.
  const [formsCollapsed, setFormsCollapsed] = useViewState<boolean>(
    'workspace.product.formsCollapsed',
    false,
  );
  const [openComponents, setOpenComponents] = useViewState<Record<string, boolean>>(
    'workspace.product.openComponents',
    {},
  );

  // LAZY drill fetch — one drill's review rows, search filtered server-side.
  const debouncedQ = useDebounced(search.trim(), 250);
  const reviewUrl = drill
    ? `/product-spine/review?${scopeQS}&drill=${encodeURIComponent(drill)}${
        debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ''
      }`
    : null;
  const {
    data: review,
    loading: reviewLoading,
    error: reviewError,
  } = useApi<ReviewPayload>(reviewUrl);

  // The dashboard tiles collapse behind a chevron (persisted per view) so the
  // table can take the full height.
  const [tilesCollapsed, setTilesCollapsed] = useViewState<boolean>(
    'workspace.product.tilesCollapsed',
    false,
  );

  // Scrolling down hides everything but the table (the parent hides the lens
  // tabs + filter bar, this view hides the strip + legend) and SNAPS the grid
  // back to its first row, so the maximized table reads from the top. The
  // overflow guard skips barely-overflowing grids. Restore: wheel up while
  // already at the top, or the header button.
  const onGridScroll = (el: HTMLElement) => {
    if (chromeHidden) return;
    const overflow = el.scrollHeight - el.clientHeight;
    if (el.scrollTop > 0 && overflow > 240) {
      onDeepScroll?.(true);
      el.scrollTop = 0;
    }
  };
  const onGridWheel = (el: HTMLElement, deltaY: number) => {
    if (chromeHidden && deltaY < 0 && el.scrollTop === 0) onDeepScroll?.(false);
  };
  // An open drill replaces the grid scroller — bring the chrome back.
  useEffect(() => {
    if (drill) onDeepScroll?.(false);
  }, [drill, onDeepScroll]);

  const pending = heat.totals.need - heat.totals.decided;
  const colCount = columns.length;
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
  // label fully visible, nothing spilling out of the header band. The fold
  // count suffix ("(10)") leans with the label, so it counts too.
  const maxLabelChars = columns.reduce(
    (n, v) => Math.max(n, labelOf(v).length + (v.members > 1 ? ` (${v.members})`.length : 0)),
    0,
  );
  // 6.6px/char is deliberately generous for the 11px label font — labels must
  // never ellipsize unless the 400px hard cap is hit. The floor is just tall
  // enough for the Coverage/To decide/Progress chips — short labels waste no
  // vertical space.
  const headerH = Math.min(400, Math.max(64, Math.round(maxLabelChars * 6.6 * 0.79) + 34));

  const openDrill = (component: string, filter: ReviewFilter) => {
    setDrillFilter(filter);
    setDrill(component);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* (0) North-star strip — the end goal every decision moves toward. */}
      {!drill && !chromeHidden && (
        <GoalBanner
          scopeLabel={`${colCount} ${board.columnMode === 'product' ? 'products' : 'versions'} in scope`}
          decided={heat.totals.decided}
          need={heat.totals.need}
          pct={heat.totals.pct}
        />
      )}
      {/* (1) Executive dashboard — pinned like a frozen header row. Hidden
          while a review list is open; the chevron collapses it to a slim
          summary strip so the table gets the full height. */}
      {drill || chromeHidden ? null : tilesCollapsed ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '3px 14px',
            borderBottom: '1px solid #eaeaea',
            background: '#fafafa',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setTilesCollapsed(false)}
            title="expand the dashboard tiles"
            style={{
              font: 'inherit',
              border: 'none',
              background: 'transparent',
              padding: '2px 4px',
              fontSize: 12,
              color: '#525252',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ▾
          </button>
          <span style={{ fontSize: 11.5, color: '#525252', whiteSpace: 'nowrap' }}>
            {colCount} {board.columnMode === 'product' ? 'products' : 'versions'} ·{' '}
            {heat.totals.total} coverages · {pending} decisions pending · {heat.totals.pct}%
            normalized
          </span>
        </div>
      ) : (
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
            label={
              board.columnMode === 'product'
                ? `products in scope (${board.scopedVersions} versions)`
                : 'versions in scope'
            }
            value={String(colCount)}
            tone="#171717"
          />
          <StatTile
            label={`coverages across ${heat.rows.length} sections`}
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
            label={`similar — in over half, configured differently (${heat.totals.similar})`}
            value={`${pctOfTotal(heat.totals.similar)}%`}
            tone={MATCH_META.PARTIAL.fg}
            onClick={() => openDrill('__all__', 'similar')}
          />
          <StatTile
            label={`unique — in half or fewer products (${heat.totals.unique})`}
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
          <button
            type="button"
            onClick={() => setTilesCollapsed(true)}
            title="collapse the dashboard tiles"
            style={{
              font: 'inherit',
              border: 'none',
              background: 'transparent',
              padding: '0 2px',
              fontSize: 12,
              color: '#525252',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              lineHeight: 1,
            }}
          >
            ▴
          </button>
        </div>
      )}

      {drill ? (
        reviewError ? (
          <LoadingState message="That view is no longer available — returning to the board…" />
        ) : !review ? (
          <LoadingState message={reviewLoading ? 'Loading the review list…' : 'Preparing…'} />
        ) : (
          <>
            {review.truncated > 0 && (
              <div
                style={{
                  padding: '6px 14px',
                  background: '#fffbeb',
                  borderBottom: '1px solid #fde68a',
                  fontSize: 11.5,
                  color: '#92400e',
                  flexShrink: 0,
                }}
              >
                Showing the first {review.rows.length.toLocaleString()} of{' '}
                {review.total.toLocaleString()} rows — narrow the scope or search to see the rest.
              </div>
            )}
            <ProductReviewList
              // Keyed by drill + filter so a stats-pill click re-arms the filter.
              key={`${drill}|${drillFilter}`}
              columns={review.columns}
              rows={review.rows}
              mandates={review.mandates}
              selfRow={review.self ?? null}
              defaultFilter={drillFilter}
              completePct={review.pct}
              search={search}
              onDecide={(row, status, comment) =>
                onDecide(row.lobId, row.group.component, row.group.key, status, comment)
              }
              labelOf={labelOf}
              abbr={abbr}
              onToggleAbbr={() => setAbbr((a) => !a)}
              // Forms drills band the list by what the form contains (anything
              // beyond coverages groups like the register sections).
              groupOf={review.groupOf}
              groupOrder={review.groupOrder}
              chromeHidden={chromeHidden}
              onDeepScroll={onDeepScroll}
            />
          </>
        )
      ) : (
        <>
          {/* (2) The heatmap — products angled across the top, components down the side. */}
          <div
            style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}
            onScroll={(e) => onGridScroll(e.currentTarget)}
            onWheel={(e) => onGridWheel(e.currentTarget, e.deltaY)}
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
                  <span>Products</span>
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
                  {chromeHidden && (
                    <button
                      type="button"
                      onClick={() => onDeepScroll?.(false)}
                      title="show the filters and dashboard again"
                      style={{
                        font: 'inherit',
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: '#525252',
                        background: '#fff',
                        border: '1px solid #d4d4d4',
                        borderRadius: 5,
                        padding: '2px 7px',
                        cursor: 'pointer',
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ▾ filters
                    </button>
                  )}
                </div>
                {columns.map((v) => (
                  <div
                    key={v.id}
                    title={
                      v.members > 1
                        ? `${v.segmentName} › ${v.lobName} › ${v.productName} — ${v.members} versions`
                        : `${v.segmentName} › ${v.lobName} › ${v.productName} · ${versionPlaceLabel(v.name)}`
                    }
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
                        // Rise from the column's CENTER so the angled name
                        // reads centered over its own column of cells.
                        left: '50%',
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
                      {v.members > 1 ? ` (${v.members})` : ''}
                    </span>
                  </div>
                ))}
                <span aria-hidden style={{ alignSelf: 'end' }} />
                {/* Solid chips ABOVE the angled labels so a leaning product
                    name can never run over these headings. */}
                {['Coverages', 'To decide', 'Progress'].map((h) => (
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

              {/* FORMS-FIRST: the forms register leads the table (core
                  national / state-required / product-specific sections) —
                  state-required variations aggregate one row per LOB; every
                  remaining component stays a plain row below. */}
              {model && (
                <SectionBand
                  label="Forms"
                  detail={`${model.counts.core} countrywide · ${model.counts.state} state-required · ${model.counts.product} product-specific — open a form for its coverages, coverage parts, endorsements and clauses`}
                  collapsed={formsCollapsed}
                  onToggle={() => setFormsCollapsed((c) => !c)}
                />
              )}
              {model && !formsCollapsed && (
                <FormsSection
                  model={model}
                  columns={columns}
                  grid={grid}
                  density={density}
                  notesOpen={notesOpen}
                  onOpenDrill={(rowKey) => openDrill(`${FORMS_DRILL}${rowKey}`, 'all')}
                />
              )}
              {/* Every remaining model component gets its own collapsible band
                  — Rating, Pricing, … through Lifecycle — with its element
                  table beneath it, exactly like the forms register. */}
              {otherRows.map((row) => {
                const open = Boolean(openComponents[row.component]);
                const pending = row.need - row.decided;
                return (
                  <div key={row.component} style={{ display: 'contents' }}>
                    <SectionBand
                      label={row.component}
                      detail={`${row.total} coverages · ${row.common} common · ${row.similar} similar · ${row.unique} unique${
                        pending > 0 ? ` · ${pending} to decide` : ''
                      } — ${row.pct}% decided`}
                      collapsed={!open}
                      onToggle={() =>
                        setOpenComponents((o) => ({ ...o, [row.component]: !o[row.component] }))
                      }
                    />
                    {open && (
                      <ComponentElementRows
                        component={row.component}
                        scopeQS={scopeQS}
                        grid={grid}
                        density={density}
                        columns={columns}
                        notesOpen={notesOpen}
                        onOpen={() => openDrill(row.component, 'all')}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!chromeHidden && (
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
                cells:{' '}
                <span style={{ color: MATCH_META.COMMON.fg, fontWeight: 600 }}>■ common</span> — in
                every product ·{' '}
                <span style={{ color: MATCH_META.PARTIAL.fg, fontWeight: 600 }}>■ similar</span> —
                configured differently ·{' '}
                <span style={{ color: MATCH_META.UNIQUE.fg, fontWeight: 600 }}>■ unique</span> — in
                1–2 products
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
