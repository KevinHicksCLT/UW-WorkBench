import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import DeliverablesSection from './DeliverablesSection';
import TaskSummarySection from './TaskSummarySection';
import {
  Card,
  Chip,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import type { RoleProfilePayload } from './types';

// Role profile — /roles/:id. The full drill-down page for one operating-model
// role: research-sourced job description + family/level, org alignment, the
// value streams it leads/supports, its deliverables (expandable to the role's
// tasks under each), the expandable task summary, and responsibilities.
// Data: GET /roles/:id/profile (lib/roleProfile assembly). The RoleDrawer
// remains the quick peek; this page is where every /roles/:id link lands.
export default function RoleProfile() {
  const { id } = useParams();
  const { data, error, loading } = useApi<RoleProfilePayload>(
    id ? `/roles/${encodeURIComponent(id)}/profile` : null,
  );

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

  return (
    <div className="max-w-5xl">
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

      {/* Job description */}
      <Card variant="elevated" className="p-4 mb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
          Job description
        </h2>
        {data.description ? (
          <p className="text-sm text-[#525252] leading-relaxed">{data.description}</p>
        ) : (
          <EmptyState message="No description yet — profile enrichment hasn't been applied to this role." />
        )}
      </Card>

      {/* Value streams — Lead/Owner vs Support */}
      <Card variant="elevated" className="overflow-hidden mb-3">
        <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-[#171717]">Value Streams</h2>
          <span className="text-[11px] text-[#a3a3a3] tnum">{data.participation.length}</span>
        </div>
        {data.participation.length === 0 ? (
          <EmptyState
            className="px-4 py-6"
            message="This role isn't wired to any value streams yet."
          />
        ) : (
          data.participation.map((p) => (
            <div
              key={p.valueStreamId}
              className="flex items-center gap-2.5 px-4 py-2 border-b border-[#f5f5f5] last:border-b-0"
            >
              <Link
                to={`/overview?focus=${encodeURIComponent(p.valueStreamId)}`}
                className="flex-1 min-w-0 text-sm text-[#171717] truncate hover:underline"
              >
                {p.valueStreamName}
              </Link>
              <StatusPill
                tone={p.participationType === 'Lead' ? 'blue' : 'slate'}
                className="flex-shrink-0"
              >
                {p.participationType === 'Lead' ? 'Lead / Owner' : 'Supporting'}
              </StatusPill>
            </div>
          ))
        )}
      </Card>

      <div className="mb-3">
        <DeliverablesSection deliverables={data.deliverables} />
      </div>

      <div className="mb-3">
        <TaskSummarySection tasks={data.taskSummary} />
      </div>

      {/* Responsibilities */}
      {data.responsibilities.length > 0 && (
        <Card variant="elevated" className="p-4">
          <h2 className="text-base font-semibold text-[#171717] mb-2">Responsibilities</h2>
          <div className="space-y-3">
            {data.responsibilities.map((group) => (
              <div key={group.category}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
                  {group.category}
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
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
  );
}
