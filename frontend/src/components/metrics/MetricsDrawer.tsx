/**
 * Comprehensive (uncapped) metrics view — a wide drawer that slides over the
 * map canvas to show a section's full list or a single clicked node's detail.
 * Closing it leaves the map exactly where it was. Extracted verbatim from
 * MetricsSidebar.tsx.
 */
import { useNavigate } from 'react-router-dom';
import {
  BAR, TAGS, fmt, isChainSection, ChainLegend, TreeRow, TreeChildren,
  type MetricSection,
} from './tree';

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
  const navigate = useNavigate();
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
              {!(section.items.length === 1 && section.items[0].tag) && (
                <span className="text-[#a3a3a3] font-normal tabular-nums">({section.items.length})</span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body — full list, nothing truncated */}
        <div className="flex-1 overflow-y-auto p-4">
          {section.kind === 'tree' && section.items.length === 1 && section.items[0].tag ? (
            // Single-node detail view (a clicked deliverable / task / role /
            // checklist item): full text, identity chip, context trail, and
            // its subtree fully expanded beneath.
            (() => {
              const it = section.items[0];
              const t = TAGS[it.tag!];
              return (
                <div>
                  {it.trail && (
                    <div className="text-[10.5px] text-[#a3a3a3] mb-2 leading-snug">{it.trail}</div>
                  )}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {t && <span className={`text-[9.5px] font-semibold uppercase tracking-wide rounded px-2 py-0.5 ${t.chip}`}>{t.label}</span>}
                    {it.hint && <span className="text-[10.5px] font-medium text-[#525252] bg-[#f4f4f5] border border-[#e4e4e7] rounded px-2 py-0.5">{it.hint}</span>}
                  </div>
                  <div className="text-[16px] font-bold text-[#171717] leading-snug">{it.label}</div>
                  {it.sub && <div className="text-[12px] text-[#737373] mt-1">{it.sub}</div>}
                  {it.drill && (
                    <button
                      onClick={() => drill(it.drill!)}
                      className="mt-2.5 inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150"
                    >
                      Open full profile
                      <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                  {(it.children?.length ?? 0) > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#eaeaea]">
                      <TreeChildren items={it.children!} depth={0} wide defaultOpen onDrill={(l, id) => drill({ level: l, id })} onNavigate={(href) => { navigate(href); onClose(); }} />
                    </div>
                  )}
                </div>
              );
            })()
          ) : section.kind === 'bar' ? (
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
          ) : section.kind === 'tree' ? (
            <div className="flex flex-col gap-2">
              {isChainSection(section) && <ChainLegend wide />}
              {section.items.map((item, i) => (
                <TreeRow key={`${item.label}-${i}`} item={item} depth={0} wide defaultOpen onDrill={(l, id) => drill({ level: l, id })} onNavigate={(href) => { navigate(href); onClose(); }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const go = item.drill ? () => drill(item.drill!) : item.href ? () => { navigate(item.href!); onClose(); } : undefined;
                return go ? (
                  <button
                    key={item.label}
                    onClick={go}
                    className="w-full text-left rounded-md px-2.5 py-2 hover:bg-[#f5f8ff] border border-transparent hover:border-[#dbe7ff] transition-colors duration-150"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-[13px] text-[#171717] flex-1">{item.label}</span>
                      {item.value !== 0 && <span className="text-[13px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                      {item.hint && <span className="text-[10px] font-medium text-[#525252] bg-[#f0f0f0] rounded px-1.5 py-0.5 flex-shrink-0">{item.hint}</span>}
                      <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="text-[#a3a3a3] flex-shrink-0">
                        <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item.sub && <span className="text-[11px] text-[#a3a3a3] block mt-0.5">{item.sub}</span>}
                  </button>
                ) : (
                  <div key={item.label} className="px-2.5 py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="text-[13px] text-[#525252] flex-1">{item.label}</span>
                      {item.value !== 0 && <span className="text-[13px] font-semibold text-[#171717] tabular-nums flex-shrink-0">{fmt(item.value, item.format)}</span>}
                      {item.hint && <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{item.hint}</span>}
                    </span>
                    {item.sub && <span className="text-[11px] text-[#a3a3a3] block mt-0.5">{item.sub}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
