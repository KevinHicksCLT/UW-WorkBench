// MetricsSidebar.tsx — right-hand dashboard panel. Renders a per-level metric
// dashboard (company / CEO domain / division / value stream / process area).
// All numbers come from the backend /explorer/metrics endpoint, which reads them
// straight from the workbook tables. Items carrying a `drill` target render as
// buttons that navigate one level deeper in the map.
//
// Split for maintainability (pure code motion — behavior unchanged):
//   components/metrics/tree.tsx           — payload types, chain tags, TreeRow
//   components/metrics/SidebarSection.tsx — one collapsible section
//   components/metrics/MetricsDrawer.tsx  — the comprehensive wide drawer

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonLoader } from './ui';
import { LEVEL_LABEL, fmt, type Dashboard, type MetricSection } from './metrics/tree';
import { SidebarSection } from './metrics/SidebarSection';

// Re-exports — the public surface of this module is unchanged.
export { MetricsDrawer } from './metrics/MetricsDrawer';
export type { Dashboard, Fmt, MetricItem, MetricSection } from './metrics/tree';

export default function MetricsSidebar({
  dash, loading, onDrill, onBack, onClose, onViewAll, onViewDetail, onTestingTemplate, startExpanded, accent,
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
  // When provided (value-stream / step levels), renders the testing-template
  // modal button for the focused node.
  onTestingTemplate?: () => void;
  // List views open the panel immediately (a thin rail next to a spreadsheet
  // reads as nothing happening); the map keeps the rail-first default so the
  // canvas isn't covered.
  startExpanded?: boolean;
  // Domain color of the selection (org views) — tints the rail and the panel's
  // top edge so the sidebar visibly belongs to the clicked branch.
  accent?: string;
}) {
  const navigate = useNavigate();
  // Minimizable: collapse the panel to a thin rail to give the map full width.
  // Starts collapsed (a thin rail labelled with the selection's name) — except
  // at Process Level 5, where the connected chain IS the payoff of the drill,
  // so the panel opens itself (and gets extra width for the deep nesting).
  const [collapsed, setCollapsed] = useState<boolean>(!startExpanded);
  const toggleCollapsed = () => setCollapsed((c) => !c);
  const isLeaf = dash?.level === 'leafStep';
  useEffect(() => { if (isLeaf) setCollapsed(false); }, [isLeaf]);
  const levelLabel = dash ? (LEVEL_LABEL[dash.level] ?? 'Roles') : 'Roles';
  // The rail labels itself with the clicked node's NAME (the level alone reads
  // as noise — "Process Level 3" says nothing about WHAT is selected).
  const railLabel = dash?.title ?? levelLabel;

  // ── Collapsed rail ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        className="hidden md:flex flex-col items-center bg-[#eaf1ff] border-l border-[#cdddff] flex-shrink-0"
        style={{ width: 44, ...(accent ? { background: `${accent}14`, borderColor: `${accent}45` } : {}) }}
      >
        <button
          onClick={toggleCollapsed}
          aria-label="Expand panel"
          title="Expand panel"
          className="mt-3 w-8 h-8 rounded-full bg-[#0070AD] text-white shadow-sm hover:bg-[#005a8c] flex items-center justify-center"
          style={accent ? { background: accent } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {railLabel && (
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0070AD] [writing-mode:vertical-rl] rotate-180 select-none max-h-[60vh] overflow-hidden text-ellipsis"
            style={accent ? { color: accent } : undefined} title={railLabel}>
            {railLabel}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col bg-white border-l border-[#eaeaea] overflow-y-auto flex-shrink-0"
      style={{ width: isLeaf ? 460 : 390, minWidth: 320, ...(accent ? { borderTop: `3px solid ${accent}` } : {}) }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#eaeaea] sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2 mb-1">
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="flex-shrink-0 text-[#525252] hover:text-[#171717] -ml-1">
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none"><path d="M11 6.5H2M6 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} aria-hidden="true" />}
          {levelLabel && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]" style={accent ? { color: accent } : undefined}>
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
        {(onViewDetail || onTestingTemplate) && !loading && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {onViewDetail && (
              <button
                onClick={onViewDetail}
                className="inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150"
              >
                View full details
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
                  <path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {onTestingTemplate && (
              <button
                onClick={onTestingTemplate}
                className="inline-flex items-center gap-1 rounded-md border border-[#eaeaea] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#525252] hover:bg-[#fafafa] hover:text-[#171717] transition-colors duration-150"
              >
                Testing template
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M9 11l3 3 8-8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
              </button>
            )}
          </div>
        )}
      </div>

      {loading || !dash ? (
        <SkeletonLoader count={6} height={56} className="p-4 grid grid-cols-2 gap-2" />
      ) : (
        <>
          {/* Stat tiles — tiles naming a drawer section open its consolidated list. */}
          <div className="p-3 grid grid-cols-2 gap-2 border-b border-[#eaeaea]">
            {dash.tiles.map((t) => {
              const target = t.drawer ? dash.sections.find((s) => s.title === t.drawer) : undefined;
              const clickable = !!target && !!onViewAll;
              const body = (
                <>
                  <div className="text-[19px] font-bold text-[#171717] leading-none tabular-nums">{t.value === 0 && t.hint ? '—' : fmt(t.value, t.format)}</div>
                  <div className="text-[10.5px] text-[#525252] mt-1 leading-tight flex items-center gap-1">{t.label}</div>
                  {t.hint && <div className="text-[9px] text-[#a3a3a3] mt-0.5 leading-tight">{t.hint}</div>}
                </>
              );
              return clickable ? (
                <button key={t.label} onClick={() => onViewAll!(target!)} className="text-left rounded-lg border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5 hover:bg-[#f5f8ff] hover:border-[#dbe7ff] transition-colors duration-150">
                  {body}
                </button>
              ) : (
                <div key={t.label} className="rounded-lg border border-[#eaeaea] bg-[#fafafa] px-3 py-2.5">{body}</div>
              );
            })}
          </div>

          {/* Sections (hidden ones back the tile drawers only; emptyText keeps
              the primary drill groups visible even with no rows) */}
          {dash.sections.filter((s) => !s.hidden && (s.items.length > 0 || s.emptyText)).map((section) => (
            // Keyed by dashboard + section so tree/collapse state resets when
            // the focused node changes (no stale collapse carried across).
            <SidebarSection
              key={`${dash.title}·${section.title}`}
              section={section}
              dashTitle={dash.title}
              onDrill={onDrill}
              onNavigate={(href) => navigate(href)}
              onViewAll={onViewAll}
            />
          ))}

          <div className="px-4 py-3 text-[9px] text-[#cbcbcb]">
            Roles from the operating-model workbook.
          </div>
        </>
      )}
    </aside>
  );
}
