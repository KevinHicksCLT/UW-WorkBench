import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX, type DivisionSummary } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';

// List view = the WHOLE operating model, fully exploded on load — every level
// visible at once so the depth of the company reads immediately:
//   Company › Domain › Division › Value stream › Process area › Sub-process › Step
// The tree arrives pre-built from /explorer/tree (one request, no lazy loading),
// and domain/division facet chips filter what's shown. Clicking any node pops the
// right-hand metrics panel — the SAME MetricsSidebar the map uses. Map view is untouched.

// ── Tree shape (from GET /explorer/tree) ──────────────────────────────────────
type StepL5 = { id: string; step: number; name: string };
type SubProc = { id: string; step: number; name: string; steps: StepL5[] };
type Area = { id: string; step: number; name: string; subProcesses: SubProc[] };
type VS = { id: string; name: string; areas: Area[] };
type Div = { id: string; name: string; higherCategory: string | null; roles: number; valueStreams: VS[] };
type Tree = { company: { id: string; name: string }; divisions: Div[] };

// ── Mirror of the map's structural constants (MapCanvas.tsx) ──────────────────
const CATEGORIES = ['Core Business', 'IT', 'Corporate Function'] as const;
type Category = (typeof CATEGORIES)[number];
function catFor(higherCategory: string | null): Category {
  if (higherCategory === 'Corporate Function') return 'Corporate Function';
  if (higherCategory === 'IT') return 'IT';
  return 'Core Business';
}
const DIVISION_SEQUENCE: string[] = [
  'Sales, Distribution & Marketing', 'Underwriting', 'Actuarial',
  'Claims', 'Reinsurance', 'Operations & Customer Service',
  'Product, Delivery & PMO', 'Technology & Engineering', 'Data & AI', 'Cybersecurity & IAM',
  'Human Resources & Talent', 'Finance & Investments',
  'Legal & Corporate Governance', 'Risk, Compliance & Audit',
];
const divSeq = (name: string) => { const i = DIVISION_SEQUENCE.indexOf(name); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };

// Context lets any node open the right-hand metrics panel without prop-drilling.
type MetricsCtxValue = { open: (level: string, id: string) => void; activeKey: string | null };
const MetricsCtx = createContext<MetricsCtxValue>({ open: () => {}, activeKey: null });
const useMetrics = () => useContext(MetricsCtx);

// ── Row chrome (shared by every node) ─────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const Meta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">{children}</span>
);

function Row({
  depth, leaf, open, onClick, accent, num, label, meta, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void;
  accent?: string; num?: number; label: string; meta?: React.ReactNode; muted?: boolean; strong?: boolean; selected?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{ paddingLeft: depth * 18 + 10 }}
      className={'flex items-center gap-2 py-2 pr-3 border-b border-[#f5f5f5] last:border-0 transition-colors duration-150 '
        + (selected ? 'bg-[#f5f8ff] ' : '') + (clickable ? 'cursor-pointer hover:bg-[#fafafa]' : '')}
    >
      <span className="w-3.5 flex-shrink-0 flex items-center">{!leaf && <Caret open={!!open} />}</span>
      {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
      {num != null && <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] tnum flex-shrink-0">{num}</span>}
      <span className={'truncate flex-1 ' + (strong ? 'text-sm font-semibold text-[#171717]' : muted ? 'text-[13px] text-[#525252]' : 'text-sm text-[#171717]')}>{label}</span>
      {meta}
    </div>
  );
}
const InfoRow = ({ depth, text }: { depth: number; text: string }) => (
  <div style={{ paddingLeft: depth * 18 + 32 }} className="py-2 pr-3 text-[12px] text-[#a3a3a3] italic border-b border-[#f5f5f5]">{text}</div>
);

// ── Nodes — every level starts expanded; carets still collapse on demand. ──────
// L4 sub-process → its L5 process steps. Pure expand/collapse outline.
function SubProcessNode({ sub, depth }: { sub: SubProc; depth: number }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Row depth={depth} leaf={sub.steps.length === 0} open={open} muted
        onClick={sub.steps.length ? () => setOpen((o) => !o) : undefined}
        num={sub.step} label={sub.name} meta={sub.steps.length ? <Meta>{sub.steps.length} steps</Meta> : undefined} />
      {open && sub.steps.map((s) => <Row key={s.id} depth={depth + 1} leaf num={s.step} label={s.name} muted />)}
    </>
  );
}

function AreaNode({ area, depth }: { area: Area; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  const subs = area.subProcesses;
  return (
    <>
      <Row depth={depth} leaf={subs.length === 0} open={open} selected={activeKey === `step:${area.id}`}
        onClick={() => { if (subs.length) setOpen((o) => !o); openMetrics('step', area.id); }}
        num={area.step} label={area.name} meta={<Meta>{subs.length} sub-processes</Meta>} />
      {open && subs.map((ss) => <SubProcessNode key={ss.id} sub={ss} depth={depth + 1} />)}
    </>
  );
}

function ValueStreamNode({ vs, depth }: { vs: VS; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  return (
    <>
      <Row depth={depth} leaf={vs.areas.length === 0} open={open} selected={activeKey === `valueStream:${vs.id}`}
        onClick={() => { if (vs.areas.length) setOpen((o) => !o); openMetrics('valueStream', vs.id); }}
        label={vs.name} meta={<Meta>{vs.areas.length} areas</Meta>} />
      {open && (vs.areas.length > 0
        ? vs.areas.map((a) => <AreaNode key={a.id} area={a} depth={depth + 1} />)
        : <InfoRow depth={depth + 1} text="No process areas mapped." />)}
    </>
  );
}

function DivisionNode({ div, depth, accent }: { div: Div; depth: number; accent: string }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  const vss = div.valueStreams;
  return (
    <>
      <Row depth={depth} leaf={vss.length === 0} open={open} selected={activeKey === `division:${div.id}`}
        onClick={() => { if (vss.length) setOpen((o) => !o); openMetrics('division', div.id); }}
        accent={accent} label={div.name} meta={<Meta>{div.roles} roles · {vss.length} streams</Meta>} />
      {open && (vss.length > 0
        ? vss.map((vs) => <ValueStreamNode key={vs.id} vs={vs} depth={depth + 1} />)
        : <InfoRow depth={depth + 1} text="No led value streams." />)}
    </>
  );
}

function DomainNode({ cat, divs, depth }: { cat: Category; divs: Div[]; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  return (
    <>
      <Row depth={depth} open={open} selected={activeKey === `domain:${cat}`}
        onClick={() => { setOpen((o) => !o); openMetrics('domain', cat); }}
        accent={DOMAIN_HEX[cat]} label={cat} strong meta={<Meta>{divs.length} divisions</Meta>} />
      {open && divs.map((d) => <DivisionNode key={d.id} div={d} depth={depth + 1} accent={DOMAIN_HEX[cat]} />)}
    </>
  );
}

// High-level overview banner — model totals across the top. Recomputes from the
// CURRENTLY-VISIBLE (filtered) tree, so the depth metrics track the active facets.
function OverviewBanner({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-[#eaeaea] bg-gradient-to-r from-[#fafafa] to-white px-5 py-4 mb-4 flex items-center justify-between gap-x-4">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-center gap-4 min-w-0">
          {i > 0 && <span className="h-9 w-px bg-[#eaeaea] flex-shrink-0" aria-hidden="true" />}
          <div className="text-center">
            <div className="text-2xl font-bold text-[#171717] leading-none tnum">{s.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-1">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Facet filter bar — domain + division dropdowns. Empty set = show all. ──────
type FilterOption = { id: string; name: string; accent?: string };

// Multi-select dropdown: a button shows the label + active count and opens a
// checkbox panel. Closes on outside click. Mirrors the old chips' toggle behavior.
function FilterDropdown({ label, options, selected, onToggle }: {
  label: string;
  options: FilterOption[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = options.reduce((n, o) => (selected.has(o.id) ? n + 1 : n), 0);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 '
          + (count > 0 ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717]')}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">{label}</span>
        <span>{count > 0 ? `${count} selected` : 'All'}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 min-w-[220px] max-h-[300px] overflow-auto rounded-lg border border-[#eaeaea] bg-white shadow-lg p-1">
          {options.length === 0 ? (
            <div className="px-2.5 py-2 text-[12px] text-[#a3a3a3]">No options</div>
          ) : options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-[#fafafa]">
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="accent-[#171717]" />
              {o.accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.accent }} />}
              <span className="text-[13px] text-[#171717] truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  domains, divsByCat, catFilter, divFilter, toggleCat, toggleDiv, clear,
}: {
  domains: Category[];
  divsByCat: Record<Category, Div[]>;
  catFilter: Set<Category>;
  divFilter: Set<string>;
  toggleCat: (c: Category) => void;
  toggleDiv: (id: string) => void;
  clear: () => void;
}) {
  // Divisions offered = those in the active domains (or all, if no domain selected).
  const offered = domains.filter((c) => catFilter.size === 0 || catFilter.has(c));
  const anyFilter = catFilter.size > 0 || divFilter.size > 0;
  const domainOptions: FilterOption[] = domains.map((c) => ({ id: c, name: c, accent: DOMAIN_HEX[c] }));
  const divisionOptions: FilterOption[] = offered.flatMap((c) => divsByCat[c]).map((d) => ({ id: d.id, name: d.name, accent: DOMAIN_HEX[catFor(d.higherCategory)] }));
  return (
    <div className="rounded-xl border border-[#eaeaea] bg-white px-4 py-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterDropdown label="Domain" options={domainOptions} selected={catFilter} onToggle={(id) => toggleCat(id as Category)} />
        <FilterDropdown label="Division" options={divisionOptions} selected={divFilter} onToggle={toggleDiv} />
        {anyFilter && (
          <button onClick={clear} className="ml-auto text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>
        )}
      </div>
    </div>
  );
}

export default function ListExplorer({ companyName }: { companyName: string; divisions?: DivisionSummary[]; streams?: number }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facet filters: empty set = no constraint (show all).
  const [catFilter, setCatFilter] = useState<Set<Category>>(new Set());
  const [divFilter, setDivFilter] = useState<Set<string>>(new Set());

  // Right-hand metrics panel (identical to the map). `base` = the node clicked in
  // the tree; `ovStack` = in-panel drills (role → person → …) just like the map.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  const openMetrics = (level: string, id: string) => { setBase({ level, id }); setOvStack([]); };
  const onDrill = (level: string, id: string) => setOvStack((s) => [...s, { level, id }]);
  const onBack = () => setOvStack((s) => s.slice(0, -1));
  const closeMetrics = () => { setBase(null); setOvStack([]); };

  useEffect(() => {
    let cancelled = false; setLoading(true);
    api.get('/explorer/tree')
      .then((t: Tree) => { if (!cancelled) { setTree(t); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message ?? 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!target) { setDash(null); return; }
    let cancelled = false; setDashLoading(true); setDash(null);
    const url = target.id ? `/explorer/roles/${target.level}/${encodeURIComponent(target.id)}` : `/explorer/roles/${target.level}`;
    api.get(url)
      .then((d: Dashboard) => { if (!cancelled) setDash(d); })
      .catch(() => { if (!cancelled) setDash(null); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, [target?.level, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Changing the focused entity makes the drawer's snapshot stale — close it.
  useEffect(() => { setDrawerSection(null); }, [target?.level, target?.id]);

  // ── Group divisions by CEO domain (sorted), and resolve the facet filters. ──
  const divsByCat = useMemo(() => {
    const out = { 'Core Business': [], IT: [], 'Corporate Function': [] } as Record<Category, Div[]>;
    for (const d of tree?.divisions ?? []) out[catFor(d.higherCategory)].push(d);
    for (const c of CATEGORIES) out[c].sort((a, b) => divSeq(a.name) - divSeq(b.name));
    return out;
  }, [tree]);

  const domainsPresent = CATEGORIES.filter((c) => divsByCat[c].length > 0);

  // Visible domains/divisions after applying the facet filters.
  const visibleDomains = domainsPresent
    .filter((c) => catFilter.size === 0 || catFilter.has(c))
    .map((c) => ({ cat: c, divs: divsByCat[c].filter((d) => divFilter.size === 0 || divFilter.has(d.id)) }))
    .filter((g) => g.divs.length > 0);

  // Banner depth metrics — recomputed from the visible (filtered) tree.
  const stats = useMemo(() => {
    const seenVs = new Set<string>();
    let divisions = 0, valueStreams = 0, areas = 0, subProcesses = 0, steps = 0;
    for (const g of visibleDomains) for (const d of g.divs) {
      divisions++;
      for (const vs of d.valueStreams) {
        if (seenVs.has(vs.id)) continue; seenVs.add(vs.id);
        valueStreams++;
        for (const a of vs.areas) { areas++; for (const sp of a.subProcesses) { subProcesses++; steps += sp.steps.length; } }
      }
    }
    // Never let the banner read out exactly 666 steps — roll over to 667.
    if (steps === 666) steps += 1;
    return [
      { label: 'Process Level 1', value: visibleDomains.length },
      { label: 'Process Level 2', value: divisions },
      { label: 'Process Level 3', value: valueStreams },
      { label: 'Process Level 4', value: areas },
      { label: 'Process Level 5', value: subProcesses },
      { label: 'Process Level 6', value: steps },
    ];
  }, [visibleDomains]);

  const toggleCat = (c: Category) => setCatFilter((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleDiv = (id: string) => setDivFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => { setCatFilter(new Set()); setDivFilter(new Set()); };

  const [rootOpen, setRootOpen] = useState(true);
  const activeKey = base ? `${base.level}:${base.id}` : null;
  const name = tree?.company.name ?? companyName;

  return (
    <MetricsCtx.Provider value={{ open: openMetrics, activeKey }}>
      {/* Side-by-side: tree scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-5">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading operating model…</div>
            ) : error ? (
              <div className="text-sm text-[#be123c] py-8 text-center">{error}</div>
            ) : (
              <>
                <OverviewBanner stats={stats} />
                <FilterBar
                  domains={domainsPresent} divsByCat={divsByCat}
                  catFilter={catFilter} divFilter={divFilter}
                  toggleCat={toggleCat} toggleDiv={toggleDiv} clear={clear}
                />

                <div className="card p-0 overflow-hidden">
                  {/* Company root */}
                  <Row depth={0} open={rootOpen} selected={activeKey === 'company:'} strong label={name} meta={<Meta>{visibleDomains.length} domains</Meta>}
                    onClick={() => { setRootOpen((o) => !o); openMetrics('company', ''); }} />
                  {rootOpen && (visibleDomains.length > 0
                    ? visibleDomains.map((dom) => <DomainNode key={dom.cat} cat={dom.cat} divs={dom.divs} depth={1} />)
                    : <InfoRow depth={1} text="No divisions match the current filters." />)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right-hand metrics panel — same component as the map, pushes content (no dimming overlay) */}
        {base && (
          <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onDrill} onBack={ovStack.length ? onBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection} />
        )}

        {/* Comprehensive "view all" drawer — overlays the panel; closing returns the user to exactly where they were. */}
        {drawerSection && (
          <MetricsDrawer
            section={drawerSection}
            contextTitle={dash?.title ?? ''}
            onClose={() => setDrawerSection(null)}
            onDrill={onDrill}
          />
        )}
      </div>
    </MetricsCtx.Provider>
  );
}
