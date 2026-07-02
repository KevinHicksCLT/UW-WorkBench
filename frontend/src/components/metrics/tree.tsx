/**
 * Shared model + tree rendering for the metrics sidebar/drawer — the dashboard
 * payload types, formatting helpers, the per-tag visual identity of the
 * deliverable chain, and the nested TreeRow/TreeChildren renderers. Extracted
 * verbatim from MetricsSidebar.tsx.
 */
import { Fragment, useState } from 'react';

export type Fmt = 'money' | 'years' | 'number';
// `href` links out to an app page (e.g. /applications); `children` nests items
// for `tree` sections (deliverable → role → task → checklist → application);
// `tag` names what the row IS so it renders with a consistent color + chip.
export type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string }; href?: string; children?: MetricItem[]; tag?: string; trail?: string };
// A `hidden` section never renders inline — it backs a tile's consolidated
// drawer (tile.drawer names the section). An `expanded` tree opens every level
// on load (the L5 deliverable chain). A section carrying `emptyText` renders
// even with no items (the primary drill groups: Deliverables / Roles / Tasks /
// Checklist), showing that text as an honest empty state.
export type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi' | 'tree'; items: MetricItem[]; illustrative?: boolean; hidden?: boolean; expanded?: boolean; emptyText?: string };
export type Dashboard = {
  level: string;
  title: string;
  subtitle?: string;
  tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean; drawer?: string }[];
  sections: MetricSection[];
};

export const LEVEL_LABEL: Record<string, string> = {
  company: 'Enterprise', domain: '', division: 'Division', department: 'Department',
  valueStream: 'Process Level 3', step: 'Process Level 4', leafStep: 'Process Level 5', role: 'Role',
};

export const BAR = '#2563eb';

// Sidebar is narrow (300px), so long lists overflow/truncate. Cap each section to
// a few rows; the overflow opens the comprehensive view in a wide drawer.
export const SECTION_LIMIT = 6;

function money(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}
export function fmt(n: number, f?: Fmt) {
  if (f === 'money') return money(n);
  if (f === 'years') return `${n} yr`;
  return n >= 1000 ? n.toLocaleString() : String(n);
}

// ── Nested tree rows (kind: 'tree') ─────────────────────────────────────────
// Deliverable → responsible role → task → checklist → where the work is done
// (application), color-coded by `tag`. Top-level deliverables render
// as accent cards; nested levels hang off an indent guide. `defaultOpen`
// (section.expanded) opens the whole chain.

// Per-tag visual identity: accent color, chip styling, and chip label. One
// clean hue per level — Capgemini blue (deliverable) → emerald (role) →
// violet (task) → green check (checklist) → blue (application) — so the
// hierarchy reads at a glance.
export const TAGS: Record<string, { accent: string; chip: string; label: string }> = {
  deliverable: { accent: '#0070AD', chip: 'bg-[#eff6ff] text-[#0070AD] border border-[#bfdbfe]', label: 'Deliverable' },
  task:        { accent: '#7c3aed', chip: 'bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe]', label: 'Task' },
  role:        { accent: '#059669', chip: 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]', label: 'Role' },
  checklist:   { accent: '#16a34a', chip: 'bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]', label: 'Checklist' },
  step:        { accent: '#0284c7', chip: 'bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]', label: 'L5 step' },
  app:         { accent: '#0070AD', chip: 'bg-[#eaf1ff] text-[#0070AD] border border-[#cdddff]', label: 'Application' },
};

// ── Chain legend ─────────────────────────────────────────────────────────────
// The connection order, spelled out above the chain so the nesting reads as a
// flow: Deliverable → Role → Checklist → Application. (The task concept was
// dropped — checklist items now hang directly under each role.)
const CHAIN_ORDER: (keyof typeof TAGS)[] = ['deliverable', 'role', 'checklist', 'app'];
export function ChainLegend({ wide }: { wide?: boolean }) {
  return (
    <div className={`flex items-center flex-wrap gap-y-1 ${wide ? 'mb-3' : 'mb-2.5'}`}>
      {CHAIN_ORDER.map((k, i) => (
        <span key={k} className="flex items-center">
          {i > 0 && (
            <svg width="9" height="9" viewBox="0 0 13 13" fill="none" className="mx-0.5 text-[#c4c4c4] flex-shrink-0" aria-hidden>
              <path d="M2 6.5h9M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className={`text-[8px] font-semibold uppercase tracking-wide rounded px-1 py-px ${TAGS[k].chip}`}>{TAGS[k].label}</span>
        </span>
      ))}
    </div>
  );
}

// A tree section whose top-level rows are deliverables IS the connected chain —
// it gets the legend.
export const isChainSection = (s: MetricSection) => s.kind === 'tree' && s.items.some((i) => i.tag === 'deliverable');

// Connector captions between chain levels: a tiny colored label above each run
// of same-tag children says what the nesting MEANS, so the user doesn't have
// to infer the relationship from indentation alone.
const GROUP_LABEL: Record<string, string> = {
  role: 'Responsible roles',
  task: 'Tasks',
  checklist: 'Checklist',
  app: 'Supporting application',
  step: 'Produced by step',
};

// Children of a tree row, with a connector caption wherever the tag changes.
export function TreeChildren({ items, depth, wide, defaultOpen, trail, onDrill, onNavigate, onInspect }: {
  items: MetricItem[]; depth: number; wide?: boolean; defaultOpen?: boolean; trail?: string[];
  onDrill: (level: string, id: string) => void;
  onNavigate: (href: string) => void;
  onInspect?: (item: MetricItem, trail: string[]) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {items.map((c, i) => {
        const label = c.tag ? GROUP_LABEL[c.tag] : undefined;
        const showHeader = !!label && (i === 0 || items[i - 1].tag !== c.tag);
        return (
          <Fragment key={`${c.label}-${i}`}>
            {showHeader && (
              <div className="flex items-center gap-1 mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em]" style={{ color: TAGS[c.tag!]?.accent }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden>
                  <path d="M4 4v8a4 4 0 004 4h12M15 11l5 5-5 5" />
                </svg>
                {label}
              </div>
            )}
            <TreeRow item={c} depth={depth} wide={wide} defaultOpen={defaultOpen} trail={trail} onDrill={onDrill} onNavigate={onNavigate} onInspect={onInspect} />
          </Fragment>
        );
      })}
    </div>
  );
}

// Container-level identity: deliverables, tasks, roles and apps render as
// tinted PANELS (boxes inside boxes), so each level of the chain is visibly
// contained by its parent rather than flowing together.
const PANEL: Record<string, { bg: string; border: string; rail: string }> = {
  deliverable: { bg: '#f0f7ff', border: '#c6ddf5', rail: '#0070AD' },
  task:        { bg: '#faf8ff', border: '#ded5f8', rail: '#7c3aed' },
  role:        { bg: '#effaf5', border: '#bfe8d4', rail: '#059669' },
  app:         { bg: '#f0f7ff', border: '#c6ddf5', rail: '#0070AD' },
};

export function TreeRow({ item, depth, wide, defaultOpen, trail = [], onDrill, onNavigate, onInspect }: {
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
  const panel = item.tag ? PANEL[item.tag] : undefined;
  const text = wide ? 'text-[13.5px]' : 'text-[12px]';

  const isRole = item.tag === 'role';
  const isCheck = item.tag === 'checklist';

  // Lead marker: role rows show participation as a colored dot, not a tag chip.
  const marker = isCheck ? (
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
    <TreeChildren items={kids} depth={depth + 1} wide={wide} defaultOpen={defaultOpen} trail={[...trail, item.label]} onDrill={onDrill} onNavigate={onNavigate} onInspect={onInspect} />
  );

  // Panel levels are boxes inside boxes — tinted background + colored left
  // rail per kind; plain rows (checklist/step) sit inside them.
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
