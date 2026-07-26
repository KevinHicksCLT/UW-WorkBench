/**
 * Approvals — the creator → approver work queue. Three mailboxes over
 * GET /approvals/requests: "My queue" (requests waiting on me), "My requests"
 * (requests I created), and "All" (SITE_ADMIN only). Rows render in the
 * canonical Sheet; clicking one opens the RequestDrawer with the held payload,
 * assignment ladder, and the Approve / Reject / Cancel actions.
 */
import { useMemo } from 'react';
import { APPROVAL_STATUS_LABELS } from '@cascade/shared';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { useViewState } from '../../lib/viewState';
import { fmt } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { ErrorMessage, StatusPill } from '../../components/ui';
import RequestDrawer from './RequestDrawer';
import { REQUEST_STATUS_TONE, isOverdue, type ApprovalBox, type ApprovalRequest } from './types';

const BOX_SUBTITLES: Record<ApprovalBox, string> = {
  inbox: 'Requests waiting on your decision — approve or reject each held change.',
  mine: 'Changes you submitted that route through an approver before they apply.',
  all: 'Every approval request in the tenant, whatever its stage or outcome.',
};

export default function Approvals() {
  const { user } = useAuth();
  // Persisted per session (lib/viewState) so returning restores the mailbox
  // and the open request.
  const [box, setBox] = useViewState<ApprovalBox>('approvals.box', 'inbox');
  const [selectedId, setSelectedId] = useViewState<string | null>('approvals.selectedId', null);

  const boxes = useMemo(() => {
    const all: { key: ApprovalBox; label: string }[] = [
      { key: 'inbox', label: 'My queue' },
      { key: 'mine', label: 'My requests' },
      { key: 'all', label: 'All' },
    ];
    // box=all is a SITE_ADMIN-only surface (the endpoint 403s for everyone
    // else) — hide the tab rather than render a dead mailbox.
    return user?.role === 'SITE_ADMIN' ? all : all.filter((b) => b.key !== 'all');
  }, [user?.role]);

  const { data, error, loading, refetch } = useApi<ApprovalRequest[]>(
    `/approvals/requests?box=${box}`,
  );
  const rows = data ?? [];

  // The drawer derives from the fetched list so a refetch after decide/cancel
  // re-renders it with fresh assignment state; a row that leaves the mailbox
  // (e.g. decided out of the queue) closes it.
  const selected = selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null;

  const cols: SheetCol<ApprovalRequest>[] = [
    {
      key: 'summary',
      label: 'Summary',
      width: 'minmax(0,1.7fr)',
      value: (r) => r.summary,
      hideable: false,
    },
    {
      key: 'policy',
      label: 'Policy',
      width: 'minmax(0,1fr)',
      value: (r) => r.policy.name,
      dim: true,
    },
    {
      key: 'requestedBy',
      label: 'Requested by',
      width: '150px',
      value: (r) => r.requestedBy.name,
      dim: true,
    },
    {
      key: 'created',
      label: 'Created',
      width: '110px',
      value: (r) => fmt.date(r.createdAt),
      dim: true,
    },
    {
      key: 'due',
      label: 'Due',
      width: '120px',
      value: (r) => fmt.date(r.dueAt),
      render: (r) =>
        isOverdue(r) ? (
          <span
            className="truncate text-[12px] text-[#be123c] font-semibold"
            title="Overdue — past the policy SLA"
          >
            {fmt.date(r.dueAt)} ⚠
          </span>
        ) : (
          <SheetCell text={fmt.date(r.dueAt)} dim />
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      value: (r) => APPROVAL_STATUS_LABELS[r.status],
      render: (r) => (
        <StatusPill tone={REQUEST_STATUS_TONE[r.status]}>
          {APPROVAL_STATUS_LABELS[r.status]}
        </StatusPill>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Approvals" subtitle={BOX_SUBTITLES[box]} />

      <div className="inline-flex rounded-lg border border-[#eaeaea] p-0.5 mb-5">
        {boxes.map((b) => (
          <button
            key={b.key}
            onClick={() => {
              setBox(b.key);
              setSelectedId(null);
            }}
            className={
              'px-3 py-1 text-sm font-medium rounded-md transition-colors ' +
              (box === b.key ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
            }
          >
            {b.label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}

      <Sheet<ApprovalRequest>
        rows={rows}
        cols={cols}
        rowKey={(r) => r.id}
        sheetKey="approvals.requests"
        unit="requests"
        loading={loading}
        emptyText={
          box === 'inbox' ? 'Nothing is waiting on you.' : 'No approval requests here yet.'
        }
        onRowClick={(r) => setSelectedId(r.id)}
        selectedKey={selectedId}
      />

      {selected && (
        <RequestDrawer
          req={selected}
          userId={user?.id}
          onClose={() => setSelectedId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}
