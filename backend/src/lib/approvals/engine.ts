// Approval engine — hold, decide, cancel, replay. Governed mutations call
// maybeHold() after zod validation; a non-null return means the change is HELD
// (respond 202) and will be applied only by applyRequest() after the policy's
// definition of done (ordered stages, per-stage quorum) is satisfied.
// Every transition writes an AuditEntry: time, user, action, method.
import type { ApprovalSeatRule, ApprovalSubjectAttrs, HeldResponse } from '@cascade/shared';
import { seatRuleSchema } from '@cascade/shared';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { logger } from '../logger.js';
import { getApplyHandler } from './registry.js';
import { resolveStageSeats } from './resolve.js';

type Actor = { tenantId: string; userId: string; email: string };

export type HoldSpec = {
  decisionKey: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  payload: unknown;
  subjectAttrs?: ApprovalSubjectAttrs | null;
};

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

const seatsSchema = z.array(seatRuleSchema).min(1);

function parseSeats(raw: unknown): ApprovalSeatRule[] {
  return seatsSchema.parse(raw);
}

/**
 * Hold a governed mutation. Returns null when no enabled policy governs the
 * decision key (caller proceeds normally); otherwise creates the request +
 * stage-1 assignments and returns the 202 body. Throws 409 when the same
 * entity already has a pending request for this decision.
 */
export async function maybeHold(actor: Actor, spec: HoldSpec): Promise<HeldResponse | null> {
  const policy = await prisma.approvalPolicy.findUnique({
    where: { tenantId_decisionKey: { tenantId: actor.tenantId, decisionKey: spec.decisionKey } },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!policy?.enabled || policy.stages.length === 0) return null;

  if (spec.entityId) {
    const dup = await prisma.approvalRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        policyId: policy.id,
        entityType: spec.entityType,
        entityId: spec.entityId,
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (dup) {
      throw httpError(`A pending approval request already exists (${dup.id})`, 409);
    }
  }

  const firstStage = policy.stages[0];
  const seats = await resolveStageSeats(
    actor.tenantId,
    actor.userId,
    parseSeats(firstStage.seats),
    spec.subjectAttrs ?? null,
  );
  const dueAt = new Date(Date.now() + policy.slaHours * 3_600_000);

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        tenantId: actor.tenantId,
        policyId: policy.id,
        entityType: spec.entityType,
        entityId: spec.entityId ?? null,
        action: spec.action,
        summary: spec.summary,
        payload: spec.payload as object,
        ...(spec.subjectAttrs ? { subjectAttrs: spec.subjectAttrs } : {}),
        requestedById: actor.userId,
        currentStage: firstStage.order,
        dueAt,
      },
    });
    await tx.approvalAssignment.createMany({
      data: seats.flatMap((seat) =>
        seat.userIds.map((assigneeId) => ({
          requestId: created.id,
          stageOrder: firstStage.order,
          seatKey: seat.seatKey,
          assigneeId,
          escalated: seat.escalated,
        })),
      ),
    });
    return created;
  });

  const unresolvable = seats.filter((s) => s.userIds.length === 0);
  await logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'ApprovalRequest',
    entityId: request.id,
    action: 'APPROVAL_REQUESTED',
    diff: {
      decisionKey: spec.decisionKey,
      summary: spec.summary,
      governedEntity: `${spec.entityType}${spec.entityId ? `:${spec.entityId}` : ''}`,
      ...(unresolvable.length > 0 ? { unresolvableSeats: unresolvable.map((s) => s.seatKey) } : {}),
    },
  });
  if (unresolvable.length > 0) {
    logger.warn(
      { requestId: request.id, decisionKey: spec.decisionKey, seats: unresolvable },
      'approval request created with unresolvable seat(s) — configure approvers',
    );
  }

  return {
    approval: 'PENDING',
    requestId: request.id,
    summary: spec.summary,
    dueAt: dueAt.toISOString(),
  };
}

type StageAssignment = {
  id: string;
  stageOrder: number;
  seatKey: string;
  assigneeId: string;
  status: string;
};

function stageComplete(quorum: string, n: number | null, assignments: StageAssignment[]): boolean {
  const seats = new Map<string, boolean>();
  for (const a of assignments) {
    seats.set(a.seatKey, (seats.get(a.seatKey) ?? false) || a.status === 'APPROVED');
  }
  const approved = [...seats.values()].filter(Boolean).length;
  if (quorum === 'ANY_OF') return approved >= 1;
  if (quorum === 'N_OF_M') return approved >= (n ?? seats.size);
  return approved === seats.size; // MANAGER | ALL_OF
}

/**
 * Record one approver's decision. The caller must hold a PENDING assignment on
 * the request's current stage — anything else is a 404 (no existence leaks).
 * Approval evaluates the stage quorum, advances to the next stage (resolving
 * its seats now), or finalizes and replays the held payload.
 */
export async function decideRequest(
  actor: Actor,
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
  comment: string | undefined,
  method: string,
): Promise<{ status: string; requestId: string }> {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: requestId, tenantId: actor.tenantId },
    include: {
      policy: { include: { stages: { orderBy: { order: 'asc' } } } },
      assignments: true,
    },
  });
  if (!request) throw httpError('Not found', 404);
  if (request.status !== 'PENDING') throw httpError('Request already decided', 409);

  const mine = request.assignments.find(
    (a) =>
      a.stageOrder === request.currentStage &&
      a.assigneeId === actor.userId &&
      a.status === 'PENDING',
  );
  // Out-of-scope / non-assignee → 404, matching the tenancy rule.
  if (!mine) throw httpError('Not found', 404);
  if (request.requestedById === actor.userId) throw httpError('Not found', 404); // defense in depth

  const now = new Date();

  if (decision === 'REJECT') {
    await prisma.$transaction([
      prisma.approvalAssignment.update({
        where: { id: mine.id },
        data: { status: 'REJECTED', decidedAt: now, method, comment: comment ?? null },
      }),
      prisma.approvalAssignment.updateMany({
        where: { requestId: request.id, status: 'PENDING', id: { not: mine.id } },
        data: { status: 'CANCELLED' },
      }),
      prisma.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED', decidedAt: now },
      }),
    ]);
    await logAudit({
      tenantId: actor.tenantId,
      actorEmail: actor.email,
      entityType: 'ApprovalRequest',
      entityId: request.id,
      action: 'APPROVAL_REJECTED',
      diff: { method, comment: comment ?? null, summary: request.summary },
    });
    return { status: 'REJECTED', requestId: request.id };
  }

  // APPROVE: my row approved; same-seat sibling candidates superseded.
  await prisma.$transaction([
    prisma.approvalAssignment.update({
      where: { id: mine.id },
      data: { status: 'APPROVED', decidedAt: now, method, comment: comment ?? null },
    }),
    prisma.approvalAssignment.updateMany({
      where: {
        requestId: request.id,
        stageOrder: mine.stageOrder,
        seatKey: mine.seatKey,
        status: 'PENDING',
        id: { not: mine.id },
      },
      data: { status: 'SUPERSEDED' },
    }),
  ]);
  await logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'ApprovalRequest',
    entityId: request.id,
    action: 'APPROVAL_SEAT_APPROVED',
    diff: { seat: mine.seatKey, method, comment: comment ?? null, summary: request.summary },
  });

  const stageRows = await prisma.approvalAssignment.findMany({
    where: { requestId: request.id, stageOrder: request.currentStage },
    select: { id: true, stageOrder: true, seatKey: true, assigneeId: true, status: true },
  });
  const stage = request.policy.stages.find((s) => s.order === request.currentStage);
  if (!stage || !stageComplete(stage.quorum, stage.n, stageRows)) {
    return { status: 'PENDING', requestId: request.id };
  }

  // Stage satisfied — quorum met; open PENDING rows on this stage are moot.
  await prisma.approvalAssignment.updateMany({
    where: { requestId: request.id, stageOrder: request.currentStage, status: 'PENDING' },
    data: { status: 'SUPERSEDED' },
  });

  const nextStage = request.policy.stages.find((s) => s.order > request.currentStage);
  if (nextStage) {
    const seats = await resolveStageSeats(
      actor.tenantId,
      request.requestedById,
      parseSeats(nextStage.seats),
      (request.subjectAttrs ?? null) as ApprovalSubjectAttrs | null,
    );
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { currentStage: nextStage.order },
      });
      await tx.approvalAssignment.createMany({
        data: seats.flatMap((seat) =>
          seat.userIds.map((assigneeId) => ({
            requestId: request.id,
            stageOrder: nextStage.order,
            seatKey: seat.seatKey,
            assigneeId,
            escalated: seat.escalated,
          })),
        ),
      });
    });
    await logAudit({
      tenantId: actor.tenantId,
      actorEmail: actor.email,
      entityType: 'ApprovalRequest',
      entityId: request.id,
      action: 'APPROVAL_STAGE_COMPLETED',
      diff: { completedStage: request.currentStage, nextStage: nextStage.order },
    });
    return { status: 'PENDING', requestId: request.id };
  }

  // Final approval → memorialize, then replay the held change.
  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: 'APPROVED', decidedAt: now },
  });
  await logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'ApprovalRequest',
    entityId: request.id,
    action: 'APPROVAL_APPROVED',
    diff: { method, summary: request.summary },
  });
  await applyRequest(request.id, actor);
  return { status: 'APPROVED', requestId: request.id };
}

/**
 * Replay the held payload through the registered apply handler. Failures are
 * recorded on the row (applyError) — the approval itself stands; an admin can
 * retry once the underlying issue is fixed.
 */
export async function applyRequest(requestId: string, actor: Actor): Promise<void> {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: requestId, tenantId: actor.tenantId },
    include: {
      policy: { select: { decisionKey: true } },
      requestedBy: { select: { email: true } },
    },
  });
  if (!request) throw httpError('Not found', 404);
  if (request.status !== 'APPROVED') throw httpError('Request is not approved', 409);

  const handler = getApplyHandler(request.policy.decisionKey);
  try {
    if (!handler) {
      throw new Error(`No apply handler registered for ${request.policy.decisionKey}`);
    }
    await handler({
      tenantId: request.tenantId,
      entityId: request.entityId,
      payload: request.payload,
      requestedByEmail: request.requestedBy.email,
      approvedByEmail: actor.email,
    });
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { applyError: null },
    });
    await logAudit({
      tenantId: actor.tenantId,
      actorEmail: actor.email,
      entityType: 'ApprovalRequest',
      entityId: request.id,
      action: 'APPROVAL_APPLIED',
      diff: { decisionKey: request.policy.decisionKey, requestedBy: request.requestedBy.email },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { applyError: message.slice(0, 2000) },
    });
    logger.error({ err: e, requestId: request.id }, 'approval replay failed — retryable');
    await logAudit({
      tenantId: actor.tenantId,
      actorEmail: actor.email,
      entityType: 'ApprovalRequest',
      entityId: request.id,
      action: 'APPROVAL_APPLY_FAILED',
      diff: { error: message.slice(0, 500) },
    });
  }
}

/** Creator withdraws their own pending request. */
export async function cancelRequest(actor: Actor, requestId: string): Promise<void> {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: requestId, tenantId: actor.tenantId, requestedById: actor.userId },
    select: { id: true, status: true, summary: true },
  });
  if (!request) throw httpError('Not found', 404);
  if (request.status !== 'PENDING') throw httpError('Request already decided', 409);
  await prisma.$transaction([
    prisma.approvalAssignment.updateMany({
      where: { requestId: request.id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    }),
    prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    }),
  ]);
  await logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'ApprovalRequest',
    entityId: request.id,
    action: 'APPROVAL_CANCELLED',
    diff: { summary: request.summary },
  });
}
