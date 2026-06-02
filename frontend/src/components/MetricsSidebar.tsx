// MetricsSidebar.tsx — right-hand dashboard panel. Renders a per-level metric
// dashboard (company / CEO domain / division / value stream / process area).
// All numbers come from the backend /explorer/metrics endpoint, which reads them
// straight from the workbook tables. Items carrying a `drill` target render as
// buttons that navigate one level deeper in the map.

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
  company: 'Enterprise', domain: 'CEO Domain', division: 'Division',
  valueStream: 'Value Stream', step: 'Process Area', role: 'Role', person: 'Individual',
};

const BAR = '#2563eb';

function IllusTag() {
  return <span className="text-[8px] font-semibold uppercase tracking-wide text-[#b45309] bg-[#fff7ed] border border-[#fdd9a8] rounded px-1 py-0.5 flex-shrink-0">illus.</span>;
}

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
  dash, loading, onDrill, onBack,
}: {
  dash: Dashboard | null;
  loading: boolean;
  onDrill: (level: string, id: string) => void;
  onBack?: () => void;
}) {
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            {dash ? (LEVEL_LABEL[dash.level] ?? 'Metrics') : 'Metrics'}
          </div>
        </div>
        <div className="text-[14px] font-bold text-[#171717] leading-snug">
          {loading ? 'Loading…' : dash?.title ?? '—'}
        </div>
        {dash?.subtitle && !loading && (
          <div className="text-[11px] text-[#a3a3a3] mt-0.5">{dash.subtitle}</div>
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
                <div className="text-[10.5px] text-[#525252] mt-1 leading-tight flex items-center gap-1">{t.label}{t.illustrative && <IllusTag />}</div>
                {t.hint && <div className="text-[9px] text-[#a3a3a3] mt-0.5 leading-tight">{t.hint}</div>}
              </div>
            ))}
          </div>

          {/* Sections */}
          {dash.sections.filter((s) => s.items.length > 0).map((section) => {
            const max = Math.max(1, ...section.items.map((i) => i.value));
            return (
              <div key={section.title} className="px-4 py-3 border-b border-[#eaeaea] last:border-b-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2.5 flex items-center gap-1.5">
                  {section.title}{section.illustrative && <IllusTag />}
                </div>

                {section.kind === 'bar' ? (
                  <div className="flex flex-col gap-2">
                    {section.items.map((item) => {
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
                    {section.items.map((item) => (
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
                    {section.items.map((item) =>
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
              </div>
            );
          })}

          <div className="px-4 py-3 text-[9px] text-[#cbcbcb]">
            Metrics sourced from the operating-model workbook.
          </div>
        </>
      )}
    </aside>
  );
}
