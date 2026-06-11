import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';

// Org List view (defect backlog 02, D4) — a spreadsheet-style grid of the org
// spine, the mirror image of the Value Streams list (ListExplorer):
//   Domain › Division › Department › Role
// People are NOT rendered — the tree stops at Role (D4.2). Filtering lives IN
// the column headers (same pattern as the Work tab): the name column carries a
// free-text search, Division a searchable dropdown, Domain a plain dropdown.
// Rows are thin, branches expand/collapse (with Expand/Collapse-all), and
// clicking a row opens the SAME right-hand MetricsSidebar the map and
// value-stream list use. The box-grid drill-down (OrgTable) is untouched.

// ── Tree shape (from GET /explorer/org-table) ─────────────────────────────────
type Part = { valueStreamId: string; valueStreamName: string; domain: string | null; participationType: string; l3: string | null; l4: string | null };
type RoleNode = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; peopleCount: number; valueStreamCount: number; participations: Part[] };
type DeptNode = { id: string; name: string; roles: RoleNode[]; roleCount: number; peopleCount: number };
type DivNode = { id: string; name: string; segment: string; departments: DeptNode[]; looseRoles: RoleNode[]; roleCount: number; peopleCount: number };
type SegNode = { name: string; divisions: DivNode[]; divisionCount: number; roleCount: number; peopleCount: number };
type OrgData = {
  company: { id: string; name: string };
  totals: { segments: number; divisions: number; departments: number; roles: number; people: number };
  segments: SegNode[];
};

// Count helpers — derived from the (possibly search-pruned) arrays so the
// columns always agree with the rows actually rendered.
const divRoleCount = (d: DivNode) => d.departments.reduce((n, t) => n + t.roles.length, 0) + d.looseRoles.length;
const segDeptCount = (s: SegNode) => s.divisions.reduce((n, d) => n + d.departments.length, 0);
const segRoleCount = (s: SegNode) => s.divisions.reduce((n, d) => n + divRoleCount(d), 0);

// Context lets any node open the right-hand metrics panel without prop-drilling.
type MetricsCtxValue = { open: (level: string, id: string) => void; activeKey: string | null };
const MetricsCtx = createContext<MetricsCtxValue>({ open: () => {}, activeKey: null });
const useMetrics = () => useContext(MetricsCtx);

// Shared column template so the header and every row stay aligned:
// name | division | domain | departments | roles
const GRID_COLS = 'grid grid-cols-[minmax(0,1fr)_180px_140px_110px_70px]';

// ── Row chrome ────────────────────────────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// One grid row: indented name cell, the Division/Domain text cells (filled where
// the row has a sensible value, blank otherwise) and the two count columns.
// Column dividers (divide-x) give the sheet feel; rows stay thin (D4.1).
function GridRow({
  depth, leaf, open, onClick, onToggle, accent, label, division, domain, depts, roles, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void; onToggle?: () => void;
  accent?: string; label: string; division?: string; domain?: string; depts?: number | null; roles?: number | null;
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
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
        <span className={'truncate ' + (strong ? 'text-[13px] font-semibold text-[#171717]' : muted ? 'text-[12px] text-[#525252]' : 'text-[13px] text-[#171717]')}>{label}</span>
      </div>
      <div className="px-2 flex items-center min-w-0"><span className="truncate text-[11px] text-[#525252]">{division ?? ''}</span></div>
      <div className="px-2 flex items-center min-w-0"><span className="truncate text-[11px] text-[#525252]">{domain ?? ''}</span></div>
      <div className="px-2 flex items-center justify-end"><span className="text-[11px] text-[#737373] tnum">{depts ?? ''}</span></div>
      <div className="px-2 flex items-center justify-end"><span className="text-[11px] text-[#737373] tnum">{roles ?? ''}</span></div>
    </div>
  );
}
const InfoRow = ({ depth, text }: { depth: number; text: string }) => (
  <div style={{ paddingLeft: depth * 16 + 28 }} className="py-1 pr-3 text-[11px] text-[#a3a3a3] italic border-b border-[#f5f5f5]">{text}</div>
);

// ── Nodes — controlled by an expandAll epoch so the header buttons can fold the
// whole grid at once (Excel-style); carets still toggle each branch. ───────────
// A role is a leaf (people are not rendered — D4.2); clicking opens its dashboard.
// Each level carries its parent division name down so the Division column reads
// like a filled spreadsheet column.
function RoleRow({ role, division, depth }: { role: RoleNode; division?: string; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  return (
    <GridRow depth={depth} leaf muted selected={activeKey === `role:${role.id}`}
      onClick={() => openMetrics('role', role.id)} label={role.name} division={division} />
  );
}

function DeptNodeC({ dept, division, depth, epoch, defaultOpen }: { dept: DeptNode; division?: string; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  return (
    <>
      <GridRow depth={depth} leaf={dept.roles.length === 0} open={open} selected={activeKey === `department:${dept.id}`}
        onClick={() => openMetrics('department', dept.id)}
        onToggle={dept.roles.length ? () => setOpen((o) => !o) : undefined}
        label={dept.name} division={division} roles={dept.roles.length} />
      {open && (dept.roles.length > 0
        ? dept.roles.map((r) => <RoleRow key={r.id} role={r} division={division} depth={depth + 1} />)
        : <InfoRow depth={depth + 1} text="No roles in this team." />)}
    </>
  );
}

function DivNodeC({ div, domain, depth, epoch, defaultOpen }: { div: DivNode; domain: string; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  const hasChildren = div.departments.length > 0 || div.looseRoles.length > 0;
  return (
    <>
      <GridRow depth={depth} leaf={!hasChildren} open={open} selected={activeKey === `division:${div.id}`}
        onClick={() => openMetrics('division', div.id)}
        onToggle={hasChildren ? () => setOpen((o) => !o) : undefined}
        label={div.name} domain={domain} depts={div.departments.length} roles={divRoleCount(div)} />
      {open && (
        <>
          {div.departments.map((d) => <DeptNodeC key={d.id} dept={d} division={div.name} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)}
          {div.looseRoles.length > 0 && (
            <DeptNodeC
              key={`__loose:${div.id}`}
              dept={{ id: `__loose:${div.id}`, name: 'Direct to division', roles: div.looseRoles, roleCount: div.looseRoles.length, peopleCount: 0 }}
              division={div.name} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen}
            />
          )}
          {!hasChildren && <InfoRow depth={depth + 1} text="No teams or roles." />}
        </>
      )}
    </>
  );
}

function SegmentNodeC({ seg, depth, epoch, defaultOpen }: { seg: SegNode; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  const accent = DOMAIN_HEX[seg.name] ?? '#94a3b8';
  return (
    <>
      <GridRow depth={depth} leaf={seg.divisions.length === 0} open={open} accent={accent} strong selected={activeKey === `domain:${seg.name}`}
        onClick={() => openMetrics('domain', seg.name)}
        onToggle={seg.divisions.length ? () => setOpen((o) => !o) : undefined}
        label={seg.name} depts={segDeptCount(seg)} roles={segRoleCount(seg)} />
      {open && seg.divisions.map((d) => <DivNodeC key={d.id} div={d} domain={seg.name} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)}
    </>
  );
}

// ── Spreadsheet column headers (Work-tab pattern, D4 rework): each header cell
// carries its own filter control plus a sort toggle. ──────────────────────────
type Sort = { col: 'name' | 'depts' | 'roles'; dir: 1 | -1 };

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

export default function OrgListExplorer() {
  const [data, setData] = useState<OrgData | null>(null);
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

  // Right-hand metrics panel — identical to the map / value-stream list.
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
    api.get('/explorer/org-table')
      .then((d: OrgData) => { if (!cancelled) { setData(d); setLoading(false); } })
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

  // Visible tree: header filters → search prune (a matching node keeps its whole
  // subtree; otherwise only matching descendants survive) → recursive sort.
  const visibleSegments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hit = (s: string) => s.toLowerCase().includes(q);

    const pruneDept = (dept: DeptNode): DeptNode | null => {
      if (!q || hit(dept.name)) return dept;
      const roles = dept.roles.filter((r) => hit(r.name));
      return roles.length ? { ...dept, roles } : null;
    };
    const pruneDiv = (div: DivNode): DivNode | null => {
      if (!q || hit(div.name)) return div;
      const departments = div.departments.map(pruneDept).filter((d): d is DeptNode => d !== null);
      const looseRoles = div.looseRoles.filter((r) => hit(r.name));
      return departments.length || looseRoles.length ? { ...div, departments, looseRoles } : null;
    };

    const cmp = (name: [string, string], depts: [number, number], roles: [number, number]) => {
      const c = sort.col === 'name' ? name[0].localeCompare(name[1])
        : sort.col === 'depts' ? depts[0] - depts[1]
        : roles[0] - roles[1];
      return c * sort.dir || name[0].localeCompare(name[1]);
    };
    const sortRoles = (rs: RoleNode[]) => [...rs].sort((a, b) => cmp([a.name, b.name], [0, 0], [0, 0]));

    return (data?.segments ?? [])
      .filter((s) => domainSel === 'All' || s.name === domainSel)
      .map((s) => ({ ...s, divisions: s.divisions.filter((d) => divisionSel === 'All' || d.name === divisionSel) }))
      .map((s) => (!q || hit(s.name) ? s : { ...s, divisions: s.divisions.map(pruneDiv).filter((d): d is DivNode => d !== null) }))
      .filter((s) => s.divisions.length > 0)
      .map((s) => ({
        ...s,
        divisions: s.divisions
          .map((d) => ({
            ...d,
            departments: d.departments
              .map((t) => ({ ...t, roles: sortRoles(t.roles) }))
              .sort((a, b) => cmp([a.name, b.name], [0, 0], [a.roles.length, b.roles.length])),
            looseRoles: sortRoles(d.looseRoles),
          }))
          .sort((a, b) => cmp([a.name, b.name], [a.departments.length, b.departments.length], [divRoleCount(a), divRoleCount(b)])),
      }))
      .sort((a, b) => cmp([a.name, b.name], [segDeptCount(a), segDeptCount(b)], [segRoleCount(a), segRoleCount(b)]));
  }, [data, domainSel, divisionSel, search, sort]);

  // Totals for the slim strip — recomputed from the visible (filtered) tree.
  const totals = useMemo(() => {
    let divisions = 0, departments = 0, roles = 0;
    for (const s of visibleSegments) for (const d of s.divisions) {
      divisions++;
      departments += d.departments.length;
      roles += divRoleCount(d);
    }
    return { domains: visibleSegments.length, divisions, departments, roles };
  }, [visibleSegments]);

  // ── Header-filter option lists. Picking a domain narrows the division list
  // (and clears a division pick that no longer applies). ──
  const domainOptions = useMemo(() => ['All', ...(data?.segments ?? []).map((s) => s.name)], [data]);
  const divisionOptions = useMemo(() => {
    const names = (data?.segments ?? [])
      .filter((s) => domainSel === 'All' || s.name === domainSel)
      .flatMap((s) => s.divisions.map((d) => d.name));
    return ['All', ...[...new Set(names)].sort()];
  }, [data, domainSel]);

  const anyFilter = domainSel !== 'All' || divisionSel !== 'All' || search.trim() !== '';
  const clear = () => { setDomainSel('All'); setDivisionSel('All'); setSearch(''); };

  const toggleSort = (col: Sort['col']) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;

  return (
    <MetricsCtx.Provider value={{ open: openMetrics, activeKey }}>
      {/* Side-by-side: grid scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="px-3 sm:px-4 pt-2 pb-4">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading organization…</div>
            ) : error ? (
              <div className="text-sm text-[#be123c] py-8 text-center">{error}</div>
            ) : (
              <>
                {/* Very slim strip: totals + expand/collapse (filters moved into the headers).
                    pl clears the floating List|Map toggle pinned at the top-left. */}
                <div className="flex items-center gap-3 flex-wrap mb-1.5 pl-[150px] min-h-[24px]">
                  <span className="text-[11px] text-[#737373] tnum">
                    {totals.domains} domains · {totals.divisions} divisions · {totals.departments} departments · {totals.roles} roles
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
                    <HeaderSearch label="Organization" value={search} onChange={setSearch}
                      sort={<SortToggle col="name" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Division" value={divisionSel} onChange={setDivisionSel} options={divisionOptions} />
                    <HeaderFilter label="Domain" value={domainSel} onChange={(v) => { setDomainSel(v); setDivisionSel('All'); }} options={domainOptions} />
                    <HeaderPlain right label="Departments" sort={<SortToggle col="depts" sort={sort} onSort={toggleSort} />} />
                    <HeaderPlain right label="Roles" sort={<SortToggle col="roles" sort={sort} onSort={toggleSort} />} />
                  </div>
                  <div className="rounded-b-lg overflow-hidden">
                    {visibleSegments.length > 0
                      ? visibleSegments.map((seg) => <SegmentNodeC key={seg.name} seg={seg} depth={0} epoch={epoch} defaultOpen={allOpen} />)
                      : <InfoRow depth={0} text="No divisions match the current filters." />}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right-hand metrics panel — same component as the map. */}
        {base && (
          <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onDrill} onBack={ovStack.length ? onBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection} />
        )}

        {/* Comprehensive "view all" drawer — overlays the panel. */}
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
