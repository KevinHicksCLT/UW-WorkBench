import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import { withCompany } from '../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';

// Deliverables / Tasks — the standalone work tracker, now two top-level tabs
// (/deliverables and /tasks) rendering this same page with a `tab` prop:
// Deliverables (one row per deliverable) and Tasks (one row per task), each in
// the canonical Sheet format (see components/Sheet.tsx). Clicking a row opens
// the right-hand drill-down sidebar — roles, value stream, downstream impact.
// Scoped to the active company.

type Deliverable = {
  id: string; title: string; description: string | null; owner: string | null; type: string;
  status: string; dueDate: string | null; taskCount: number; valueStreamId: string | null; valueStreamName: string | null;
  roles: string[]; processes: string[];
};
type Task = {
  id: string; title: string; owner: string | null; status: string; priority: string; dueDate: string | null;
  source: string; deliverableId: string | null; deliverableTitle: string | null;
  roles: string[]; processes: string[];
};
type WorkData = { deliverables: Deliverable[]; tasks: Task[]; valueStreams: { id: string; name: string }[] };
// One checklist item (GET /work/checklist) — the finest grain of work. Each
// carries its parent task (the role's task in the same category) for context.
type ChecklistRow = {
  id: string; text: string; roleId: string; roleName: string; category: string | null;
  taskId: string | null; taskTitle: string | null; valueStreamName: string | null;
};

// ── Drill-down shapes (mirror /work/deliverable/:id and /work/task/:id) ────────
type RoleRef = { id: string; name: string };
type RoleSet = { roles: RoleRef[]; unresolved: string[] };
type DeliverableDetail = {
  kind: 'deliverable'; id: string; title: string; description: string | null; type: string; owner: string | null;
  jiraKey: string | null;
  valueStream: { id: string; name: string; domain: string } | null;
  subProcesses: string[]; dataElements: string[];
  inputs: { name: string; dataElements: string[]; roles: RoleSet }[];
  assignedRoles: RoleRef[]; assignedExtra: string[];
  tasks: { id: string; title: string; owner: string | null; priority: string }[];
  downstream: { valueStreamId: string; valueStreamName: string; subProcess: string | null; roles: RoleSet }[];
};
type TaskDetail = {
  kind: 'task'; id: string; title: string; owner: string | null; priority: string;
  jiraKey: string | null;
  valueStream: { id: string; name: string } | null; subProcess: string | null;
  leadRoles: RoleRef[]; leadExtra: string[]; supportRoles: RoleRef[]; supportExtra: string[];
  outputs: string[];
  deliverable: { id: string; title: string } | null;
  downstream: { valueStreamId: string; valueStreamName: string; subProcess: string | null; item: string; roles: RoleSet }[];
};
type Detail = DeliverableDetail | TaskDetail;

const PRIORITY_PILL: Record<string, string> = { High: 'pill-red', Medium: 'pill-amber', Low: 'pill-slate' };

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
          {detail.jiraKey && (
            <span className="pill-blue text-xs" title="Linked Jira issue (integration stub — no live sync yet)">
              JIRA {detail.jiraKey}
            </span>
          )}
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

export default function Work({ tab }: { tab: 'deliverables' | 'tasks' }) {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  // Tasks tab grain: task rows (default) or one row per checklist item.
  const [grain, setGrain] = useState<'tasks' | 'checklist'>('tasks');
  const [checklist, setChecklist] = useState<ChecklistRow[] | null>(null);

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setChecklist(null);
    api.get(withCompany('/work', companyId))
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // Checklist rows load lazily, the first time the grain is switched.
  useEffect(() => {
    if (grain !== 'checklist' || checklist !== null || companyLoading) return;
    api.get(withCompany('/work/checklist', companyId))
      .then((d: { items: ChecklistRow[] }) => setChecklist(d.items))
      .catch(() => setChecklist([]));
  }, [grain, checklist, companyId, companyLoading]);

  // Open a row's drill-down in the sidebar by fetching its detail.
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    api.get(withCompany(`/work/${kind}/${id}`, companyId)).then(setDetail).catch(() => {});
  }

  const { deliverables, tasks } = data;
  const vsByDeliverable = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d.valueStreamName ?? DASH])),
    [deliverables],
  );

  const rolesCell = (roles: string[]) => {
    const joined = (roles ?? []).join(', ');
    return <SheetCell text={joined || DASH} dim title={joined || undefined} />;
  };

  const dCols = useMemo<SheetCol<Deliverable>[]>(() => [
    { key: 'title', label: 'Deliverable', width: 'minmax(0,1.3fr)', value: (d) => d.title },
    { key: 'type', label: 'Type', width: '120px', value: (d) => d.type, dim: true },
    { key: 'valueStream', label: 'Value Stream', width: 'minmax(0,1fr)', value: (d) => d.valueStreamName ?? DASH, dim: true },
    { key: 'process', label: 'Process', width: 'minmax(0,1fr)', values: (d) => d.processes ?? [], dim: true },
    { key: 'roles', label: 'Role', width: 'minmax(0,1fr)', values: (d) => d.roles ?? [], dim: true, render: (d) => rolesCell(d.roles) },
    {
      key: 'tasks', label: 'Tasks', width: '70px', value: (d) => String(d.taskCount), filterable: false,
      render: (d) => <span className="text-[12px] text-[#737373] tnum">{d.taskCount}</span>,
    },
  ], []);

  const tCols = useMemo<SheetCol<Task>[]>(() => [
    { key: 'title', label: 'Task', width: 'minmax(0,1.5fr)', value: (t) => t.title },
    { key: 'deliverable', label: 'Deliverable', width: 'minmax(0,1fr)', value: (t) => t.deliverableTitle ?? DASH, dim: true },
    { key: 'valueStream', label: 'Value Stream', width: 'minmax(0,1fr)', value: (t) => (t.deliverableId ? vsByDeliverable.get(t.deliverableId) ?? DASH : DASH), dim: true },
    { key: 'process', label: 'Process', width: 'minmax(0,0.9fr)', values: (t) => t.processes ?? [], dim: true },
  ], [vsByDeliverable]);

  const cCols = useMemo<SheetCol<ChecklistRow>[]>(() => [
    { key: 'text', label: 'Checklist item', width: 'minmax(0,1.5fr)', value: (c) => c.text },
    { key: 'task', label: 'Task', width: 'minmax(0,1fr)', value: (c) => c.taskTitle ?? DASH, dim: true },
    { key: 'role', label: 'Role', width: 'minmax(0,0.9fr)', value: (c) => c.roleName, dim: true },
    { key: 'category', label: 'Category', width: 'minmax(0,0.8fr)', value: (c) => c.category ?? DASH, dim: true },
    { key: 'valueStream', label: 'Value Stream', width: 'minmax(0,0.9fr)', value: (c) => c.valueStreamName ?? DASH, dim: true },
  ], []);

  // Grain toggle for the Tasks tab (sits inline on the Sheet's totals strip).
  const grainToggle = (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white/90 backdrop-blur p-0.5 shadow-sm" role="tablist" aria-label="Row grain">
      {([['tasks', 'Tasks'], ['checklist', 'Checklist items']] as const).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={grain === v}
          onClick={() => setGrain(v)}
          className={
            'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ' +
            (grain === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
          }
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {tab === 'deliverables' ? (
        <PageHeader title={`Deliverables (${deliverables.length})`} subtitle="Track tangible outputs across the company" />
      ) : grain === 'checklist' ? (
        <PageHeader title={`Checklist items (${checklist?.length ?? '…'})`} subtitle="The finest grain of work — every checklist item as its own row" />
      ) : (
        <PageHeader title={`Tasks (${tasks.length})`} subtitle="Track the work driving deliverables across the company" />
      )}

      {tab === 'deliverables' ? (
        <Sheet
          rows={deliverables}
          cols={dCols}
          rowKey={(d) => d.id}
          loading={loading}
          onRowClick={(d) => openDrill('deliverable', d.id)}
          summarize={(v) => `${new Set(v.map((d) => d.valueStreamName).filter(Boolean)).size} value streams`}
        />
      ) : grain === 'checklist' ? (
        <Sheet
          rows={checklist ?? []}
          cols={cCols}
          rowKey={(c) => c.id}
          loading={checklist === null}
          leading={grainToggle}
          onRowClick={(c) => { if (c.taskId) openDrill('task', c.taskId); }}
          summarize={(v) => `${new Set(v.map((c) => c.taskId).filter(Boolean)).size} tasks · ${new Set(v.map((c) => c.roleId)).size} roles`}
        />
      ) : (
        <Sheet
          rows={tasks}
          cols={tCols}
          rowKey={(t) => t.id}
          loading={loading}
          leading={grainToggle}
          onRowClick={(t) => openDrill('task', t.id)}
          summarize={(v) => `${new Set(v.map((t) => t.deliverableId).filter(Boolean)).size} deliverables`}
        />
      )}

      {detail && (
        <Sidebar title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'} onClose={() => setDetail(null)}>
          <DetailBody detail={detail} />
        </Sidebar>
      )}
    </div>
  );
}
