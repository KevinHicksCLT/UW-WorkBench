import { useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX, type DivisionSummary } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';
import ValueStreamDrawer from './ValueStreamDrawer';

// List view (R2 rework) — a FLAT spreadsheet of the operating model. No tree,
// no expand/collapse: every row is one full process chain read left-to-right
//   Domain | Division | Value stream | Sub-process | Step
// (one row per step; sub-processes with no steps and streams with no
// sub-processes still get a row with the trailing cells blank). Every column
// header carries a searchable combobox filter (options = the distinct values
// among rows passing the OTHER filters, Excel-style) plus a sort toggle, the
// header sticks while the sheet scrolls, and clicking a cell opens the
// right-hand metrics panel for that specific level — the SAME MetricsSidebar
// the map uses.

// ── Tree shape (from GET /explorer/tree) ──────────────────────────────────────
type StepL5 = { id: string; step: number; name: string };
type SubProc = { id: string; step: number; name: string; steps: StepL5[] };
type Area = { id: string; step: number; name: string; subProcesses: SubProc[] };
type VS = { id: string; name: string; areas: Area[] };
type Div = { id: string; name: string; higherCategory: string | null; roles: number; valueStreams: VS[] };
type Tree = { company: { id: string; name: string }; divisions: Div[] };

const catFor = (higherCategory: string | null): string => higherCategory ?? 'Unassigned';

// Shared column template so the header and every row stay aligned:
// domain | division | value stream | sub-process | step
const GRID_COLS = 'grid grid-cols-[140px_160px_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.3fr)]';

// One flattened chain (one spreadsheet row).
type FlatRow = {
  vsId: string; vsName: string;
  division: string; domain: string; divisions: string[]; domains: string[];
  areaId: string | null; areaName: string; areaNum: number | null;
  stepId: string | null; stepName: string; stepNum: number | null;
};

// ── Spreadsheet column headers: each header cell carries a searchable
// combobox filter plus a sort toggle. ─────────────────────────────────────────
type Col = 'domain' | 'division' | 'vs' | 'sub' | 'step';
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
// click — the most specific entity — doesn't also fire). `dead` cells swallow
// the click entirely (Domain/Division have no sidebar in Value Streams).
function Cell({ text, num, accent, onClick, dim, dead }: { text: string; num?: number | null; accent?: string; onClick?: () => void; dim?: boolean; dead?: boolean }) {
  return (
    <div
      className={'px-2 py-[3px] flex items-center gap-1.5 min-w-0' + (onClick ? ' cursor-pointer group/cell' : dead ? ' cursor-default' : '')}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : dead ? (e) => e.stopPropagation() : undefined}
    >
      {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
      {num != null && <span className="text-[9px] text-[#a3a3a3] tnum flex-shrink-0">{num}</span>}
      <span className={'truncate text-[12px] ' + (dim ? 'text-[#737373]' : 'text-[#171717]') + (onClick ? ' group-hover/cell:underline' : '')}>{text}</span>
    </div>
  );
}

const EmptyRow = ({ text }: { text: string }) => (
  <div className="py-1.5 px-3 text-[11px] text-[#a3a3a3] italic">{text}</div>
);

export default function ListExplorer({ focusVsId = null }: { companyName?: string; divisions?: DivisionSummary[]; streams?: number; focusVsId?: string | null }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header filters — one combobox selection per column; 'All' = no constraint.
  const [domainSel, setDomainSel] = useState('All');
  const [divisionSel, setDivisionSel] = useState('All');
  const [vsSel, setVsSel] = useState('All');
  const [subSel, setSubSel] = useState('All');
  const [stepSel, setStepSel] = useState('All');
  const [sort, setSort] = useState<Sort>({ col: 'vs', dir: 1 });

  // Right-hand metrics panel (identical to the map). `base` = the cell clicked
  // in the sheet; `ovStack` = in-panel drills (role → person → …).
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
  // stream's detail in the sidebar; the Value stream filter below narrows the
  // sheet to just that stream once the tree is loaded.
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

  // ── Flatten every chain to one row (dedupe streams first — a stream can sit
  // under several divisions, so it carries ALL its divisions/domains). ──
  const flat = useMemo(() => {
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
    const rows: FlatRow[] = [];
    for (const e of byId.values()) {
      const divisions = [...e.divisions].sort();
      const domains = [...e.domains].sort();
      const head = {
        vsId: e.vs.id, vsName: e.vs.name,
        division: divisions.join(', '), domain: domains.join(', '), divisions, domains,
      };
      if (e.vs.areas.length === 0) {
        rows.push({ ...head, areaId: null, areaName: '', areaNum: null, stepId: null, stepName: '', stepNum: null });
        continue;
      }
      for (const a of e.vs.areas) {
        if (a.subProcesses.length === 0) {
          rows.push({ ...head, areaId: a.id, areaName: a.name, areaNum: a.step, stepId: null, stepName: '', stepNum: null });
          continue;
        }
        for (const s of a.subProcesses) {
          rows.push({ ...head, areaId: a.id, areaName: a.name, areaNum: a.step, stepId: s.id, stepName: s.name, stepNum: s.step });
        }
      }
    }
    return rows;
  }, [tree]);

  // Deep-linked focus also pre-applies the Value stream filter so the sheet
  // shows ONLY that stream's rows (clearing any stale picks in other columns).
  // Links across the app carry LEGACY ValueStream ids while the tree rows use
  // unified node ids — when the id isn't in the tree, resolve it via the same
  // focus endpoint the map uses, then match by the canonical id.
  useEffect(() => {
    if (!focusVsId || !flat.length) return;
    let cancelled = false;
    const apply = (name: string) => {
      if (cancelled) return;
      setVsSel(name); setDomainSel('All'); setDivisionSel('All'); setSubSel('All'); setStepSel('All');
    };
    const row = flat.find((r) => r.vsId === focusVsId);
    if (row) { apply(row.vsName); return; }
    api.get(`/explorer/value-stream/${encodeURIComponent(focusVsId)}/focus`)
      .then((f: { valueStreamId: string }) => {
        const resolved = flat.find((r) => r.vsId === f.valueStreamId);
        if (resolved) apply(resolved.vsName);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [focusVsId, flat]);

  // A row passes the filters; `skip` exempts one column so each combobox can
  // list the distinct values among rows passing the OTHER filters (Excel-style).
  const matches = (r: FlatRow, skip?: Col) =>
    (skip === 'domain' || domainSel === 'All' || r.domains.includes(domainSel))
    && (skip === 'division' || divisionSel === 'All' || r.divisions.includes(divisionSel))
    && (skip === 'vs' || vsSel === 'All' || r.vsName === vsSel)
    && (skip === 'sub' || subSel === 'All' || r.areaName === subSel)
    && (skip === 'step' || stepSel === 'All' || r.stepName === stepSel);

  const selDeps = [flat, domainSel, divisionSel, vsSel, subSel, stepSel]; // eslint-disable-line
  const optionList = (vals: Iterable<string>) => ['All', ...[...new Set([...vals].filter(Boolean))].sort()];
  /* eslint-disable react-hooks/exhaustive-deps */
  const domainOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'domain')).flatMap((r) => r.domains)), selDeps);
  const divisionOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'division')).flatMap((r) => r.divisions)), selDeps);
  const vsOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'vs')).map((r) => r.vsName)), selDeps);
  const subOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'sub')).map((r) => r.areaName)), selDeps);
  const stepOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'step')).map((r) => r.stepName)), selDeps);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A pick can be invalidated by a later pick in another column — clear it.
  useEffect(() => { if (domainSel !== 'All' && !domainOptions.includes(domainSel)) setDomainSel('All'); }, [domainOptions, domainSel]);
  useEffect(() => { if (divisionSel !== 'All' && !divisionOptions.includes(divisionSel)) setDivisionSel('All'); }, [divisionOptions, divisionSel]);
  useEffect(() => { if (vsSel !== 'All' && !vsOptions.includes(vsSel)) setVsSel('All'); }, [vsOptions, vsSel]);
  useEffect(() => { if (subSel !== 'All' && !subOptions.includes(subSel)) setSubSel('All'); }, [subOptions, subSel]);
  useEffect(() => { if (stepSel !== 'All' && !stepOptions.includes(stepSel)) setStepSel('All'); }, [stepOptions, stepSel]);

  // Visible rows: filters + sort. Default sort = value stream, with the
  // process order (sub-process № then step №) as the tie-break so each stream
  // reads top-to-bottom in execution order.
  const rows = useMemo(() => {
    const list = flat.filter((r) => matches(r));
    const procOrder = (a: FlatRow, b: FlatRow) =>
      a.vsName.localeCompare(b.vsName)
      || (a.areaNum ?? 0) - (b.areaNum ?? 0)
      || a.areaName.localeCompare(b.areaName)
      || (a.stepNum ?? 0) - (b.stepNum ?? 0);
    return [...list].sort((a, b) => {
      const c = sort.col === 'domain' ? a.domain.localeCompare(b.domain)
        : sort.col === 'division' ? a.division.localeCompare(b.division)
        : sort.col === 'vs' ? a.vsName.localeCompare(b.vsName)
        : sort.col === 'sub' ? a.areaName.localeCompare(b.areaName)
        : a.stepName.localeCompare(b.stepName);
      return c * sort.dir || procOrder(a, b);
    });
  }, [flat, domainSel, divisionSel, vsSel, subSel, stepSel, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totals strip — distinct entities among the visible (filtered) rows.
  const totals = useMemo(() => {
    const vs = new Set<string>(), subs = new Set<string>();
    let steps = 0;
    for (const r of rows) {
      vs.add(r.vsId);
      if (r.areaId) subs.add(r.areaId);
      if (r.stepId) steps++;
    }
    return { vs: vs.size, subs: subs.size, steps };
  }, [rows]);

  const anyFilter = domainSel !== 'All' || divisionSel !== 'All' || vsSel !== 'All' || subSel !== 'All' || stepSel !== 'All';
  const clear = () => { setDomainSel('All'); setDivisionSel('All'); setVsSel('All'); setSubSel('All'); setStepSel('All'); };

  const toggleSort = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;
  // Scroll target for deep-linked focus: the first visible row of that stream.
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusVsId && !loading) focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focusVsId, loading]);

  // Track first row per stream while rendering (for the focus scroll target).
  const seenVs = new Set<string>();

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
                  {totals.vs} value streams · {totals.subs} sub-processes · {totals.steps} steps · {rows.length} rows
                </span>
                {anyFilter && <button onClick={clear} className="text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>}
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-3 sm:px-4 pb-4">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading operating model…</div>
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
                    <HeaderComboFilter label="Value stream" value={vsSel} onChange={setVsSel} options={vsOptions}
                      sort={<SortToggle col="vs" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Sub-process" value={subSel} onChange={setSubSel} options={subOptions}
                      sort={<SortToggle col="sub" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="Step" value={stepSel} onChange={setStepSel} options={stepOptions}
                      sort={<SortToggle col="step" sort={sort} onSort={toggleSort} />} />
                  </div>
                  <div className="rounded-b-lg overflow-hidden">
                    {rows.length === 0 && <EmptyRow text="No rows match the current filters." />}
                    {rows.map((r) => {
                      const firstOfVs = !seenVs.has(r.vsId);
                      seenVs.add(r.vsId);
                      // Row default click = the most specific entity on the row.
                      const rowTarget: [string, string] = r.stepId ? ['step', r.stepId] : r.areaId ? ['step', r.areaId] : ['valueStream', r.vsId];
                      const selected = activeKey != null && (
                        activeKey === `valueStream:${r.vsId}`
                        || (r.areaId != null && activeKey === `step:${r.areaId}`)
                        || (r.stepId != null && activeKey === `step:${r.stepId}`));
                      return (
                        <div
                          key={`${r.vsId}|${r.areaId ?? ''}|${r.stepId ?? ''}`}
                          ref={firstOfVs && r.vsId === focusVsId ? focusRef : undefined}
                          onClick={() => openMetrics(rowTarget[0], rowTarget[1])}
                          className={GRID_COLS + ' items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 cursor-pointer transition-colors duration-100 '
                            + (selected ? 'bg-[#f5f8ff] ' : '') + 'hover:bg-[#fafafa]'}
                        >
                          <Cell text={r.domain} accent={DOMAIN_HEX[r.domains[0]] ?? '#94a3b8'} dim dead />
                          <Cell text={r.division} dim dead />
                          <Cell text={r.vsName} onClick={() => openMetrics('valueStream', r.vsId)} />
                          <Cell text={r.areaName} num={r.areaNum} onClick={r.areaId ? () => openMetrics('step', r.areaId!) : undefined} />
                          <Cell text={r.stepName} num={r.stepNum} onClick={r.stepId ? () => openMetrics('step', r.stepId!) : undefined} />
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

        {/* Right-hand metrics panel — same component as the map, pushes content (no dimming overlay) */}
        {base && (
          <MetricsSidebar
            dash={dash} loading={dashLoading} onDrill={onDrill} startExpanded
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
    </>
  );
}
