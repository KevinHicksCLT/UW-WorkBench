// Registers the apply (replay) handler for every wired decision key.
// Imported ONCE from app.ts at boot. Each handler replays the held payload
// through the same validated write path the direct mutation uses — never a
// parallel implementation. Payload shapes are re-validated with zod here:
// the payload crossed a DB round-trip, so it is untrusted input again.
import { userUpsertSchema, permissionGrantSchema } from '@cascade/shared';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit } from '../../services/audit.js';
import { applyChangeRequestUpdate } from '../../services/changeRequests.js';
import { replacePermissionSetGrants } from '../../services/permissionSetWrites.js';
import { applyWorkflowAction } from '../../services/portfolioWorkflow.js';
import { upsertUser } from '../../services/userProvisioning.js';
import { registerApplyHandler } from './registry.js';

// DA-11 — initiative stage-gate advance.
const stageGateSchema = z.object({ initiativeId: z.string() });
registerApplyHandler('portfolio.initiative.stage-gate', async (ctx) => {
  const { initiativeId } = stageGateSchema.parse(ctx.payload);
  await applyWorkflowAction({
    initiativeId,
    action: 'APPROVE',
    actor: { tenantId: ctx.tenantId, email: ctx.approvedByEmail },
  });
});

// DA-12 — change-request approval (minor and major share the apply path).
const crSchema = z.object({
  cid: z.string(),
  data: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    raisedBy: z.string().optional(),
    costImpact: z.number().optional(),
    scheduleImpactDays: z.number().int().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});
const applyChangeRequest = async (ctx: {
  tenantId: string;
  payload: unknown;
  approvedByEmail: string;
}) => {
  const { cid, data } = crSchema.parse(ctx.payload);
  await applyChangeRequestUpdate(ctx.tenantId, cid, data, ctx.approvedByEmail);
};
registerApplyHandler('portfolio.change-request.approve', applyChangeRequest);
registerApplyHandler('portfolio.change-request.approve-major', applyChangeRequest);

// DA-01 — permission-set grant replacement.
const grantsSchema = z.object({
  userType: z.string(),
  grants: z.array(permissionGrantSchema),
});
registerApplyHandler('user-admin.permission-sets.replace', async (ctx) => {
  const { userType, grants } = grantsSchema.parse(ctx.payload);
  await replacePermissionSetGrants(ctx.tenantId, userType, grants, ctx.approvedByEmail);
});

// DA-03 — minting/promoting an admin. Escalation and ref checks ran at hold
// time in the route (POST held a full body, PATCH a partial one); upsertUser
// revalidates references internally.
const mintAdminSchema = z.object({
  data: userUpsertSchema.partial(),
  byId: z.string().optional(),
});
registerApplyHandler('user-admin.users.mint-admin', async (ctx) => {
  const { data, byId } = mintAdminSchema.parse(ctx.payload);
  await upsertUser({
    tenantId: ctx.tenantId,
    actorLabel: `${ctx.requestedByEmail} (approved by ${ctx.approvedByEmail})`,
    data,
    byId,
  });
});

// DA-08 — approval policy change (meta-approval).
const policyChangeSchema = z.object({
  policyId: z.string(),
  data: z.object({
    enabled: z.boolean().optional(),
    slaHours: z
      .number()
      .int()
      .min(1)
      .max(24 * 90)
      .optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  }),
});
registerApplyHandler('approvals.policy.change', async (ctx) => {
  const { policyId, data } = policyChangeSchema.parse(ctx.payload);
  const existing = await prisma.approvalPolicy.findFirst({
    where: { id: policyId, tenantId: ctx.tenantId },
    select: { id: true, decisionKey: true, enabled: true, slaHours: true },
  });
  if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });
  await prisma.approvalPolicy.update({ where: { id: policyId }, data });
  await logAudit({
    tenantId: ctx.tenantId,
    actorEmail: ctx.approvedByEmail,
    entityType: 'ApprovalPolicy',
    entityId: policyId,
    action: 'UPDATE',
    diff: { decisionKey: existing.decisionKey, ...data, requestedBy: ctx.requestedByEmail },
  });
});
