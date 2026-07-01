import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';
import RoleDrawer from './RoleDrawer';
import { HeaderComboFilter, ListSearch } from './Sheet';

// Org List view (R2 rework) — a FLAT spreadsheet of the org spine, the mirror
// image of the Value Streams list (ListExplorer). No tree, no expand/collapse:
// every row is one full chain read left-to-right
//   Domain | Division | Department | Role
// (one row per role; departments with no roles and divisions with no
// departments still get a row with the trailing cells blank; roles attached
// directly to a division show "Direct to division" in the Department column).
// The sheet stops at Role. Every column header
// carries a searchable combobox filter (options = the distinct values among
// rows passing the OTHER filters, Excel-style) plus a sort toggle, the header
// sticks while the sheet scrolls, and clicking a cell opens the right-hand
// metrics panel for that specific level — the SAME MetricsSidebar the map and
// value-stream list use. The box-grid drill-down (OrgTable) is untouched.

// ── Tree shape (from GET /explorer/org-table) ─────────────────────────────────
type Part = { valueStreamId: string; valueStreamName: string; domain: string | null; participationType: string; l3: string | null; l4: string | null };
type RoleNode = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; valueStreamCount: number; participations: Part[] };
type DeptNode = { id: string; name: string; roles: RoleNode[]; roleCount: number };
type DivNode = { id: string; name: string; segment: string; departments: DeptNode[]; looseRoles: RoleNode[]; roleCount: number };
type SegNode = { name: string; divisions: DivNode[]; divisionCount: number; roleCount: number };
type OrgData = {
  company: { id: string; name: string };
  totals: { segments: number; divisions: number; departments: number; roles: number };
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

// Header combobox filters are the shared multi-select version from Sheet.tsx
// (plain click = single pick; ctrl/shift-click = toggle multiple).

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

  // Header filters — a multi-selection per column; [] = no constraint (All).
  const [domainSel, setDomainSel] = useState<string[]>([]);
  const [divisionSel, setDivisionSel] = useState<string[]>([]);
  const [deptSel, setDeptSel] = useState<string[]>([]);
  const [roleSel, setRoleSel] = useState<string[]>([]);
  const [search, setSearch] = useState('');
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
    if (name) { setRoleSel([name]); setDomainSel([]); setDivisionSel([]); setDeptSel([]); }
  }, [focusRoleId, flat]);

  // A row passes the filters; `skip` exempts one column so each combobox can
  // list the distinct values among rows passing the OTHER filters (Excel-style).
  const matches = (r: FlatRow, skip?: Col) =>
    (skip === 'domain' || domainSel.length === 0 || domainSel.includes(r.domain))
    && (skip === 'division' || divisionSel.length === 0 || divisionSel.includes(r.divName))
    && (skip === 'dept' || deptSel.length === 0 || deptSel.includes(r.deptName))
    && (skip === 'role' || roleSel.length === 0 || roleSel.includes(r.roleName));

  const selDeps = [flat, domainSel, divisionSel, deptSel, roleSel]; // eslint-disable-line
  const optionList = (vals: Iterable<string>) => ['All', ...[...new Set([...vals].filter(Boolean))].sort()];
  /* eslint-disable react-hooks/exhaustive-deps */
  const domainOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'domain')).map((r) => r.domain)), selDeps);
  const divisionOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'division')).map((r) => r.divName)), selDeps);
  const deptOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'dept')).map((r) => r.deptName)), selDeps);
  const roleOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'role')).map((r) => r.roleName)), selDeps);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A pick can be invalidated by a later pick in another column — drop it.
  const prune = (sel: string[], options: string[], set: (v: string[]) => void) => {
    const kept = sel.filter((v) => options.includes(v));
    if (kept.length !== sel.length) set(kept);
  };
  useEffect(() => { prune(domainSel, domainOptions, setDomainSel); }, [domainOptions, domainSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(divisionSel, divisionOptions, setDivisionSel); }, [divisionOptions, divisionSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(deptSel, deptOptions, setDeptSel); }, [deptOptions, deptSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(roleSel, roleOptions, setRoleSel); }, [roleOptions, roleSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visible rows: filters + sort (chain order as the tie-break).
  const needle = search.trim().toLowerCase();
  const searchMatch = (r: FlatRow) =>
    !needle || [r.domain, r.divName, r.deptName, r.roleName].some((v) => v.toLowerCase().includes(needle));
  const rows = useMemo(() => {
    const list = flat.filter((r) => matches(r) && searchMatch(r));
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
  }, [flat, domainSel, divisionSel, deptSel, roleSel, sort, needle]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const anyFilter = domainSel.length > 0 || divisionSel.length > 0 || deptSel.length > 0 || roleSel.length > 0 || !!needle;
  const clear = () => { setDomainSel([]); setDivisionSel([]); setDeptSel([]); setRoleSel([]); setSearch(''); };

  const toggleSort = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;

  // ── Row virtualization ──────────────────────────────────────────────────────
  // The sheet can be thousands of rows (one per role); rendering them all at once
  // floods the DOM and hangs the tab. Rows are a fixed height, so window to just
  // the slice in view (+ overscan) and pad above/below with spacers. The markup of
  // each rendered row is unchanged, so the sheet looks identical. (Mirrors the
  // Value Streams list — ListExplorer.)
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsWrapRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [rowsTop, setRowsTop] = useState(0); // rows-area offset from scroll-content top (clears the sticky header)
  const [rowH, setRowH] = useState(24);      // measured row height
  const OVERSCAN = 10;

  const measure = () => {
    const el = scrollRef.current; if (!el) return;
    setViewH(el.clientHeight);
    const rw = rowsWrapRef.current;
    if (rw) setRowsTop(rw.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop);
  };
  useLayoutEffect(measure, [loading, rows.length === 0]);
  // Filtering can shrink the list while scrolled down; the browser clamps the
  // real scrollTop but our cached value goes stale (no scroll event fires). Re-
  // read it whenever the row count changes so the window can't point past the end.
  useLayoutEffect(() => { const el = scrollRef.current; if (el) setScrollTop(el.scrollTop); }, [rows.length]);
  useEffect(() => {
    const el = scrollRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Measure the live row height from the first rendered row (handles zoom/DPR).
  const measureRow = (el: HTMLDivElement | null) => {
    if (el && el.offsetHeight && Math.abs(el.offsetHeight - rowH) > 0.5) setRowH(el.offsetHeight);
  };

  const ticking = useRef(false);
  const onScroll = () => {
    if (ticking.current) return; ticking.current = true;
    requestAnimationFrame(() => { ticking.current = false; const el = scrollRef.current; if (el) setScrollTop(el.scrollTop); });
  };

  const rel = Math.max(0, scrollTop - rowsTop);
  const start = Math.max(0, Math.floor(rel / rowH) - OVERSCAN);
  const end = viewH > 0 ? Math.min(rows.length, Math.ceil((rel + viewH) / rowH) + OVERSCAN) : Math.min(rows.length, OVERSCAN * 4);
  const visible = rows.slice(start, end);
  const padTop = start * rowH;
  const padBottom = Math.max(0, (rows.length - end) * rowH);

  return (
    <>
      {/* Side-by-side: sheet scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Very slim strip: totals + clear. Lives OUTSIDE the scroll area so the
              sticky sheet header pins below it instead of sliding over the
              floating List|Map toggle (pl clears the toggle). */}
          {/* pr clears the card padding + the scroll area's scrollbar so the
              search box lines up with the table's right edge (doesn't hang past). */}
          <div className="flex-shrink-0 flex items-center gap-3 flex-wrap pr-[31px] pl-[162px] h-[57px]">
            {!loading && !error && (
              <>
                <span className="text-[11px] text-[#737373] tnum">
                  {totals.domains} domains · {totals.divisions} divisions · {totals.departments} departments · {totals.roles} roles
                </span>
                {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>}
                <div className="flex-1" />
                <ListSearch value={search} onChange={setSearch} />
              </>
            )}
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-auto">
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
                  <div ref={rowsWrapRef} className="rounded-b-lg overflow-hidden">
                    {rows.length === 0 && <EmptyRow text="No rows match the current filters." />}
                    {padTop > 0 && <div style={{ height: padTop }} />}
                    {visible.map((r, vi) => {
                      const hex = DOMAIN_HEX[r.domain] ?? '#94a3b8';
                      const selected = activeKey != null && (
                        activeKey === `domain:${r.domain}`
                        || activeKey === `division:${r.divId}`
                        || (r.deptId != null && activeKey === `department:${r.deptId}`)
                        || (r.roleId != null && activeKey === `role:${r.roleId}`));
                      return (
                        <div
                          key={`${r.divId}|${r.deptId ?? r.deptName}|${r.roleId ?? ''}`}
                          ref={vi === 0 ? measureRow : undefined}
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
                    {padBottom > 0 && <div style={{ height: padBottom }} />}
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
