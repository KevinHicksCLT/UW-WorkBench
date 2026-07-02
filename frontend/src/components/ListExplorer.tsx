import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX, type DivisionSummary } from '../viz/model';
import { api } from '../lib/api';
import Inspector from './Inspector';
import { HeaderComboFilter, ListSearch } from './Sheet';

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

// Header combobox filters are the shared multi-select version from Sheet.tsx
// (plain click = single pick; ctrl/shift-click = toggle multiple).

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

export default function ListExplorer({ focusVsId = null, focusVsName = null }: { companyName?: string; divisions?: DivisionSummary[]; streams?: number; focusVsId?: string | null; focusVsName?: string | null }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header filters — a multi-selection per column; [] = no constraint (All).
  const [domainSel, setDomainSel] = useState<string[]>([]);
  const [divisionSel, setDivisionSel] = useState<string[]>([]);
  const [vsSel, setVsSel] = useState<string[]>([]);
  const [subSel, setSubSel] = useState<string[]>([]);
  const [stepSel, setStepSel] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ col: 'vs', dir: 1 });

  // Right-hand inspector — same component the map docks. `base` = the cell
  // clicked in the sheet (a process node); the inspector handles its own drill.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);

  const openMetrics = (level: string, id: string) => setBase({ level, id });
  const closeMetrics = () => setBase(null);

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
      setVsSel([name]); setDomainSel([]); setDivisionSel([]); setSubSel([]); setStepSel([]);
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

  // Name-based focus (Third-Parties drawer → "?vs=<name>"): pre-apply the Value
  // stream filter, clearing other columns. The incoming string can be a single
  // clean stream name OR a free-text, multi-value label (e.g. "Delegated
  // Authority; Submission-to-Bind"), so split on ; , / and match each token to
  // the tree streams (exact, or substring for tokens long enough to be safe).
  useEffect(() => {
    if (!focusVsName || !flat.length) return;
    const tokens = focusVsName.split(/[;,/]/).map((t) => t.toLowerCase().trim()).filter(Boolean);
    const names = new Set<string>();
    for (const r of flat) {
      const n = r.vsName.toLowerCase().trim();
      if (tokens.some((t) => n === t || (t.length >= 4 && (n.includes(t) || t.includes(n))))) names.add(r.vsName);
    }
    if (!names.size) return;
    setVsSel([...names]); setDomainSel([]); setDivisionSel([]); setSubSel([]); setStepSel([]);
    const first = flat.find((r) => names.has(r.vsName));
    if (first) openMetrics('valueStream', first.vsId);
  }, [focusVsName, flat]); // eslint-disable-line react-hooks/exhaustive-deps

  // A row passes the filters; `skip` exempts one column so each combobox can
  // list the distinct values among rows passing the OTHER filters (Excel-style).
  const matches = (r: FlatRow, skip?: Col) =>
    (skip === 'domain' || domainSel.length === 0 || domainSel.some((v) => r.domains.includes(v)))
    && (skip === 'division' || divisionSel.length === 0 || divisionSel.some((v) => r.divisions.includes(v)))
    && (skip === 'vs' || vsSel.length === 0 || vsSel.includes(r.vsName))
    && (skip === 'sub' || subSel.length === 0 || subSel.includes(r.areaName))
    && (skip === 'step' || stepSel.length === 0 || stepSel.includes(r.stepName));

  const selDeps = [flat, domainSel, divisionSel, vsSel, subSel, stepSel]; // eslint-disable-line
  const optionList = (vals: Iterable<string>) => ['All', ...[...new Set([...vals].filter(Boolean))].sort()];
  /* eslint-disable react-hooks/exhaustive-deps */
  const domainOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'domain')).flatMap((r) => r.domains)), selDeps);
  const divisionOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'division')).flatMap((r) => r.divisions)), selDeps);
  const vsOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'vs')).map((r) => r.vsName)), selDeps);
  const subOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'sub')).map((r) => r.areaName)), selDeps);
  const stepOptions = useMemo(() => optionList(flat.filter((r) => matches(r, 'step')).map((r) => r.stepName)), selDeps);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A pick can be invalidated by a later pick in another column — drop it.
  const prune = (sel: string[], options: string[], set: (v: string[]) => void) => {
    const kept = sel.filter((v) => options.includes(v));
    if (kept.length !== sel.length) set(kept);
  };
  useEffect(() => { prune(domainSel, domainOptions, setDomainSel); }, [domainOptions, domainSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(divisionSel, divisionOptions, setDivisionSel); }, [divisionOptions, divisionSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(vsSel, vsOptions, setVsSel); }, [vsOptions, vsSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(subSel, subOptions, setSubSel); }, [subOptions, subSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prune(stepSel, stepOptions, setStepSel); }, [stepOptions, stepSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visible rows: filters + sort. Default sort = value stream, with the
  // process order (sub-process № then step №) as the tie-break so each stream
  // reads top-to-bottom in execution order.
  const needle = search.trim().toLowerCase();
  const searchMatch = (r: FlatRow) =>
    !needle || [r.domain, r.division, r.vsName, r.areaName, r.stepName].some((v) => v.toLowerCase().includes(needle));
  const rows = useMemo(() => {
    const list = flat.filter((r) => matches(r) && searchMatch(r));
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
  }, [flat, domainSel, divisionSel, vsSel, subSel, stepSel, sort, needle]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const anyFilter = domainSel.length > 0 || divisionSel.length > 0 || vsSel.length > 0 || subSel.length > 0 || stepSel.length > 0 || !!needle;
  const clear = () => { setDomainSel([]); setDivisionSel([]); setVsSel([]); setSubSel([]); setStepSel([]); setSearch(''); };

  const toggleSort = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const activeKey = base ? `${base.level}:${base.id}` : null;

  // ── Row virtualization ──────────────────────────────────────────────────────
  // The sheet can be ~3,800 rows (one per step); rendering them all at once
  // floods the DOM and hangs/crashes the tab. Rows are a fixed height, so window
  // to just the slice in view (+ overscan) and pad above/below with spacers. The
  // markup of each rendered row is unchanged, so the sheet looks identical.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsWrapRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [rowsTop, setRowsTop] = useState(0); // rows-area offset from scroll-content top (clears the sticky header)
  const [rowH, setRowH] = useState(23);       // measured row height
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

  // Deep-linked focus: jump the scroll to the focused stream's first row (the
  // row may not be mounted, so scroll by computed offset, not scrollIntoView).
  const scrolledFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!focusVsId || loading || !rows.length || scrolledFocus.current === focusVsId) return;
    const idx = rows.findIndex((r) => r.vsId === focusVsId);
    if (idx < 0) return;
    const el = scrollRef.current; if (!el) return;
    el.scrollTop = Math.max(0, rowsTop + idx * rowH - el.clientHeight / 2);
    setScrollTop(el.scrollTop);
    scrolledFocus.current = focusVsId;
  }, [focusVsId, loading, rows, rowsTop, rowH]);

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
                  {totals.vs} value streams · {totals.subs} L4 processes · {totals.steps} L5 processes
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
                    <HeaderComboFilter label="L4 Process" value={subSel} onChange={setSubSel} options={subOptions}
                      sort={<SortToggle col="sub" sort={sort} onSort={toggleSort} />} />
                    <HeaderComboFilter label="L5 Process" value={stepSel} onChange={setStepSel} options={stepOptions}
                      sort={<SortToggle col="step" sort={sort} onSort={toggleSort} />} />
                  </div>
                  <div ref={rowsWrapRef} className="rounded-b-lg overflow-hidden">
                    {rows.length === 0 && <EmptyRow text="No rows match the current filters." />}
                    {padTop > 0 && <div style={{ height: padTop }} />}
                    {visible.map((r, vi) => {
                      // Row default click = the most specific entity on the row.
                      const rowTarget: [string, string] = r.stepId ? ['step', r.stepId] : r.areaId ? ['step', r.areaId] : ['valueStream', r.vsId];
                      const selected = activeKey != null && (
                        activeKey === `valueStream:${r.vsId}`
                        || (r.areaId != null && activeKey === `step:${r.areaId}`)
                        || (r.stepId != null && activeKey === `step:${r.stepId}`));
                      return (
                        <div
                          key={`${r.vsId}|${r.areaId ?? ''}|${r.stepId ?? ''}`}
                          ref={vi === 0 ? measureRow : undefined}
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
                    {padBottom > 0 && <div style={{ height: padBottom }} />}
                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>

        {/* Right-hand inspector — same component as the map; pushes content (no overlay). */}
        {base && (
          <Inspector
            nodeId={base.id}
            onClose={closeMetrics}
            onRetarget={(id) => openMetrics('node', id)}
          />
        )}
      </div>
    </>
  );
}
