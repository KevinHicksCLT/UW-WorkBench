// Approval policy registry (SITE_ADMIN). Editing a policy is ITSELF governed
// (DA-08 meta-approval): the PATCH is held for a second SITE_ADMIN unless the
// meta-policy is disabled. Stage editing is deliberately not exposed yet —
// stages ship seeded from the dispositioned inventory; a stage editor is a
// Phase 1.x follow-up.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { maybeHold } from '../../lib/approvals/engine.js';
import { getApplyHandler } from '../../lib/approvals/registry.js';

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  slaHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export function registerPolicyRoutes(router: Router): void {
  const guard = requireRole('SITE_ADMIN');

  router.get('/policies', guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.approvalPolicy.findMany({
        where: { tenantId: req.tenantId },
        include: {
          stages: { orderBy: { order: 'asc' } },
          _count: { select: { requests: { where: { status: 'PENDING' } } } },
        },
        orderBy: { decisionKey: 'asc' },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  router.patch('/policies/:id', guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = patchSchema.parse(req.body);
      const existing = await prisma.approvalPolicy.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        select: { id: true, decisionKey: true, name: true, enabled: true },
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const held = await maybeHold(
        { tenantId: req.tenantId, userId: req.user.id, email: req.user.email },
        {
          decisionKey: 'approvals.policy.change',
          entityType: 'ApprovalPolicy',
          entityId: existing.id,
          action: 'POLICY_CHANGE',
          summary: `Change approval policy "${existing.name}" (${describePatch(data)})`,
          payload: { policyId: existing.id, data },
        },
      );
      if (held) return res.status(202).json(held);

      const handler = getApplyHandler('approvals.policy.change');
      if (!handler) return res.status(500).json({ error: 'Apply handler missing' });
      await handler({
        tenantId: req.tenantId,
        entityId: existing.id,
        payload: { policyId: existing.id, data },
        requestedByEmail: req.user.email,
        approvedByEmail: req.user.email,
      });
      const fresh = await prisma.approvalPolicy.findUnique({
        where: { id: existing.id },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      res.json(fresh);
    } catch (e) {
      next(e);
    }
  });
}

function describePatch(data: z.infer<typeof patchSchema>): string {
  const parts: string[] = [];
  if (data.enabled !== undefined) parts.push(data.enabled ? 'enable' : 'disable');
  if (data.slaHours !== undefined) parts.push(`SLA ${data.slaHours}h`);
  if (data.name !== undefined) parts.push('rename');
  if (data.description !== undefined) parts.push('description');
  return parts.join(', ') || 'no-op';
}
