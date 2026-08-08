import { useEffect, useRef, useState } from 'react';

// ColumnPicker — the "Columns" gear button in the Sheet's totals strip.
// Opens a checklist of every column (checked = visible; hideable:false
// columns are locked on) plus a "Reset columns" action that clears the whole
// persisted preference. Visuals match the header combobox dropdowns.

export type PickerCol = { key: string; label: string; hideable?: boolean };

export function ColumnPicker({
  cols,
  hiddenKeys,
  visibleCount,
  onToggle,
  onReset,
}: {
  cols: PickerCol[];
  hiddenKeys: string[];
  visibleCount: number;
  onToggle: (key: string, hide: boolean) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = new Set(hiddenKeys);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Show, hide, and reset columns"
        aria-label="Choose columns"
        className={
          'flex items-center gap-1 rounded border bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
          (open
            ? 'border-[#171717] text-[#171717]'
            : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')
        }
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Columns
      </button>
      {open && (
        <div className="absolute z-30 right-0 mt-1 w-[220px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {cols.map((c) => {
              const isHidden = hidden.has(c.key);
              const locked = c.hideable === false || (!isHidden && visibleCount === 1); // never hide the last visible column
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={locked}
                  onClick={() => onToggle(c.key, !isHidden)}
                  title={c.hideable === false ? 'This column cannot be hidden' : undefined}
                  className={
                    'flex w-full items-center gap-1.5 text-left px-2.5 py-1 text-xs transition-colors duration-100 ' +
                    (locked
                      ? 'text-[#a3a3a3] cursor-not-allowed'
                      : 'hover:bg-[#fafafa] ' +
                        (isHidden ? 'text-[#525252]' : 'text-[#171717] font-medium'))
                  }
                >
                  <span className="w-3 flex-shrink-0 text-[#171717]">{isHidden ? '' : '✓'}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-[#f5f5f5] py-1">
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 text-left px-2.5 py-1 text-xs text-[#525252] hover:bg-[#fafafa] hover:text-[#171717] transition-colors duration-100"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="w-3 flex-shrink-0"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
