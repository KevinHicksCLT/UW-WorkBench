/**
 * Approvals page — client-side view of GET /approvals/requests. The wire shape
 * is produced by backend/src/routes/approvals; enum tokens come from
 * @cascade/shared (the single contract both sides consume).
 */
import type {
  ApprovalAssignmentStatus,
  ApprovalMethod,
  ApprovalRequestStatus,
} from '@cascade/shared';
import type { PillTone } from '../../components/ui';

export type ApprovalPerson = { id: string; name: string; email: string };

export type ApprovalAssignment = {
  id: string;
  stageOrder: number;
  seatKey: string;
  assigneeId: string;
  escalated: boolean;
  status: ApprovalAssignmentStatus;
  assignedAt: string;
  decidedAt: string | null;
  method: ApprovalMethod | null;
  comment: string | null;
  assignee: ApprovalPerson;
};

export type ApprovalRequest = {
  id: string;
  summary: string;
  status: ApprovalRequestStatus;
  currentStage: number;
  dueAt: string | null;
  createdAt: string;
  applyError: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: unknown;
  policy: { decisionKey: string; name: string; slaHours: number };
  requestedBy: ApprovalPerson;
  assignments: ApprovalAssignment[];
};

/** Which mailbox of requests the list shows. */
export type ApprovalBox = 'inbox' | 'mine' | 'all';

export const REQUEST_STATUS_TONE: Record<ApprovalRequestStatus, PillTone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'slate',
  EXPIRED: 'slate',
};

export const ASSIGNMENT_STATUS_TONE: Record<ApprovalAssignmentStatus, PillTone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  SUPERSEDED: 'slate',
  CANCELLED: 'slate',
};

/** A request is overdue when it is still pending past its SLA due date. */
export function isOverdue(r: Pick<ApprovalRequest, 'status' | 'dueAt'>): boolean {
  return r.status === 'PENDING' && !!r.dueAt && new Date(r.dueAt).getTime() < Date.now();
}

/** True when `userId` holds a pending assignment on the request's current stage. */
export function canDecide(r: ApprovalRequest, userId: string | undefined): boolean {
  if (!userId || r.status !== 'PENDING') return false;
  return r.assignments.some(
    (a) => a.status === 'PENDING' && a.stageOrder === r.currentStage && a.assigneeId === userId,
  );
}

/** True when `userId` created the request and it can still be withdrawn. */
export function canCancel(r: ApprovalRequest, userId: string | undefined): boolean {
  return !!userId && r.status === 'PENDING' && r.requestedBy.id === userId;
}
