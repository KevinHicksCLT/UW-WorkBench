import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import { withCompany } from '../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';
import { AutomatableMeter, SCORE_LABEL, SCORE_DESC, automatablePct } from '../lib/automatable';
import { EmptyState, StatusPill } from '../components/ui';

// Deliverables / Tasks — the standalone work tracker, now two top-level tabs
// (/deliverables and /tasks) rendering this same page with a `tab` prop:
// Deliverables (one row per deliverable) and Tasks (one row per task), each in
// the canonical Sheet format (see components/Sheet.tsx). Clicking a row opens
// the right-hand drill-down sidebar — roles, value stream, downstream impact.
// Scoped to the active company.

type Deliverable = {
  id: string; title: string; description: string | null; owner: string | null; contributors: string[]; type: string;
  status: string; dueDate: string | null; taskCount: number; valueStreamId: string | null; valueStreamName: string | null;
  roles: string[]; processes: string[]; level3: string | null; level4: string | null; test: string | null;
};
type Task = {
  id: string; title: string; description: string | null; owner: string | null; contributors: string[];
  status: string; priority: string; dueDate: string | null;
  source: string; deliverableId: string | null; deliverableTitle: string | null;
  roles: string[]; processes: string[]; level3: string | null; level4: string | null;
  division: string | null;
  department: string | null;
  roleName: string | null;
  valueStreamName: string | null;
  agentScore: number | null; agentRationale: string | null;
  test: string | null;
  testPattern: string | null;
  standards: string[]; regulations: string[];
};
type WorkData = { deliverables: Deliverable[]; tasks: Task[]; valueStreams: { id: string; name: string }[] };

// ── Drill-down shapes (mirror /work/deliverable/:id and /work/task/:id) ────────
type RoleRef = { id: string; name: string };
type PlanRow = { key: string; value: string | null; defined: boolean };
type RoleSet = { roles: RoleRef[]; unresolved: string[] };
type DeliverableDetail = {
  kind: 'deliverable'; id: string; title: string; description: string | null; type: string; owner: string | null;
  jiraKey: string | null;
  valueStream: { id: string; name: string; domain: string } | null;
  level3: string | null; level4: string | null;
  subProcesses: string[]; dataElements: string[];
  inputs: { name: string; dataElements: string[]; roles: RoleSet }[];
  assignedRoles: RoleRef[]; assignedExtra: string[];
  ownerRoles: RoleRef[]; contributorRoles: RoleRef[];
  planRollup: { defined: number; total: number } | null;
  tasks: { id: string; title: string; owner: string | null; priority: string }[];
  downstream: { valueStreamId: string; valueStreamName: string; subProcess: string | null; roles: RoleSet }[];
};
type TaskDetail = {
  kind: 'task'; id: string; title: string; description: string | null; owner: string | null; priority: string;
  ownerRole: RoleRef | null;
  plan: { checklist: PlanRow[]; testing: PlanRow[]; defined: number; total: number } | null;
  jiraKey: string | null; agentScore: number | null; agentRationale: string | null;
  valueStream: { id: string; name: string } | null; subProcess: string | null;
  level3: string | null; level4: string | null;
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
      {extra.map((e) => <StatusPill key={e} tone="slate" className="text-xs">{e}</StatusPill>)}
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
        {detail.description && (
          <p className="text-sm text-[#666666] mt-1">{detail.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {detail.kind === 'deliverable'
            ? <StatusPill tone="slate" className="text-xs">{detail.type}</StatusPill>
            : <span className={`${PRIORITY_PILL[detail.priority] ?? 'pill-slate'} text-xs`}>{detail.priority}</span>}
          {detail.owner && <StatusPill tone="slate" className="text-xs">Owner · {detail.owner}</StatusPill>}
          {detail.jiraKey && (
            <StatusPill tone="blue" className="text-xs" title="Linked Jira issue (integration stub — no live sync yet)">
              JIRA {detail.jiraKey}
            </StatusPill>
          )}
        </div>
      </div>

      {/* Agent-automatability assessment (tasks only) */}
      {detail.kind === 'task' && (
        <div className="rounded-lg border border-[#eaeaea] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">AI automatable</div>
          {typeof detail.agentScore === 'number' ? (
            <>
              <AutomatableMeter score={detail.agentScore} rationale={detail.agentRationale} />
              <p className="text-xs text-[#666666] mt-2">{SCORE_DESC[detail.agentScore]}</p>
              {detail.agentRationale && <p className="text-sm text-[#171717] mt-1.5 italic">“{detail.agentRationale}”</p>}
            </>
          ) : (
            <span className="text-sm text-[#a3a3a3]">Not yet scored</span>
          )}
        </div>
      )}

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

      {/* Roles — deliverables list every assigned role; a task shows just its
          single owning role. */}
      {detail.kind === 'deliverable' ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner"><RoleChips roles={detail.ownerRoles} extra={detail.ownerRoles.length === 0 && detail.owner ? [detail.owner] : []} /></Field>
          <Field label={`Contributors (${detail.contributorRoles.length})`}><RoleChips roles={detail.contributorRoles} extra={[]} /></Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner"><RoleChips roles={detail.ownerRole ? [detail.ownerRole] : []} extra={!detail.ownerRole && detail.owner ? [detail.owner] : []} /></Field>
          <Field label={`Contributors (${detail.supportRoles.length})`}><RoleChips roles={detail.supportRoles} extra={detail.supportExtra} /></Field>
        </div>
      )}

      {/* Work Library plan — checklist + testing keys (✓ defined / ✗ missing) */}
      {detail.kind === 'task' && detail.plan && (detail.plan.checklist.length > 0 || detail.plan.testing.length > 0) && (
        <>
          {(['Checklist', 'Testing'] as const).map((label) => {
            const rows = label === 'Checklist' ? detail.plan!.checklist : detail.plan!.testing;
            if (!rows.length) return null;
            return (
              <Field key={label} label={label}>
                <ul className="space-y-1">
                  {rows.map((r, i) => (
                    <li key={i} className="text-sm flex gap-1.5 items-start">
                      <span className={(r.defined ? 'text-[#1e9e6a]' : 'text-[#dc2626]') + ' flex-shrink-0'}>{r.defined ? '✓' : '✗'}</span>
                      {r.defined
                        ? <span><span className="text-[#8a94a0]">{r.key}: </span><span className="text-[#171717]">{r.value}</span></span>
                        : <span className="text-[#6b7785]">{r.key}</span>}
                    </li>
                  ))}
                </ul>
              </Field>
            );
          })}
          <Link to={`/work-library?type=task&id=${detail.id}`} className="text-sm font-medium text-[#2563eb] hover:underline">
            Edit plan in Work library ↗
          </Link>
        </>
      )}
      {detail.kind === 'deliverable' && detail.planRollup && detail.planRollup.total > 0 && (
        <Field label="Checklist & testing plans">
          <div className="text-sm text-[#171717]">{detail.planRollup.defined} of {detail.planRollup.total} keys defined across this deliverable's tasks</div>
          <div className="h-1.5 rounded-full bg-[#eef1f4] mt-1.5">
            <div className="h-1.5 rounded-full bg-[#1e9e6a]" style={{ width: `${Math.round((100 * detail.planRollup.defined) / detail.planRollup.total)}%` }} />
          </div>
        </Field>
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
                    {inp.dataElements.map((e) => <StatusPill key={e} tone="slate" className="text-xs">{e}</StatusPill>)}
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
          <div className="flex flex-wrap gap-1.5">{detail.dataElements.map((e) => <StatusPill key={e} tone="slate" className="text-xs">{e}</StatusPill>)}</div>
        </Field>
      )}
      {detail.kind === 'task' && detail.outputs.length > 0 && (
        <Field label="Outputs">
          <div className="flex flex-wrap gap-1.5">{detail.outputs.map((o) => <StatusPill key={o} tone="slate" className="text-xs">{o}</StatusPill>)}</div>
        </Field>
      )}

      {/* Downstream impact — deliverables only (where a work product flows next). */}
      {detail.kind === 'deliverable' && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">
            Downstream impact ({detail.downstream.length})
          </div>
          {detail.downstream.length === 0 ? (
            <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="Not consumed elsewhere in the operating model." />
          ) : (
            <div className="space-y-2">
              {detail.downstream.map((ds, i) => (
                <div key={i} className="rounded-lg border border-[#eaeaea] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#171717]">{ds.valueStreamName}</span>
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
      )}
    </div>
  );
}

const DASH = '—';

export default function Work({ tab }: { tab: 'deliverables' | 'tasks' }) {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    // fetch all rows (tasks exceed the old 5k default; splits push the total higher).
    api.get(withCompany('/work?take=30000', companyId))
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // Open a row's drill-down in the sidebar by fetching its detail.
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    api.get(withCompany(`/work/${kind}/${id}`, companyId)).then(setDetail).catch(() => {});
  }

  const { deliverables, tasks } = data;
  const rolesCell = (roles: string[]) => {
    const joined = (roles ?? []).join(', ');
    return <SheetCell text={joined || DASH} dim title={joined || undefined} />;
  };
  // Standards / regulations governing a task — "N/A" when its area carries none.
  const naCell = (items: string[]) => {
    const joined = (items ?? []).join(', ');
    return <SheetCell text={joined || 'N/A'} dim title={joined || undefined} />;
  };

  const dCols = useMemo<SheetCol<Deliverable>[]>(() => [
    { key: 'title', label: 'Deliverable', width: 'minmax(0,1.1fr)', value: (d) => d.title },
    { key: 'description', label: 'Description', width: 'minmax(0,1.3fr)', value: (d) => d.description ?? DASH, dim: true, render: (d) => <SheetCell text={d.description ?? DASH} dim title={d.description ?? undefined} /> },
    { key: 'valueStream', label: 'Value Stream (L2)', width: 'minmax(0,0.9fr)', value: (d) => d.valueStreamName ?? DASH, dim: true },
    { key: 'level3', label: 'Process L3', width: 'minmax(0,0.9fr)', value: (d) => d.level3 ?? DASH, dim: true },
    { key: 'level4', label: 'Process L4', width: 'minmax(0,0.9fr)', value: (d) => d.level4 ?? DASH, dim: true },
    { key: 'owner', label: 'Owner', width: 'minmax(0,0.8fr)', value: (d) => d.owner ?? DASH, dim: true },
    { key: 'contributors', label: 'Contributors', width: 'minmax(0,1fr)', values: (d) => d.contributors ?? [], dim: true, render: (d) => rolesCell(d.contributors) },
    {
      key: 'tasks', label: 'Tasks', width: '70px', value: (d) => String(d.taskCount), filterable: false,
      render: (d) => <span className="text-[12px] text-[#737373] tnum">{d.taskCount}</span>,
    },
  ], []);

  const tCols = useMemo<SheetCol<Task>[]>(() => [
    { key: 'title', label: 'Task (L5)', width: 'minmax(0,1.8fr)', value: (t) => t.title },
    { key: 'level4', label: 'Process L4', width: 'minmax(0,1fr)', value: (t) => t.level4 ?? DASH, dim: true },
    { key: 'deliverable', label: 'Deliverable', width: 'minmax(0,1fr)', value: (t) => t.deliverableTitle ?? DASH, dim: true },
    { key: 'owner', label: 'Owner', width: 'minmax(0,0.8fr)', value: (t) => t.owner ?? DASH, dim: true },
    { key: 'contributors', label: 'Contributors', width: 'minmax(0,0.9fr)', values: (t) => t.contributors ?? [], dim: true, render: (t) => rolesCell(t.contributors) },
    { key: 'standards', label: 'Standards', width: 'minmax(0,1fr)', values: (t) => (t.standards?.length ? t.standards : ['N/A']), dim: true, render: (t) => naCell(t.standards) },
    { key: 'regulations', label: 'Regulations', width: 'minmax(0,1fr)', values: (t) => (t.regulations?.length ? t.regulations : ['N/A']), dim: true, render: (t) => naCell(t.regulations) },
    {
      key: 'testPattern', label: 'Testing pattern', width: 'minmax(0,1fr)',
      hint: 'Work Library testing pattern — filter by "Missing" to find tasks without one',
      value: (t) => t.testPattern ?? 'Missing',
      render: (t) => t.testPattern
        ? <span className="truncate text-[12px] text-[#525252]" title={t.testPattern}>{t.testPattern}</span>
        : <span className="text-[12px] text-[#dc2626]">✗ Missing</span>,
    },
    {
      key: 'automatable', label: 'AI automatable', width: '140px',
      // Filter by band ("1 · Agent-ready" … "5 · Human-only"); leading digit sorts numerically.
      value: (t) => (typeof t.agentScore === 'number' ? `${t.agentScore} · ${SCORE_LABEL[t.agentScore]}` : 'Not scored'),
      render: (t) => <AutomatableMeter score={t.agentScore} rationale={t.agentRationale} />,
    },
  ], []);

  return (
    <div>
      {tab === 'deliverables' ? (
        <PageHeader title="Deliverables" subtitle="Track tangible outputs across the company" />
      ) : (
        <PageHeader title="Tasks" subtitle="Every task and checklist item across the company, in one list" />
      )}

      {tab === 'deliverables' ? (
        <Sheet
          rows={deliverables}
          cols={dCols}
          rowKey={(d) => d.id}
          loading={loading}
          unit="deliverables"
          onRowClick={(d) => openDrill('deliverable', d.id)}
          summarize={(v) => `${new Set(v.map((d) => d.valueStreamName).filter(Boolean)).size} value streams`}
        />
      ) : (
        <>
          <Sheet
            rows={tasks}
            cols={tCols}
            rowKey={(t) => t.id}
            loading={loading}
            unit="tasks"
            onRowClick={(t) => openDrill('task', t.id)}
            summarize={(v) => {
              const a = automatablePct(v.map((t) => t.agentScore));
              return `${new Set(v.map((t) => t.deliverableId).filter(Boolean)).size} deliverables${a ? ` · ${a.pct}% automatable` : ''}`;
            }}
          />
        </>
      )}

      {detail && (
        <Sidebar title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'} onClose={() => setDetail(null)}>
          <DetailBody detail={detail} />
        </Sidebar>
      )}
    </div>
  );
}
