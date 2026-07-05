// ── Approval policies (creator → approver framework, Phase 1 pilot) ──
// Seeds one ApprovalPolicy per wired decision key, from the dispositioned
// inventory (documents/approvals/dual-approval-inventory.md, all rows ACCEPTED
// 2026-07-05). Idempotent: policies are upserted, stages replaced wholesale.
// Only keys with a registered apply handler are seeded — a policy without
// enforcement wiring would be a lie.
import type { PrismaClient } from '@prisma/client';
import type { ApprovalQuorum, ApprovalSeatRule, DecisionKey } from '@cascade/shared';

type PolicySeed = {
  decisionKey: DecisionKey;
  name: string;
  description: string;
  enabled: boolean;
  slaHours: number; // 72h ≈ 3 working days (calendar-hour v1; working-day math lands in Phase 4)
  stages: { order: number; quorum: ApprovalQuorum; n?: number; seats: ApprovalSeatRule[] }[];
};

const POLICIES: PolicySeed[] = [
  {
    decisionKey: 'portfolio.initiative.stage-gate',
    name: 'Initiative stage-gate advance',
    description:
      'DA-11 — advancing an initiative past a stage gate needs the sponsor role (fallback: requester’s manager).',
    enabled: true,
    slaHours: 72,
    stages: [
      { order: 1, quorum: 'ALL_OF', seats: [{ kind: 'ENTITY_ROLE', attr: 'sponsorRoleId' }] },
    ],
  },
  {
    decisionKey: 'portfolio.change-request.approve',
    name: 'Change request approval',
    description:
      'DA-12 — approving a change request (≤ $50k cost impact) needs the requester’s manager.',
    enabled: true,
    slaHours: 72,
    stages: [{ order: 1, quorum: 'MANAGER', seats: [{ kind: 'MANAGER' }] }],
  },
  {
    decisionKey: 'portfolio.change-request.approve-major',
    name: 'Major change request approval (> $50k)',
    description:
      'DA-12 — above the $50k threshold the manager AND the initiative sponsor must both approve (parallel panel).',
    enabled: true,
    slaHours: 72,
    stages: [
      {
        order: 1,
        quorum: 'ALL_OF',
        seats: [{ kind: 'MANAGER' }, { kind: 'ENTITY_ROLE', attr: 'sponsorRoleId' }],
      },
    ],
  },
  {
    decisionKey: 'user-admin.permission-sets.replace',
    name: 'Permission set replacement',
    description:
      'DA-01 — replacing a user type’s entitlements needs a second SITE_ADMIN (four-eyes).',
    enabled: true,
    slaHours: 72,
    stages: [{ order: 1, quorum: 'ANY_OF', seats: [{ kind: 'SITE_ADMINS' }] }],
  },
  {
    decisionKey: 'user-admin.users.mint-admin',
    name: 'Admin role grant',
    description:
      'DA-03 — minting or promoting an admin/super user needs a second SITE_ADMIN (four-eyes).',
    enabled: true,
    slaHours: 72,
    stages: [{ order: 1, quorum: 'ANY_OF', seats: [{ kind: 'SITE_ADMINS' }] }],
  },
  {
    decisionKey: 'approvals.policy.change',
    name: 'Approval policy change (meta)',
    description:
      'DA-08 — changing (including disabling) any approval policy needs a second SITE_ADMIN. The framework protects itself.',
    enabled: true,
    slaHours: 72,
    stages: [{ order: 1, quorum: 'ANY_OF', seats: [{ kind: 'SITE_ADMINS' }] }],
  },
];

export async function seedApprovalPolicies(p: PrismaClient, ctx: { tenantId: string }) {
  for (const seed of POLICIES) {
    const policy = await p.approvalPolicy.upsert({
      where: { tenantId_decisionKey: { tenantId: ctx.tenantId, decisionKey: seed.decisionKey } },
      update: { name: seed.name, description: seed.description },
      create: {
        tenantId: ctx.tenantId,
        decisionKey: seed.decisionKey,
        name: seed.name,
        description: seed.description,
        enabled: seed.enabled,
        slaHours: seed.slaHours,
      },
    });
    await p.approvalPolicyStage.deleteMany({ where: { policyId: policy.id } });
    await p.approvalPolicyStage.createMany({
      data: seed.stages.map((s) => ({
        policyId: policy.id,
        order: s.order,
        quorum: s.quorum,
        n: s.n ?? null,
        seats: s.seats,
      })),
    });
  }
  console.log(`   + ${POLICIES.length} approval policies (pilot: DA-01/03/08/11/12)`);
}
