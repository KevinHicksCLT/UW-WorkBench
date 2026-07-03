import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card, EmptyState, LinkButton, LoadingState } from './ui';
import {
  HeaderComboFilter,
  HeaderLabel,
  ListSearch,
  SortToggle,
  type Sort,
} from './sheet/headerControls';
import { useSheetColumns } from './sheet/useSheetColumns';
import { ColumnPicker } from './sheet/ColumnPicker';
import { HeaderDnd, SortableHeaderCell } from './sheet/SheetHeaderCell';

// HeaderComboFilter/ListSearch moved to sheet/headerControls.tsx (file-size
// budget); re-exported so the Value Streams / Organization explorers keep
// importing them from here.
export { HeaderComboFilter, ListSearch } from './sheet/headerControls';

// Sheet — the canonical spreadsheet list view (extracted from the Value
// Streams / Organization list explorers so every list tab shares the EXACT
// same format): a flat grid sheet inside a flush card, a sticky header row
// where each column hosts a searchable combobox filter + sort toggle,
// Excel-style cascading options (each dropdown lists the distinct values among
// rows passing the OTHER filters; invalidated picks auto-clear), and a slim
// totals strip above with a blue "Clear filters" link.
//
// Column config drives everything:
//   value(r)  — the string used for filtering/sorting/display (omit for a
//               label-only column with no filter or sort, e.g. Description)
//   values(r) — multi-valued alternative (row matches if ANY value matches)
//   render(r) — custom cell content (links, pills, chips); wrapper stays the
//               canonical dense cell
//   expand(r) — optional: row click toggles an expansion panel underneath

export type SheetCol<R> = {
  key: string;
  label: string;
  width: string; // CSS grid track, e.g. '170px' or 'minmax(0,1fr)'
  value?: (r: R) => string;
  values?: (r: R) => string[];
  render?: (r: R) => React.ReactNode;
  sortable?: boolean; // default: has value/values
  filterable?: boolean; // default: has value/values
  dim?: boolean;
  hint?: string; // header tooltip (title) — spell out acronyms like APCD/SBS
  align?: 'left' | 'center' | 'right'; // header + cell horizontal alignment (default left)
  hideable?: boolean; // default true — key/title columns opt out with false
  minPx?: number; // resize floor in px (default 60)
};

// One spreadsheet cell. Clickable cells underline on hover and stopPropagation
// so a cell-level action doesn't also fire the row's default click.
export function SheetCell({
  text,
  onClick,
  dim,
  title,
}: {
  text: string;
  onClick?: () => void;
  dim?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={
        'truncate text-[12px] ' +
        (dim ? 'text-[#737373]' : 'text-[#171717]') +
        (onClick ? ' cursor-pointer hover:underline' : '')
      }
    >
      {text}
    </span>
  );
}

export function Sheet<R>({
  rows,
  cols,
  rowKey,
  defaultSort,
  defaultFilters,
  summarize,
  unit,
  loading,
  emptyText,
  onRowClick,
  expand,
  selectedKey,
  scrollToKey,
  leading,
  stickyStrip,
  sheetKey,
}: {
  rows: R[];
  cols: SheetCol<R>[];
  rowKey: (r: R) => string;
  // Opt-in per-user column personalization (hide/show, drag reorder, width
  // resize) persisted server-side under `sheet.columns.<sheetKey>`. Absent →
  // behavior is identical to a non-personalized sheet.
  sheetKey?: string;
  defaultSort?: Sort;
  defaultFilters?: Record<string, string>;
  // Extra entity totals for the strip (e.g. "13 areas · 96 categories"); the
  // row count is always appended.
  summarize?: (visible: R[]) => string;
  // Noun for the appended row count (e.g. "tasks", "deliverables"); default "rows".
  unit?: string;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (r: R) => void;
  expand?: (r: R) => React.ReactNode;
  selectedKey?: string | null;
  scrollToKey?: string | null;
  // Rendered at the start of the totals strip (e.g. a List|Drilldown view
  // toggle) so pages can share one compact row instead of stacking headers.
  leading?: React.ReactNode;
  // Pin the totals/leading strip to the top of the scroll area (with the column
  // header stacking just below it) so both stay visible while scrolling.
  stickyStrip?: boolean;
}) {
  const filterCols = cols.filter((c) => c.filterable ?? !!(c.value || c.values));
  // Per-column multi-selection; [] = All (no filter on that column).
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const c of filterCols) {
      const d = defaultFilters?.[c.key];
      init[c.key] = d && d !== 'All' ? [d] : [];
    }
    return init;
  });
  const firstSortable = cols.find((c) => c.sortable ?? !!(c.value || c.values));
  const [sort, setSort] = useState<Sort>(defaultSort ?? { col: firstSortable?.key ?? '', dir: 1 });
  const [expanded, setExpanded] = useState<string | null>(null);
  // Free-text search across every column with a value (complements the per-
  // column combobox filters; narrows the visible rows only, not the dropdowns).
  const [search, setSearch] = useState('');

  const colByKey = useMemo(() => new Map(cols.map((c) => [c.key, c])), [cols]);
  const valOf = (c: SheetCol<R>, r: R): string[] =>
    c.values ? c.values(r) : c.value ? [c.value(r)] : [];

  // A row passes the filters; `skip` exempts one column so each combobox can
  // list the distinct values among rows passing the OTHER filters (Excel-style).
  const matches = (r: R, skip?: string) =>
    filterCols.every((c) => {
      if (c.key === skip) return true;
      const picked = sel[c.key] ?? [];
      if (picked.length === 0) return true;
      const vals = valOf(c, r);
      return picked.some((p) => vals.includes(p));
    });

  const optionList = (vals: Iterable<string>) => [
    'All',
    ...[...new Set([...vals].filter(Boolean))].sort(),
  ];
  const optionsByCol = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of filterCols)
      out[c.key] = optionList(rows.filter((r) => matches(r, c.key)).flatMap((r) => valOf(c, r)));
    return out;
  }, [rows, sel, cols]);

  // A pick can be invalidated by a later pick in another column — drop it.
  // (Skip while rows are still loading, so defaultFilters survive the empty state.)
  useEffect(() => {
    if (!rows.length) return;
    for (const c of filterCols) {
      const picked = sel[c.key] ?? [];
      const kept = picked.filter((p) => optionsByCol[c.key]?.includes(p));
      if (kept.length !== picked.length) setSel((p) => ({ ...p, [c.key]: kept }));
    }
  }, [optionsByCol]);

  const needle = search.trim().toLowerCase();
  const searchMatch = (r: R) =>
    !needle ||
    cols.some(
      (c) => (c.value || c.values) && valOf(c, r).some((v) => v.toLowerCase().includes(needle)),
    );

  const visible = useMemo(() => {
    const list = rows.filter((r) => matches(r) && searchMatch(r));
    const sc = colByKey.get(sort.col);
    if (!sc) return list;
    const get = (r: R) => valOf(sc, r).join(', ');
    return [...list].sort((a, b) => {
      const va = get(a),
        vb = get(b);
      // Empty cells always trail, regardless of direction.
      if (!va && vb) return 1;
      if (!vb && va) return -1;
      return va.localeCompare(vb, undefined, { numeric: true }) * sort.dir;
    });
  }, [rows, sel, sort, colByKey, needle]);

  const anyFilter = filterCols.some((c) => (sel[c.key] ?? []).length > 0) || !!needle;
  const clear = () => {
    const init: Record<string, string[]> = {};
    for (const c of filterCols) init[c.key] = [];
    setSel(init);
    setSearch('');
  };
  const toggleSort = (col: string) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  // Per-user column personalization: effective (ordered/visible/resized)
  // columns for RENDERING only — filtering, sorting and search stay on the
  // declared `cols` so hidden columns keep their semantics. Without a
  // sheetKey this passes the declared columns straight through.
  const colState = useSheetColumns(sheetKey, cols);
  const effCols = colState.cols;

  // Header + rows share one grid template (width previews update it live).
  const gridCols = useMemo(() => ({ gridTemplateColumns: colState.template }), [colState.template]);

  // ── Row virtualization (variable height) ──────────────────────────────────────
  // Sheets can be thousands of rows (e.g. ~3,800 tasks); rendering them all at
  // once floods the DOM and hangs/crashes the tab. Rows are NOT a fixed height
  // (chips and long titles wrap), so we measure each rendered row by its stable
  // key and window off a measured-offset model, padding above/below. The Sheet
  // doesn't own its scroller (the sticky header pins to a parent <main> with
  // overflow-auto), so we find that scroll ancestor and measure off rects. Each
  // rendered row's markup is unchanged, so the sheet looks identical. The single
  // expandable row (`expand`) folds its measured panel height into the offsets.
  const rowsWrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [rel, setRel] = useState(0); // px the rows-area top is scrolled above the viewport
  const [viewH, setViewH] = useState(0);
  const [panelH, setPanelH] = useState(0);
  const heights = useRef<Map<string, number>>(new Map());
  const [measureTick, setMeasureTick] = useState(0);
  const EST_ROW_H = 30; // estimate for not-yet-measured rows
  const OVERSCAN = 12;

  // Any change to the effective column signature (order/hidden/widths) changes
  // how cell content wraps, so every cached row height is stale — clear the
  // cache and bump the tick or the window misplaces rows.
  const colSigRef = useRef(colState.signature);
  useLayoutEffect(() => {
    if (colSigRef.current === colState.signature) return;
    colSigRef.current = colState.signature;
    heights.current.clear();
    setMeasureTick((t) => t + 1);
  }, [colState.signature]);

  // Measure each row by its stable key. A row's content is fixed, so its height
  // is stable once measured — the tick settles and there is no feedback loop.
  // (The old single `rowH` sample thrashed as the windowed first row changed on
  // fast scroll, blowing past React's update depth and white-screening the tab.)
  const measureRow = (key: string) => (el: HTMLDivElement | null) => {
    if (!el || !el.offsetHeight) return;
    const prev = heights.current.get(key);
    if (prev === undefined || Math.abs(prev - el.offsetHeight) > 0.5) {
      heights.current.set(key, el.offsetHeight);
      setMeasureTick((t) => t + 1);
    }
  };
  const measurePanel = (el: HTMLDivElement | null) => {
    if (el && el.offsetHeight && Math.abs(el.offsetHeight - panelH) > 0.5)
      setPanelH(el.offsetHeight);
  };

  const N = visible.length;
  // Cumulative top offset of each visible row (measured height where known, else
  // an estimate), with the expanded panel folded in after its row.
  const offsets = useMemo(() => {
    const off = new Array<number>(N + 1);
    off[0] = 0;
    for (let i = 0; i < N; i++) {
      const k = rowKey(visible[i]);
      off[i + 1] = off[i] + (heights.current.get(k) ?? EST_ROW_H) + (k === expanded ? panelH : 0);
    }
    return off;
  }, [visible, expanded, panelH, measureTick]);
  const total = offsets[N];

  useLayoutEffect(() => {
    const rw = rowsWrapRef.current;
    if (!rw) return;
    let p: HTMLElement | null = rw.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      p = p.parentElement;
    }
    const scroller = p;
    scrollerRef.current = scroller;
    const recompute = () => {
      const rwTop = rowsWrapRef.current?.getBoundingClientRect().top ?? 0;
      if (scroller) {
        const c = scroller.getBoundingClientRect();
        setRel(Math.max(0, c.top - rwTop));
        setViewH(scroller.clientHeight);
      } else {
        setRel(Math.max(0, -rwTop));
        setViewH(window.innerHeight);
      }
    };
    recompute();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        recompute();
      });
    };
    const target: Window | HTMLElement = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [loading, visible.length === 0]);

  // Filtering/expanding changes total height while scrolled; the browser clamps
  // the scroller but no scroll event fires, leaving rel stale (→ a blank window).
  // Recompute rel/viewH off live rects whenever the list or total height changes.
  useLayoutEffect(() => {
    const rw = rowsWrapRef.current;
    if (!rw) return;
    const scroller = scrollerRef.current;
    const rwTop = rw.getBoundingClientRect().top;
    if (scroller) {
      const c = scroller.getBoundingClientRect();
      setRel(Math.max(0, c.top - rwTop));
      setViewH(scroller.clientHeight);
    } else {
      setRel(Math.max(0, -rwTop));
      setViewH(window.innerHeight);
    }
  }, [N, expanded, panelH, total, loading]);

  // First visible index whose bottom passes `y` (binary search over offsets).
  const idxAt = (y: number) => {
    let lo = 0,
      hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] <= y) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const vStart = Math.max(0, idxAt(rel) - OVERSCAN);
  const vEnd =
    viewH > 0 ? Math.min(N, idxAt(rel + viewH) + 1 + OVERSCAN) : Math.min(N, OVERSCAN * 4);
  const slice = visible.slice(vStart, vEnd);
  const padTop = offsets[vStart];
  const padBottom = Math.max(0, total - offsets[vEnd]);

  // Deep-linked focus: jump the scroller to the target row (it may be unmounted,
  // so scroll by computed offset rather than scrollIntoView).
  const scrolledKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!scrollToKey || !N || scrolledKey.current === scrollToKey) return;
    const idx = visible.findIndex((r) => rowKey(r) === scrollToKey);
    const rw = rowsWrapRef.current;
    if (idx < 0 || !rw) return;
    const scroller = scrollerRef.current;
    const rwTop = rw.getBoundingClientRect().top;
    if (scroller)
      scroller.scrollTop +=
        rwTop - scroller.getBoundingClientRect().top + offsets[idx] - scroller.clientHeight / 2;
    else window.scrollBy(0, rwTop + offsets[idx] - window.innerHeight / 2);
    scrolledKey.current = scrollToKey;
  }, [scrollToKey, visible, total]);

  // One header cell's content (combobox filter or plain label) — shared by the
  // personalized (sortable-wrapped) and plain header paths.
  const renderHeadCell = (c: SheetCol<R>) => {
    const filterable = c.filterable ?? !!(c.value || c.values);
    const sortable = c.sortable ?? !!(c.value || c.values);
    const sortNode = sortable ? (
      <SortToggle col={c.key} sort={sort} onSort={toggleSort} />
    ) : undefined;
    return filterable ? (
      <HeaderComboFilter
        key={c.key}
        label={c.label}
        value={sel[c.key] ?? []}
        onChange={(v) => setSel((p) => ({ ...p, [c.key]: v }))}
        options={optionsByCol[c.key] ?? ['All']}
        sort={sortNode}
        hint={c.hint}
        align={c.align}
      />
    ) : (
      <div
        key={c.key}
        className={
          'px-2 py-1 min-w-0 ' +
          (c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : '')
        }
        title={c.hint}
      >
        <HeaderLabel>
          {c.label}
          {sortNode}
        </HeaderLabel>
      </div>
    );
  };

  return (
    <>
      {/* Slim strip: optional leading control (view toggle) + totals + clear,
          then a free-text search box pushed to the right. */}
      <div
        className={
          'flex items-center gap-3 flex-wrap pb-1.5 ' +
          (stickyStrip ? 'sticky top-0 z-30 bg-white pt-1' : '')
        }
      >
        {leading}
        {!loading && (
          <>
            <span className="text-[11px] text-[#737373] tnum">
              {summarize ? summarize(visible) + ' · ' : ''}
              {visible.length} {unit ?? 'rows'}
            </span>
            {anyFilter && (
              <LinkButton onClick={clear} className="text-[11px] font-medium">
                Clear filters
              </LinkButton>
            )}
            <div className="flex-1" />
            <ListSearch value={search} onChange={setSearch} />
            {colState.enabled && (
              <ColumnPicker
                cols={colState.allCols}
                hiddenKeys={colState.hiddenKeys}
                visibleCount={effCols.length}
                onToggle={colState.setHidden}
                onReset={colState.reset}
              />
            )}
          </>
        )}
      </div>

      {/* No overflow-hidden on the card — the combo dropdowns must escape it. */}
      <Card className="p-0">
        {/* Sticky spreadsheet header: each cell hosts its combobox filter + sort. */}
        <div
          className={
            'grid items-stretch divide-x divide-[#eaeaea] border-b border-[#eaeaea] bg-[#fafafa] rounded-t-lg sticky z-20 ' +
            (stickyStrip ? 'top-10' : 'top-0')
          }
          style={gridCols}
        >
          {colState.enabled ? (
            <HeaderDnd items={effCols.map((c) => c.key)} onReorder={colState.reorder}>
              {effCols.map((c) => (
                <SortableHeaderCell
                  key={c.key}
                  colKey={c.key}
                  label={c.label}
                  onPreviewWidth={colState.previewWidth}
                  onCommitWidth={colState.commitWidth}
                  onCancelWidth={colState.cancelWidth}
                >
                  {renderHeadCell(c)}
                </SortableHeaderCell>
              ))}
              {colState.filler && <div className="min-w-0" aria-hidden="true" />}
            </HeaderDnd>
          ) : (
            cols.map(renderHeadCell)
          )}
        </div>
        <div ref={rowsWrapRef} className="rounded-b-lg overflow-hidden">
          {loading ? (
            <LoadingState baseClassName="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic" />
          ) : visible.length === 0 ? (
            <EmptyState
              baseClassName="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic"
              message={emptyText ?? 'No rows match the current filters.'}
            />
          ) : (
            <>
              {padTop > 0 && <div style={{ height: padTop }} />}
              {slice.map((r) => {
                const k = rowKey(r);
                const isOpen = expanded === k;
                const clickable = !!onRowClick || !!expand;
                const handleClick = expand
                  ? () => setExpanded(isOpen ? null : k)
                  : onRowClick
                    ? () => onRowClick(r)
                    : undefined;
                return (
                  <div key={k}>
                    <div
                      ref={measureRow(k)}
                      onClick={handleClick}
                      className={
                        'grid items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 transition-colors duration-100 ' +
                        (clickable ? 'cursor-pointer ' : '') +
                        (selectedKey === k || k === scrollToKey ? 'bg-[#f5f8ff] ' : '') +
                        'hover:bg-[#fafafa]'
                      }
                      style={gridCols}
                    >
                      {effCols.map((c) => (
                        <div
                          key={c.key}
                          className={
                            'px-2 py-[3px] flex items-center gap-1.5 min-w-0 ' +
                            (c.align === 'center'
                              ? 'justify-center text-center'
                              : c.align === 'right'
                                ? 'justify-end text-right'
                                : '')
                          }
                        >
                          {c.render ? (
                            c.render(r)
                          ) : (
                            <SheetCell text={valOf(c, r).join(', ')} dim={c.dim} />
                          )}
                        </div>
                      ))}
                      {colState.filler && <div className="min-w-0" aria-hidden="true" />}
                    </div>
                    {isOpen && expand && (
                      <div
                        ref={measurePanel}
                        className="border-b border-[#f5f5f5] bg-[#fafafa] px-4 py-2.5"
                      >
                        {expand(r)}
                      </div>
                    )}
                  </div>
                );
              })}
              {padBottom > 0 && <div style={{ height: padBottom }} />}
            </>
          )}
        </div>
      </Card>
    </>
  );
}
