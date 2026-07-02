import { prisma } from '../db/prisma.js';
import { logAudit } from './audit.js';

// Stage-gate engine for the initiative tracker. Stages advance
// IDEA → PLAN → EXECUTE → COMPLETE; each stage maps to a coarse state.
// Ported from Cascade, with the notification + business-rule side effects removed
// (out of scope) — every action is still recorded in the shared audit log.

const STAGE_ORDER = ['IDEA', 'PLAN', 'EXECUTE', 'COMPLETE'] as const;

const STAGE_TO_STATE: Record<string, string> = {
  IDEA: 'PLANNING',
  PLAN: 'PLANNING',
  EXECUTE: 'ACTIVE',
  COMPLETE: 'DONE',
};

type Actor = { tenantId: string; email: string };
type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'MOVE_BACK';

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

// SUBMIT    — request advancement (flags workflowAction=SUBMIT, pending approval)
// APPROVE   — approve a pending submission; advance one stage, clear the flag
// MOVE_BACK — revert one stage
export async function applyWorkflowAction({
  initiativeId,
  action,
  actor,
}: {
  initiativeId: string;
  action: WorkflowAction;
  actor: Actor;
}) {
  const init = await prisma.portfolioInitiative.findUnique({ where: { id: initiativeId } });
  if (!init) throw httpError('Initiative not found', 404);

  const currentIdx = STAGE_ORDER.indexOf(init.stage as (typeof STAGE_ORDER)[number]);
  let newStage = init.stage;
  let newWorkflowAction: string | null = null;
  let auditAction: string; // assigned on every branch below (unknown action throws)

  if (action === 'SUBMIT') {
    if (currentIdx >= STAGE_ORDER.length - 1) throw httpError('Already at final stage', 400);
    newWorkflowAction = 'SUBMIT';
    auditAction = 'SUBMIT_FOR_APPROVAL';
  } else if (action === 'APPROVE') {
    if (init.workflowAction !== 'SUBMIT') throw httpError('No pending submission to approve', 400);
    if (currentIdx >= STAGE_ORDER.length - 1) throw httpError('Already at final stage', 400);
    newStage = STAGE_ORDER[currentIdx + 1];
    auditAction = 'STAGE_ADVANCED';
  } else if (action === 'MOVE_BACK') {
    if (currentIdx === 0) throw httpError('Already at first stage', 400);
    newStage = STAGE_ORDER[currentIdx - 1];
    auditAction = 'STAGE_REVERTED';
  } else {
    throw httpError(`Unknown workflow action: ${action}`, 400);
  }

  const updated = await prisma.portfolioInitiative.update({
    where: { id: initiativeId },
    data: { stage: newStage, state: STAGE_TO_STATE[newStage], workflowAction: newWorkflowAction },
  });

  logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'PortfolioInitiative',
    entityId: initiativeId,
    action: auditAction,
    // SUBMIT doesn't move the stage — record the current stage + the one being
    // requested, rather than a misleading from===to pair.
    diff: action === 'SUBMIT'
      ? { stage: init.stage, requestedNext: STAGE_ORDER[currentIdx + 1] }
      : { from: init.stage, to: newStage },
  });

  return updated;
}
