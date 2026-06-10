import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import { withCompany } from '../lib/portfolio';

// Deliverables & Tasks — the standalone work tracker, split into two tabs
// (defect backlog 02, D8): Deliverables (one row per deliverable) and Tasks
// (one row per task). Each column header is a filter (dropdown, combo, or
// free-text search) with a sort toggle. Clicking a deliverable or task opens
// the right-hand drill-down sidebar — roles, value stream, downstream impact.
// Scoped to the active company.

type Deliverable = {
  id: string; title: string; description: string | null; owner: string | null; type: string;
  status: string; dueDate: string | null; taskCount: number; valueStreamId: string | null; valueStreamName: string | null;
};
type Task = {
  id: string; title: string; owner: string | null; status: string; priority: string; dueDate: string | null;
  source: string; deliverableId: string | null; deliverableTitle: string | null;
};
type WorkData = { deliverables: Deliverable[]; tasks: Task[]; valueStreams: { id: string; name: string }[] };

// ── Drill-down shapes (mirror /work/deliverable/:id and /work/task/:id) ────────
type RoleRef = { id: string; name: string };
type RoleSet = { roles: RoleRef[]; unresolved: string[] };
type DeliverableDetail = {
  kind: 'deliverable'; id: string; title: string; description: string | null; type: string; owner: string | null;
  valueStream: { id: string; name: string; domain: string } | null;
  subProcesses: string[]; dataElements: string[];
  inputs: { name: string; dataElements: string[]; roles: RoleSet }[];
  assignedRoles: RoleRef[]; assignedExtra: string[];
  tasks: { id: string; title: string; owner: string | null; priority: string }[];
  downstream: { valueStreamId: string; valueStreamName: string; subProcess: string | null; roles: RoleSet }[];
};
type TaskDetail = {
  kind: 'task'; id: string; title: string; owner: string | null; priority: string;
  valueStream: { id: string; name: string } | null; subProcess: string | null;
  leadRoles: RoleRef[]; leadExtra: string[]; supportRoles: RoleRef[]; supportExtra: string[];
  outputs: string[];
  deliverable: { id: string; title: string } | null;
  downstream: { valueStreamId: string; valueStreamName: string; subProcess: string | null; item: string; roles: RoleSet }[];
};
type Detail = DeliverableDetail | TaskDetail;

const PRIORITY_PILL: Record<string, string> = { High: 'pill-red', Medium: 'pill-amber', Low: 'pill-slate' };

// Distinguishes the two task sources nested under a deliverable: 'role' tasks are
// role responsibilities folded in; 'process' tasks come from L5 process steps.
function SourceTag({ source }: { source: string }) {
  const isRole = source === 'role';
  return (
    <span
      title={isRole ? 'From a role responsibility' : 'From a Process Level 6 step'}
      className={'text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded flex-shrink-0 ' +
        (isRole ? 'bg-[#eef2ff] text-[#4338ca]' : 'bg-[#f5f5f5] text-[#737373]')}
    >
      {isRole ? 'Role' : 'Process'}
    </span>
  );
}

// Matrix column header that doubles as a filter: the column name sits above a
// compact native <select>. A value other than 'All' narrows the rows to that
// column value. Styled to match the app's company picker.
function HeaderFilter({ label, value, onChange, options, extra }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; extra?: React.ReactNode;
}) {
  const active = value !== 'All';
  return (
    <th className="text-left align-top px-3 py-2 border-b border-[#eaeaea]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">{label}{extra}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={'appearance-none w-full rounded-md border bg-white pl-2.5 pr-7 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
            (active ? 'border-[#171717] text-[#171717] font-medium' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </th>
  );
}

// Like HeaderFilter but with a search box inside the dropdown — used for the
// Deliverable column, whose option list is long enough to want type-ahead. A
// custom combobox (native <select> can't host an input); closes on outside click.
function HeaderComboFilter({ label, value, onChange, options, extra }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLTableCellElement>(null);
  const active = value !== 'All';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  // 'All' always stays selectable so the filter can be cleared from the list.
  const filtered = options.filter((o) => o === 'All' || o.toLowerCase().includes(q));
  function pick(o: string) { onChange(o); setOpen(false); setQuery(''); }

  return (
    <th ref={ref} className="text-left align-top px-3 py-2 border-b border-[#eaeaea] relative">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">{label}{extra}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={'flex items-center justify-between gap-1 w-full rounded-md border bg-white pl-2.5 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
          (active ? 'border-[#171717] text-[#171717] font-medium' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      >
        <span className="truncate">{value}</span>
        <svg className={'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-180' : '')} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 left-3 mt-1 min-w-[220px] rounded-md border border-[#eaeaea] bg-white shadow-lg">
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
                className={'block w-full truncate text-left px-2.5 py-1.5 text-xs hover:bg-[#fafafa] transition-colors duration-100 ' +
                  (o === value ? 'text-[#171717] font-medium bg-[#fafafa]' : 'text-[#525252]')}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </th>
  );
}

// Like HeaderFilter but free-text — used for the title columns, whose values are
// too many/unique for a dropdown.
function HeaderSearch({ label, value, onChange, extra }: {
  label: string; value: string; onChange: (v: string) => void; extra?: React.ReactNode;
}) {
  return (
    <th className="text-left align-top px-3 py-2 border-b border-[#eaeaea]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">{label}{extra}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={'w-full rounded-md border bg-white px-2.5 py-1 text-xs placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
          (value.trim() ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      />
    </th>
  );
}

// Plain (non-filter) column header with an optional sort toggle.
function HeaderPlain({ label, extra }: { label: string; extra?: React.ReactNode }) {
  return (
    <th className="text-left align-top px-3 py-2 border-b border-[#eaeaea]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">{label}{extra}</div>
    </th>
  );
}

// ── Drill-down primitives ─────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{label}</div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

// Resolved roles render as blue pills that link to the role page; unmatched raw
// references stay as plain slate pills.
function RoleChips({ roles, extra, empty = '—' }: { roles: RoleRef[]; extra: string[]; empty?: string }) {
  if (roles.length === 0 && extra.length === 0) return <span className="text-[#a3a3a3]">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => (
        <Link key={r.id} to={`/roles/${r.id}`} className="pill-blue text-xs hover:ring-1 hover:ring-[#171717] transition-shadow duration-150">{r.name}</Link>
      ))}
      {extra.map((e) => <span key={e} className="pill-slate text-xs">{e}</span>)}
    </div>
  );
}

// Right-hand sliding sidebar that hosts the drill-down detail.
function Sidebar({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-md shadow-lg border-l border-[#eaeaea] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-[#eaeaea] sticky top-0 bg-white flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function DetailBody({ detail }: { detail: Detail }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[#171717]">{detail.title}</h3>
        {detail.kind === 'deliverable' && detail.description && (
          <p className="text-sm text-[#666666] mt-1">{detail.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {detail.kind === 'deliverable'
            ? <span className="pill-slate text-xs">{detail.type}</span>
            : <span className={`${PRIORITY_PILL[detail.priority] ?? 'pill-slate'} text-xs`}>{detail.priority}</span>}
          {detail.owner && <span className="pill-slate text-xs">Owner · {detail.owner}</span>}
        </div>
      </div>

      {/* Where it lives in the operating model */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Process Level 3">
          {detail.valueStream
            ? <>{detail.valueStream.name}{detail.kind === 'deliverable' && detail.valueStream.domain && <span className="text-[#a3a3a3]"> · {detail.valueStream.domain}</span>}</>
            : <span className="text-[#a3a3a3]">—</span>}
        </Field>
        <Field label="Process Level 5">
          {detail.kind === 'deliverable'
            ? (detail.subProcesses.length ? detail.subProcesses.join(', ') : <span className="text-[#a3a3a3]">—</span>)
            : (detail.subProcess ?? <span className="text-[#a3a3a3]">—</span>)}
        </Field>
      </div>

      {/* Roles this is assigned to */}
      {detail.kind === 'deliverable' ? (
        <Field label="Assigned roles"><RoleChips roles={detail.assignedRoles} extra={detail.assignedExtra} /></Field>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lead roles"><RoleChips roles={detail.leadRoles} extra={detail.leadExtra} /></Field>
          <Field label="Supporting roles"><RoleChips roles={detail.supportRoles} extra={detail.supportExtra} /></Field>
        </div>
      )}

      {/* Linked work */}
      {detail.kind === 'deliverable' ? (
        <Field label={`Tasks (${detail.tasks.length})`}>
          {detail.tasks.length === 0 ? <span className="text-[#a3a3a3]">No tasks</span> : (
            <ul className="space-y-1">
              {detail.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[#171717]">{t.title}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {t.owner && <span className="text-xs text-[#a3a3a3]">{t.owner}</span>}
                    <span className={`${PRIORITY_PILL[t.priority] ?? 'pill-slate'} text-xs`}>{t.priority}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Field>
      ) : (
        detail.deliverable && <Field label="Feeds deliverable">{detail.deliverable.title}</Field>
      )}

      {/* Upstream inputs consumed by the producing sub-process (DT2) */}
      {detail.kind === 'deliverable' && (detail.inputs?.length ?? 0) > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">
            Inputs consumed ({detail.inputs.length})
          </div>
          <div className="space-y-2">
            {detail.inputs.map((inp) => (
              <div key={inp.name} className="rounded-lg border border-[#eaeaea] p-3">
                <div className="text-sm font-medium text-[#171717]">{inp.name}</div>
                {inp.dataElements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {inp.dataElements.map((e) => <span key={e} className="pill-slate text-xs">{e}</span>)}
                  </div>
                )}
                {(inp.roles.roles.length > 0 || inp.roles.unresolved.length > 0) && (
                  <div className="mt-2"><RoleChips roles={inp.roles.roles} extra={inp.roles.unresolved} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data elements / outputs produced */}
      {detail.kind === 'deliverable' && detail.dataElements.length > 0 && (
        <Field label="Data elements">
          <div className="flex flex-wrap gap-1.5">{detail.dataElements.map((e) => <span key={e} className="pill-slate text-xs">{e}</span>)}</div>
        </Field>
      )}
      {detail.kind === 'task' && detail.outputs.length > 0 && (
        <Field label="Outputs">
          <div className="flex flex-wrap gap-1.5">{detail.outputs.map((o) => <span key={o} className="pill-slate text-xs">{o}</span>)}</div>
        </Field>
      )}

      {/* Downstream impact */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">
          Downstream impact ({detail.downstream.length})
        </div>
        {detail.downstream.length === 0 ? (
          <div className="text-sm text-[#a3a3a3]">Not consumed elsewhere in the operating model.</div>
        ) : (
          <div className="space-y-2">
            {detail.downstream.map((ds, i) => (
              <div key={i} className="rounded-lg border border-[#eaeaea] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#171717]">{ds.valueStreamName}</span>
                  {'item' in ds && <span className="text-xs text-[#a3a3a3]">consumes {ds.item}</span>}
                </div>
                {ds.subProcess && <div className="text-xs text-[#a3a3a3] mt-0.5">{ds.subProcess}</div>}
                {(ds.roles.roles.length > 0 || ds.roles.unresolved.length > 0) && (
                  <div className="mt-2"><RoleChips roles={ds.roles.roles} extra={ds.roles.unresolved} /></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DASH = '—';

// Column ordering: each column sorts via the toggle in its header.
type Sort = { col: string; dir: 1 | -1 } | null;
function compareValues(va: string, vb: string, dir: 1 | -1): number {
  // Dashes (empty cells) always trail, regardless of direction.
  if (va === DASH && vb !== DASH) return 1;
  if (vb === DASH && va !== DASH) return -1;
  return va.localeCompare(vb, undefined, { numeric: true }) * dir;
}

// Sort toggle rendered beside each column label — sized for visibility (D8.2).
function SortToggle({ col, sort, onSort }: { col: string; sort: Sort; onSort: (c: string) => void }) {
  const active = sort?.col === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      title={active ? (sort!.dir === 1 ? 'Sorted ascending — click to reverse' : 'Sorted descending — click to clear') : 'Sort by this column'}
      className={'ml-1.5 align-middle text-[13px] leading-none font-bold ' + (active ? 'text-[#171717]' : 'text-[#737373] hover:text-[#171717]')}
    >
      {active ? (sort!.dir === 1 ? '▲' : '▼') : '⇅'}
    </button>
  );
}

const PAGE_SIZE = 100;

// Shared pagination footer.
function Pager({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-[#eaeaea] text-xs text-[#525252]">
      <span className="tnum">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} rows
      </span>
      <span className="flex items-center gap-1">
        <button onClick={() => onPage(0)} disabled={page === 0} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 0} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">‹ Prev</button>
        <span className="px-2 tnum">Page {page + 1} / {pageCount}</span>
        <button onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">Next ›</button>
        <button onClick={() => onPage(pageCount - 1)} disabled={page >= pageCount - 1} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">»</button>
      </span>
    </div>
  );
}

export default function Work() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<'deliverables' | 'tasks'>('deliverables');

  // ── Deliverables tab filters ──
  const [dSearch, setDSearch] = useState('');
  const [dType, setDType] = useState('All');
  const [dValueStream, setDValueStream] = useState('All');
  const [dSort, setDSort] = useState<Sort>(null);
  const [dPage, setDPage] = useState(0);

  // ── Tasks tab filters ──
  const [tSearch, setTSearch] = useState('');
  const [tDeliverable, setTDeliverable] = useState('All');
  const [tValueStream, setTValueStream] = useState('All');
  const [tSort, setTSort] = useState<Sort>(null);
  const [tPage, setTPage] = useState(0);

  // Cycle a column's sort: none -> asc -> desc -> none. Any change resets paging.
  const cycle = (s: Sort, col: string): Sort => (!s || s.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null);
  const dToggleSort = (col: string) => { setDSort((s) => cycle(s, col)); setDPage(0); };
  const tToggleSort = (col: string) => { setTSort((s) => cycle(s, col)); setTPage(0); };

  useEffect(() => {
    if (companyLoading) return;
    api.get(withCompany('/work', companyId)).then(setData).catch(() => {});
  }, [companyId, companyLoading]);

  // Open a row's drill-down in the sidebar by fetching its detail.
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    api.get(withCompany(`/work/${kind}/${id}`, companyId)).then(setDetail).catch(() => {});
  }

  const { deliverables, tasks } = data;
  const vsByDeliverable = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d.valueStreamName ?? DASH])),
    [deliverables],
  );

  // ── Deliverables tab rows ──
  const dTypeOptions = useMemo(() => ['All', ...[...new Set(deliverables.map((d) => d.type).filter(Boolean))].sort()], [deliverables]);
  const valueStreamOptions = useMemo(() => ['All', ...data.valueStreams.map((v) => v.name)], [data.valueStreams]);
  const dRows = useMemo(() => {
    const q = dSearch.trim().toLowerCase();
    const base = deliverables.filter((d) =>
      (!q || d.title.toLowerCase().includes(q))
      && (dType === 'All' || d.type === dType)
      && (dValueStream === 'All' || d.valueStreamName === dValueStream)
    );
    if (!dSort) return base;
    const { col, dir } = dSort;
    return [...base].sort((a, b) => {
      if (col === 'tasks') return (a.taskCount - b.taskCount) * dir;
      const va = col === 'title' ? a.title : col === 'type' ? a.type : (a.valueStreamName ?? DASH);
      const vb = col === 'title' ? b.title : col === 'type' ? b.type : (b.valueStreamName ?? DASH);
      return compareValues(va, vb, dir);
    });
  }, [deliverables, dSearch, dType, dValueStream, dSort]);
  const dPageCount = Math.max(1, Math.ceil(dRows.length / PAGE_SIZE));
  const dSafePage = Math.min(dPage, dPageCount - 1);
  const dPaged = dRows.slice(dSafePage * PAGE_SIZE, (dSafePage + 1) * PAGE_SIZE);

  // ── Tasks tab rows ──
  const tDeliverableOptions = useMemo(() => ['All', ...[...new Set(deliverables.map((d) => d.title))].sort()], [deliverables]);
  const tRows = useMemo(() => {
    const q = tSearch.trim().toLowerCase();
    const base = tasks.filter((t) => {
      const vs = t.deliverableId ? vsByDeliverable.get(t.deliverableId) ?? DASH : DASH;
      return (!q || t.title.toLowerCase().includes(q))
        && (tDeliverable === 'All' || t.deliverableTitle === tDeliverable)
        && (tValueStream === 'All' || vs === tValueStream);
    });
    if (!tSort) return base;
    const { col, dir } = tSort;
    return [...base].sort((a, b) => {
      const get = (t: Task) =>
        col === 'title' ? t.title
        : col === 'deliverable' ? (t.deliverableTitle ?? DASH)
        : (t.deliverableId ? vsByDeliverable.get(t.deliverableId) ?? DASH : DASH);
      return compareValues(get(a), get(b), dir);
    });
  }, [tasks, tSearch, tDeliverable, tValueStream, tSort, vsByDeliverable]);
  const tPageCount = Math.max(1, Math.ceil(tRows.length / PAGE_SIZE));
  const tSafePage = Math.min(tPage, tPageCount - 1);
  const tPaged = tRows.slice(tSafePage * PAGE_SIZE, (tSafePage + 1) * PAGE_SIZE);

  const dAnyFilter = dSearch.trim() !== '' || dType !== 'All' || dValueStream !== 'All';
  const tAnyFilter = tSearch.trim() !== '' || tDeliverable !== 'All' || tValueStream !== 'All';

  return (
    <div>
      <PageHeader title="Deliverables & Tasks" subtitle="Track tangible outputs and the work driving them across the company" />

      {/* ── Tab switcher (D8.1) — carries the counts so no tile row is needed ── */}
      <div className="border-b border-[#eaeaea] mb-3 flex items-center gap-1">
        {([['deliverables', `Deliverables (${deliverables.length})`], ['tasks', `Tasks (${tasks.length})`]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ' +
              (tab === v ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#666666] hover:text-[#171717]')
            }
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        {((tab === 'deliverables' && dAnyFilter) || (tab === 'tasks' && tAnyFilter)) && (
          <button
            onClick={() => {
              if (tab === 'deliverables') { setDSearch(''); setDType('All'); setDValueStream('All'); setDPage(0); }
              else { setTSearch(''); setTDeliverable('All'); setTValueStream('All'); setTPage(0); }
            }}
            className="text-xs font-medium text-[#525252] hover:text-[#171717] transition-colors duration-150 pb-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {tab === 'deliverables' ? (
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <HeaderSearch label="Deliverable" value={dSearch} onChange={(v) => { setDSearch(v); setDPage(0); }} extra={<SortToggle col="title" sort={dSort} onSort={dToggleSort} />} />
                  <HeaderFilter label="Type" value={dType} onChange={(v) => { setDType(v); setDPage(0); }} options={dTypeOptions} extra={<SortToggle col="type" sort={dSort} onSort={dToggleSort} />} />
                  <HeaderComboFilter label="Value Stream" value={dValueStream} onChange={(v) => { setDValueStream(v); setDPage(0); }} options={valueStreamOptions} extra={<SortToggle col="valueStream" sort={dSort} onSort={dToggleSort} />} />
                  <HeaderPlain label="Tasks" extra={<SortToggle col="tasks" sort={dSort} onSort={dToggleSort} />} />
                </tr>
              </thead>
              <tbody>
                {dRows.length === 0 ? (
                  <tr><td colSpan={4} className="text-sm text-[#a3a3a3] py-8 text-center">No deliverables match the filters.</td></tr>
                ) : dPaged.map((d) => (
                  <tr key={d.id} className="border-t border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="px-3 py-2 align-top">
                      <button onClick={() => openDrill('deliverable', d.id)} className="text-left font-medium text-[#171717] hover:underline">
                        {d.title}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-top"><span className="pill-slate text-xs">{d.type}</span></td>
                    <td className="px-3 py-2 align-top text-[#525252]">{d.valueStreamName ?? DASH}</td>
                    <td className="px-3 py-2 align-top text-[#525252] tnum">{d.taskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={dSafePage} pageCount={dPageCount} total={dRows.length} onPage={setDPage} />
          </div>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <HeaderSearch label="Task" value={tSearch} onChange={(v) => { setTSearch(v); setTPage(0); }} extra={<SortToggle col="title" sort={tSort} onSort={tToggleSort} />} />
                  <HeaderComboFilter label="Deliverable" value={tDeliverable} onChange={(v) => { setTDeliverable(v); setTPage(0); }} options={tDeliverableOptions} extra={<SortToggle col="deliverable" sort={tSort} onSort={tToggleSort} />} />
                  <HeaderComboFilter label="Value Stream" value={tValueStream} onChange={(v) => { setTValueStream(v); setTPage(0); }} options={valueStreamOptions} extra={<SortToggle col="valueStream" sort={tSort} onSort={tToggleSort} />} />
                </tr>
              </thead>
              <tbody>
                {tRows.length === 0 ? (
                  <tr><td colSpan={3} className="text-sm text-[#a3a3a3] py-8 text-center">No tasks match the filters.</td></tr>
                ) : tPaged.map((t) => (
                  <tr key={t.id} className="border-t border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="px-3 py-2 align-top">
                      <button onClick={() => openDrill('task', t.id)} className="flex items-center gap-2 text-left text-[#171717] hover:underline">
                        <SourceTag source={t.source} />
                        <span>{t.title}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 align-top text-[#525252]">{t.deliverableTitle ?? DASH}</td>
                    <td className="px-3 py-2 align-top text-[#525252]">{t.deliverableId ? vsByDeliverable.get(t.deliverableId) ?? DASH : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={tSafePage} pageCount={tPageCount} total={tRows.length} onPage={setTPage} />
          </div>
        </div>
      )}

      {detail && (
        <Sidebar title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'} onClose={() => setDetail(null)}>
          <DetailBody detail={detail} />
        </Sidebar>
      )}
    </div>
  );
}
