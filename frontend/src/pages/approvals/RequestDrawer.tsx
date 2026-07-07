/**
 * Approvals — request detail drawer. Shows the held change (summary, policy,
 * requester, payload, assignment ladder) and hosts the decide/cancel actions:
 * Approve/Reject when the current user holds a pending assignment on the
 * current stage, Cancel when they created the request and it is still pending.
 */
import { useState } from 'react';
import {
  APPROVAL_METHOD_LABELS,
  APPROVAL_STATUS_LABELS,
  type ApprovalRequestStatus,
} from '@cascade/shared';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Button, DrawerShell, StatusPill } from '../../components/ui';
import {
  ASSIGNMENT_STATUS_TONE,
  REQUEST_STATUS_TONE,
  canCancel,
  canDecide,
  isOverdue,
  type ApprovalRequest,
} from './types';

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
        {label}
      </div>
      <div className="text-sm text-[#171717] mt-0.5">{children}</div>
    </div>
  );
}

export default function RequestDrawer({
  req,
  userId,
  onClose,
  onChanged,
}: {
  req: ApprovalRequest;
  /** The signed-in user's id — drives which actions render. */
  userId: string | undefined;
  onClose: () => void;
  /** Called after a successful decide/cancel so the list refetches. */
  onChanged: () => void;
}) {
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    let comment: string | undefined;
    if (decision === 'REJECT') {
      // Reject requires a reason — the prompt's confirm stays disabled until
      // non-empty text is entered; null = the approver backed out.
      const reason = await dialogs.prompt({
        title: 'Reject this request?',
        message: req.summary,
        label: 'Reason (required)',
        confirmLabel: 'Reject',
      });
      if (reason === null) return;
      comment = reason;
    } else {
      const ok = await dialogs.confirm({
        title: 'Approve this request?',
        message: req.summary,
        confirmLabel: 'Approve',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = (await api.post(`/approvals/requests/${req.id}/decide`, {
        decision,
        ...(comment ? { comment } : {}),
      })) as { status: ApprovalRequestStatus; requestId: string };
      onChanged();
      await dialogs.alert({
        title: 'Decision recorded',
        message: `The request is now ${APPROVAL_STATUS_LABELS[res.status].toLowerCase()}.`,
      });
    } catch (e) {
      await dialogs.alert({ title: 'Decision failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await dialogs.confirm({
      title: 'Cancel this request?',
      message: 'The held change is discarded and approvers are stood down.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/approvals/requests/${req.id}/cancel`);
      onChanged();
      onClose();
    } catch (e) {
      await dialogs.alert({ title: 'Cancel failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const overdue = isOverdue(req);

  return (
    // Fixed wrapper gives the DrawerShell's absolute positioning a
    // viewport-sized box regardless of how far the page is scrolled.
    <div className="fixed inset-0 z-40">
      <DrawerShell
        onClose={onClose}
        width={640}
        maxWidth="94vw"
        header={
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
              Approval request
            </div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug">{req.summary}</div>
            <div className="mt-1">
              <StatusPill tone={REQUEST_STATUS_TONE[req.status]}>
                {APPROVAL_STATUS_LABELS[req.status]}
              </StatusPill>
            </div>
          </div>
        }
      >
        {req.applyError && (
          <div className="mb-4 rounded-md border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
            <span className="font-semibold">Apply failed after approval:</span> {req.applyError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
          <Meta label="Policy">
            {req.policy.name}
            <span className="text-[#a3a3a3]"> · SLA {req.policy.slaHours}h</span>
          </Meta>
          <Meta label="Requested by">
            {req.requestedBy.name}
            <span className="block text-[11px] text-[#a3a3a3] truncate">
              {req.requestedBy.email}
            </span>
          </Meta>
          <Meta label="Created">{fmt.date(req.createdAt)}</Meta>
          <Meta label="Due">
            <span className={overdue ? 'text-[#be123c] font-semibold' : undefined}>
              {fmt.date(req.dueAt)}
              {overdue && ' — overdue'}
            </span>
          </Meta>
          <Meta label="Entity">
            {req.entityType}
            <span className="text-[#a3a3a3]"> · {req.action}</span>
          </Meta>
          <Meta label="Stage">{req.currentStage}</Meta>
        </div>

        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">
          Held change
        </h4>
        <pre className="mb-5 max-h-64 overflow-auto rounded-md border border-[#eaeaea] bg-[#fafafa] p-3 text-xs text-[#171717]">
          {JSON.stringify(req.payload, null, 2)}
        </pre>

        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">
          Approvers
        </h4>
        <div className="mb-5 divide-y divide-[#f5f5f5] rounded-md border border-[#eaeaea]">
          {req.assignments.map((a) => (
            <div key={a.id} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
                  Stage {a.stageOrder}
                </span>
                <span className="font-medium text-[#171717] truncate">{a.assignee.name}</span>
                {a.escalated && <StatusPill tone="amber">Escalated</StatusPill>}
                <span className="flex-1" />
                <StatusPill tone={ASSIGNMENT_STATUS_TONE[a.status]}>
                  {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                </StatusPill>
              </div>
              {(a.decidedAt || a.comment) && (
                <div className="mt-1 text-[11px] text-[#666666]">
                  {a.decidedAt && (
                    <span>
                      Decided {fmt.date(a.decidedAt)}
                      {a.method ? ` via ${APPROVAL_METHOD_LABELS[a.method]}` : ''}
                    </span>
                  )}
                  {a.comment && <span className="block italic">“{a.comment}”</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {(canDecide(req, userId) || canCancel(req, userId)) && (
          <div className="flex items-center gap-2 border-t border-[#eaeaea] pt-4">
            {canDecide(req, userId) && (
              <>
                <Button disabled={busy} onClick={() => void decide('APPROVE')}>
                  Approve
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void decide('REJECT')}>
                  Reject
                </Button>
              </>
            )}
            <span className="flex-1" />
            {canCancel(req, userId) && (
              <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>
                Cancel request
              </Button>
            )}
          </div>
        )}
      </DrawerShell>
    </div>
  );
}
