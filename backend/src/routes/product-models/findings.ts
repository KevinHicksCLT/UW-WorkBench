// Product-model findings CRUD (PM-07): create atomic observations, reclassify
// scope (Common | Segment | Geography | Eliminate), set segment/geography
// values, link the target component, mark dead code. Audited against the
// parent workspace like every board edit.
import type { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { STATUS_WEIGHT } from '../../lib/rationalization.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { SCOPES } from './helpers.js';

const createSchema = z.object({
  workspaceId: z.string().min(1),
  legacyModelId: z.string().min(1),
  component: z.string().trim().min(1),
  name: z.string().trim().min(1),
  detail: z.string().nullable().optional(),
  scope: z.enum(SCOPES).optional(),
  segmentValue: z.string().nullable().optional(),
  geographyValue: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  anatomyCategoryId: z.string().nullable().optional(),
  targetComponentId: z.string().nullable().optional(),
});

const patchSchema = createSchema
  .omit({ workspaceId: true, legacyModelId: true })
  .partial()
  .extend({
    deadCode: z.boolean().optional(),
    migrationStatus: z.string().optional(),
    whyThisMoves: z
      .object({
        captured: z.string().optional(),
        sent: z.string().optional(),
        processed: z.string().optional(),
        validated: z.string().optional(),
        lands: z.string().optional(),
      })
      .nullable()
      .optional(),
  });

const FINDING_FIELDS = [
  'component',
  'name',
  'detail',
  'scope',
  'segmentValue',
  'geographyValue',
  'sourceRef',
  'anatomyCategoryId',
  'targetComponentId',
  'deadCode',
  'migrationStatus',
] as const;

/** Both linkable references must live on the same board/company (400 if not). */
async function validateLinks(
  res: Response,
  tenantId: string,
  workspaceId: string,
  companyId: string,
  data: { targetComponentId?: string | null; anatomyCategoryId?: string | null },
): Promise<boolean> {
  if (data.targetComponentId) {
    const target = await prisma.productModelComponent.findFirst({
      where: { id: data.targetComponentId, tenantId, workspaceId },
      select: { id: true },
    });
    if (!target) {
      res.status(400).json({ error: 'Unknown targetComponentId' });
      return false;
    }
  }
  if (data.anatomyCategoryId) {
    const cat = await prisma.productModelAnatomyCategory.findFirst({
      where: { id: data.anatomyCategoryId, tenantId, companyId },
      select: { id: true },
    });
    if (!cat) {
      res.status(400).json({ error: 'Unknown anatomyCategoryId' });
      return false;
    }
  }
  return true;
}

export function registerFindingRoutes(router: Router) {
  // POST /product-models/findings — author a new atomic finding on a legacy
  // product model's component row.
  router.post('/findings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const { workspaceId, legacyModelId, ...data } = parsed.data;
      const model = await prisma.legacyProductModel.findFirst({
        where: { id: legacyModelId, tenantId: req.tenantId, workspaceId },
        select: { id: true, tenantId: true, companyId: true, workspaceId: true, name: true },
      });
      if (!model) return res.status(404).json({ error: 'Not found' });
      if (!(await validateLinks(res, req.tenantId, model.workspaceId, model.companyId, data)))
        return;

      const created = await prisma.productModelFinding.create({
        data: {
          ...data,
          tenantId: model.tenantId,
          companyId: model.companyId,
          workspaceId: model.workspaceId,
          legacyModelId: model.id,
        },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'ProductModelWorkspace',
        entityId: model.workspaceId,
        action: 'CREATE_FINDING',
        diff: { subject: created.name, component: created.component, model: model.name },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  });

  // PATCH /product-models/findings/:id — reclassify / re-target / retire.
  router.patch('/findings/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const data = parsed.data;
      if (typeof data.migrationStatus === 'string' && !(data.migrationStatus in STATUS_WEIGHT)) {
        return res.status(400).json({ error: 'Invalid migrationStatus' });
      }
      const before = await prisma.productModelFinding.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });
      if (!(await validateLinks(res, req.tenantId, before.workspaceId, before.companyId, data)))
        return;
      if (Object.keys(data).length === 0) return res.json(before);

      // Nullable Json needs the Prisma null sentinel, not JS null.
      const { whyThisMoves, ...rest } = data;
      const updated = await prisma.productModelFinding.update({
        where: { id: before.id },
        data: {
          ...rest,
          ...(whyThisMoves !== undefined
            ? { whyThisMoves: whyThisMoves === null ? Prisma.DbNull : whyThisMoves }
            : {}),
        },
      });
      const changes = computeDiff(before, updated, [...FINDING_FIELDS]);
      if (Object.keys(changes).length) {
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ProductModelWorkspace',
          entityId: updated.workspaceId,
          action: 'UPDATE_FINDING',
          diff: { subject: updated.name, component: updated.component, changes },
        });
      }
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  // DELETE /product-models/findings/:id — remove an atomic finding (plan §2-C
  // CRUD). Tenant walk → 404, never 403; audited like the sibling PATCH.
  router.delete('/findings/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await prisma.productModelFinding.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        select: { id: true, workspaceId: true, name: true, component: true },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });
      await prisma.productModelFinding.delete({ where: { id: before.id } });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'ProductModelWorkspace',
        entityId: before.workspaceId,
        action: 'DELETE_FINDING',
        diff: { subject: before.name, component: before.component },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}
