import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import DeliverableCard from './DeliverableCard';
import type { TaskValidation } from '../../components/TaskValidationControl';
import { Card, Chip, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import type { ProfileTask, RoleProfilePayload } from './types';

// Role profile — /roles/:id. Everything on this page is a roll-up from the
// task (L5) level: tasks come from NodeRole links, deliverables group the
// role's tasks via NodeDeliverable, applications aggregate NodeAppUsage, and
// checklist steps surface NodeChecklist — no denormalized copies.
//
// Layout (per the review-first design): role description callout → headline
// review stats with an Unreviewed/Owned/All filter → the applications the
// role works in → deliverable cards grouped under their value stream, each
// expanding to the numbered task list with validation controls.

/** Fixed palette cycled over the role's value streams (participation order). */
const STREAM_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#fb923c', // orange
];

type Filter = 'all' | 'unreviewed';

const matchesFilter = (t: ProfileTask, f: Filter) =>
  f === 'all' || (f === 'unreviewed' && t.validation.status === 'UNREVIEWED');

export default function RoleProfile() {
  const { id } = useParams();
  const { data, error, loading } = useApi<RoleProfilePayload>(
    id ? `/roles/${encodeURIComponent(id)}/profile` : null,
  );

  // Validation decisions land on the NodeRole link server-side; fold the PATCH
  // responses over the loaded payload so every view stays in sync without a
  // full-page refetch. One link id = one state, wherever it renders.
  const [overrides, setOverrides] = useState<Record<string, TaskValidation>>({});
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    setOverrides({});
    setFilter('all');
  }, [id]);
  const onValidation = (nodeRoleId: string, v: TaskValidation) =>
    setOverrides((o) => ({ ...o, [nodeRoleId]: v }));

  const taskSummary = useMemo(
    () =>
      (data?.taskSummary ?? []).map((t) =>
        overrides[t.nodeRoleId] ? { ...t, validation: overrides[t.nodeRoleId] } : t,
      ),
    [data, overrides],
  );

  // Deliverable → the role's tasks under it, in step order (taskSummary is
  // already sorted stream → L4 → step).
  const tasksByDeliverable = useMemo(() => {
    const m = new Map<string, ProfileTask[]>();
    for (const t of taskSummary) {
      for (const d of t.deliverables) {
        const list = m.get(d.id) ?? [];
        list.push(t);
        m.set(d.id, list);
      }
    }
    return m;
  }, [taskSummary]);

  if (loading) return <LoadingState message="Loading role profile…" />;
  if (error) {
    return (
      <div>
        <PageHeader title="Role profile" />
        <ErrorMessage>{error === 'Not found' ? 'No such role.' : error}</ErrorMessage>
        <Link to="/roles" className="text-sm text-[#4338ca] underline">
          Back to Roles
        </Link>
      </div>
    );
  }
  if (!data) return null;

  const orgPath = [data.division?.name, data.department?.name].filter(Boolean).join(' · ');
  const total = taskSummary.length;
  const reviewed = taskSummary.filter((t) => t.validation.status !== 'UNREVIEWED').length;
  const unreviewed = total - reviewed;
  const pct = total === 0 ? 0 : Math.round((reviewed / total) * 100);

  const streamColor = new Map(
    data.participation.map((p, i) => [
      p.valueStreamName,
      STREAM_PALETTE[i % STREAM_PALETTE.length],
    ]),
  );

  // Value-stream groups descend the process tree L2 → L3 → L4: inside each
  // stream, deliverable cards cluster under an "L3 → L4" sub-header (the modal
  // process path of the role's tasks under that deliverable). Tasks that feed
  // no deliverable land in an "Other tasks" bucket per path; tasks whose
  // ancestry resolves to no stream land in a trailing "Unmapped" group.
  const modalPath = (tasks: ProfileTask[]) => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const key = [t.l3, t.l4].filter(Boolean).join(' · ') || 'Other processes';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other processes';
  };
  const groups = data.participation.map((p) => {
    type Sub = { path: string; cards: typeof data.deliverables; other: ProfileTask[] };
    const subs = new Map<string, Sub>();
    const subFor = (path: string) => {
      const s = subs.get(path) ?? { path, cards: [], other: [] };
      subs.set(path, s);
      return s;
    };
    for (const d of data.deliverables) {
      if (d.valueStreamName !== p.valueStreamName) continue;
      const tasks = tasksByDeliverable.get(d.id) ?? [];
      if (!tasks.some((t) => matchesFilter(t, filter))) continue;
      subFor(modalPath(tasks)).cards.push(d);
    }
    for (const t of taskSummary) {
      if (t.valueStreamName !== p.valueStreamName) continue;
      if (t.deliverables.length > 0 || !matchesFilter(t, filter)) continue;
      subFor([t.l3, t.l4].filter(Boolean).join(' · ') || 'Other processes').other.push(t);
    }
    const subgroups = [...subs.values()].sort((a, b) => a.path.localeCompare(b.path));
    return { valueStreamId: p.valueStreamId, valueStreamName: p.valueStreamName, subgroups };
  });
  const unmapped = taskSummary.filter((t) => t.valueStreamName === '—' && matchesFilter(t, filter));

  const filterBtn = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={`px-2 py-0.5 text-[11px] rounded-md transition-colors duration-150 ${
        filter === f
          ? 'bg-[#065f46] text-white font-medium'
          : 'text-[#525252] hover:bg-[#f5f5f5] border border-transparent'
      }`}
    >
      {label}
    </button>
  );

  let firstCard = true;
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow={orgPath || 'Unassigned organization'}
        title={data.name}
        actions={
          <Link
            to="/roles"
            className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
          >
            All roles
          </Link>
        }
        dense
      />

      {/* Family/level chips + org links */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {data.roleFamily && <Chip variant="soft">{data.roleFamily}</Chip>}
        {data.roleLevel && <Chip variant="plain">{data.roleLevel}</Chip>}
        {data.division && (
          <Link
            to={`/divisions/${data.division.id}`}
            className="text-[11px] text-[#4338ca] hover:underline"
          >
            {data.division.name}
          </Link>
        )}
        {data.department && (
          <Link
            to={`/departments/${data.department.id}`}
            className="text-[11px] text-[#4338ca] hover:underline"
          >
            {data.department.name}
          </Link>
        )}
      </div>

      {/* Role description callout */}
      <div className="rounded-lg border border-[#e0e7ff] border-l-4 border-l-[#6366f1] bg-[#eef2ff] px-4 py-3 mb-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#4338ca] mb-1">
          Role description
        </div>
        {data.description ? (
          <p className="text-[13px] text-[#3730a3] leading-relaxed">{data.description}</p>
        ) : (
          <p className="text-[13px] text-[#818cf8]">
            No description yet — profile enrichment hasn't been applied to this role.
          </p>
        )}
      </div>

      {/* Review stats + filter */}
      <Card variant="elevated" className="px-4 py-3 mb-3">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-2xl font-bold text-[#065f46] tnum leading-tight">{pct}%</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
              Reviewed · {reviewed}/{total}
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[#171717] tnum leading-tight">{total}</div>
            <div className="text-[11px] text-[#737373]">tasks assigned</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[#171717] tnum leading-tight">
              {data.deliverables.length}
            </div>
            <div className="text-[11px] text-[#737373]">
              deliverables · {data.participation.length} value stream
              {data.participation.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="h-2 rounded-full bg-[#e5e7eb] overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full bg-[#10b981] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] text-[#a3a3a3] mr-1">Filter:</span>
              {filterBtn('unreviewed', `Needs review (${unreviewed})`)}
              {filterBtn('all', 'All')}
            </div>
          </div>
        </div>
      </Card>

      {/* Applications the role works in (task-level NodeAppUsage roll-up) */}
      {data.applications.length > 0 && (
        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 mb-4">
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#b45309] mb-2">
            ● Applications you work in
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.applications.map((a) => (
              <Link
                key={a.id}
                to={`/applications?focus=${encodeURIComponent(a.id)}`}
                title={a.name}
                className="flex items-center justify-between gap-2 rounded-md border border-[#fcd34d] bg-white px-2.5 py-1.5 hover:border-[#f59e0b] hover:shadow-sm transition-all duration-150"
              >
                <span className="text-[12px] font-medium text-[#171717] truncate">{a.name}</span>
                <span className="text-[10px] font-semibold text-[#b45309] bg-[#fef3c7] rounded px-1.5 py-px tnum flex-shrink-0">
                  {a.taskCount} task{a.taskCount === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Deliverables grouped by value stream, descending L2 → L3 → L4 */}
      {groups.every((g) => g.subgroups.length === 0) && !unmapped.length ? (
        <EmptyState message="No tasks match the current filter." />
      ) : (
        groups.map((g) => {
          if (g.subgroups.length === 0) return null;
          return (
            <section key={g.valueStreamId} className="mb-6">
              {g.subgroups.map((sg) => (
                <div key={sg.path} className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: streamColor.get(g.valueStreamName) ?? '#a3a3a3' }}
                      aria-hidden="true"
                    />
                    <Link
                      to={`/overview?focus=${encodeURIComponent(g.valueStreamId)}`}
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#525252] hover:underline"
                    >
                      {g.valueStreamName} · {sg.path}
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {sg.cards.map((d) => {
                      const tasks = (tasksByDeliverable.get(d.id) ?? []).filter((t) =>
                        matchesFilter(t, filter),
                      );
                      const open = firstCard;
                      firstCard = false;
                      return (
                        <DeliverableCard
                          key={d.id}
                          title={d.title}
                          tasks={tasks}
                          defaultOpen={open}
                          onValidation={onValidation}
                        />
                      );
                    })}
                    {sg.other.length > 0 && (
                      <DeliverableCard
                        title="Tasks without a deliverable"
                        tasks={sg.other}
                        onValidation={onValidation}
                      />
                    )}
                  </div>
                </div>
              ))}
            </section>
          );
        })
      )}
      {unmapped.length > 0 && (
        <section className="mb-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] mb-2">
            Unmapped tasks
          </div>
          <DeliverableCard
            title="Tasks outside any value stream"
            tasks={unmapped}
            onValidation={onValidation}
          />
        </section>
      )}
    </div>
  );
}
