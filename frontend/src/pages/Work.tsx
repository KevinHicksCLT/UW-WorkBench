import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import { SectionCard, Tile, withCompany } from '../lib/portfolio';

// Deliverables & Tasks — a standalone work tracker rendered as a spreadsheet
// matrix: one row per task, with the deliverable columns (title/type/value
// stream) repeating across the tasks that share a deliverable. Each column
// header is a filter (dropdown, or free-text search for Task). Clicking a
// deliverable or task cell opens a right-hand sidebar with the granular
// drill-down — roles, value stream, downstream impact. Scoped to the active company.

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
    <th className="text-left align-top px-3 py-2.5 border-b border-[#eaeaea]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1.5">{label}{extra}</div>
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
    <th ref={ref} className="text-left align-top px-3 py-2.5 border-b border-[#eaeaea] relative">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1.5">{label}{extra}</div>
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

// Like HeaderFilter but free-text — used for the Task column, whose values are
// too many/unique for a dropdown.
function HeaderSearch({ label, value, onChange, extra }: {
  label: string; value: string; onChange: (v: string) => void; extra?: React.ReactNode;
}) {
  return (
    <th className="text-left align-top px-3 py-2.5 border-b border-[#eaeaea]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1.5">{label}{extra}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className={'w-full rounded-md border bg-white px-2.5 py-1 text-xs placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150 ' +
          (value.trim() ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4]')}
      />
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

// One flattened matrix row. Each task becomes a row; the deliverable columns
// (title/type/value stream) repeat across the tasks that share a deliverable. A
// deliverable with no tasks still gets a row (task cells blank), and tasks with
// no deliverable get a row with the deliverable cells blank.
const DASH = '—';
type Row = {
  key: string;
  deliverableId: string | null; deliverable: string;
  task: string; type: string; valueStream: string; role: string; priority: string;
  source: string | null;
  kind: 'deliverable' | 'task'; drillId: string;
};

// Priority columns sort High → Medium → Low; anything else trails alphabetically.
const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const byPriority = (a: string, b: string) =>
  (PRIORITY_ORDER[a] ?? 9) - (PRIORITY_ORDER[b] ?? 9) || a.localeCompare(b);

// Column ordering: each filterable column also sorts (▲/▼ toggle in the header).
type SortCol = 'deliverable' | 'task' | 'type' | 'valueStream' | 'role' | 'priority';
type Sort = { col: SortCol; dir: 1 | -1 } | null;
function compareRows(a: Row, b: Row, sort: Sort): number {
  if (!sort) return 0;
  const va = a[sort.col], vb = b[sort.col];
  // Dashes (empty cells) always trail, regardless of direction.
  if (va === DASH && vb !== DASH) return 1;
  if (vb === DASH && va !== DASH) return -1;
  const cmp = sort.col === 'priority' ? byPriority(va, vb) : va.localeCompare(vb);
  return cmp * sort.dir;
}

// Small ▲/▼ toggle rendered beside each column label.
function SortToggle({ col, sort, onSort }: { col: SortCol; sort: Sort; onSort: (c: SortCol) => void }) {
  const active = sort?.col === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      title={active ? (sort!.dir === 1 ? 'Sorted ascending — click to reverse' : 'Sorted descending — click to clear') : 'Sort by this column'}
      className={'ml-1 align-middle text-[10px] leading-none ' + (active ? 'text-[#171717]' : 'text-[#c4c4c4] hover:text-[#737373]')}
    >
      {active ? (sort!.dir === 1 ? '▲' : '▼') : '⇅'}
    </button>
  );
}

const PAGE_SIZE = 100;

export default function Work() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [detail, setDetail] = useState<Detail | null>(null);

  // Column-header filters ('All' = no filter); Task is a free-text search.
  const [deliverable, setDeliverable] = useState('All');
  const [taskSearch, setTaskSearch] = useState('');
  const [type, setType] = useState('All');
  const [valueStream, setValueStream] = useState('All');
  const [role, setRole] = useState('All');
  const [priority, setPriority] = useState('All');
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(0);

  // Cycle a column's sort: none -> asc -> desc -> none. Any change resets paging.
  function toggleSort(col: SortCol) {
    setSort((s) => (!s || s.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null));
    setPage(0);
  }

  useEffect(() => {
    if (companyLoading) return;
    api.get(withCompany('/work', companyId)).then(setData).catch(() => {});
  }, [companyId, companyLoading]);

  // Open a row's drill-down in the sidebar by fetching its detail.
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    api.get(withCompany(`/work/${kind}/${id}`, companyId)).then(setDetail).catch(() => {});
  }

  const { deliverables, tasks } = data;

  // Tasks grouped under their deliverable; tasks with no deliverable kept aside.
  const tasksByDeliverable = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) if (t.deliverableId) {
      const arr = map.get(t.deliverableId) ?? []; arr.push(t); map.set(t.deliverableId, arr);
    }
    return map;
  }, [tasks]);
  const orphanTasks = useMemo(() => tasks.filter((t) => !t.deliverableId), [tasks]);

  // ── Flatten deliverables + tasks into matrix rows ──────────────────────────
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const d of deliverables) {
      const childTasks = tasksByDeliverable.get(d.id) ?? [];
      if (childTasks.length === 0) {
        out.push({
          key: `d-${d.id}`, deliverableId: d.id, deliverable: d.title,
          task: DASH, type: d.type, valueStream: d.valueStreamName ?? DASH,
          role: d.owner ?? DASH, priority: DASH, source: null,
          kind: 'deliverable', drillId: d.id,
        });
      } else {
        for (const t of childTasks) {
          out.push({
            key: `t-${t.id}`, deliverableId: d.id, deliverable: d.title,
            task: t.title, type: d.type, valueStream: d.valueStreamName ?? DASH,
            role: t.owner ?? DASH, priority: t.priority, source: t.source,
            kind: 'task', drillId: t.id,
          });
        }
      }
    }
    for (const t of orphanTasks) {
      out.push({
        key: `t-${t.id}`, deliverableId: null, deliverable: DASH,
        task: t.title, type: DASH, valueStream: DASH,
        role: t.owner ?? DASH, priority: t.priority, source: t.source,
        kind: 'task', drillId: t.id,
      });
    }
    return out;
  }, [deliverables, tasksByDeliverable, orphanTasks]);

  // ── Filter option lists derived from the rows ──────────────────────────────
  const distinct = (vals: string[]) => [...new Set(vals.filter((v) => v && v !== DASH))];
  const deliverableOptions = useMemo(() => ['All', ...distinct(rows.map((r) => r.deliverable)).sort()], [rows]);
  const typeOptions = useMemo(() => ['All', ...distinct(rows.map((r) => r.type)).sort()], [rows]);
  const valueStreamOptions = useMemo(() => ['All', ...data.valueStreams.map((v) => v.name)], [data.valueStreams]);
  const roleOptions = useMemo(() => ['All', ...distinct(rows.map((r) => r.role)).sort()], [rows]);
  const priorityOptions = useMemo(() => ['All', ...distinct(rows.map((r) => r.priority)).sort(byPriority)], [rows]);

  // A row survives every active column filter.
  const filteredRows = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const base = rows.filter((r) =>
      (deliverable === 'All' || r.deliverable === deliverable)
      && (type === 'All' || r.type === type)
      && (valueStream === 'All' || r.valueStream === valueStream)
      && (role === 'All' || r.role === role)
      && (priority === 'All' || r.priority === priority)
      && (!q || r.task.toLowerCase().includes(q))
    );
    return sort ? [...base].sort((a, b) => compareRows(a, b, sort)) : base;
  }, [rows, deliverable, type, valueStream, role, priority, taskSearch, sort]);

  // Render at most a page of rows at a time — the full 5k+ row table is what
  // made this screen slow, not the query.
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(
    () => filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filteredRows, safePage],
  );

  // Tiles count distinct deliverables and task rows among the visible rows.
  const visibleDeliverables = useMemo(
    () => new Set(filteredRows.filter((r) => r.deliverableId).map((r) => r.deliverableId)).size,
    [filteredRows],
  );
  const visibleTasks = useMemo(() => filteredRows.filter((r) => r.kind === 'task').length, [filteredRows]);

  const anyFilter = deliverable !== 'All' || type !== 'All' || valueStream !== 'All'
    || role !== 'All' || priority !== 'All' || taskSearch.trim() !== '';
  function clearFilters() {
    setDeliverable('All'); setType('All'); setValueStream('All');
    setRole('All'); setPriority('All'); setTaskSearch(''); setPage(0);
  }

  return (
    <div>
      <PageHeader title="Deliverables & Tasks" subtitle="Track tangible outputs and the work driving them across the company" />

      {/* ── Overview metric tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label="Deliverables" value={visibleDeliverables} />
        <Tile label="Tasks" value={visibleTasks} />
      </div>

      {/* ── Matrix: one row per task, filterable column headers ────────────── */}
      <SectionCard
        title="Work matrix"
        actions={anyFilter ? (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-[#525252] hover:text-[#171717] transition-colors duration-150"
          >
            Clear filters
          </button>
        ) : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <HeaderComboFilter label="Deliverable" value={deliverable} onChange={(v) => { setDeliverable(v); setPage(0); }} options={deliverableOptions} extra={<SortToggle col="deliverable" sort={sort} onSort={toggleSort} />} />
                <HeaderSearch label="Task" value={taskSearch} onChange={(v) => { setTaskSearch(v); setPage(0); }} extra={<SortToggle col="task" sort={sort} onSort={toggleSort} />} />
                <HeaderFilter label="Type" value={type} onChange={(v) => { setType(v); setPage(0); }} options={typeOptions} extra={<SortToggle col="type" sort={sort} onSort={toggleSort} />} />
                <HeaderComboFilter label="Value Stream" value={valueStream} onChange={(v) => { setValueStream(v); setPage(0); }} options={valueStreamOptions} extra={<SortToggle col="valueStream" sort={sort} onSort={toggleSort} />} />
                <HeaderComboFilter label="Role" value={role} onChange={(v) => { setRole(v); setPage(0); }} options={roleOptions} extra={<SortToggle col="role" sort={sort} onSort={toggleSort} />} />
                <HeaderFilter label="Priority" value={priority} onChange={(v) => { setPriority(v); setPage(0); }} options={priorityOptions} extra={<SortToggle col="priority" sort={sort} onSort={toggleSort} />} />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-sm text-[#a3a3a3] py-8 text-center">No work items match the filters.</td>
                </tr>
              ) : pagedRows.map((r) => (
                <tr key={r.key} className="border-t border-[#f5f5f5] hover:bg-[#fafafa]">
                  {/* Deliverable — clickable when present; drills the deliverable */}
                  <td className="px-3 py-2.5 align-top">
                    {r.deliverableId ? (
                      <button
                        onClick={() => openDrill('deliverable', r.deliverableId!)}
                        className="text-left font-medium text-[#171717] hover:underline"
                      >
                        {r.deliverable}
                      </button>
                    ) : <span className="text-[#a3a3a3]">{r.deliverable}</span>}
                  </td>
                  {/* Task — clickable when present; drills the task */}
                  <td className="px-3 py-2.5 align-top">
                    {r.kind === 'task' ? (
                      <button
                        onClick={() => openDrill('task', r.drillId)}
                        className="flex items-center gap-2 text-left text-[#171717] hover:underline"
                      >
                        {r.source && <SourceTag source={r.source} />}
                        <span>{r.task}</span>
                      </button>
                    ) : <span className="text-[#a3a3a3]">{r.task}</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {r.type === DASH ? <span className="text-[#a3a3a3]">{DASH}</span> : <span className="pill-slate text-xs">{r.type}</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[#525252]">{r.valueStream}</td>
                  <td className="px-3 py-2.5 align-top text-[#525252]">{r.role}</td>
                  <td className="px-3 py-2.5 align-top">
                    {r.priority === DASH ? <span className="text-[#a3a3a3]">{DASH}</span> : <span className={`${PRIORITY_PILL[r.priority] ?? 'pill-slate'} text-xs`}>{r.priority}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-[#eaeaea] text-xs text-[#525252]">
              <span className="tnum">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} rows
              </span>
              <span className="flex items-center gap-1">
                <button onClick={() => setPage(0)} disabled={safePage === 0} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">«</button>
                <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">‹ Prev</button>
                <span className="px-2 tnum">Page {safePage + 1} / {pageCount}</span>
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">Next ›</button>
                <button onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1} className="px-2 py-1 rounded border border-[#eaeaea] disabled:opacity-40 hover:bg-[#fafafa]">»</button>
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {detail && (
        <Sidebar title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'} onClose={() => setDetail(null)}>
          <DetailBody detail={detail} />
        </Sidebar>
      )}
    </div>
  );
}
