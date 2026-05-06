import { prisma } from '../db/prisma.js';
import { logAudit } from './audit.js';
import { runRulesForEntity } from './rulesEngine.js';
import { sendNotification } from './notifications.js';

const STAGE_ORDER = ['IDEA', 'PLAN', 'EXECUTE', 'REALIZE', 'COMPLETE'];

const STAGE_TO_STATE = {
  IDEA: 'PLANNING',
  PLAN: 'PLANNING',
  EXECUTE: 'ACTIVE',
  REALIZE: 'ACTIVE',
  COMPLETE: 'DONE',
};

/**
 * Apply a workflow action against an initiative.
 * action ∈ { SUBMIT, APPROVE, MOVE_BACK }
 *
 * SUBMIT      — submitter requests advancement; sets workflowAction=SUBMIT and notifies sponsor
 * APPROVE     — sponsor approves; advances stage by one, clears action, notifies owner
 * MOVE_BACK   — sponsor rejects or revisits; moves stage back by one
 */
export async function applyWorkflowAction({ initiativeId, action, actor }) {
  const init = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    include: { sponsor: true, owner: true, workstream: { include: { program: true } } },
  });
  if (!init) throw Object.assign(new Error('Initiative not found'), { status: 404 });

  const currentIdx = STAGE_ORDER.indexOf(init.stage);
  let newStage = init.stage;
  let newWorkflowAction = null;
  let auditAction = 'UPDATE';
  const notifications = [];

  if (action === 'SUBMIT') {
    if (currentIdx >= STAGE_ORDER.length - 1) {
      throw Object.assign(new Error('Already at final stage'), { status: 400 });
    }
    newWorkflowAction = 'SUBMIT';
    auditAction = 'SUBMIT_FOR_APPROVAL';
    if (init.sponsor) {
      notifications.push({
        userId: init.sponsor.id,
        subject: `Approval requested: ${init.name}`,
        body: `${actor.name} has requested advancement to ${STAGE_ORDER[currentIdx + 1]}.`,
        link: `/initiatives/${init.id}`,
      });
    }
  } else if (action === 'APPROVE') {
    if (init.workflowAction !== 'SUBMIT') {
      throw Object.assign(new Error('No pending submission to approve'), { status: 400 });
    }
    if (currentIdx >= STAGE_ORDER.length - 1) {
      throw Object.assign(new Error('Already at final stage'), { status: 400 });
    }
    newStage = STAGE_ORDER[currentIdx + 1];
    auditAction = 'STAGE_ADVANCED';
    if (init.owner) {
      notifications.push({
        userId: init.owner.id,
        subject: `Approved: ${init.name} → ${newStage}`,
        body: `Your initiative has advanced to ${newStage}.`,
        link: `/initiatives/${init.id}`,
      });
    }
  } else if (action === 'MOVE_BACK') {
    if (currentIdx === 0) {
      throw Object.assign(new Error('Already at first stage'), { status: 400 });
    }
    newStage = STAGE_ORDER[currentIdx - 1];
    auditAction = 'STAGE_REVERTED';
  } else {
    throw Object.assign(new Error(`Unknown workflow action: ${action}`), { status: 400 });
  }

  const updated = await prisma.initiative.update({
    where: { id: initiativeId },
    data: {
      stage: newStage,
      state: STAGE_TO_STATE[newStage],
      workflowAction: newWorkflowAction,
    },
  });

  await logAudit({
    tenantId: actor.tenantId,
    actorEmail: actor.email,
    entityType: 'Initiative',
    entityId: initiativeId,
    action: auditAction,
    diff: { from: init.stage, to: newStage },
  });

  // Fire notifications
  for (const n of notifications) {
    await sendNotification({ tenantId: actor.tenantId, ...n });
  }

  // Trigger business rules on stage change
  await runRulesForEntity({
    tenantId: actor.tenantId,
    entityType: 'Initiative',
    trigger: 'ON_FIELD_CHANGE',
    fieldName: 'stage',
    fieldValue: newStage,
    entity: updated,
    actor,
  });

  return updated;
}
