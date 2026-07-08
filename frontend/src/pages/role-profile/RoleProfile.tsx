import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { Tile } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import DeliverablesSection from './DeliverablesSection';
import TaskSummarySection from './TaskSummarySection';
import SectionHeader, { StreamDot } from './SectionHeader';
import type { TaskValidation } from '../../components/TaskValidationControl';
import { Card, Chip, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import type { RoleProfilePayload } from './types';

// Role profile — /roles/:id. The full drill-down page for one operating-model
// role: research-sourced job description + family/level, org alignment, the
// value streams it participates in, its deliverables (expandable to the role's
// tasks under each), the expandable task summary, and responsibilities.
// Data: GET /roles/:id/profile (lib/roleProfile assembly). The RoleDrawer
// remains the quick peek; this page is where every /roles/:id link lands.
//
// Layout: headline stat tiles, then a two-column split — the work (deliverables
// + tasks) on the left, the context (description, value streams,
// responsibilities) in a right sidebar. Every value stream gets a stable color
// dot reused across all three cards so streams can be traced at a glance.

/** Fixed palette cycled over the role's value streams (sorted by name). */
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

export default function RoleProfile() {
  const { id } = useParams();
  const { data, error, loading } = useApi<RoleProfilePayload>(
    id ? `/roles/${encodeURIComponent(id)}/profile` : null,
  );

  // Validation decisions land on the NodeRole link server-side; fold the PATCH
  // responses over the loaded payload so both task views stay in sync without
  // a full-page refetch. One link id = one state, wherever it renders.
  const [overrides, setOverrides] = useState<Record<string, TaskValidation>>({});
  useEffect(() => setOverrides({}), [id]);
  const onValidation = (nodeRoleId: string, v: TaskValidation) =>
    setOverrides((o) => ({ ...o, [nodeRoleId]: v }));

  const streamColor = useMemo(() => {
    if (!data) return new Map<string, string>();
    const names = [
      ...new Set([
        ...data.participation.map((p) => p.valueStreamName),
        ...data.taskSummary.map((t) => t.valueStreamName),
        ...data.deliverables.flatMap((d) => (d.valueStreamName ? [d.valueStreamName] : [])),
      ]),
    ].sort((a, b) => a.localeCompare(b));
    return new Map(names.map((n, i) => [n, STREAM_PALETTE[i % STREAM_PALETTE.length]]));
  }, [data]);

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
  const taskSummary = data.taskSummary.map((t) =>
    overrides[t.nodeRoleId] ? { ...t, validation: overrides[t.nodeRoleId] } : t,
  );
  const deliverables = data.deliverables.map((d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      overrides[t.nodeRoleId] ? { ...t, validation: overrides[t.nodeRoleId] } : t,
    ),
  }));

  const reviewed = taskSummary.filter((t) => t.validation.status !== 'UNREVIEWED').length;
  const tasksPerStream = taskSummary.reduce((m, t) => {
    m.set(t.valueStreamName, (m.get(t.valueStreamName) ?? 0) + 1);
    return m;
  }, new Map<string, number>());

  return (
    <div className="max-w-7xl">
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

      {/* Headline stats — what this role touches and how far review has come */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Tile
          compact
          label="Value streams"
          value={data.participation.length}
          hint="participates in"
        />
        <Tile
          compact
          label="Deliverables"
          value={deliverables.length}
          hint="owned or contributed"
        />
        <Tile compact label="Tasks" value={taskSummary.length} hint="assigned via process" />
        <Tile
          compact
          label="Reviewed"
          value={
            taskSummary.length === 0 ? '—' : `${Math.round((reviewed / taskSummary.length) * 100)}%`
          }
          hint={`${reviewed} of ${taskSummary.length} tasks validated`}
          tone={taskSummary.length > 0 && reviewed === taskSummary.length ? 'positive' : 'neutral'}
        />
      </div>

      {/* Two columns on wide screens: the work left, the context right */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-3 min-w-0">
          <DeliverablesSection
            deliverables={deliverables}
            streamColor={streamColor}
            onValidation={onValidation}
          />
          <TaskSummarySection
            tasks={taskSummary}
            streamColor={streamColor}
            onValidation={onValidation}
          />
        </div>

        <div className="space-y-3 min-w-0">
          {/* Job description */}
          <Card variant="elevated" className="overflow-hidden">
            <SectionHeader
              iconClass="bg-[#fef3c7] text-[#b45309]"
              icon={
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              }
              title="Job description"
            />
            <div className="p-4">
              {data.description ? (
                <p className="text-sm text-[#525252] leading-relaxed">{data.description}</p>
              ) : (
                <EmptyState message="No description yet — profile enrichment hasn't been applied to this role." />
              )}
            </div>
          </Card>

          {/* Value streams the role participates in */}
          <Card variant="elevated" className="overflow-hidden">
            <SectionHeader
              iconClass="bg-[#ede9fe] text-[#6d28d9]"
              icon={
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16M4 12h10M4 17h13" />
                </svg>
              }
              title="Value Streams"
              count={data.participation.length}
            />
            {data.participation.length === 0 ? (
              <EmptyState
                className="px-4 py-6"
                message="This role isn't wired to any value streams yet."
              />
            ) : (
              // Plain list — the retired Lead/Support participation tag is
              // intentionally absent (the value is the stream membership itself).
              data.participation.map((p) => (
                <div
                  key={p.valueStreamId}
                  className="flex items-center gap-2.5 px-4 py-2 border-b border-[#f5f5f5] last:border-b-0"
                >
                  <StreamDot color={streamColor.get(p.valueStreamName) ?? '#a3a3a3'} />
                  <Link
                    to={`/overview?focus=${encodeURIComponent(p.valueStreamId)}`}
                    className="flex-1 min-w-0 text-sm text-[#171717] truncate hover:underline"
                  >
                    {p.valueStreamName}
                  </Link>
                  {(tasksPerStream.get(p.valueStreamName) ?? 0) > 0 && (
                    <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
                      {tasksPerStream.get(p.valueStreamName)} task
                      {tasksPerStream.get(p.valueStreamName) === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              ))
            )}
          </Card>

          {/* Responsibilities */}
          {data.responsibilities.length > 0 && (
            <Card variant="elevated" className="overflow-hidden">
              <SectionHeader
                iconClass="bg-[#d1fae5] text-[#047857]"
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                }
                title="Responsibilities"
              />
              <div className="p-4 space-y-3">
                {data.responsibilities.map((group) => (
                  <div key={group.category}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#047857] mb-1">
                      {group.category}
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 marker:text-[#a7f3d0]">
                      {group.items.map((item, i) => (
                        <li key={i} className="text-sm text-[#525252]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
