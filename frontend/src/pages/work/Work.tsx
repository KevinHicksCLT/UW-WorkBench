import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useOpenRole } from '../../lib/roleDrawer';
import { useViewState } from '../../lib/viewState';
import PageHeader from '../../components/PageHeader';
import ProcedureValue from '../../components/ProcedureValue';
import { withCompany } from '../../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { TocView, ViewPills } from '../../components/TocView';
import { useWorkToc, WorkGroupPicker } from './workToc';
import WorkGroupDrill from './WorkGroupDrill';
import { AutomatableMeter, SCORE_LABEL, SCORE_DESC, automatablePct } from '../../lib/automatable';
import { StatusPill } from '../../components/ui';

// Deliverables / Tasks — the standalone work tracker, now two top-level tabs
// (/deliverables and /tasks) rendering this same page with a `tab` prop:
// Deliverables (one row per deliverable) and Tasks (one row per task), each in
// the canonical Sheet format (see components/Sheet.tsx). Clicking a row opens
// the right-hand drill-down sidebar — location, roles, governance, plan health.
// Scoped to the active company.

type Deliverable = {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  contributors: string[];
  type: string;
  status: string;
  dueDate: string | null;
  taskCount: number;
  valueStreamId: string | null;
  valueStreamName: string | null;
  roles: string[];
  processes: string[];
  level3: string | null;
  level4: string | null;
};
// Slim list row — the /work Tasks grain carries only what the list, TOC and
// drill actually render (description etc. come from /work/task/:id on click).
type Task = {
  id: string;
  title: string;
  owner: string | null;
  contributors: string[];
  deliverableId: string | null;
  deliverableTitle: string | null;
  level4: string | null;
  division: string | null;
  valueStreamName: string | null;
  agentScore: number | null;
  agentRationale: string | null;
  testPattern: string | null;
  standards: string[];
  regulations: string[];
};
type WorkData = {
  deliverables: Deliverable[];
  tasks: Task[];
  valueStreams: { id: string; name: string }[];
};

// ── Drill-down shapes (mirror /work/deliverable/:id and /work/task/:id) ────────
type RoleRef = { id: string; name: string };
type PlanRow = { key: string; value: string | null; defined: boolean; generic: boolean };
type RoleSet = { roles: RoleRef[]; unresolved: string[] };
type DeliverableTask = {
  id: string;
  title: string;
  owner: string | null;
  agentScore: number | null;
  plan: { defined: number; total: number } | null;
};
type DeliverableDetail = {
  kind: 'deliverable';
  id: string;
  title: string;
  description: string | null;
  type: string;
  owner: string | null;
  valueStream: { id: string; name: string; domain: string } | null;
  level3: string | null;
  level4: string | null;
  division: string | null;
  department: string | null;
  subProcesses: string[];
  ownerRoles: RoleRef[];
  contributorRoles: RoleRef[];
  planRollup: { defined: number; total: number } | null;
  tasks: DeliverableTask[];
};
type TaskDetail = {
  kind: 'task';
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  ownerRole: RoleRef | null;
  plan: { checklist: PlanRow[]; testing: PlanRow[]; defined: number; total: number } | null;
  jiraKey: string | null;
  agentScore: number | null;
  agentRationale: string | null;
  valueStream: { id: string; name: string } | null;
  subProcess: string | null;
  level3: string | null;
  level4: string | null;
  leadRoles: RoleRef[];
  leadExtra: string[];
  supportRoles: RoleRef[];
  supportExtra: string[];
  outputs: string[];
  deliverable: { id: string; title: string } | null;
  downstream: {
    valueStreamId: string;
    valueStreamName: string;
    subProcess: string | null;
    item: string;
    roles: RoleSet;
  }[];
};
type Detail = DeliverableDetail | TaskDetail;

// ── Drill-down primitives ─────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">
        {label}
      </div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

// Resolved roles render as blue pills that open the role drawer in place;
// unmatched raw references stay as plain slate pills.
function RoleChips({
  roles,
  extra,
  empty = '—',
}: {
  roles: RoleRef[];
  extra: string[];
  empty?: string;
}) {
  const openRole = useOpenRole();
  if (roles.length === 0 && extra.length === 0)
    return <span className="text-[#a3a3a3]">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => openRole(r.id)}
          className="pill-blue text-xs hover:ring-1 hover:ring-[#171717] transition-shadow duration-150"
        >
          {r.name}
        </button>
      ))}
      {extra.map((e) => (
        <StatusPill key={e} tone="slate" className="text-xs">
          {e}
        </StatusPill>
      ))}
    </div>
  );
}

// Right-hand sliding sidebar that hosts the drill-down detail.
function Sidebar({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-md shadow-lg border-l border-[#eaeaea] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[#eaeaea] sticky top-0 bg-white flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// At-a-glance rollups for a deliverable — every number derives from the
// deliverable's task rows (plan coverage from the Work Library, automatability
// from ProcessNode scores). Nothing here is invented client-side.
function DeliverableStats({ detail }: { detail: DeliverableDetail }) {
  const auto = automatablePct(detail.tasks.map((t) => t.agentScore));
  const plan = detail.planRollup;
  const planPct = plan && plan.total > 0 ? Math.round((100 * plan.defined) / plan.total) : null;
  const tiles = [
    { label: 'Tasks', value: String(detail.tasks.length), sub: 'produce this deliverable' },
    {
      label: 'Plan keys',
      value: planPct != null ? `${planPct}%` : '—',
      sub: plan && plan.total > 0 ? `${plan.defined} of ${plan.total} defined` : 'no plan keys',
    },
    {
      label: 'AI automatable',
      value: auto ? `${auto.pct}%` : '—',
      sub: auto ? `${auto.auto} of ${auto.scored} scored tasks` : 'not yet scored',
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-[#eaeaea] p-2.5">
          <div className="text-lg font-semibold text-[#171717] tnum leading-6">{t.value}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-0.5">
            {t.label}
          </div>
          <div className="text-[11px] text-[#737373] mt-0.5">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DetailBody({ detail, onOpenTask }: { detail: Detail; onOpenTask?: (id: string) => void }) {
  // When every task shares one owner, name it once in the list header instead
  // of repeating the same chip on all rows.
  const commonOwner =
    detail.kind === 'deliverable' &&
    detail.tasks.length > 1 &&
    new Set(detail.tasks.map((t) => t.owner).filter(Boolean)).size === 1 &&
    detail.tasks.every((t) => t.owner)
      ? detail.tasks[0].owner
      : null;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[#171717]">{detail.title}</h3>
        {detail.description && <p className="text-sm text-[#666666] mt-1">{detail.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {detail.kind === 'deliverable' && (
            <StatusPill tone="slate" className="text-xs">
              {detail.type}
            </StatusPill>
          )}
          {detail.owner && (
            <StatusPill tone="slate" className="text-xs">
              Owner · {detail.owner}
            </StatusPill>
          )}
          {detail.kind === 'task' && detail.jiraKey && (
            <StatusPill
              tone="blue"
              className="text-xs"
              title="Linked Jira issue (integration stub — no live sync yet)"
            >
              JIRA {detail.jiraKey}
            </StatusPill>
          )}
        </div>
      </div>

      {detail.kind === 'deliverable' && <DeliverableStats detail={detail} />}

      {/* Agent-automatability assessment (tasks only) */}
      {detail.kind === 'task' && (
        <div className="rounded-lg border border-[#eaeaea] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">
            AI automatable
          </div>
          {typeof detail.agentScore === 'number' ? (
            <>
              <AutomatableMeter score={detail.agentScore} rationale={detail.agentRationale} />
              <p className="text-xs text-[#666666] mt-2">{SCORE_DESC[detail.agentScore]}</p>
              {detail.agentRationale && (
                <p className="text-sm text-[#171717] mt-1.5 italic">“{detail.agentRationale}”</p>
              )}
            </>
          ) : (
            <span className="text-sm text-[#a3a3a3]">Not yet scored</span>
          )}
        </div>
      )}

      {/* Where it lives in the operating model */}
      <div className="rounded-lg border border-[#eaeaea] p-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Value stream (L2)">
          {detail.valueStream ? (
            <>
              {detail.valueStream.name}
              {detail.kind === 'deliverable' && detail.valueStream.domain && (
                <span className="text-[#a3a3a3]"> · {detail.valueStream.domain}</span>
              )}
            </>
          ) : (
            <span className="text-[#a3a3a3]">—</span>
          )}
        </Field>
        <Field label="Process area (L3 · L4)">
          {detail.kind === 'deliverable' ? (
            detail.subProcesses.length ? (
              detail.subProcesses.join(', ')
            ) : (
              <span className="text-[#a3a3a3]">—</span>
            )
          ) : (
            (detail.subProcess ?? <span className="text-[#a3a3a3]">—</span>)
          )}
        </Field>
        {detail.kind === 'deliverable' && (detail.division || detail.department) && (
          <Field label="Org home">
            {[detail.division, detail.department].filter(Boolean).join(' · ')}
          </Field>
        )}
      </div>

      {/* Roles — deliverables list every assigned role; a task shows just its
          single owning role. */}
      {detail.kind === 'deliverable' ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner">
            <RoleChips
              roles={detail.ownerRoles}
              extra={detail.ownerRoles.length === 0 && detail.owner ? [detail.owner] : []}
            />
          </Field>
          <Field label={`Contributors (${detail.contributorRoles.length})`}>
            <RoleChips roles={detail.contributorRoles} extra={[]} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner">
            <RoleChips
              roles={detail.ownerRole ? [detail.ownerRole] : []}
              extra={!detail.ownerRole && detail.owner ? [detail.owner] : []}
            />
          </Field>
          <Field label={`Contributors (${detail.supportRoles.length})`}>
            <RoleChips roles={detail.supportRoles} extra={detail.supportExtra} />
          </Field>
        </div>
      )}

      {/* Work Library plan — checklist + testing keys combined into one Actions
          list (✓ defined / ✗ missing); item-specific steps only, generic
          pattern keys are not surfaced. */}
      {detail.kind === 'task' &&
        detail.plan &&
        (() => {
          const rows = [...detail.plan.checklist, ...detail.plan.testing].filter((r) => !r.generic);
          if (!rows.length) return null;
          return (
            <>
              <Field label="Actions">
                <ul className="space-y-1">
                  {rows.map((r, i) => (
                    <li key={i} className="text-sm flex gap-1.5 items-start">
                      <span
                        className={
                          (r.defined ? 'text-[#1e9e6a]' : 'text-[#dc2626]') + ' flex-shrink-0'
                        }
                      >
                        {r.defined ? '✓' : '✗'}
                      </span>
                      {r.defined ? (
                        <span>
                          <span className="text-[#8a94a0]">{r.key}: </span>
                          <span className="text-[#171717]">
                            <ProcedureValue value={r.value ?? ''} />
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#6b7785]">{r.key}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Field>
              <Link
                to={`/work-library?type=task&id=${detail.id}`}
                className="text-sm font-medium text-[#2563eb] hover:underline"
              >
                Edit plan in Work library ↗
              </Link>
            </>
          );
        })()}
      {/* Linked work — each task row drills into the task detail. */}
      {detail.kind === 'deliverable' ? (
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
              Tasks ({detail.tasks.length})
            </div>
            {commonOwner && (
              <span className="text-[11px] text-[#a3a3a3]">all owned by {commonOwner}</span>
            )}
          </div>
          {detail.tasks.length === 0 ? (
            <span className="text-sm text-[#a3a3a3]">No tasks</span>
          ) : (
            <ul>
              {detail.tasks.map((t) => (
                <li key={t.id} className="border-b border-[#f5f5f5] last:border-0">
                  <button
                    type="button"
                    onClick={() => onOpenTask?.(t.id)}
                    className="w-full flex items-start justify-between gap-3 text-left py-1.5 group"
                  >
                    <span className="text-sm text-[#171717] group-hover:text-[#2563eb] transition-colors duration-150">
                      {t.title}
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                      {!commonOwner && t.owner && (
                        <span className="text-xs text-[#a3a3a3]">{t.owner}</span>
                      )}
                      {t.plan && t.plan.total > 0 && (
                        <span
                          className={`text-[11px] tnum ${
                            t.plan.defined === t.plan.total ? 'text-[#1e9e6a]' : 'text-[#b45309]'
                          }`}
                          title={`${t.plan.defined} of ${t.plan.total} checklist & testing keys defined`}
                        >
                          {t.plan.defined === t.plan.total ? '✓ ' : ''}
                          {t.plan.defined}/{t.plan.total}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        detail.deliverable && <Field label="Feeds deliverable">{detail.deliverable.title}</Field>
      )}

      {detail.kind === 'task' && detail.outputs.length > 0 && (
        <Field label="Outputs">
          <div className="flex flex-wrap gap-1.5">
            {detail.outputs.map((o) => (
              <StatusPill key={o} tone="slate" className="text-xs">
                {o}
              </StatusPill>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}

const DASH = '—';

// Lazy per-tab data: each tab fetches only its own grain (`kind=`), and the
// result is kept for the SPA session so tab flips and back-navigation render
// instantly instead of re-pulling ~30k rows. The page is read-only, so a
// session-stale cache is acceptable; a hard refresh refetches.
const workCache = new Map<string, WorkData>();

export default function Work({ tab }: { tab: 'deliverables' | 'tasks' }) {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<WorkData>({ deliverables: [], tasks: [], valueStreams: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
    if (companyLoading) return;
    const cacheKey = `${companyId ?? ''}:${tab}`;
    const cached = workCache.get(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    // fetch all rows of the ACTIVE grain only (tasks exceed the old 5k default;
    // splits push the total higher).
    api
      .get<WorkData>(withCompany(`/work?take=30000&kind=${tab}`, companyId))
      .then((d) => {
        workCache.set(cacheKey, d);
        setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId, companyLoading, tab]);

  // Open a row's drill-down in the sidebar by fetching its detail. The open
  // target persists per tab (lib/viewState), so drilling out of the sidebar
  // (e.g. to a role page) and coming back reopens the same sidebar.
  const [detailRef, setDetailRef] = useViewState<{
    kind: 'deliverable' | 'task';
    id: string;
  } | null>(`work.${tab}.detail`, null);
  function openDrill(kind: 'deliverable' | 'task', id: string) {
    setDetailRef({ kind, id });
    api
      .get<Detail>(withCompany(`/work/${kind}/${id}`, companyId))
      .then(setDetail)
      .catch(() => {});
  }
  const closeDrill = () => {
    setDetail(null);
    setDetailRef(null);
  };
  // Restore the open sidebar on mount (refetch — the detail is server data).
  const rearmedDetail = useRef(false);
  useEffect(() => {
    if (rearmedDetail.current || companyLoading || !detailRef) return;
    rearmedDetail.current = true;
    api
      .get<Detail>(withCompany(`/work/${detailRef.kind}/${detailRef.id}`, companyId))
      .then(setDetail)
      .catch(() => {});
  }, [companyLoading, detailRef, companyId]);

  const { deliverables, tasks } = data;

  // TOC (default view) — grouping state, rows and pickers live in workToc.tsx.
  const {
    view,
    setView,
    preFilter,
    setPreFilter,
    drillValue,
    setDrillValue,
    inDrill,
    group,
    groups,
    pickGroup,
    tocRows,
  } = useWorkToc(tab, deliverables, tasks, DASH);

  const viewToggle = (
    <ViewPills
      options={[
        { key: 'toc' as const, label: 'TOC' },
        { key: 'list' as const, label: 'List' },
      ]}
      view={view}
      onChange={(v) => {
        if (v === 'toc') {
          setPreFilter(null);
          setDrillValue(null);
        }
        setView(v);
      }}
    />
  );

  const rolesCell = (roles: string[]) => {
    const joined = (roles ?? []).join(', ');
    return <SheetCell text={joined || DASH} dim title={joined || undefined} />;
  };
  // Standards / regulations governing a task — "N/A" when its area carries none.
  const naCell = (items: string[]) => {
    const joined = (items ?? []).join(', ');
    return <SheetCell text={joined || 'N/A'} dim title={joined || undefined} />;
  };

  const dCols = useMemo<SheetCol<Deliverable>[]>(
    () => [
      { key: 'title', label: 'Deliverable', width: 'minmax(0,1.1fr)', value: (d) => d.title },
      {
        key: 'description',
        label: 'Description',
        width: 'minmax(0,1.3fr)',
        value: (d) => d.description ?? DASH,
        dim: true,
        render: (d) => (
          <SheetCell text={d.description ?? DASH} dim title={d.description ?? undefined} />
        ),
      },
      {
        key: 'valueStream',
        label: 'Value Stream (L2)',
        width: 'minmax(0,0.9fr)',
        value: (d) => d.valueStreamName ?? DASH,
        dim: true,
      },
      {
        key: 'level3',
        label: 'Process L3',
        width: 'minmax(0,0.9fr)',
        value: (d) => d.level3 ?? DASH,
        dim: true,
      },
      {
        key: 'level4',
        label: 'Process L4',
        width: 'minmax(0,0.9fr)',
        value: (d) => d.level4 ?? DASH,
        dim: true,
      },
      {
        key: 'owner',
        label: 'Owner',
        width: 'minmax(0,0.8fr)',
        value: (d) => d.owner ?? DASH,
        dim: true,
      },
      {
        key: 'contributors',
        label: 'Contributors',
        width: 'minmax(0,1fr)',
        values: (d) => d.contributors ?? [],
        dim: true,
        render: (d) => rolesCell(d.contributors),
      },
      {
        key: 'tasks',
        label: 'Tasks',
        width: '70px',
        value: (d) => String(d.taskCount),
        filterable: false,
        align: 'center',
        render: (d) => <span className="text-[12px] text-[#737373] tnum">{d.taskCount}</span>,
      },
    ],
    [],
  );

  const tCols = useMemo<SheetCol<Task>[]>(
    () => [
      { key: 'title', label: 'Task (L5)', width: 'minmax(0,1.8fr)', value: (t) => t.title },
      {
        key: 'level4',
        label: 'Process L4',
        width: 'minmax(0,1fr)',
        value: (t) => t.level4 ?? DASH,
        dim: true,
      },
      {
        key: 'deliverable',
        label: 'Deliverable',
        width: 'minmax(0,1fr)',
        value: (t) => t.deliverableTitle ?? DASH,
        dim: true,
      },
      {
        key: 'owner',
        label: 'Owner',
        width: 'minmax(0,0.8fr)',
        value: (t) => t.owner ?? DASH,
        dim: true,
      },
      {
        key: 'contributors',
        label: 'Contributors',
        width: 'minmax(0,0.9fr)',
        values: (t) => t.contributors ?? [],
        dim: true,
        render: (t) => rolesCell(t.contributors),
      },
      {
        key: 'standards',
        label: 'Standards',
        width: 'minmax(0,1fr)',
        values: (t) => (t.standards?.length ? t.standards : ['N/A']),
        dim: true,
        render: (t) => naCell(t.standards),
      },
      {
        key: 'regulations',
        label: 'Regulations',
        width: 'minmax(0,1fr)',
        values: (t) => (t.regulations?.length ? t.regulations : ['N/A']),
        dim: true,
        render: (t) => naCell(t.regulations),
      },
      {
        key: 'testPattern',
        label: 'Testing pattern',
        width: 'minmax(0,1fr)',
        hint: 'Work Library testing pattern — filter by "Missing" to find tasks without one',
        value: (t) => t.testPattern ?? 'Missing',
        render: (t) =>
          t.testPattern ? (
            <span className="truncate text-[12px] text-[#525252]" title={t.testPattern}>
              {t.testPattern}
            </span>
          ) : (
            <span className="text-[12px] text-[#dc2626]">✗ Missing</span>
          ),
      },
      {
        key: 'automatable',
        label: 'AI automatable',
        width: '140px',
        // Filter by band ("1 · Agent-ready" … "5 · Human-only"); leading digit sorts numerically.
        value: (t) =>
          typeof t.agentScore === 'number'
            ? `${t.agentScore} · ${SCORE_LABEL[t.agentScore]}`
            : 'Not scored',
        render: (t) => <AutomatableMeter score={t.agentScore} rationale={t.agentRationale} />,
      },
    ],
    [],
  );

  return (
    <div>
      {tab === 'deliverables' ? (
        <PageHeader title="Deliverables" subtitle="Track tangible outputs across the company" />
      ) : (
        <PageHeader
          title="Tasks"
          subtitle="Every task and checklist item across the company, in one list"
        />
      )}

      {view === 'toc' ? (
        <TocView
          stateKey={`work.${tab}.toc`}
          rows={tocRows}
          nameLabel={group.label}
          countLabel={tab === 'deliverables' ? 'Deliverables' : 'Tasks'}
          unit={group.unit}
          searchPlaceholder={`Search ${group.label.toLowerCase()}…`}
          leading={viewToggle}
          totals={`${tab === 'deliverables' ? `${deliverables.length} deliverables` : `${tasks.length} tasks`} across ${tocRows.length} ${group.unit}`}
          actions={<WorkGroupPicker groups={groups} activeKey={group.key} onPick={pickGroup} />}
        />
      ) : view === 'drill' && drillValue != null ? (
        <WorkGroupDrill
          tab={tab}
          group={group}
          value={drillValue}
          deliverables={tab === 'deliverables' ? deliverables.filter((d) => inDrill(d)) : []}
          tasks={tab === 'tasks' ? tasks.filter((t) => inDrill(t)) : []}
          onOpenDeliverable={(id) => openDrill('deliverable', id)}
          onOpenTask={(id) => openDrill('task', id)}
          leading={viewToggle}
        />
      ) : tab === 'deliverables' ? (
        <Sheet
          key={`d-${preFilter ? `${preFilter.col}:${preFilter.value}` : ''}`}
          sheetKey="work.deliverables"
          rows={deliverables}
          cols={dCols}
          rowKey={(d) => d.id}
          loading={loading}
          unit="deliverables"
          leading={viewToggle}
          forceFilters={preFilter ? { [preFilter.col]: preFilter.value } : undefined}
          onRowClick={(d) => openDrill('deliverable', d.id)}
          summarize={(v) =>
            `${new Set(v.map((d) => d.valueStreamName).filter(Boolean)).size} value streams`
          }
        />
      ) : (
        <>
          <Sheet
            key={`t-${preFilter ? `${preFilter.col}:${preFilter.value}` : ''}`}
            sheetKey="work.tasks"
            rows={tasks}
            cols={tCols}
            rowKey={(t) => t.id}
            loading={loading}
            unit="tasks"
            leading={viewToggle}
            forceFilters={preFilter ? { [preFilter.col]: preFilter.value } : undefined}
            onRowClick={(t) => openDrill('task', t.id)}
            summarize={(v) => {
              const a = automatablePct(v.map((t) => t.agentScore));
              return `${new Set(v.map((t) => t.deliverableId).filter(Boolean)).size} deliverables${a ? ` · ${a.pct}% automatable` : ''}`;
            }}
          />
        </>
      )}

      {detail && (
        <Sidebar
          title={detail.kind === 'deliverable' ? 'Deliverable' : 'Task'}
          onClose={closeDrill}
        >
          <DetailBody detail={detail} onOpenTask={(id) => openDrill('task', id)} />
        </Sidebar>
      )}
    </div>
  );
}
