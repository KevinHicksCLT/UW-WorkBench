import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';

// Org List view (defect backlog 02, D4) — an Excel-like grid of the org spine,
// the mirror image of the Value Streams list (ListExplorer):
//   Domain › Division › Department › Role
// People are NOT rendered — the tree stops at Role (D4.2). Rows are thin,
// columns are sortable, branches expand/collapse (with Expand/Collapse-all),
// and clicking a row opens the SAME right-hand MetricsSidebar the map and
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

// ── Row chrome ────────────────────────────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// One grid row: indented name cell + the two count columns. Thin (D4.1).
function GridRow({
  depth, leaf, open, onClick, onToggle, accent, label, depts, roles, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void; onToggle?: () => void;
  accent?: string; label: string; depts?: number | null; roles?: number | null;
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
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
        <span className={'truncate ' + (strong ? 'text-[13px] font-semibold text-[#171717]' : muted ? 'text-[12px] text-[#525252]' : 'text-[13px] text-[#171717]')}>{label}</span>
      </div>
      <span className="text-[11px] text-[#737373] tnum text-right">{depts ?? ''}</span>
      <span className="text-[11px] text-[#737373] tnum text-right">{roles ?? ''}</span>
    </div>
  );
}
const InfoRow = ({ depth, text }: { depth: number; text: string }) => (
  <div style={{ paddingLeft: depth * 16 + 28 }} className="py-1 pr-3 text-[11px] text-[#a3a3a3] italic border-b border-[#f5f5f5]">{text}</div>
);

// ── Nodes — controlled by an expandAll epoch so the header buttons can fold the
// whole grid at once (Excel-style); carets still toggle each branch. ───────────
// A role is a leaf (people are not rendered — D4.2); clicking opens its dashboard.
function RoleRow({ role, depth }: { role: RoleNode; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  return (
    <GridRow depth={depth} leaf muted selected={activeKey === `role:${role.id}`}
      onClick={() => openMetrics('role', role.id)} label={role.name} />
  );
}

function DeptNodeC({ dept, depth, epoch, defaultOpen }: { dept: DeptNode; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  return (
    <>
      <GridRow depth={depth} leaf={dept.roles.length === 0} open={open} selected={activeKey === `department:${dept.id}`}
        onClick={() => openMetrics('department', dept.id)}
        onToggle={dept.roles.length ? () => setOpen((o) => !o) : undefined}
        label={dept.name} roles={dept.roles.length} />
      {open && (dept.roles.length > 0
        ? dept.roles.map((r) => <RoleRow key={r.id} role={r} depth={depth + 1} />)
        : <InfoRow depth={depth + 1} text="No roles in this team." />)}
    </>
  );
}

function DivNodeC({ div, depth, epoch, defaultOpen }: { div: DivNode; depth: number; epoch: number; defaultOpen: boolean }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [epoch]); // eslint-disable-line
  const hasChildren = div.departments.length > 0 || div.looseRoles.length > 0;
  return (
    <>
      <GridRow depth={depth} leaf={!hasChildren} open={open} selected={activeKey === `division:${div.id}`}
        onClick={() => openMetrics('division', div.id)}
        onToggle={hasChildren ? () => setOpen((o) => !o) : undefined}
        label={div.name} depts={div.departments.length} roles={divRoleCount(div)} />
      {open && (
        <>
          {div.departments.map((d) => <DeptNodeC key={d.id} dept={d} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)}
          {div.looseRoles.length > 0 && (
            <DeptNodeC
              key={`__loose:${div.id}`}
              dept={{ id: `__loose:${div.id}`, name: 'Direct to division', roles: div.looseRoles, roleCount: div.looseRoles.length, peopleCount: 0 }}
              depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen}
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
      {open && seg.divisions.map((d) => <DivNodeC key={d.id} div={d} depth={depth + 1} epoch={epoch} defaultOpen={defaultOpen} />)}
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
type Sort = { col: 'name' | 'depts' | 'roles'; dir: 1 | -1 };
function SortBtn({ col, sort, onSort, children }: { col: Sort['col']; sort: Sort; onSort: (c: Sort['col']) => void; children: React.ReactNode }) {
  const active = sort.col === col;
  return (
    <button onClick={() => onSort(col)} className={'inline-flex items-center gap-1 hover:text-[#171717] ' + (active ? 'text-[#171717]' : '')}>
      {children}
      <span className={'text-[10px] font-bold ' + (active ? 'text-[#171717]' : 'text-[#a3a3a3]')}>{active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

export default function OrgListExplorer() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facet filters: empty set = no constraint (show all).
  const [segFilter, setSegFilter] = useState<Set<string>>(new Set());
  const [divFilter, setDivFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
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

  // Visible tree: facet filters → search prune (a matching node keeps its whole
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
      .filter((s) => segFilter.size === 0 || segFilter.has(s.name))
      .map((s) => ({ ...s, divisions: s.divisions.filter((d) => divFilter.size === 0 || divFilter.has(d.id)) }))
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
  }, [data, segFilter, divFilter, search, sort]);

  // Totals for the slim header row — recomputed from the visible (filtered) tree.
  const totals = useMemo(() => {
    let divisions = 0, departments = 0, roles = 0;
    for (const s of visibleSegments) for (const d of s.divisions) {
      divisions++;
      departments += d.departments.length;
      roles += divRoleCount(d);
    }
    return { domains: visibleSegments.length, divisions, departments, roles };
  }, [visibleSegments]);

  // Facet options.
  const segmentOptions: FilterOption[] = (data?.segments ?? []).map((s) => ({ id: s.name, name: s.name, accent: DOMAIN_HEX[s.name] }));
  const divisionOptions: FilterOption[] = (data?.segments ?? [])
    .filter((s) => segFilter.size === 0 || segFilter.has(s.name))
    .flatMap((s) => s.divisions.map((d) => ({ id: d.id, name: d.name, accent: DOMAIN_HEX[s.name] })));

  const toggleSeg = (id: string) => setSegFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDiv = (id: string) => setDivFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const anyFilter = segFilter.size > 0 || divFilter.size > 0 || search.trim() !== '';
  const clear = () => { setSegFilter(new Set()); setDivFilter(new Set()); setSearch(''); };

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
                {/* Slim filter row: search + facets + totals — one line, no fat card (D4.1). */}
                {/* pl clears the floating List|Map toggle pinned at the top-left. */}
                <div className="flex items-center gap-2 flex-wrap mb-2 pl-[150px]">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-md border border-[#eaeaea] bg-white px-2.5 py-1 text-[12px] text-[#171717] w-48 focus:outline-none focus:ring-1 focus:ring-[#171717]"
                    aria-label="Search organization"
                  />
                  <FilterDropdown label="Domain" options={segmentOptions} selected={segFilter} onToggle={toggleSeg} />
                  <FilterDropdown label="Division" options={divisionOptions} selected={divFilter} onToggle={toggleDiv} />
                  {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear</button>}
                  <span className="ml-auto text-[11px] text-[#737373] tnum">
                    {totals.domains} domains · {totals.divisions} divisions · {totals.departments} departments · {totals.roles} roles
                  </span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => setAll(true)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Expand all</button>
                    <button onClick={() => setAll(false)} className="text-[11px] font-medium text-[#525252] hover:text-[#171717] border border-[#eaeaea] rounded px-1.5 py-0.5">Collapse all</button>
                  </span>
                </div>

                <div className="card p-0 overflow-hidden">
                  {/* Grid header with sort */}
                  <div className="grid grid-cols-[1fr_110px_80px] items-center gap-2 pr-2 border-b border-[#eaeaea] bg-[#fafafa]">
                    <div className="py-1.5 pl-8 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="name" sort={sort} onSort={toggleSort}>Organization</SortBtn>
                    </div>
                    <div className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="depts" sort={sort} onSort={toggleSort}>Departments</SortBtn>
                    </div>
                    <div className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                      <SortBtn col="roles" sort={sort} onSort={toggleSort}>Roles</SortBtn>
                    </div>
                  </div>
                  {visibleSegments.length > 0
                    ? visibleSegments.map((seg) => <SegmentNodeC key={seg.name} seg={seg} depth={0} epoch={epoch} defaultOpen={allOpen} />)
                    : <InfoRow depth={0} text="No divisions match the current filters." />}
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
