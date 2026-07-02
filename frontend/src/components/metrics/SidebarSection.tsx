/**
 * One collapsible section of the metrics sidebar — bar / kpi / tree / list
 * renderers with the SECTION_LIMIT cap and the "View all" overflow into the
 * wide drawer. Extracted verbatim from MetricsSidebar.tsx.
 */
import { useState } from 'react';
import {
  BAR, SECTION_LIMIT, fmt, isChainSection, ChainLegend, TreeRow,
  type MetricSection,
} from './tree';

// ── One sidebar section ───────────────────────────────────────────────────────
// A collapsible group (chevron in the heading, open by default). The four
// primary drill groups — Deliverables, Roles, Tasks, Checklist — always render
// in that order; when a level has no rows the section shows its `emptyText`
// instead of disappearing.
export function SidebarSection({ section, dashTitle, onDrill, onNavigate, onViewAll }: {
  section: MetricSection;
  dashTitle: string;
  onDrill: (level: string, id: string) => void;
  onNavigate: (href: string) => void;
  onViewAll?: (section: MetricSection) => void;
}) {
  const [open, setOpen] = useState(true);
  const max = Math.max(1, ...section.items.map((i) => i.value));
  const shown = section.items.slice(0, SECTION_LIMIT);
  const hidden = section.items.length - shown.length;
  return (
    <div className="px-4 py-3 border-b border-[#eaeaea] last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.10em] text-[#171717] ${open ? 'mb-2.5' : ''}`}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><path d="M9 6l6 6-6 6" /></svg>
        {section.title}
        <span className="font-normal tabular-nums text-[#737373]">({section.items.length})</span>
      </button>

      {open && (section.items.length === 0 ? (
        <div className="text-[11px] text-[#a3a3a3] italic leading-snug">{section.emptyText}</div>
      ) : (
        <>
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
                ) : section.kind === 'tree' ? (
                  <div className="flex flex-col gap-1.5">
                    {isChainSection(section) && <ChainLegend />}
                    {shown.map((item, i) => (
                      <TreeRow
                        key={`${item.label}-${i}`}
                        item={item}
                        depth={0}
                        defaultOpen={section.expanded}
                        trail={[dashTitle]}
                        onDrill={onDrill}
                        onNavigate={onNavigate}
                        // Clicking any node opens it in the wide drawer as a
                        // detail view of that thing (deliverable → checklist item).
                        onInspect={onViewAll ? (it, trail) => onViewAll({
                          title: it.label, kind: 'tree', expanded: true,
                          items: [{ ...it, trail: trail.join(' › ') }],
                        }) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {shown.map((item) => {
                      const go = item.drill ? () => onDrill(item.drill!.level, item.drill!.id) : item.href ? () => onNavigate(item.href!) : undefined;
                      return go ? (
                        <button
                          key={item.label}
                          onClick={go}
                          className="w-full text-left rounded-md px-2 py-1.5 -mx-1 hover:bg-[#f5f8ff] border border-transparent hover:border-[#dbe7ff] transition-colors duration-150"
                        >
                          <span className="flex items-start gap-2">
                            <span className="text-[11.5px] text-[#171717] leading-snug flex-1">{item.label}</span>
                            {item.value !== 0 && <span className="text-[11px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                            {item.hint && <span className="text-[9px] font-medium text-[#525252] bg-[#f0f0f0] rounded px-1.5 py-0.5 flex-shrink-0">{item.hint}</span>}
                            <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="text-[#a3a3a3] flex-shrink-0">
                              <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          {item.sub && <span className="text-[9.5px] text-[#a3a3a3] block mt-0.5">{item.sub}</span>}
                        </button>
                      ) : (
                        <div key={item.label} className="px-2 py-1.5">
                          <span className="flex items-start gap-2">
                            <span className="text-[11.5px] text-[#525252] leading-snug flex-1">{item.label}</span>
                            {item.value !== 0 && <span className="text-[11px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                            {item.hint && <span className="text-[9px] text-[#a3a3a3] flex-shrink-0">{item.hint}</span>}
                          </span>
                          {item.sub && <span className="text-[9.5px] text-[#a3a3a3] block mt-0.5">{item.sub}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(hidden > 0 || section.kind === 'tree') && onViewAll && (
                  <button
                    onClick={() => onViewAll(section)}
                    className="mt-2 w-full flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#f5f8ff] transition-colors duration-150"
                  >
                    {hidden > 0 ? `View all ${section.items.length}` : 'Open expanded view'}
                    <svg width="10" height="10" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                      <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
        </>
      ))}
    </div>
  );
}
