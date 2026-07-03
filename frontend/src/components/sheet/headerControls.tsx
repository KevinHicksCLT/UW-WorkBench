import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../ui';

// Header/strip controls extracted from Sheet.tsx (kept byte-for-byte) so the
// Sheet stays under the file-size budget: the sort toggle, header label, the
// searchable combobox filter each header cell hosts, and the free-text list
// search. HeaderComboFilter and ListSearch are re-exported from Sheet.tsx so
// the Value Streams / Organization explorers keep their import path.

export type Sort = { col: string; dir: 1 | -1 };

export function SortToggle({
  col,
  sort,
  onSort,
}: {
  col: string;
  sort: Sort;
  onSort: (c: string) => void;
}) {
  const active = sort.col === col;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSort(col);
      }}
      title="Sort by this column"
      className={
        'ml-1 align-middle text-[10px] font-bold ' +
        (active ? 'text-[#171717]' : 'text-[#a3a3a3] hover:text-[#171717]')
      }
    >
      {active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}
    </button>
  );
}

export const HeaderLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1 whitespace-nowrap">
    {children}
  </div>
);

// Long option lists render at most this many entries — type-ahead narrows.
const MAX_OPTIONS = 300;

// `value` is the multi-selection ([] = All). A plain click replaces the
// selection (classic single-pick, closes the dropdown); ctrl/cmd/shift-click
// toggles the option in/out of the selection and keeps the dropdown open.
// Exported so the Value Streams / Organization list explorers share it.
export function HeaderComboFilter({
  label,
  value,
  onChange,
  options,
  sort,
  hint,
  align,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  sort?: React.ReactNode;
  hint?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const active = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o === 'All' || o.toLowerCase().includes(q));
  const shown = filtered.slice(0, MAX_OPTIONS);
  function pick(o: string, e: React.MouseEvent) {
    if (o === 'All') {
      onChange([]);
      setOpen(false);
      setQuery('');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
      return; // stay open for further picks
    }
    onChange([o]);
    setOpen(false);
    setQuery('');
  }
  const display =
    value.length === 0 ? 'All' : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div
      ref={ref}
      className="px-2 py-1 min-w-0 relative"
      onClick={(e) => e.stopPropagation()}
      title={hint}
    >
      <div className={align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}>
        <HeaderLabel>
          {label}
          {sort}
        </HeaderLabel>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          'flex items-center justify-between gap-1 w-full rounded border bg-white pl-2 pr-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
          (active
            ? 'border-[#171717] text-[#171717] font-medium'
            : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')
        }
      >
        <span className="truncate" title={value.length > 1 ? value.join(', ') : undefined}>
          {display}
        </span>
        <svg
          className={
            'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' +
            (open ? 'rotate-180' : '')
          }
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
              <EmptyState
                baseClassName="px-2.5 py-1.5 text-xs text-[#a3a3a3]"
                message="No matches"
              />
            ) : (
              shown.map((o) => {
                const checked = o === 'All' ? value.length === 0 : value.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={(e) => pick(o, e)}
                    className={
                      'flex w-full items-center gap-1.5 text-left px-2.5 py-1 text-xs hover:bg-[#fafafa] transition-colors duration-100 ' +
                      (checked ? 'text-[#171717] font-medium bg-[#fafafa]' : 'text-[#525252]')
                    }
                  >
                    <span className="w-3 flex-shrink-0 text-[#171717]">
                      {checked && o !== 'All' ? '✓' : ''}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })
            )}
            {filtered.length > MAX_OPTIONS && (
              <div className="px-2.5 py-1.5 text-[10px] text-[#a3a3a3] italic">
                +{filtered.length - MAX_OPTIONS} more — type to narrow
              </div>
            )}
          </div>
          <div className="px-2.5 py-1 border-t border-[#f5f5f5] text-[10px] text-[#a3a3a3]">
            Ctrl/Shift-click to select multiple
          </div>
        </div>
      )}
    </div>
  );
}

// Shared free-text search box for the totals strip of every list view (the
// canonical Sheet plus the hand-rolled Value Streams / Organization explorers).
// A compact input that filters the whole sheet across all columns at once —
// complements the per-column combobox filters in the header. One component so
// the control looks identical on every list.
export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-2 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        aria-label="Search list"
        className="w-44 sm:w-56 rounded border border-[#eaeaea] bg-white pl-7 pr-6 py-1 text-[11px] text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#d4d4d4] focus:ring-2 focus:ring-[#f5f8ff] transition-colors duration-150"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
