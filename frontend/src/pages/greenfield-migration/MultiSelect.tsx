/**
 * Dropdown-with-checkboxes multi-select for the WR-01 lens bar. The trigger
 * button (lens-select visual family) summarizes the selection — the single
 * selection's name, or "N selected" — and opens a popover of checkbox options
 * with an optional search filter (for long lists like roles). Controlled via
 * `selected` + `onChange`; closes on outside click or Escape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../../components/ui';
import { LENS_SELECT_CLS } from './lens';

export type MultiSelectOption = { id: string; name: string };

export type MultiSelectProps = {
  /** Accessible name for the trigger and the option listbox. */
  label: string;
  options: MultiSelectOption[];
  /** Selected option ids (controlled). */
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Show a text filter above the options (for long lists). */
  searchable?: boolean;
  /** Trigger text when nothing is selected. */
  emptyLabel?: string;
  /** Options are still being fetched. */
  loading?: boolean;
};

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  emptyLabel = 'All',
  loading = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape while open; reset the filter on close.
  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? '1 selected')
        : `${selected.length} selected`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`${LENS_SELECT_CLS} inline-flex w-[190px] items-center justify-between gap-1 text-left`}
      >
        <span className="truncate">{summary}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="flex-shrink-0 text-[#a3a3a3]"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[240px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
          {searchable && (
            <div className="border-b border-[#eaeaea] p-1.5">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-7 text-[12px]"
              />
            </div>
          )}
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-64 overflow-y-auto py-1"
          >
            {loading ? (
              <div className="px-2.5 py-1.5 text-[12px] text-[#a3a3a3]">Loading…</div>
            ) : shown.length === 0 ? (
              <div className="px-2.5 py-1.5 text-[12px] text-[#a3a3a3]">No matches</div>
            ) : (
              shown.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-[12px] text-[#171717] hover:bg-[#fafafa]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="h-3.5 w-3.5 flex-shrink-0 accent-[#171717]"
                  />
                  <span className="truncate" title={o.name}>
                    {o.name}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
