// Approval request surface: inbox/mine/all listings, detail, decide, cancel,
// and admin replay retry. Reads are gated by the 'approvals' menu key; decide
// and cancel are additionally gated by OWNERSHIP (a live assignment / being
// the requester) — a non-assignee probing a request id gets 404, never 403.
import type { Router, Request, Response, NextFunction } from 'express';
import { approvalDecisionSchema } from '@cascade/shared';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requirePermission } from '../../middleware/permissions.js';
import { requireRole } from '../../middleware/auth.js';
import { applyRequest, cancelRequest, decideRequest } from '../../lib/approvals/engine.js';

const listQuerySchema = z.object({ box: z.enum(['inbox', 'mine', 'all']).default('inbox') });

const LIST_INCLUDE = {
  policy: { select: { decisionKey: true, name: true, slaHours: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  assignments: {
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: [{ stageOrder: 'asc' }, { assignedAt: 'asc' }],
  },
} satisfies Prisma.ApprovalRequestInclude;

export function registerRequestRoutes(router: Router): void {
  const read = requirePermission('approvals', 'read');

  router.get('/requests', read, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { box } = listQuerySchema.parse(req.query);
      if (box === 'all' && req.user.role !== 'SITE_ADMIN') {
        return res.status(403).json({ error: 'Missing permission: approvals:all' });
      }
      const where =
        box === 'all'
          ? { tenantId: req.tenantId }
          : box === 'mine'
            ? { tenantId: req.tenantId, requestedById: req.user.id }
            : {
                tenantId: req.tenantId,
                status: 'PENDING',
                assignments: { some: { assigneeId: req.user.id, status: 'PENDING' } },
              };
      const rows = await prisma.approvalRequest.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      // Inbox only shows requests whose CURRENT stage is waiting on me.
      const filtered =
        req.query.box === 'inbox' || !req.query.box
          ? rows.filter((r) =>
              r.assignments.some(
                (a) =>
                  a.assigneeId === req.user.id &&
                  a.status === 'PENDING' &&
                  a.stageOrder === r.currentStage,
              ),
            )
          : rows;
      res.json(filtered);
    } catch (e) {
      next(e);
    }
  });

  router.get('/requests/:id', read, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.approvalRequest.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: LIST_INCLUDE,
      });
      const visible =
        row &&
        (req.user.role === 'SITE_ADMIN' ||
          row.requestedById === req.user.id ||
          row.assignments.some((a) => a.assigneeId === req.user.id));
      if (!visible) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  router.post(
    '/requests/:id/decide',
    read,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { decision, comment } = approvalDecisionSchema.parse(req.body);
        const result = await decideRequest(
          { tenantId: req.tenantId, userId: req.user.id, email: req.user.email },
          req.params.id,
          decision,
          comment,
          'IN_APP',
        );
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    '/requests/:id/cancel',
    read,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await cancelRequest(
          { tenantId: req.tenantId, userId: req.user.id, email: req.user.email },
          req.params.id,
        );
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );

  // Re-run a failed replay (request APPROVED but applyError set).
  router.post(
    '/requests/:id/apply-retry',
    requireRole('SITE_ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await applyRequest(req.params.id, {
          tenantId: req.tenantId,
          userId: req.user.id,
          email: req.user.email,
        });
        const fresh = await prisma.approvalRequest.findUnique({
          where: { id: req.params.id },
          select: { id: true, status: true, applyError: true },
        });
        res.json(fresh);
      } catch (e) {
        next(e);
      }
    },
  );
}
