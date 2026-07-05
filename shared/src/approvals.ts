// Shared contract for the creator → approver framework (Phase 1).
// Backend: hold/resolve/decide engine in backend/src/lib/approvals/.
// Frontend: Approvals inbox + 202-held responses on governed mutations.
import { z } from 'zod';

// Decision keys with wired enforcement (the seeded registry holds one
// ApprovalPolicy per key; documents/approvals/dual-approval-inventory.md is
// the governance source these were dispositioned from).
export const DECISION_KEYS = [
  'portfolio.initiative.stage-gate', // DA-11
  'portfolio.change-request.approve', // DA-12 (≤ $50k)
  'portfolio.change-request.approve-major', // DA-12 (> $50k panel)
  'user-admin.permission-sets.replace', // DA-01
  'user-admin.users.mint-admin', // DA-03
  'approvals.policy.change', // DA-08 (meta-approval)
] as const;
export type DecisionKey = (typeof DECISION_KEYS)[number];

/** DA-12: cost impact above this routes to the -major panel policy. */
export const CHANGE_REQUEST_MAJOR_THRESHOLD = 50_000;

export const APPROVAL_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export const APPROVAL_ASSIGNMENT_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'CANCELLED',
] as const;
export type ApprovalAssignmentStatus = (typeof APPROVAL_ASSIGNMENT_STATUSES)[number];

export const APPROVAL_METHODS = [
  'IN_APP',
  'ADAPTIVE_CARD_TEAMS',
  'ADAPTIVE_CARD_EMAIL',
  'SERVICENOW',
  'API',
] as const;
export type ApprovalMethod = (typeof APPROVAL_METHODS)[number];

export const APPROVAL_QUORUMS = ['MANAGER', 'ANY_OF', 'ALL_OF', 'N_OF_M'] as const;
export type ApprovalQuorum = (typeof APPROVAL_QUORUMS)[number];

// Seat rules — how one seat of a stage resolves to candidate approvers.
// MANAGER: the requester's reportsTo. ROLES: isApprover holders of the named
// operating roles. USERS: explicit list. ENTITY_ROLE: role id taken from the
// request's subjectAttrs (e.g. an initiative's sponsorRoleId). SITE_ADMINS:
// any other SITE_ADMIN (four-eyes among admins).
export const seatRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('MANAGER') }),
  z.object({ kind: z.literal('ROLES'), roleIds: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('USERS'), userIds: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('ENTITY_ROLE'), attr: z.string().min(1) }),
  z.object({ kind: z.literal('SITE_ADMINS') }),
]);
export type ApprovalSeatRule = z.infer<typeof seatRuleSchema>;

// ABAC subject attributes derived from the governed entity; every candidate
// approver's scope (org-unit subtree, geography, value streams) must contain
// these. Missing attribute = dimension skipped for the request.
export const subjectAttrsSchema = z.object({
  orgUnitId: z.string().nullish(),
  geography: z.string().nullish(),
  valueStreamNodeId: z.string().nullish(),
  sponsorRoleId: z.string().nullish(), // consumed by ENTITY_ROLE seats
});
export type ApprovalSubjectAttrs = z.infer<typeof subjectAttrsSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().trim().max(2000).optional(),
});
export type ApprovalDecisionRequest = z.infer<typeof approvalDecisionSchema>;

/** Shape of the 202 body a held (governed) mutation returns. */
export type HeldResponse = {
  approval: 'PENDING';
  requestId: string;
  summary: string;
  dueAt: string | null;
};

export function isHeldResponse(v: unknown): v is HeldResponse {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>).approval === 'PENDING' &&
    typeof (v as Record<string, unknown>).requestId === 'string'
  );
}

export const APPROVAL_STATUS_LABELS: Readonly<Record<ApprovalRequestStatus, string>> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const APPROVAL_METHOD_LABELS: Readonly<Record<ApprovalMethod, string>> = {
  IN_APP: 'In app',
  ADAPTIVE_CARD_TEAMS: 'Teams card',
  ADAPTIVE_CARD_EMAIL: 'Email card',
  SERVICENOW: 'ServiceNow',
  API: 'API',
};
