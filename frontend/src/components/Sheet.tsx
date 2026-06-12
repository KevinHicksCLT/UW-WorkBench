import { useEffect, useMemo, useRef, useState } from 'react';

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
  sortable?: boolean;   // default: has value/values
  filterable?: boolean; // default: has value/values
  dim?: boolean;
};

type Sort = { col: string; dir: 1 | -1 };

function SortToggle({ col, sort, onSort }: { col: string; sort: Sort; onSort: (c: string) => void }) {
  const active = sort.col === col;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSort(col); }}
      title="Sort by this column"
      className={'ml-1 align-middle text-[10px] font-bold ' + (active ? 'text-[#171717]' : 'text-[#a3a3a3] hover:text-[#171717]')}
    >
      {active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}
    </button>
  );
}

const HeaderLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1 whitespace-nowrap">{children}</div>
);

// Long option lists render at most this many entries — type-ahead narrows.
const MAX_OPTIONS = 300;

// `value` is the multi-selection ([] = All). A plain click replaces the
// selection (classic single-pick, closes the dropdown); ctrl/cmd/shift-click
// toggles the option in/out of the selection and keeps the dropdown open.
// Exported so the Value Streams / Organization list explorers share it.
export function HeaderComboFilter({ label, value, onChange, options, sort }: {
  label: string; value: string[]; onChange: (v: string[]) => void; options: string[]; sort?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const active = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o === 'All' || o.toLowerCase().includes(q));
  const shown = filtered.slice(0, MAX_OPTIONS);
  function pick(o: string, e: React.MouseEvent) {
    if (o === 'All') { onChange([]); setOpen(false); setQuery(''); return; }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
      return; // stay open for further picks
    }
    onChange([o]); setOpen(false); setQuery('');
  }
  const display = value.length === 0 ? 'All' : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div ref={ref} className="px-2 py-1 min-w-0 relative" onClick={(e) => e.stopPropagation()}>
      <HeaderLabel>{label}{sort}</HeaderLabel>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={'flex items-center justify-between gap-1 w-full rounded border bg-white pl-2 pr-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 '
          + (active ? 'border-[#171717] text-[#171717] font-medium' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      >
        <span className="truncate" title={value.length > 1 ? value.join(', ') : undefined}>{display}</span>
        <svg className={'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-180' : '')} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 left-2 mt-1 w-[260px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
          <div className="p-1.5 border-b border-[#f5f5f5]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Filter by ${label.toLowerCase()}`}
              className="w-full rounded border border-[#eaeaea] bg-white px-2 py-1 text-xs text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <div className="px-2.5 py-1.5 text-xs text-[#a3a3a3]">No matches</div>
            ) : shown.map((o) => {
              const checked = o === 'All' ? value.length === 0 : value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={(e) => pick(o, e)}
                  className={'flex w-full items-center gap-1.5 text-left px-2.5 py-1 text-xs hover:bg-[#fafafa] transition-colors duration-100 '
                    + (checked ? 'text-[#171717] font-medium bg-[#fafafa]' : 'text-[#525252]')}
                >
                  <span className="w-3 flex-shrink-0 text-[#171717]">{checked && o !== 'All' ? '✓' : ''}</span>
                  <span className="truncate">{o}</span>
                </button>
              );
            })}
            {filtered.length > MAX_OPTIONS && (
              <div className="px-2.5 py-1.5 text-[10px] text-[#a3a3a3] italic">+{filtered.length - MAX_OPTIONS} more — type to narrow</div>
            )}
          </div>
          <div className="px-2.5 py-1 border-t border-[#f5f5f5] text-[10px] text-[#a3a3a3]">Ctrl/Shift-click to select multiple</div>
        </div>
      )}
    </div>
  );
}

// One spreadsheet cell. Clickable cells underline on hover and stopPropagation
// so a cell-level action doesn't also fire the row's default click.
export function SheetCell({ text, onClick, dim, title }: { text: string; onClick?: () => void; dim?: boolean; title?: string }) {
  return (
    <span
      title={title}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={'truncate text-[12px] ' + (dim ? 'text-[#737373]' : 'text-[#171717]') + (onClick ? ' cursor-pointer hover:underline' : '')}
    >
      {text}
    </span>
  );
}

export function Sheet<R>({
  rows, cols, rowKey, defaultSort, defaultFilters, summarize, loading, emptyText,
  onRowClick, expand, selectedKey, scrollToKey, leading,
}: {
  rows: R[];
  cols: SheetCol<R>[];
  rowKey: (r: R) => string;
  defaultSort?: Sort;
  defaultFilters?: Record<string, string>;
  // Extra entity totals for the strip (e.g. "13 areas · 96 categories"); the
  // row count is always appended.
  summarize?: (visible: R[]) => string;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (r: R) => void;
  expand?: (r: R) => React.ReactNode;
  selectedKey?: string | null;
  scrollToKey?: string | null;
  // Rendered at the start of the totals strip (e.g. a List|Drilldown view
  // toggle) so pages can share one compact row instead of stacking headers.
  leading?: React.ReactNode;
}) {
  const filterCols = cols.filter((c) => (c.filterable ?? !!(c.value || c.values)));
  // Per-column multi-selection; [] = All (no filter on that column).
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const c of filterCols) {
      const d = defaultFilters?.[c.key];
      init[c.key] = d && d !== 'All' ? [d] : [];
    }
    return init;
  });
  const firstSortable = cols.find((c) => (c.sortable ?? !!(c.value || c.values)));
  const [sort, setSort] = useState<Sort>(defaultSort ?? { col: firstSortable?.key ?? '', dir: 1 });
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const optionList = (vals: Iterable<string>) => ['All', ...[...new Set([...vals].filter(Boolean))].sort()];
  const optionsByCol = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of filterCols) out[c.key] = optionList(rows.filter((r) => matches(r, c.key)).flatMap((r) => valOf(c, r)));
    return out;
  }, [rows, sel, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  // A pick can be invalidated by a later pick in another column — drop it.
  // (Skip while rows are still loading, so defaultFilters survive the empty state.)
  useEffect(() => {
    if (!rows.length) return;
    for (const c of filterCols) {
      const picked = sel[c.key] ?? [];
      const kept = picked.filter((p) => optionsByCol[c.key]?.includes(p));
      if (kept.length !== picked.length) setSel((p) => ({ ...p, [c.key]: kept }));
    }
  }, [optionsByCol]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const list = rows.filter((r) => matches(r));
    const sc = colByKey.get(sort.col);
    if (!sc) return list;
    const get = (r: R) => valOf(sc, r).join(', ');
    return [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      // Empty cells always trail, regardless of direction.
      if (!va && vb) return 1;
      if (!vb && va) return -1;
      return va.localeCompare(vb, undefined, { numeric: true }) * sort.dir;
    });
  }, [rows, sel, sort, colByKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const anyFilter = filterCols.some((c) => (sel[c.key] ?? []).length > 0);
  const clear = () => {
    const init: Record<string, string[]> = {};
    for (const c of filterCols) init[c.key] = [];
    setSel(init);
  };
  const toggleSort = (col: string) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const gridCols = { gridTemplateColumns: cols.map((c) => c.width).join(' ') };

  // Deep-linked focus: scroll the target row into view once rows are in.
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToKey && rows.length) focusRef.current?.scrollIntoView({ block: 'center' });
  }, [scrollToKey, rows.length]);

  return (
    <>
      {/* Slim strip: optional leading control (view toggle) + totals + clear. */}
      <div className="flex items-center gap-3 flex-wrap pb-1.5">
        {leading}
        {!loading && (
          <>
            <span className="text-[11px] text-[#737373] tnum">
              {summarize ? summarize(visible) + ' · ' : ''}{visible.length} rows
            </span>
            {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>}
          </>
        )}
      </div>

      {/* No overflow-hidden on the card — the combo dropdowns must escape it. */}
      <div className="card p-0">
        {/* Sticky spreadsheet header: each cell hosts its combobox filter + sort. */}
        <div className="grid items-stretch divide-x divide-[#eaeaea] border-b border-[#eaeaea] bg-[#fafafa] rounded-t-lg sticky top-0 z-20" style={gridCols}>
          {cols.map((c) => {
            const filterable = c.filterable ?? !!(c.value || c.values);
            const sortable = c.sortable ?? !!(c.value || c.values);
            const sortNode = sortable ? <SortToggle col={c.key} sort={sort} onSort={toggleSort} /> : undefined;
            return filterable ? (
              <HeaderComboFilter key={c.key} label={c.label} value={sel[c.key] ?? []} onChange={(v) => setSel((p) => ({ ...p, [c.key]: v }))}
                options={optionsByCol[c.key] ?? ['All']} sort={sortNode} />
            ) : (
              <div key={c.key} className="px-2 py-1 min-w-0"><HeaderLabel>{c.label}{sortNode}</HeaderLabel></div>
            );
          })}
        </div>
        <div className="rounded-b-lg overflow-hidden">
          {loading ? (
            <div className="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic">{emptyText ?? 'No rows match the current filters.'}</div>
          ) : visible.map((r) => {
            const k = rowKey(r);
            const isOpen = expanded === k;
            const clickable = !!onRowClick || !!expand;
            const handleClick = expand
              ? () => setExpanded(isOpen ? null : k)
              : onRowClick ? () => onRowClick(r) : undefined;
            return (
              <div key={k} ref={k === scrollToKey ? focusRef : undefined}>
                <div
                  onClick={handleClick}
                  className={'grid items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 transition-colors duration-100 '
                    + (clickable ? 'cursor-pointer ' : '')
                    + (selectedKey === k || k === scrollToKey ? 'bg-[#f5f8ff] ' : '') + 'hover:bg-[#fafafa]'}
                  style={gridCols}
                >
                  {cols.map((c) => (
                    <div key={c.key} className="px-2 py-[3px] flex items-center gap-1.5 min-w-0">
                      {c.render ? c.render(r) : <SheetCell text={valOf(c, r).join(', ')} dim={c.dim} />}
                    </div>
                  ))}
                </div>
                {isOpen && expand && (
                  <div className="border-b border-[#f5f5f5] bg-[#fafafa] px-4 py-2.5">{expand(r)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
