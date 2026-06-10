// MetricsSidebar.tsx — right-hand dashboard panel. Renders a per-level metric
// dashboard (company / CEO domain / division / value stream / process area).
// All numbers come from the backend /explorer/metrics endpoint, which reads them
// straight from the workbook tables. Items carrying a `drill` target render as
// buttons that navigate one level deeper in the map.

import { useEffect, useState } from 'react';

export type Fmt = 'money' | 'years' | 'number';
export type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string } };
export type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi'; items: MetricItem[]; illustrative?: boolean };
export type Dashboard = {
  level: string;
  title: string;
  subtitle?: string;
  tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean }[];
  sections: MetricSection[];
};

const LEVEL_LABEL: Record<string, string> = {
  company: 'Enterprise', domain: '', division: 'Division', department: 'Department',
  valueStream: 'Process Level 3', step: 'Process Level 4', role: 'Role', person: 'Individual',
};

const BAR = '#2563eb';

// Sidebar is narrow (300px), so long lists overflow/truncate. Cap each section to
// a few rows; the overflow opens the comprehensive view in a wide drawer.
const SECTION_LIMIT = 6;

function money(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}
function fmt(n: number, f?: Fmt) {
  if (f === 'money') return money(n);
  if (f === 'years') return `${n} yr`;
  return n >= 1000 ? n.toLocaleString() : String(n);
}

export default function MetricsSidebar({
  dash, loading, onDrill, onBack, onClose, onViewAll, onViewDetail, expandKey,
}: {
  dash: Dashboard | null;
  loading: boolean;
  onDrill: (level: string, id: string) => void;
  onBack?: () => void;
  // When provided (list view), renders a close button. The map omits it.
  onClose?: () => void;
  // Opens a section's comprehensive (uncapped) view in a wide drawer.
  onViewAll?: (section: MetricSection) => void;
  // When provided (value-stream level), renders the full-detail drawer button.
  onViewDetail?: () => void;
  // When this key changes (the user clicked a row), the panel auto-expands —
  // a click is an explicit ask to see the data, not just the rail.
  expandKey?: string | null;
}) {
  // Minimizable: collapse the panel to a thin rail to give the map full width.
  // Starts collapsed by default; expands on row selection (expandKey) or by hand.
  const [collapsed, setCollapsed] = useState<boolean>(!expandKey);
  const toggleCollapsed = () => setCollapsed((c) => !c);
  useEffect(() => { if (expandKey) setCollapsed(false); }, [expandKey]);
  const levelLabel = dash ? (LEVEL_LABEL[dash.level] ?? 'Roles') : 'Roles';
  // The rail labels itself with the clicked node's NAME (the level alone reads
  // as noise — "Process Level 3" says nothing about WHAT is selected).
  const railLabel = dash?.title ?? levelLabel;

  // ── Collapsed rail ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col items-center bg-[#eaf1ff] border-l border-[#cdddff] flex-shrink-0" style={{ width: 44 }}>
        <button
          onClick={toggleCollapsed}
          aria-label="Expand panel"
          title="Expand panel"
          className="mt-3 w-8 h-8 rounded-full bg-[#0070AD] text-white shadow-sm hover:bg-[#005a8c] flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {railLabel && (
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0070AD] [writing-mode:vertical-rl] rotate-180 select-none max-h-[60vh] overflow-hidden text-ellipsis" title={railLabel}>
            {railLabel}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col bg-white border-l border-[#eaeaea] overflow-y-auto flex-shrink-0"
      style={{ width: 300, minWidth: 260 }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#eaeaea] sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2 mb-1">
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="flex-shrink-0 text-[#525252] hover:text-[#171717] -ml-1">
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none"><path d="M11 6.5H2M6 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          {levelLabel && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
              {levelLabel}
            </div>
          )}
          {/* Minimize — collapse to a thin rail. */}
          <button
            onClick={toggleCollapsed}
            aria-label="Minimize panel"
            title="Minimize panel"
            className={'ml-auto flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center' + (onClose ? '' : ' -mr-1')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <div className="text-[14px] font-bold text-[#171717] leading-snug">
          {loading ? 'Loading…' : dash?.title ?? '—'}
        </div>
        {dash?.subtitle && !loading && (
          <div className="text-[11px] text-[#a3a3a3] mt-0.5">{dash.subtitle}</div>
        )}
        {onViewDetail && !loading && (
          <button
            onClick={onViewDetail}
            className="mt-2.5 inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150"
          >
            View full details
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
              <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {loading || !dash ? (
        <div className="p-4 grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-md" style={{ height: 56 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="p-3 grid grid-cols-2 gap-2 border-b border-[#eaeaea]">
            {dash.tiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5">
                <div className="text-[19px] font-bold text-[#171717] leading-none tabular-nums">{t.value === 0 && t.hint ? '—' : fmt(t.value, t.format)}</div>
                <div className="text-[10.5px] text-[#525252] mt-1 leading-tight flex items-center gap-1">{t.label}</div>
                {t.hint && <div className="text-[9px] text-[#a3a3a3] mt-0.5 leading-tight">{t.hint}</div>}
              </div>
            ))}
          </div>

          {/* Sections */}
          {dash.sections.filter((s) => s.items.length > 0).map((section) => {
            const max = Math.max(1, ...section.items.map((i) => i.value));
            const shown = section.items.slice(0, SECTION_LIMIT);
            const hidden = section.items.length - shown.length;
            return (
              <div key={section.title} className="px-4 py-3 border-b border-[#eaeaea] last:border-b-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2.5 flex items-center gap-1.5">
                  {section.title}
                </div>

                {section.kind === 'bar' ? (
                  <div className="flex flex-col gap-2">
                    {shown.map((item) => {
                      const pct = Math.round((item.value / max) * 100);
                      const inner = (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11.5px] text-[#171717] truncate pr-2 flex items-center gap-1">
                              {item.label}
                              {item.drill && (
                                <svg width="10" height="10" viewBox="0 0 13 13" fill="none" className="text-[#a3a3a3] flex-shrink-0">
                                  <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className="text-[11.5px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR }} />
                          </div>
                        </>
                      );
                      return item.drill ? (
                        <button
                          key={item.label}
                          onClick={() => onDrill(item.drill!.level, item.drill!.id)}
                          className="text-left w-full rounded-md -mx-1 px-1 py-0.5 hover:bg-[#f5f8ff] transition-colors duration-150 group"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div key={item.label}>{inner}</div>
                      );
                    })}
                  </div>
                ) : section.kind === 'kpi' ? (
                  <div className="flex flex-col gap-1.5">
                    {shown.map((item) => (
                      <div key={item.label} className="rounded-md border border-[#eaeaea] bg-[#fafafa] px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11.5px] font-semibold text-[#171717] leading-snug">{item.label}</span>
                          {item.hint && (
                            <span className="text-[10px] font-semibold text-[#1d4ed8] bg-[#eef3ff] border border-[#dbe7ff] rounded px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">
                              {item.hint}
                            </span>
                          )}
                        </div>
                        {item.sub && <div className="text-[9.5px] text-[#a3a3a3] mt-1">{item.sub}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {shown.map((item) =>
                      item.drill ? (
                        <button
                          key={item.label}
                          onClick={() => onDrill(item.drill!.level, item.drill!.id)}
                          className="w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 -mx-1 hover:bg-[#f5f8ff] border border-transparent hover:border-[#dbe7ff] transition-colors duration-150"
                        >
                          <span className="text-[11.5px] text-[#171717] truncate flex-1">{item.label}</span>
                          {item.value !== 0 && <span className="text-[11px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                          {item.hint && <span className="text-[9px] font-medium text-[#525252] bg-[#f0f0f0] rounded px-1.5 py-0.5 flex-shrink-0">{item.hint}</span>}
                          <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="text-[#a3a3a3] flex-shrink-0">
                            <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : (
                        <div key={item.label} className="flex items-center gap-2 px-2 py-1.5">
                          <span className="text-[11.5px] text-[#525252] truncate flex-1">{item.label}</span>
                          {item.value !== 0 && <span className="text-[11px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                          {item.hint && <span className="text-[9px] text-[#a3a3a3] flex-shrink-0">{item.hint}</span>}
                        </div>
                      )
                    )}
                  </div>
                )}

                {hidden > 0 && onViewAll && (
                  <button
                    onClick={() => onViewAll(section)}
                    className="mt-2 w-full flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#f5f8ff] transition-colors duration-150"
                  >
                    View all {section.items.length}
                    <svg width="10" height="10" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                      <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          <div className="px-4 py-3 text-[9px] text-[#cbcbcb]">
            Roles from the operating-model workbook.
          </div>
        </>
      )}
    </aside>
  );
}

// ── Comprehensive (uncapped) view ──────────────────────────────────────────────
// Wide drawer that slides over the map canvas to show a section's full, untruncated
// list. Closing it leaves the map exactly where it was — no navigation, so the
// breadcrumb and drill state are preserved.
export function MetricsDrawer({
  section, contextTitle, onClose, onDrill,
}: {
  section: MetricSection;
  contextTitle: string;
  onClose: () => void;
  onDrill: (level: string, id: string) => void;
}) {
  const max = Math.max(1, ...section.items.map((i) => i.value));
  const drill = (d: { level: string; id: string }) => { onDrill(d.level, d.id); onClose(); };

  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the map; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside
        className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col"
        style={{ width: 520, maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] truncate">{contextTitle}</div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug flex items-center gap-1.5">
              {section.title}
              <span className="text-[#a3a3a3] font-normal tabular-nums">({section.items.length})</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body — full list, nothing truncated */}
        <div className="flex-1 overflow-y-auto p-4">
          {section.kind === 'bar' ? (
            <div className="flex flex-col gap-3">
              {section.items.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <span className="text-[13px] text-[#171717]">{item.label}</span>
                    <span className="text-[13px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((item.value / max) * 100)}%`, background: BAR }} />
                  </div>
                </div>
              ))}
            </div>
          ) : section.kind === 'kpi' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {section.items.map((item) => (
                <div key={item.label} className="rounded-md border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#171717] leading-snug">{item.label}</span>
                    {item.hint && (
                      <span className="text-[11px] font-semibold text-[#1d4ed8] bg-[#eef3ff] border border-[#dbe7ff] rounded px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">{item.hint}</span>
                    )}
                  </div>
                  {item.sub && <div className="text-[11px] text-[#a3a3a3] mt-1">{item.sub}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) =>
                item.drill ? (
                  <button
                    key={item.label}
                    onClick={() => drill(item.drill!)}
                    className="w-full flex items-center gap-2.5 text-left rounded-md px-2.5 py-2 hover:bg-[#f5f8ff] border border-transparent hover:border-[#dbe7ff] transition-colors duration-150"
                  >
                    <span className="text-[13px] text-[#171717] flex-1">{item.label}</span>
                    {item.value !== 0 && <span className="text-[13px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                    {item.hint && <span className="text-[10px] font-medium text-[#525252] bg-[#f0f0f0] rounded px-1.5 py-0.5 flex-shrink-0">{item.hint}</span>}
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="text-[#a3a3a3] flex-shrink-0">
                      <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <div key={item.label} className="flex items-center gap-2.5 px-2.5 py-2">
                    <span className="text-[13px] text-[#525252] flex-1">{item.label}</span>
                    {item.value !== 0 && <span className="text-[13px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                    {item.hint && <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{item.hint}</span>}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
