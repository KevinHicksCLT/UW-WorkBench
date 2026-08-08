import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, LinkButton, LoadingState } from './ui';
import { useViewState } from '../lib/viewState';
import {
  HeaderComboFilter,
  HeaderLabel,
  ListSearch,
  SortToggle,
  type Sort,
} from './sheet/headerControls';
import { useSheetColumns } from './sheet/useSheetColumns';
import { useVirtualRows } from './sheet/useVirtualRows';
import { ColumnPicker } from './sheet/ColumnPicker';

export { HeaderComboFilter, ListSearch } from './sheet/headerControls';

// Sheet — the canonical spreadsheet list view: a flat grid sheet inside a
// flush card, a sticky header row where each column hosts a searchable
// combobox filter + sort toggle, Excel-style cascading options (each dropdown
// lists the distinct values among rows passing the OTHER filters; invalidated
// picks auto-clear), and a slim totals strip above with a "Clear filters" link.
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
  hint?: string; // header tooltip (title)
  align?: 'left' | 'center' | 'right'; // header + cell horizontal alignment (default left)
  hideable?: boolean; // default true — key/title columns opt out with false
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
  forceFilters,
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
  // Opt-in per-user column personalization (hide/show, localStorage-backed)
  // plus session view-state persistence (filters/sort/search). Absent →
  // behavior is identical to a non-personalized sheet.
  sheetKey?: string;
  defaultSort?: Sort;
  defaultFilters?: Record<string, string>;
  // Explicit filter intent (a deep link or a drill): applied ON TOP of any
  // restored view state, unlike defaultFilters which only seed a fresh view.
  forceFilters?: Record<string, string>;
  // Extra entity totals for the strip; the row count is always appended.
  summarize?: (visible: R[]) => string;
  // Noun for the appended row count (e.g. "submissions"); default "rows".
  unit?: string;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (r: R) => void;
  expand?: (r: R) => React.ReactNode;
  selectedKey?: string | null;
  scrollToKey?: string | null;
  // Rendered at the start of the totals strip (e.g. bulk-action buttons).
  leading?: React.ReactNode;
  // Pin the totals/leading strip to the top of the scroll area.
  stickyStrip?: boolean;
}) {
  const filterCols = cols.filter((c) => c.filterable ?? !!(c.value || c.values));
  // ── Restorable view state ──────────────────────────────────────────────────
  // With a sheetKey, filters/sort/search persist per sheet (lib/viewState), so
  // leaving and returning restores the exact view the user left. A ?focus deep
  // link (scrollToKey) skips restoring filters/search: a restored filter could
  // hide the focused row. forceFilters overlay whatever was restored.
  const persistKey = sheetKey ? `sheet.${sheetKey}` : null;
  const restoreFilters = !scrollToKey;
  // Per-column multi-selection; [] = All (no filter on that column).
  const [sel, setSel] = useViewState<Record<string, string[]>>(
    persistKey ? `${persistKey}.sel` : null,
    () => {
      const init: Record<string, string[]> = {};
      for (const c of filterCols) {
        const d = forceFilters?.[c.key] ?? defaultFilters?.[c.key];
        init[c.key] = d && d !== 'All' ? [d] : [];
      }
      return init;
    },
    restoreFilters,
  );
  // Explicit filter intent overlays restored state. Runs per render (callers
  // build the object inline) but bails with the previous state when the pick
  // is already applied, so there is no update churn.
  useEffect(() => {
    if (!forceFilters) return;
    setSel((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [k, v] of Object.entries(forceFilters)) {
        if (!v || v === 'All') continue;
        const cur = prev[k] ?? [];
        if (cur.length !== 1 || cur[0] !== v) {
          next[k] = [v];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [forceFilters, setSel]);
  const firstSortable = cols.find((c) => c.sortable ?? !!(c.value || c.values));
  const [sort, setSort] = useViewState<Sort>(
    persistKey ? `${persistKey}.sort` : null,
    defaultSort ?? { col: firstSortable?.key ?? '', dir: 1 },
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  // Free-text search across every column with a value (complements the per-
  // column combobox filters; narrows the visible rows only, not the dropdowns).
  const [search, setSearch] = useViewState<string>(
    persistKey ? `${persistKey}.search` : null,
    '',
    restoreFilters,
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Per-user column personalization: effective (visible) columns for RENDERING
  // only — filtering, sorting and search stay on the declared `cols` so hidden
  // columns keep their semantics. Without a sheetKey this passes the declared
  // columns straight through.
  const colState = useSheetColumns(sheetKey, cols);
  const effCols = colState.cols;

  // Header + rows share one grid template.
  const gridCols = useMemo(() => ({ gridTemplateColumns: colState.template }), [colState.template]);

  // Row virtualization (variable height) — see sheet/useVirtualRows.ts.
  const { rowsWrapRef, slice, padTop, padBottom, measureRow, measurePanel } = useVirtualRows({
    visible,
    rowKey,
    expanded,
    columnSignature: colState.signature,
    loading,
    scrollToKey,
  });

  // One header cell's content (combobox filter or plain label).
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
      {/* Slim strip: optional leading control + totals + clear, then a
          free-text search box pushed to the right. */}
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
          {effCols.map(renderHeadCell)}
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
