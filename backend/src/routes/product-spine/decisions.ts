/**
 * Product Normalize review sign-off. The product Normalize board derives its
 * element groups from the live spine (frontend buildComparison), so a
 * "varies / unique" group has no persisted normalization row. These routes read
 * and upsert the reviewer's decision for such a group, keyed by the compared
 * LOB node + the group's stable key: APPROVED = adopt everywhere / normalize;
 * HELD = keep as a version variant.
 *
 * Registered BEFORE cacheResponses in index.ts so an approval is never served
 * stale from (or written into) the response cache.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { activeCompany } from '../explorer/helpers.js';

const putSchema = z.object({
  lobId: z.string().trim().min(1),
  component: z.string().trim().min(1),
  groupKey: z.string().trim().min(1),
  status: z.enum(['APPROVED', 'HELD', 'RETIRED']),
  comment: z.string().trim().max(2000).optional(),
});

export function registerProductDecisionRoutes(router: Router): void {
  // GET /product-spine/decisions?lobId=... — the reviewer's decisions for one
  // compared LOB (or, with no lobId, every LOB — the portfolio heatmap's
  // progress roll-up needs them all).
  router.get('/decisions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });
      const lobId = typeof req.query.lobId === 'string' ? req.query.lobId : '';

      const rows = await prisma.productNormalizationDecision.findMany({
        where: { companyId: company.id, ...(lobId ? { lobNodeId: lobId } : {}) },
        select: {
          lobNodeId: true,
          groupKey: true,
          component: true,
          status: true,
          comment: true,
          decidedBy: true,
          updatedAt: true,
        },
      });
      res.json(
        rows.map((r) => ({
          lobId: r.lobNodeId,
          groupKey: r.groupKey,
          component: r.component,
          status: r.status,
          comment: r.comment,
          decidedBy: r.decidedBy,
          decidedAt: r.updatedAt,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  // PUT /product-spine/decisions — upsert one group's decision.
  router.put('/decisions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = putSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });

      const { lobId, component, groupKey, status, comment } = parsed.data;
      // The LOB node must belong to the tenant's active company (tenant walk).
      const lob = await prisma.productNode.findFirst({
        where: { id: lobId, companyId: company.id },
        select: { id: true },
      });
      if (!lob) return res.status(404).json({ error: 'Unknown LOB node' });

      const saved = await prisma.productNormalizationDecision.upsert({
        where: { lobNodeId_groupKey: { lobNodeId: lobId, groupKey } },
        create: {
          tenantId: req.tenantId,
          companyId: company.id,
          lobNodeId: lobId,
          component,
          groupKey,
          status,
          comment: comment ?? null,
          decidedBy: req.user.email,
        },
        // An omitted comment keeps the existing note; an empty string clears it.
        update: {
          status,
          component,
          decidedBy: req.user.email,
          ...(comment !== undefined ? { comment: comment || null } : {}),
        },
        select: { groupKey: true, component: true, status: true, comment: true, updatedAt: true },
      });
      res.json({
        groupKey: saved.groupKey,
        component: saved.component,
        status: saved.status,
        comment: saved.comment,
        decidedAt: saved.updatedAt,
      });
    } catch (e) {
      next(e);
    }
  });
}
