import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX, type DivisionSummary } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';
import ValueStreamDrawer from './ValueStreamDrawer';

// List view (defect backlog 02, D2) — an Excel-like grid of the operating model
// limited to the three levels that carry the real data:
//   Value stream › Sub-process › Step
// (the Domain / Division grouping rows are gone — divisions remain available as
// a filter). Rows are thin, columns are sortable, branches expand/collapse, and
// clicking a row opens the right-hand metrics panel — the SAME MetricsSidebar
// the map uses.

// ── Tree shape (from GET /explorer/tree) ──────────────────────────────────────
type StepL5 = { id: string; step: number; name: string };
type SubProc = { id: string; step: number; name: string; steps: StepL5[] };
type Area = { id: string; step: number; name: string; subProcesses: SubProc[] };
type VS = { id: string; name: string; areas: Area[] };
type Div = { id: string; name: string; higherCategory: string | null; roles: number; valueStreams: VS[] };
type Tree = { company: { id: string; name: string }; divisions: Div[] };

type Category = string;
const catFor = (higherCategory: string | null): Category => higherCategory ?? 'Unassigned';

// Context lets any node open the right-hand metrics panel without prop-drilling.
type MetricsCtxValue = { open: (level: string, id: string) => void; activeKey: string | null; focusVsId: string | null };
const MetricsCtx = createContext<MetricsCtxValue>({ open: () => {}, activeKey: null, focusVsId: null });
const useMetrics = () => useContext(MetricsCtx);

// ── Row chrome ────────────────────────────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// One grid row: indented name cell + the two count columns. Thin (D2.3).
function GridRow({
  depth, leaf, open, onClick, onToggle, num, label, subs, steps, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void; onToggle?: () => void;
  num?: number; label: string; subs?: number | null; steps?: number | null;
  muted?: boolean; strong?: boolean; selected?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={'grid grid-cols-[1fr_110px_80px] items-center gap-2 pr-2 border-b border-[#f5f5f5] last:border-0 transition-colors duration-150 '
        + (selected ? 'bg-[#f5f8ff] ' : '') + (clickable ? 'cursor-pointer hover:bg-[#fafafa]' : '')}
    >
      <div className="flex items-center gap-1.5 py-1 min-w-0" style={{ paddingLeft: depth * 16 + 8 }}>
        <span
          className={'w-3.5 flex-shrink-0 flex items-center' + (onToggle ? ' cursor-pointer' : '')}
          onClick={onToggle ? (e) => { e.stopPropagation(); onToggle(); } : undefined}
        >{!leaf && <Caret open={!!open} />}</span>
        {num != null && <span className="flex items-center justify-center w-4.5 h-4.5 min-w-[18px] rounded-full bg-[#f5f5f5] text-[9px] font-semibold text-[#525252] tnum flex-shrink-0">{num}</span>}
        <span className={'truncate ' + (strong ? 'text-[13px] font-semibold text-[#171717]' : muted ? 'text-[12px] text-[#525252]' : 'text-[13px] text-[#171717]')}>{label}</span>
      </div>
      <span className="text-[11px] text-[#737373] tnum text-right">{subs ?? ''}</span>
      <span className="text-[11px] text-[#737373] tnum text-right">{steps ?? ''}</span>
    </div>
  );
}
const InfoRow = ({ depth, text }: { depth: number; text: string }) => (
  <div style={{ paddingLeft: depth * 16 + 28 }} className="py-1 pr-3 text-[11px] text-[#a3a3a3] italic border-b border-[#f5f5f5]">{text}</div>
);

// ── Nodes — controlled by an expandAll epoch so the header buttons can fold the
// whole grid at once (Excel-style); carets still toggle each branch. ───────────
function StepNode({ step, depth }: { step: SubProc; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  return (
    <GridRow depth={depth} leaf muted selected={activeKey === `step:${step.id}`}
      onClick={() => openMetrics('step', step.id)}
      num={step.step} label={step.name} />
  );
}

function SubProcessNode({ area, depth, epoch, defaultOpen }: { area: Area; depth: number; epoch: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  const { open: openMetrics, activeKey } = useMetrics();
  const steps = area.subProcesses;
  return (
    <>
      <GridRow depth={depth} leaf={steps.length === 0} open={open} selected={activeKey === `step:${area.id}`}
        onClick={() => openMetrics('step', area.id)}
        onToggle={steps.length ? () => setOpen((o) => !o) : undefined}
        num={area.step} label={area.name} steps={steps.length} />
      {open && steps.map((ss) => <StepNode key={ss.id} step={ss} depth={depth + 1} />)}
    </>
  );
}

function ValueStreamNode({ vs, depth, epoch, defaultOpen }: { vs: VS; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey, focusVsId } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusVsId === vs.id) ref.current?.scrollIntoView({ block: 'center' });
  }, [focusVsId, vs.id]);
  const steps = vs.areas.reduce((n, a) => n + a.subProcesses.length, 0);
  return (
    <>
      <div ref={ref}>
        <GridRow depth={depth} leaf={vs.areas.length === 0} open={open} selected={activeKey === `valueStream:${vs.id}`}
          onClick={() => openMetrics('valueStream', vs.id)}
          onToggle={vs.areas.length ? () => setOpen((o) => !o) : undefined}
          label={vs.name} subs={vs.areas.length} steps={steps} />
      </div>
      {open && (vs.areas.length > 0
        ? vs.areas.map((a) => <SubProcessNode key={a.id} area={a} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)
        : <InfoRow depth={depth + 1} text="No sub-processes mapped." />)}
    </>
  );
}

// ── Slim facet dropdown (multi-select) ────────────────────────────────────────
type FilterOption = { id: string; name: string; accent?: string };

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
        className={'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-150 '
          + (count > 0 ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717]')}
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</span>
        <span>{count > 0 ? `${count} selected` : 'All'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[220px] max-h-[300px] overflow-auto rounded-lg border border-[#eaeaea] bg-white shadow-lg p-1">
          {options.length === 0 ? (
            <div className="px-2.5 py-2 text-[12px] text-[#a3a3a3]">No options</div>
          ) : options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2.5 py-1 rounded-md cursor-pointer hover:bg-[#fafafa]">
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="accent-[#171717]" />
              {o.accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.accent }} />}
              <span className="text-[12px] text-[#171717] truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Sort toggle for the grid column headers.
type Sort = { col: 'name' | 'subs' | 'steps'; dir: 1 | -1 };
function SortBtn({ col, sort, onSort, children }: { col: Sort['col']; sort: Sort; onSort: (c: Sort['col']) => void; children: React.ReactNode }) {
  const active = sort.col === col;
  return (
    <button onClick={() => onSort(col)} className={'inline-flex items-center gap-1 hover:text-[#171717] ' + (active ? 'text-[#171717]' : '')}>
      {children}
      <span className={'text-[10px] font-bold ' + (active ? 'text-[#171717]' : 'text-[#a3a3a3]')}>{active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

export default function ListExplorer({ companyName, focusVsId = null }: { companyName: string; divisions?: DivisionSummary[]; streams?: number; focusVsId?: string | null }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facet filters: empty set = no constraint (show all).
  const [catFilter, setCatFilter] = useState<Set<Category>>(new Set());
  const [divFilter, setDivFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ col: 'name', dir: 1 });
  // Expand/collapse-all: bump the epoch so every branch resets to defaultOpen.
  const [allOpen, setAllOpen] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const setAll = (open: boolean) => { setAllOpen(open); setEpoch((n) => n + 1); };

  // Right-hand metrics panel (identical to the map). `base` = the node clicked in
  // the tree; `ovStack` = in-panel drills (role → person → …) just like the map.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  // Value-stream full detail drawer (the standalone page was retired).
  const [vsDetailId, setVsDetailId] = useState<string | null>(null);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  const openMetrics = (level: string, id: string) => { setBase({ level, id }); setOvStack([]); };
  const onDrill = (level: string, id: string) => setOvStack((s) => [...s, { level, id }]);
  const onBack = () => setOvStack((s) => s.slice(0, -1));
  const closeMetrics = () => { setBase(null); setOvStack([]); };

  // Deep-linked focus (value-stream links across the app land here): open the
  // stream's detail in the sidebar; the row scrolls itself into view.
  useEffect(() => {
    if (focusVsId) openMetrics('valueStream', focusVsId);
  }, [focusVsId]); // eslint-disable-line

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

  // ── Facet option lists (domains/divisions remain as FILTERS, not rows). ──
  const divsByCat = useMemo(() => {
    const out: Record<Category, Div[]> = {};
    for (const d of tree?.divisions ?? []) (out[catFor(d.higherCategory)] ??= []).push(d);
    return out;
  }, [tree]);
  const domainsPresent = useMemo(() => Object.keys(divsByCat), [divsByCat]);
  const domainOptions: FilterOption[] = domainsPresent.map((c) => ({ id: c, name: c, accent: DOMAIN_HEX[c] }));
  const divisionOptions: FilterOption[] = domainsPresent
    .filter((c) => catFilter.size === 0 || catFilter.has(c))
    .flatMap((c) => divsByCat[c])
    .map((d) => ({ id: d.id, name: d.name, accent: DOMAIN_HEX[catFor(d.higherCategory)] }));

  // ── Flatten to the value-stream level (dedupe — a stream can sit under
  // several divisions), applying the facet filters + search + sort. ──
  const valueStreams = useMemo(() => {
    const seen = new Map<string, VS>();
    for (const d of tree?.divisions ?? []) {
      if (catFilter.size > 0 && !catFilter.has(catFor(d.higherCategory))) continue;
      if (divFilter.size > 0 && !divFilter.has(d.id)) continue;
      for (const vs of d.valueStreams) if (!seen.has(vs.id)) seen.set(vs.id, vs);
    }
    let list = [...seen.values()];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((vs) =>
        vs.name.toLowerCase().includes(q)
        || vs.areas.some((a) => a.name.toLowerCase().includes(q) || a.subProcesses.some((s) => s.name.toLowerCase().includes(q))));
    }
    const stepsOf = (vs: VS) => vs.areas.reduce((n, a) => n + a.subProcesses.length, 0);
    list.sort((a, b) => {
      const cmp = sort.col === 'name' ? a.name.localeCompare(b.name)
        : sort.col === 'subs' ? a.areas.length - b.areas.length
        : stepsOf(a) - stepsOf(b);
      return cmp * sort.dir || a.name.localeCompare(b.name);
    });
    return list;
  }, [tree, catFilter, divFilter, search, sort]);

  const totals = useMemo(() => {
    let subs = 0, steps = 0;
    for (const vs of valueStreams) { subs += vs.areas.length; for (const a of vs.areas) steps += a.subProcesses.length; }
    return { vs: valueStreams.length, subs, steps };
  }, [valueStreams]);

  const toggleCat = (c: Category) => setCatFilter((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleDiv = (id: string) => setDivFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const anyFilter = catFilter.size > 0 || divFilter.size > 0 || search.trim() !== '';
  const clear = () => { setCatFilter(new Set()); setDivFilter(new Set()); setSearch(''); };

  const toggleSort = (col: Sort['col']) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;

  return (
    <MetricsCtx.Provider value={{ open: openMetrics, activeKey, focusVsId }}>
      {/* Side-by-side: grid scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="px-3 sm:px-4 pt-2 pb-4">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading operating model…</div>
            ) : error ? (
              <div className="text-sm text-[#be123c] py-8 text-center">{error}</div>
            ) : (
              <>
                {/* Slim filter row: search + facets + totals — one line, no fat card (D2.1/D2.3). */}
                {/* pl clears the floating List|Map toggle pinned at the top-left. */}
                <div className="flex items-center gap-2 flex-wrap mb-2 pl-[150px]">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-md border border-[#eaeaea] bg-white px-2.5 py-1 text-[12px] text-[#171717] w-48 focus:outline-none focus:ring-1 focus:ring-[#171717]"
                    aria-label="Search value streams"
                  />
                  <FilterDropdown label="Domain" options={domainOptions} selected={catFilter} onToggle={(id) => toggleCat(id as Category)} />
                  <FilterDropdown label="Division" options={divisionOptions} selected={divFilter} onToggle={toggleDiv} />
                  {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear</button>}
                  <span className="ml-auto text-[11px] text-[#737373] tnum">
                    {totals.vs} value streams · {totals.subs} sub-processes · {totals.steps} steps
                  </span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => setAll(true)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Expand all</button>
                    <button onClick={() => setAll(false)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Collapse all</button>
                  </span>
                </div>

                <div className="card p-0 overflow-hidden">
                  {/* Grid header with sort (D2.4/D2.5) */}
                  <div className="grid grid-cols-[1fr_110px_80px] items-center gap-2 pr-2 border-b border-[#eaeaea] bg-[#fafafa]">
                    <div className="py-1.5 pl-8 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="name" sort={sort} onSort={toggleSort}>Value stream</SortBtn>
                    </div>
                    <div className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="subs" sort={sort} onSort={toggleSort}>Sub-processes</SortBtn>
                    </div>
                    <div className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="steps" sort={sort} onSort={toggleSort}>Steps</SortBtn>
                    </div>
                  </div>
                  {valueStreams.length > 0
                    ? valueStreams.map((vs) => <ValueStreamNode key={vs.id} vs={vs} depth={0} epoch={epoch} defaultOpen={allOpen} />)
                    : <InfoRow depth={0} text="No value streams match the current filters." />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right-hand metrics panel — same component as the map, pushes content (no dimming overlay) */}
        {base && (
          <MetricsSidebar
            dash={dash} loading={dashLoading} onDrill={onDrill}
            onBack={ovStack.length ? onBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection}
            onViewDetail={target?.level === 'valueStream' && target.id ? () => setVsDetailId(target.id) : undefined}
          />
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

        {/* Value-stream full detail — slides over the list in place. */}
        {vsDetailId && <ValueStreamDrawer valueStreamId={vsDetailId} onClose={() => setVsDetailId(null)} />}
      </div>
    </MetricsCtx.Provider>
  );
}
