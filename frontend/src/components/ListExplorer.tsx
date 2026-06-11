import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type DivisionSummary } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';
import ValueStreamDrawer from './ValueStreamDrawer';

// List view (defect backlog 02, D2) — a spreadsheet-style grid of the operating
// model limited to the three levels that carry the real data:
//   Value stream › Sub-process › Step
// Filtering lives IN the column headers (same pattern as the Work tab): the
// name column carries a free-text search, Division a searchable dropdown,
// Domain a plain dropdown, and every column has a sort toggle. Rows are thin,
// branches expand/collapse, and clicking a row opens the right-hand metrics
// panel — the SAME MetricsSidebar the map uses.

// ── Tree shape (from GET /explorer/tree) ──────────────────────────────────────
type StepL5 = { id: string; step: number; name: string };
type SubProc = { id: string; step: number; name: string; steps: StepL5[] };
type Area = { id: string; step: number; name: string; subProcesses: SubProc[] };
type VS = { id: string; name: string; areas: Area[] };
type Div = { id: string; name: string; higherCategory: string | null; roles: number; valueStreams: VS[] };
type Tree = { company: { id: string; name: string }; divisions: Div[] };

const catFor = (higherCategory: string | null): string => higherCategory ?? 'Unassigned';

// Context lets any node open the right-hand metrics panel without prop-drilling.
type MetricsCtxValue = { open: (level: string, id: string) => void; activeKey: string | null; focusVsId: string | null };
const MetricsCtx = createContext<MetricsCtxValue>({ open: () => {}, activeKey: null, focusVsId: null });
const useMetrics = () => useContext(MetricsCtx);

// Shared column template so the header and every row stay aligned:
// name | division | domain | sub-processes | steps
const GRID_COLS = 'grid grid-cols-[minmax(0,1fr)_180px_140px_110px_70px]';

// ── Row chrome ────────────────────────────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// One grid row: indented name cell, the Division/Domain text cells (filled on
// value-stream rows, blank on children) and the two count columns. Column
// dividers (divide-x) give the sheet feel; rows stay thin (D2.3).
function GridRow({
  depth, leaf, open, onClick, onToggle, num, label, division, domain, subs, steps, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void; onToggle?: () => void;
  num?: number; label: string; division?: string; domain?: string; subs?: number | null; steps?: number | null;
  muted?: boolean; strong?: boolean; selected?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={GRID_COLS + ' items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 transition-colors duration-150 '
        + (selected ? 'bg-[#f5f8ff] ' : '') + (clickable ? 'cursor-pointer hover:bg-[#fafafa]' : '')}
    >
      <div className="flex items-center gap-1.5 py-1 pr-2 min-w-0" style={{ paddingLeft: depth * 16 + 8 }}>
        <span
          className={'w-3.5 flex-shrink-0 flex items-center' + (onToggle ? ' cursor-pointer' : '')}
          onClick={onToggle ? (e) => { e.stopPropagation(); onToggle(); } : undefined}
        >{!leaf && <Caret open={!!open} />}</span>
        {num != null && <span className="flex items-center justify-center w-4.5 h-4.5 min-w-[18px] rounded-full bg-[#f5f5f5] text-[9px] font-semibold text-[#525252] tnum flex-shrink-0">{num}</span>}
        <span className={'truncate ' + (strong ? 'text-[13px] font-semibold text-[#171717]' : muted ? 'text-[12px] text-[#525252]' : 'text-[13px] text-[#171717]')}>{label}</span>
      </div>
      <div className="px-2 flex items-center min-w-0"><span className="truncate text-[11px] text-[#525252]">{division ?? ''}</span></div>
      <div className="px-2 flex items-center min-w-0"><span className="truncate text-[11px] text-[#525252]">{domain ?? ''}</span></div>
      <div className="px-2 flex items-center justify-end"><span className="text-[11px] text-[#737373] tnum">{subs ?? ''}</span></div>
      <div className="px-2 flex items-center justify-end"><span className="text-[11px] text-[#737373] tnum">{steps ?? ''}</span></div>
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

function ValueStreamNode({ vs, division, domain, depth, epoch, defaultOpen }: {
  vs: VS; division: string; domain: string; depth: number; epoch: number; defaultOpen: boolean;
}) {
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
          label={vs.name} division={division} domain={domain} subs={vs.areas.length} steps={steps} />
      </div>
      {open && (vs.areas.length > 0
        ? vs.areas.map((a) => <SubProcessNode key={a.id} area={a} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)
        : <InfoRow depth={depth + 1} text="No sub-processes mapped." />)}
    </>
  );
}

// ── Spreadsheet column headers (Work-tab pattern, D2 rework): each header cell
// carries its own filter control plus a sort toggle. ──────────────────────────
type Sort = { col: 'name' | 'division' | 'domain' | 'subs' | 'steps'; dir: 1 | -1 };

function SortToggle({ col, sort, onSort }: { col: Sort['col']; sort: Sort; onSort: (c: Sort['col']) => void }) {
  const active = sort.col === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      title="Sort by this column"
      className={'ml-1 align-middle text-[10px] font-bold ' + (active ? 'text-[#171717]' : 'text-[#a3a3a3] hover:text-[#171717]')}
    >
      {active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}
    </button>
  );
}

const HeaderLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1 whitespace-nowrap">{children}</div>
);

// Free-text filter in the header — used for the name column (searches all levels).
function HeaderSearch({ label, value, onChange, sort }: { label: string; value: string; onChange: (v: string) => void; sort?: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 min-w-0">
      <HeaderLabel>{label}{sort}</HeaderLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter…"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className={'w-full max-w-[280px] rounded border bg-white px-2 py-0.5 text-[11px] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 '
          + (value.trim() ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      />
    </div>
  );
}

// Compact native <select> filter — used for the Domain column.
function HeaderFilter({ label, value, onChange, options, sort }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; sort?: React.ReactNode;
}) {
  const active = value !== 'All';
  return (
    <div className="px-2 py-1.5 min-w-0">
      <HeaderLabel>{label}{sort}</HeaderLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={'appearance-none w-full rounded border bg-white pl-2 pr-6 py-0.5 text-[11px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 '
            + (active ? 'border-[#171717] text-[#171717] font-medium' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

// Searchable dropdown filter — used for the Division column, whose option list
// is long enough to want type-ahead. Closes on outside click; 'All' clears.
function HeaderComboFilter({ label, value, onChange, options, sort }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; sort?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== 'All';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o === 'All' || o.toLowerCase().includes(q));
  function pick(o: string) { onChange(o); setOpen(false); setQuery(''); }

  return (
    <div ref={ref} className="px-2 py-1.5 min-w-0 relative">
      <HeaderLabel>{label}{sort}</HeaderLabel>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={'flex items-center justify-between gap-1 w-full rounded border bg-white pl-2 pr-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 '
          + (active ? 'border-[#171717] text-[#171717] font-medium' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      >
        <span className="truncate">{value}</span>
        <svg className={'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-180' : '')} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 left-2 mt-1 w-[240px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
          <div className="p-1.5 border-b border-[#f5f5f5]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded border border-[#eaeaea] bg-white px-2 py-1 text-xs text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-1.5 text-xs text-[#a3a3a3]">No matches</div>
            ) : filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                className={'block w-full truncate text-left px-2.5 py-1 text-xs hover:bg-[#fafafa] transition-colors duration-100 '
                  + (o === value ? 'text-[#171717] font-medium bg-[#fafafa]' : 'text-[#525252]')}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Plain (sort-only) header — used for the count columns.
function HeaderPlain({ label, sort, right }: { label: string; sort?: React.ReactNode; right?: boolean }) {
  return (
    <div className={'px-2 py-1.5' + (right ? ' text-right' : '')}>
      <HeaderLabel>{label}{sort}</HeaderLabel>
    </div>
  );
}

// One row per value stream, carrying its parent division(s) and domain(s).
type VSRow = { vs: VS; divisions: string[]; domains: string[]; division: string; domain: string };

export default function ListExplorer({ companyName, focusVsId = null }: { companyName: string; divisions?: DivisionSummary[]; streams?: number; focusVsId?: string | null }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header filters: 'All' = no constraint; the name search prunes all levels.
  const [search, setSearch] = useState('');
  const [domainSel, setDomainSel] = useState('All');
  const [divisionSel, setDivisionSel] = useState('All');
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

  // ── Header-filter option lists. Picking a domain narrows the division list
  // (and clears a division pick that no longer applies). ──
  const domainOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of tree?.divisions ?? []) set.add(catFor(d.higherCategory));
    return ['All', ...[...set].sort()];
  }, [tree]);
  const divisionOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of tree?.divisions ?? []) {
      if (domainSel !== 'All' && catFor(d.higherCategory) !== domainSel) continue;
      names.add(d.name);
    }
    return ['All', ...[...names].sort()];
  }, [tree, domainSel]);

  // ── Flatten to the value-stream level (dedupe — a stream can sit under
  // several divisions, so it carries ALL its divisions/domains), applying the
  // header filters + search (prunes across all levels) + sort. ──
  const rows = useMemo(() => {
    const byId = new Map<string, { vs: VS; divisions: Set<string>; domains: Set<string> }>();
    for (const d of tree?.divisions ?? []) {
      const dom = catFor(d.higherCategory);
      for (const vs of d.valueStreams) {
        let e = byId.get(vs.id);
        if (!e) { e = { vs, divisions: new Set(), domains: new Set() }; byId.set(vs.id, e); }
        e.divisions.add(d.name);
        e.domains.add(dom);
      }
    }
    let list: VSRow[] = [...byId.values()].map((e) => {
      const divisions = [...e.divisions].sort();
      const domains = [...e.domains].sort();
      return { vs: e.vs, divisions, domains, division: divisions.join(', '), domain: domains.join(', ') };
    });
    if (domainSel !== 'All') list = list.filter((r) => r.domains.includes(domainSel));
    if (divisionSel !== 'All') list = list.filter((r) => r.divisions.includes(divisionSel));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(({ vs }) =>
        vs.name.toLowerCase().includes(q)
        || vs.areas.some((a) => a.name.toLowerCase().includes(q) || a.subProcesses.some((s) => s.name.toLowerCase().includes(q))));
    }
    const stepsOf = (vs: VS) => vs.areas.reduce((n, a) => n + a.subProcesses.length, 0);
    list.sort((a, b) => {
      const cmp = sort.col === 'name' ? a.vs.name.localeCompare(b.vs.name)
        : sort.col === 'division' ? a.division.localeCompare(b.division)
        : sort.col === 'domain' ? a.domain.localeCompare(b.domain)
        : sort.col === 'subs' ? a.vs.areas.length - b.vs.areas.length
        : stepsOf(a.vs) - stepsOf(b.vs);
      return cmp * sort.dir || a.vs.name.localeCompare(b.vs.name);
    });
    return list;
  }, [tree, domainSel, divisionSel, search, sort]);

  const totals = useMemo(() => {
    let subs = 0, steps = 0;
    for (const { vs } of rows) { subs += vs.areas.length; for (const a of vs.areas) steps += a.subProcesses.length; }
    return { vs: rows.length, subs, steps };
  }, [rows]);

  const anyFilter = domainSel !== 'All' || divisionSel !== 'All' || search.trim() !== '';
  const clear = () => { setDomainSel('All'); setDivisionSel('All'); setSearch(''); };

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
                {/* Very slim strip: totals + expand/collapse (filters moved into the headers).
                    pl clears the floating List|Map toggle pinned at the top-left. */}
                <div className="flex items-center gap-3 flex-wrap mb-1.5 pl-[150px] min-h-[24px]">
                  <span className="text-[11px] text-[#737373] tnum">
                    {totals.vs} value streams · {totals.subs} sub-processes · {totals.steps} steps
                  </span>
                  {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>}
                  <span className="ml-auto flex items-center gap-1">
                    <button onClick={() => setAll(true)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Expand all</button>
                    <button onClick={() => setAll(false)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Collapse all</button>
                  </span>
                </div>

                {/* No overflow-hidden on the card — the Division combo dropdown must escape it. */}
                <div className="card p-0">
                  {/* Spreadsheet header: each cell hosts its filter + sort (Work-tab pattern). */}
                  <div className={GRID_COLS + ' items-stretch divide-x divide-[#eaeaea] border-b border-[#eaeaea] bg-[#fafafa] rounded-t-lg'}>
                    <HeaderSearch label="Value stream" value={search} onChange={setSearch}
                      sort={<SortToggle col="name" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Division" value={divisionSel} onChange={setDivisionSel} options={divisionOptions}
                      sort={<SortToggle col="division" sort={sort} onSort={toggleSort} />} />
                    <HeaderFilter label="Domain" value={domainSel} onChange={(v) => { setDomainSel(v); setDivisionSel('All'); }} options={domainOptions}
                      sort={<SortToggle col="domain" sort={sort} onSort={toggleSort} />} />
                    <HeaderPlain right label="Sub-processes" sort={<SortToggle col="subs" sort={sort} onSort={toggleSort} />} />
                    <HeaderPlain right label="Steps" sort={<SortToggle col="steps" sort={sort} onSort={toggleSort} />} />
                  </div>
                  <div className="rounded-b-lg overflow-hidden">
                    {rows.length > 0
                      ? rows.map((r) => (
                          <ValueStreamNode key={r.vs.id} vs={r.vs} division={r.division} domain={r.domain}
                            depth={0} epoch={epoch} defaultOpen={allOpen} />
                        ))
                      : <InfoRow depth={0} text="No value streams match the current filters." />}
                  </div>
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
