// MetricsSidebar.tsx — right-hand dashboard panel. Renders a per-level metric
// dashboard (company / CEO domain / division / value stream / process area).
// All numbers come from the backend /explorer/metrics endpoint, which reads them
// straight from the workbook tables. Items carrying a `drill` target render as
// buttons that navigate one level deeper in the map.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type Fmt = 'money' | 'years' | 'number';
// `href` links out to an app page (e.g. /applications); `children` nests items
// for `tree` sections (deliverable → task → role → checklist/people); `tag`
// names what the row IS so it renders with a consistent color + chip.
export type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string }; href?: string; children?: MetricItem[]; tag?: string; trail?: string };
// A `hidden` section never renders inline — it backs a tile's consolidated
// drawer (tile.drawer names the section). An `expanded` tree opens every level
// on load (the L5 deliverable chain).
export type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi' | 'tree'; items: MetricItem[]; illustrative?: boolean; hidden?: boolean; expanded?: boolean };
export type Dashboard = {
  level: string;
  title: string;
  subtitle?: string;
  tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean; drawer?: string }[];
  sections: MetricSection[];
};

const LEVEL_LABEL: Record<string, string> = {
  company: 'Enterprise', domain: '', division: 'Division', department: 'Department',
  valueStream: 'Process Level 3', step: 'Process Level 4', leafStep: 'Process Level 5', role: 'Role', person: 'Individual',
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

// ── Nested tree rows (kind: 'tree') ─────────────────────────────────────────
// Deliverable → task → responsible role → checklist + people, color-coded by
// `tag`. Top-level deliverables render as accent cards; nested levels hang off
// an indent guide. `defaultOpen` (section.expanded) opens the whole chain.

// Per-tag visual identity: accent color, chip styling, and chip label. One
// clean hue per level — Capgemini blue (deliverable) → violet (task) →
// emerald (role) → green check (checklist) — so the hierarchy reads at a glance.
const TAGS: Record<string, { accent: string; chip: string; label: string }> = {
  deliverable: { accent: '#0070AD', chip: 'bg-[#eff6ff] text-[#0070AD] border border-[#bfdbfe]', label: 'Deliverable' },
  task:        { accent: '#7c3aed', chip: 'bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe]', label: 'Task' },
  role:        { accent: '#059669', chip: 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]', label: 'Role' },
  checklist:   { accent: '#16a34a', chip: 'bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]', label: 'Checklist' },
  person:      { accent: '#4f46e5', chip: 'bg-[#eef2ff] text-[#4f46e5] border border-[#e0e7ff]', label: 'Person' },
  step:        { accent: '#0284c7', chip: 'bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]', label: 'L5 step' },
  app:         { accent: '#0070AD', chip: 'bg-[#eaf1ff] text-[#0070AD] border border-[#cdddff]', label: 'Application' },
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Container-level identity: deliverables, tasks, roles and apps render as
// tinted PANELS (boxes inside boxes), so each level of the chain is visibly
// contained by its parent rather than flowing together.
const PANEL: Record<string, { bg: string; border: string; rail: string }> = {
  deliverable: { bg: '#f0f7ff', border: '#c6ddf5', rail: '#0070AD' },
  task:        { bg: '#faf8ff', border: '#ded5f8', rail: '#7c3aed' },
  role:        { bg: '#effaf5', border: '#bfe8d4', rail: '#059669' },
  app:         { bg: '#f0f7ff', border: '#c6ddf5', rail: '#0070AD' },
};

function TreeRow({ item, depth, wide, defaultOpen, trail = [], onDrill, onNavigate, onInspect }: {
  item: MetricItem; depth: number; wide?: boolean; defaultOpen?: boolean; trail?: string[];
  onDrill: (level: string, id: string) => void;
  onNavigate: (href: string) => void;
  // Opens the clicked node in the wide drawer as a detail view (any level,
  // down to a single checklist item). Omitted inside the drawer itself.
  onInspect?: (item: MetricItem, trail: string[]) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen || (depth === 0 && !!wide));
  const kids = item.children ?? [];
  const jump = item.drill ? () => onDrill(item.drill!.level, item.drill!.id) : item.href ? () => onNavigate(item.href!) : undefined;
  // Row body click: inspect in the drawer when available; else jump; else toggle.
  const body = onInspect ? () => onInspect(item, trail) : jump ?? (kids.length ? () => setOpen((o) => !o) : undefined);
  const tag = item.tag ? TAGS[item.tag] : undefined;
  const panel = item.tag ? PANEL[item.tag] : undefined;
  const text = wide ? 'text-[13.5px]' : 'text-[12px]';

  const isRole = item.tag === 'role';
  const isPerson = item.tag === 'person';
  const isCheck = item.tag === 'checklist';

  // Lead marker: role rows show participation as a colored dot, not a tag chip.
  const marker = isPerson ? (
    <span className="mt-[1px] w-[18px] h-[18px] rounded-full bg-[#eef2ff] border border-[#e0e7ff] text-[#4f46e5] text-[8px] font-bold flex items-center justify-center flex-shrink-0" aria-hidden>
      {initials(item.label)}
    </span>
  ) : isCheck ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] flex-shrink-0" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
  ) : isRole ? (
    <span
      className="mt-[6px] w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: item.hint === 'Lead' ? '#0070AD' : '#cbd5e1' }}
      title={item.hint === 'Lead' ? 'Lead role' : 'Supporting role'}
      aria-hidden
    />
  ) : null;

  const row = (
    <div className={`flex items-start gap-1.5 ${panel ? '' : 'rounded-md px-1 py-1 hover:bg-black/[0.03] transition-colors duration-150'}`}>
      {kids.length > 0 && (
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="mt-[4px] flex-shrink-0 text-[#737373] hover:text-[#171717]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
      {marker ?? (kids.length === 0 && !panel ? (
        <span className="mt-[8px] w-[11px] flex-shrink-0 flex justify-center"><span className="w-1 h-1 rounded-full bg-[#d4d4d4]" /></span>
      ) : null)}
      <button
        onClick={body}
        title={onInspect ? 'Open details' : undefined}
        className={`flex-1 min-w-0 text-left ${body ? 'cursor-pointer hover:underline decoration-[#c8d6ea] underline-offset-2' : 'cursor-default'}`}
      >
        <span className={`${text} ${panel || isRole ? 'font-semibold text-[#171717]' : 'text-[#383838]'} leading-snug block`}>
          {item.label}
          {kids.length > 0 && <span className="text-[#a3a3a3] font-normal"> ({kids.length})</span>}
        </span>
        <span className="flex items-center gap-1 flex-wrap mt-0.5 empty:hidden">
          {tag && !isPerson && (
            <span className={`text-[8.5px] font-semibold uppercase tracking-wide rounded px-1.5 py-px ${tag.chip}`}>{tag.label}</span>
          )}
          {item.hint && !isRole && (
            <span className="text-[9.5px] font-medium text-[#525252] bg-[#f4f4f5] border border-[#e4e4e7] rounded px-1.5 py-px">{item.hint}</span>
          )}
        </span>
        {item.sub && <span className="text-[10px] text-[#8a8a8a] block mt-0.5 leading-snug">{item.sub}</span>}
      </button>
      {jump && (
        <button onClick={jump} aria-label="Open" title="Go to" className="mt-[4px] flex-shrink-0 text-[#a3a3a3] hover:text-[#1d4ed8]">
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  );

  const kidsBlock = open && kids.length > 0 && (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {kids.map((c, i) => (
        <TreeRow key={`${c.label}-${i}`} item={c} depth={depth + 1} wide={wide} defaultOpen={defaultOpen} trail={[...trail, item.label]} onDrill={onDrill} onNavigate={onNavigate} onInspect={onInspect} />
      ))}
    </div>
  );

  // Panel levels are boxes inside boxes — tinted background + colored left
  // rail per kind; plain rows (checklist/person/step) sit inside them.
  if (panel) {
    return (
      <div
        className="rounded-lg px-2.5 py-2"
        style={{ background: panel.bg, border: `1px solid ${panel.border}`, borderLeft: `3px solid ${panel.rail}` }}
      >
        {row}
        {kidsBlock}
      </div>
    );
  }
  return (
    <div>
      {row}
      {kidsBlock}
    </div>
  );
}

export default function MetricsSidebar({
  dash, loading, onDrill, onBack, onClose, onViewAll, onViewDetail,
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
}) {
  const navigate = useNavigate();
  // Minimizable: collapse the panel to a thin rail to give the map full width.
  // Always starts collapsed (a thin rail labelled with the selection's name);
  // the user expands it explicitly.
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const toggleCollapsed = () => setCollapsed((c) => !c);
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
      style={{ width: 390, minWidth: 320 }}
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

          {/* Sections (hidden ones back the tile drawers only) */}
          {dash.sections.filter((s) => s.items.length > 0 && !s.hidden).map((section) => {
            const max = Math.max(1, ...section.items.map((i) => i.value));
            const shown = section.items.slice(0, SECTION_LIMIT);
            const hidden = section.items.length - shown.length;
            return (
              // Keyed by dashboard + section so tree expand state resets when
              // the focused node changes (no stale collapse carried across).
              <div key={`${dash.title}·${section.title}`} className="px-4 py-3 border-b border-[#eaeaea] last:border-b-0">
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
                ) : section.kind === 'tree' ? (
                  <div className="flex flex-col gap-1.5">
                    {shown.map((item, i) => (
                      <TreeRow
                        key={`${item.label}-${i}`}
                        item={item}
                        depth={0}
                        defaultOpen={section.expanded}
                        trail={[dash.title]}
                        onDrill={onDrill}
                        onNavigate={(href) => navigate(href)}
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
                      const go = item.drill ? () => onDrill(item.drill!.level, item.drill!.id) : item.href ? () => navigate(item.href!) : undefined;
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
                    {it.illustrative && <span className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3] bg-[#fafafa] border border-[#eaeaea] rounded px-2 py-0.5">Illustrative</span>}
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
                    <div className="mt-4 pt-3 border-t border-[#eaeaea] flex flex-col gap-2">
                      {it.children!.map((c, i) => (
                        <TreeRow key={`${c.label}-${i}`} item={c} depth={0} wide defaultOpen onDrill={(l, id) => drill({ level: l, id })} onNavigate={(href) => { navigate(href); onClose(); }} />
                      ))}
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
