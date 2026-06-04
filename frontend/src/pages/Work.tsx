import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import { SectionCard, Tile, withCompany } from '../lib/portfolio';

// Deliverables & Tasks — a standalone work tracker. Deliverables render as a
// collapsible tree: each one lists its tasks nested underneath when expanded
// (all expanded by default). Clicking a deliverable or task opens a right-hand
// sidebar with the granular drill-down — roles, value stream, downstream impact.
// All data is scoped to the active company.

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
      title={isRole ? 'From a role responsibility' : 'From an L5 process step'}
      className={'text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded flex-shrink-0 ' +
        (isRole ? 'bg-[#eef2ff] text-[#4338ca]' : 'bg-[#f5f5f5] text-[#737373]')}
    >
      {isRole ? 'Role' : 'Process'}
    </span>
  );
}

// A label + native <select>, styled to match the app's company picker.
function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="min-w-[140px]">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full rounded-lg border border-[#eaeaea] bg-white pl-3 pr-8 py-1.5 text-sm text-[#171717] cursor-pointer hover:border-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
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
        <Field label="Value Stream">
          {detail.valueStream
            ? <>{detail.valueStream.name}{detail.kind === 'deliverable' && detail.valueStream.domain && <span className="text-[#a3a3a3]"> · {detail.valueStream.domain}</span>}</>
            : <span className="text-[#a3a3a3]">—</span>}
        </Field>
        <Field label="Sub-process">
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

// Chevron that rotates when its row is expanded.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={'text-[#a3a3a3] transition-transform duration-150 ' + (open ? 'rotate-90' : '')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function Work() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters.
  const [type, setType] = useState('All');
  const [valueStream, setValueStream] = useState('All');
  const [owner, setOwner] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (companyLoading) return;
    api.get(withCompany('/work', companyId)).then(setData).catch(() => {});
  }, [companyId, companyLoading]);

  // Start fully expanded whenever the deliverable set loads/changes.
  useEffect(() => { setExpanded(new Set(data.deliverables.map((d) => d.id))); }, [data.deliverables]);

  // Open a row's drill-down in the sidebar by fetching its detail.
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    api.get(withCompany(`/work/${kind}/${id}`, companyId)).then(setDetail).catch(() => {});
  }
  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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

  // ── Filter option lists derived from the data ──────────────────────────────
  const owners = useMemo(() => {
    const set = new Set<string>();
    deliverables.forEach((d) => d.owner && set.add(d.owner));
    return ['All', ...[...set].sort()];
  }, [deliverables]);
  const types = useMemo(() => ['All', ...[...new Set(deliverables.map((d) => d.type))].sort()], [deliverables]);
  const valueStreamNames = useMemo(() => ['All', ...data.valueStreams.map((v) => v.name)], [data.valueStreams]);

  const matchesSearch = (s: string) => !search.trim() || s.toLowerCase().includes(search.trim().toLowerCase());

  // A deliverable stays visible if it matches the filters and either it or one of
  // its tasks matches the search term.
  const filteredDeliverables = useMemo(() => deliverables.filter((d) =>
    (type === 'All' || d.type === type)
    && (valueStream === 'All' || d.valueStreamName === valueStream)
    && (owner === 'All' || d.owner === owner)
    && (matchesSearch(d.title) || (tasksByDeliverable.get(d.id) ?? []).some((t) => matchesSearch(t.title)))
  ), [deliverables, type, valueStream, owner, search, tasksByDeliverable]);

  const filteredOrphans = useMemo(() => orphanTasks.filter((t) =>
    (owner === 'All' || t.owner === owner) && matchesSearch(t.title)
  ), [orphanTasks, owner, search]);

  // Tasks visible under the current filters: those nested in the shown
  // deliverables, plus the shown orphan tasks. Drives the (filtered) tiles.
  const visibleTaskCount = useMemo(() => {
    let n = filteredOrphans.length;
    for (const d of filteredDeliverables) n += (tasksByDeliverable.get(d.id) ?? []).length;
    return n;
  }, [filteredDeliverables, filteredOrphans, tasksByDeliverable]);

  const anyExpanded = expanded.size > 0;
  const empty = filteredDeliverables.length === 0 && filteredOrphans.length === 0;

  return (
    <div>
      <PageHeader title="Deliverables & Tasks" subtitle="Track tangible outputs and the work driving them across the company" />

      {/* ── Overview metric tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label="Deliverables" value={filteredDeliverables.length} />
        <Tile label="Tasks" value={visibleTaskCount} />
      </div>

      {/* ── Filter bar + collapsible tree ──────────────────────────────────── */}
      <SectionCard
        title="Work items"
        actions={
          <button
            onClick={() => setExpanded(anyExpanded ? new Set() : new Set(filteredDeliverables.map((d) => d.id)))}
            className="text-xs font-medium text-[#525252] hover:text-[#171717] transition-colors duration-150"
          >
            {anyExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        }
      >
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Dropdown label="Type" value={type} onChange={setType} options={types} />
          <Dropdown label="Value Stream" value={valueStream} onChange={setValueStream} options={valueStreamNames} />
          <Dropdown label="Role" value={owner} onChange={setOwner} options={owners} />
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deliverables & tasks…"
              className="w-full rounded-lg border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
            />
          </div>
        </div>

        {/* ── Tree ──────────────────────────────────────────────────────────── */}
        {empty ? (
          <div className="text-sm text-[#a3a3a3] py-6 text-center">No work items match the filters.</div>
        ) : (
          <div className="border-t border-[#eaeaea]">
            {filteredDeliverables.map((d) => {
              const childTasks = tasksByDeliverable.get(d.id) ?? [];
              const open = expanded.has(d.id);
              return (
                <div key={d.id} className="border-b border-[#f5f5f5]">
                  {/* Deliverable row */}
                  <div className="flex items-center gap-2 py-2.5 hover:bg-[#fafafa] cursor-pointer" onClick={() => openDrill('deliverable', d.id)}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(d.id); }}
                      className={'flex items-center justify-center w-5 h-5 rounded ' + (childTasks.length ? 'hover:bg-[#eaeaea]' : 'invisible')}
                      aria-label={open ? 'Collapse' : 'Expand'}
                    >
                      <Chevron open={open} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#171717] truncate">{d.title}</div>
                      {d.description && <div className="text-xs text-[#a3a3a3] mt-0.5 line-clamp-1">{d.description}</div>}
                    </div>
                    <span className="pill-slate text-xs flex-shrink-0">{d.type}</span>
                    <span className="hidden sm:block text-xs text-[#525252] w-32 truncate flex-shrink-0">{d.valueStreamName ?? '—'}</span>
                    <span className="hidden sm:block text-xs text-[#525252] w-28 truncate flex-shrink-0">{d.owner ?? '—'}</span>
                    <span className="text-xs text-[#a3a3a3] tnum w-16 text-right flex-shrink-0">{childTasks.length} task{childTasks.length !== 1 && 's'}</span>
                  </div>
                  {/* Nested tasks */}
                  {open && childTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 py-2 pl-9 hover:bg-[#fafafa] cursor-pointer border-t border-[#fafafa]" onClick={() => openDrill('task', t.id)}>
                      <SourceTag source={t.source} />
                      <div className="flex-1 min-w-0 text-sm text-[#171717] truncate">{t.title}</div>
                      <span className="hidden sm:block text-xs text-[#525252] w-28 truncate flex-shrink-0">{t.owner ?? '—'}</span>
                      <span className={`${PRIORITY_PILL[t.priority] ?? 'pill-slate'} text-xs flex-shrink-0`}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Tasks not linked to any deliverable */}
            {filteredOrphans.length > 0 && (
              <div className="border-b border-[#f5f5f5]">
                <div className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">Tasks without a deliverable</div>
                {filteredOrphans.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-2 pl-9 hover:bg-[#fafafa] cursor-pointer border-t border-[#fafafa]" onClick={() => openDrill('task', t.id)}>
                    <SourceTag source={t.source} />
                    <div className="flex-1 min-w-0 text-sm text-[#171717] truncate">{t.title}</div>
                    <span className="hidden sm:block text-xs text-[#525252] w-28 truncate flex-shrink-0">{t.owner ?? '—'}</span>
                    <span className={`${PRIORITY_PILL[t.priority] ?? 'pill-slate'} text-xs flex-shrink-0`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {detail && (
        <Sidebar title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'} onClose={() => setDetail(null)}>
          <DetailBody detail={detail} />
        </Sidebar>
      )}
    </div>
  );
}
