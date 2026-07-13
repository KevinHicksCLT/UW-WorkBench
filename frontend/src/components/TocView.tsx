import { useMemo, useState, type ReactNode } from 'react';
import { ListSearch } from './Sheet';
import { Card, EmptyState } from './ui';

/**
 * TOC (Table of Contents) — the module-level rollup view (originally the
 * Standards "Drilldown"): one row per top-level entry with a count and an
 * optional extra column. Rows click through to the module's deeper view (list
 * filter, detail page, …). Shared by Standards, Value Streams, Organization,
 * Roles, Deliverables, Tasks and Applications.
 *
 * One compact header strip, identical on every module (matches the Standards
 * tab and the Sheet list view): view pills (`leading`) + totals on the left,
 * extra controls (`actions`) + search on the right.
 */

export type TocRow = {
  id: string;
  name: string;
  count: number;
  extra?: string | null; // optional third column (owner, domain, TCO…)
  onClick?: () => void;
};

export function TocView({
  rows,
  nameLabel,
  countLabel,
  extraLabel,
  unit,
  searchPlaceholder,
  leading,
  totals,
  actions,
}: {
  rows: TocRow[];
  nameLabel: string;
  countLabel: string;
  extraLabel?: string; // omit to hide the third column
  unit: string; // noun for the "N of M <unit>" strip
  searchPlaceholder?: string;
  leading?: ReactNode; // view pills (TOC | List …), leftmost in the strip
  totals?: string; // module totals text (e.g. "13 areas · 95 categories · 1010 standards")
  actions?: ReactNode; // extra right-side controls (e.g. Work's group picker)
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) || (r.extra ?? '').toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap pb-2">
        {leading}
        {totals && (
          <span className="hidden md:inline text-[11px] text-[#737373] tnum whitespace-nowrap">
            {totals}
          </span>
        )}
        <div className="flex-1" />
        {actions}
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder={searchPlaceholder ?? `Search ${unit}…`}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
          <span className="flex-1">{nameLabel}</span>
          <span className="w-24 text-center tnum">{countLabel}</span>
          {extraLabel && <span className="w-[34%] pl-4">{extraLabel}</span>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            message="Nothing matches."
            baseClassName="px-4 py-8 text-sm text-slate-500 italic"
          />
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={r.onClick}
              className="w-full text-left flex items-center px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm text-[#171717] truncate font-medium">{r.name}</span>
                <TocChevron />
              </div>
              <div className="w-24 text-center text-sm tnum text-[#171717] font-medium">
                {r.count}
              </div>
              {extraLabel && (
                <div className="w-[34%] pl-4 text-sm text-[#525252] truncate">
                  {r.extra ?? <span className="text-[#a3a3a3] italic">—</span>}
                </div>
              )}
            </button>
          ))
        )}
      </Card>
    </>
  );
}

/** Small "back up one TOC level" chip, rendered next to the view pills. */
export function TocBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717] transition-colors duration-150"
    >
      ← {label}
    </button>
  );
}

function TocChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-[#d4d4d4]"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// ── Segmented view pills (TOC | Map | List) ──────────────────────────────────
// The shared toggle for every module's view switch — same control everywhere.
// `floating` positions it over a full-bleed canvas (Value Streams / Org maps).

export const VIEW_ICONS: Record<string, string> = {
  toc: 'M3 3h7v7H3zM14 5h7M14 9h7M10 14h11M10 18h11M5 10v8h5',
  map: 'M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
};

export function ViewPills<V extends string>({
  options,
  view,
  onChange,
  floating,
}: {
  options: { key: V; label: string; icon?: string }[];
  view: string; // may be a surface outside the pills (e.g. Organization's 'detail')
  onChange: (v: V) => void;
  floating?: boolean;
}) {
  const pills = (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white/90 backdrop-blur p-0.5 shadow-sm"
      role="tablist"
      aria-label="View mode"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={view === o.key}
          onClick={() => onChange(o.key)}
          className={
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ' +
            (view === o.key ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={o.icon ?? VIEW_ICONS[o.key] ?? VIEW_ICONS.list} />
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  );
  return floating ? (
    <div className="map-float-controls absolute top-3 left-4 z-20">{pills}</div>
  ) : (
    pills
  );
}
