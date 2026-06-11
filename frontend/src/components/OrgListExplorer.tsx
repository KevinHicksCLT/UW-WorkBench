import { useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';
import RoleDrawer from './RoleDrawer';

// Org List view (R2 rework) — a FLAT spreadsheet of the org spine, the mirror
// image of the Value Streams list (ListExplorer). No tree, no expand/collapse:
// every row is one full chain read left-to-right
//   Domain | Division | Department | Role
// (one row per role; departments with no roles and divisions with no
// departments still get a row with the trailing cells blank; roles attached
// directly to a division show "Direct to division" in the Department column).
// People are NOT rendered — the sheet stops at Role. Every column header
// carries a searchable combobox filter (options = the distinct values among
// rows passing the OTHER filters, Excel-style) plus a sort toggle, the header
// sticks while the sheet scrolls, and clicking a cell opens the right-hand
// metrics panel for that specific level — the SAME MetricsSidebar the map and
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

// Shared column template so the header and every row stay aligned:
// domain | division | department | role
const GRID_COLS = 'grid grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]';

// One flattened chain (one spreadsheet row).
type FlatRow = {
  domain: string;
  divId: string; divName: string;
  deptId: string | null; deptName: string;
  roleId: string | null; roleName: string;
};

// ── Spreadsheet column headers: each header cell carries a searchable
// combobox filter plus a sort toggle. ─────────────────────────────────────────
type Col = 'domain' | 'division' | 'dept' | 'role';
type Sort = { col: Col; dir: 1 | -1 };

function SortToggle({ col, sort, onSort }: { col: Col; sort: Sort; onSort: (c: Col) => void }) {
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

// Searchable dropdown filter — every column uses this (type-ahead handles the
// long option lists). Closes on outside click; 'All' clears.
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
    <div ref={ref} className="px-2 py-1 min-w-0 relative">
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
        <div className="absolute z-30 left-2 mt-1 w-[260px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
          <div className="p-1.5 border-b border-[#f5f5f5]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Filter by ${label.toLowerCase()}`}
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

// One spreadsheet cell. Clickable cells underline on hover and open the
// metrics panel for exactly that level (stopPropagation so the row's default
// click — the most specific entity — doesn't also fire).
function Cell({ text, accent, onClick, dim }: { text: string; accent?: string; onClick?: () => void; dim?: boolean }) {
  return (
    <div
      className={'px-2 py-[3px] flex items-center gap-1.5 min-w-0' + (onClick ? ' cursor-pointer group/cell' : '')}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
      <span className={'truncate text-[12px] ' + (dim ? 'text-[#737373]' : 'text-[#171717]') + (onClick ? ' group-hover/cell:underline' : '')}>{text}</span>
    </div>
  );
}

const EmptyRow = ({ text }: { text: string }) => (
  <div className="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic">{text}</div>
);

const LOOSE_DEPT = 'Direct to division';

export default function OrgListExplorer({ focusRoleId = null }: { focusRoleId?: string | null }) {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header filters — one combobox selection per column; 'All' = no constraint.
  const [domainSel, setDomainSel] = useState('All');
  const [divisionSel, setDivisionSel] = useState('All');
  const [deptSel, setDeptSel] = useState('All');
  const [roleSel, setRoleSel] = useState('All');
  const [sort, setSort] = useState<Sort>({ col: 'domain', dir: 1 });

  // Right-hand metrics panel — identical to the map / value-stream list.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  // Role full-detail drawer (the standalone role page was retired).
  const [roleDetailId, setRoleDetailId] = useState<string | null>(null);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  // Domain color of the current selection — tints the sidebar (rail + header).
  const [accentHex, setAccentHex] = useState<string | undefined>(undefined);
  const openMetrics = (level: string, id: string, accent?: string) => { setBase({ level, id }); setOvStack([]); setAccentHex(accent); };
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

  // ── Flatten every chain to one row. Roles attached straight to a division
  // get the LOOSE_DEPT label. ──
  const flat = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const s of data?.segments ?? []) {
      for (const d of s.divisions) {
        const head = { domain: s.name, divId: d.id, divName: d.name };
        for (const t of d.departments) {
          if (t.roles.length === 0) {
            rows.push({ ...head, deptId: t.id, deptName: t.name, roleId: null, roleName: '' });
            continue;
          }
          for (const r of t.roles) rows.push({ ...head, deptId: t.id, deptName: t.name, roleId: r.id, roleName: r.name });
        }
        for (const r of d.looseRoles) rows.push({ ...head, deptId: null, deptName: LOOSE_DEPT, roleId: r.id, roleName: r.name });
        if (d.departments.length === 0 && d.looseRoles.length === 0) {
          rows.push({ ...head, deptId: null, deptName: '', roleId: null, roleName: '' });
        }
      }
    }
    return rows;
  }, [data]);

  // Deep-linked role (links from other tabs land here with the drawer open):
  // pre-apply the Role filter so the sheet shows ONLY that role's row(s),
  // clearing any stale picks in other columns.
  useEffect(() => {
    if (!focusRoleId || !flat.length) return;
    const name = flat.find((r) => r.roleId === focusRoleId)?.roleName;
    if (name) { setRoleSel(name); setDomainSel('All'); setDivisionSel('All'); setDeptSel('All'); }
  }, [focusRoleId, flat]);

  // A row passes the filters; `skip` exempts one column so each combobox can
  // list the distinct values among rows passing the OTHER filters (Excel-style).
  const matches = (r: FlatRow, skip?: Col) =>
    (skip === 'domain' || domainSel === 'All' || r.domain === domainSel)
    && (skip === 'division' || divisionSel === 'All' || r.divName === divisionSel)
    && (skip === 'dept' || deptSel === 'All' || r.deptName === deptSel)
    && (skip === 'role' || roleSel === 'All' || r.roleName === roleSel);

  const selDeps = [flat, domainSel, divisionSel, deptSel, roleSel]; // eslint-disable-line
  const optionList = (vals: Iterable<string>) => ['All', ...[...new Set([...vals].filter(Boolean))].sort()];
  /* eslint-disable react-hooks/exhaustive-deps */
  const domainOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'domain')).map((r) => r.domain)), selDeps);
  const divisionOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'division')).map((r) => r.divName)), selDeps);
  const deptOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'dept')).map((r) => r.deptName)), selDeps);
  const roleOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'role')).map((r) => r.roleName)), selDeps);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A pick can be invalidated by a later pick in another column — clear it.
  useEffect(() => { if (domainSel !== 'All' && !domainOptions.includes(domainSel)) setDomainSel('All'); }, [domainOptions, domainSel]);
  useEffect(() => { if (divisionSel !== 'All' && !divisionOptions.includes(divisionSel)) setDivisionSel('All'); }, [divisionOptions, divisionSel]);
  useEffect(() => { if (deptSel !== 'All' && !deptOptions.includes(deptSel)) setDeptSel('All'); }, [deptOptions, deptSel]);
  useEffect(() => { if (roleSel !== 'All' && !roleOptions.includes(roleSel)) setRoleSel('All'); }, [roleOptions, roleSel]);

  // Visible rows: filters + sort (chain order as the tie-break).
  const rows = useMemo(() => {
    const list = flat.filter((r) => matches(r));
    const chainOrder = (a: FlatRow, b: FlatRow) =>
      a.domain.localeCompare(b.domain)
      || a.divName.localeCompare(b.divName)
      || a.deptName.localeCompare(b.deptName)
      || a.roleName.localeCompare(b.roleName);
    return [...list].sort((a, b) => {
      const c = sort.col === 'domain' ? a.domain.localeCompare(b.domain)
        : sort.col === 'division' ? a.divName.localeCompare(b.divName)
        : sort.col === 'dept' ? a.deptName.localeCompare(b.deptName)
        : a.roleName.localeCompare(b.roleName);
      return c * sort.dir || chainOrder(a, b);
    });
  }, [flat, domainSel, divisionSel, deptSel, roleSel, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totals strip — distinct entities among the visible (filtered) rows.
  const totals = useMemo(() => {
    const domains = new Set<string>(), divisions = new Set<string>(), depts = new Set<string>();
    let roles = 0;
    for (const r of rows) {
      domains.add(r.domain);
      divisions.add(r.divId);
      if (r.deptId) depts.add(r.deptId);
      if (r.roleId) roles++;
    }
    return { domains: domains.size, divisions: divisions.size, departments: depts.size, roles };
  }, [rows]);

  const anyFilter = domainSel !== 'All' || divisionSel !== 'All' || deptSel !== 'All' || roleSel !== 'All';
  const clear = () => { setDomainSel('All'); setDivisionSel('All'); setDeptSel('All'); setRoleSel('All'); };

  const toggleSort = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;

  return (
    <>
      {/* Side-by-side: sheet scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Very slim strip: totals + clear. Lives OUTSIDE the scroll area so the
              sticky sheet header pins below it instead of sliding over the
              floating List|Map toggle (pl clears the toggle). */}
          <div className="flex-shrink-0 flex items-center gap-3 flex-wrap pr-3 sm:pr-4 pt-2 pb-1.5 pl-[162px] min-h-[48px]">
            {!loading && !error && (
              <>
                <span className="text-[11px] text-[#737373] tnum">
                  {totals.domains} domains · {totals.divisions} divisions · {totals.departments} departments · {totals.roles} roles
                </span>
                {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>}
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-3 sm:px-4 pb-4">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading organization…</div>
            ) : error ? (
              <div className="text-sm text-[#be123c] py-8 text-center">{error}</div>
            ) : (
              <>
                {/* No overflow-hidden on the card — the combo dropdowns must escape it. */}
                <div className="card p-0">
                  {/* Sticky spreadsheet header: each cell hosts its combobox filter + sort. */}
                  <div className={GRID_COLS + ' items-stretch divide-x divide-[#eaeaea] border-b border-[#eaeaea] bg-[#fafafa] rounded-t-lg sticky top-0 z-20'}>
                    <HeaderComboFilter label="Domain" value={domainSel} onChange={setDomainSel} options={domainOptions}
                      sort={<SortToggle col="domain" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Division" value={divisionSel} onChange={setDivisionSel} options={divisionOptions}
                      sort={<SortToggle col="division" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Department" value={deptSel} onChange={setDeptSel} options={deptOptions}
                      sort={<SortToggle col="dept" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Role" value={roleSel} onChange={setRoleSel} options={roleOptions}
                      sort={<SortToggle col="role" sort={sort} onSort={toggleSort} />} />
                  </div>
                  <div className="rounded-b-lg overflow-hidden">
                    {rows.length === 0 && <EmptyRow text="No rows match the current filters." />}
                    {rows.map((r) => {
                      const hex = DOMAIN_HEX[r.domain] ?? '#94a3b8';
                      const selected = activeKey != null && (
                        activeKey === `domain:${r.domain}`
                        || activeKey === `division:${r.divId}`
                        || (r.deptId != null && activeKey === `department:${r.deptId}`)
                        || (r.roleId != null && activeKey === `role:${r.roleId}`));
                      return (
                        <div
                          key={`${r.divId}|${r.deptId ?? r.deptName}|${r.roleId ?? ''}`}
                          // Row default click = the most specific entity on the row.
                          // Roles open the full-detail drawer (same as the map);
                          // higher levels open the metrics sidebar (same as the map).
                          onClick={() => r.roleId ? setRoleDetailId(r.roleId)
                            : r.deptId ? openMetrics('department', r.deptId, hex)
                            : openMetrics('division', r.divId, hex)}
                          className={GRID_COLS + ' items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 cursor-pointer transition-colors duration-100 '
                            + (selected ? 'bg-[#f5f8ff] ' : '') + 'hover:bg-[#fafafa]'}
                        >
                          <Cell text={r.domain} accent={hex} onClick={() => openMetrics('domain', r.domain, hex)} dim />
                          <Cell text={r.divName} onClick={() => openMetrics('division', r.divId, hex)} />
                          <Cell text={r.deptName} dim={r.deptId == null} onClick={r.deptId ? () => openMetrics('department', r.deptId!, hex) : undefined} />
                          <Cell text={r.roleName} onClick={r.roleId ? () => setRoleDetailId(r.roleId!) : undefined} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>

        {/* Right-hand metrics panel — same component as the map. */}
        {base && (
          <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onDrill} startExpanded accent={accentHex} onBack={ovStack.length ? onBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection}
            onViewDetail={target?.level === 'role' && target.id ? () => setRoleDetailId(target.id) : undefined} />
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

        {/* Role full detail — slides over the sheet in place. */}
        {roleDetailId && <RoleDrawer roleId={roleDetailId} onClose={() => setRoleDetailId(null)} />}
      </div>
    </>
  );
}
