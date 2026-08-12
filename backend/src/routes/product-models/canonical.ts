// Canonical (north-star) product models (PM-08): CRUD + component linkage.
// Status (Planned | Building | Live) is rolled up on read from the linked
// components' migrationStatus — never denormalized.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { canonicalStatusOf } from '../../lib/rationalization.js';
import { logAudit, computeDiff } from '../../services/audit.js';

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  lineOfBusiness: z.string().nullable().optional(),
  ownerRoleId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

const patchSchema = createSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({
    // Re-link the components that constitute this canonical model (exclusive:
    // listed components point here, previously-linked others are detached).
    componentIds: z.array(z.string().min(1)).optional(),
  });

const CANONICAL_FIELDS = ['name', 'description', 'lineOfBusiness', 'ownerRoleId'] as const;

function toDto(cm: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  lineOfBusiness: string | null;
  position: number;
  illustrative: boolean;
  ownerRole: { displayValue: string } | null;
  components: { id: string; component: string; name: string; migrationStatus: string }[];
}) {
  return {
    id: cm.id,
    workspaceId: cm.workspaceId,
    name: cm.name,
    description: cm.description,
    lineOfBusiness: cm.lineOfBusiness,
    ownerRole: cm.ownerRole?.displayValue ?? null,
    position: cm.position,
    illustrative: cm.illustrative,
    status: canonicalStatusOf(cm.components.map((c) => c.migrationStatus)),
    components: cm.components.map((c) => ({
      id: c.id,
      component: c.component,
      name: c.name,
      migrationStatus: c.migrationStatus,
    })),
  };
}

const CANONICAL_INCLUDE = {
  ownerRole: { select: { displayValue: true } },
  components: {
    select: { id: true, component: true, name: true, migrationStatus: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

export function registerCanonicalRoutes(router: Router) {
  // GET /product-models/canonical-models?workspaceId= — canonical models with
  // their computed status roll-up and linked components.
  router.get('/canonical-models', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId =
        typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
      const models = await prisma.canonicalProductModel.findMany({
        where: { tenantId: req.tenantId, ...(workspaceId ? { workspaceId } : {}) },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: CANONICAL_INCLUDE,
      });
      res.json({ canonicalModels: models.map(toDto) });
    } catch (e) {
      next(e);
    }
  });

  // POST /product-models/canonical-models — create a north-star model.
  router.post('/canonical-models', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const { workspaceId, ...data } = parsed.data;
      const ws = await prisma.productModelWorkspace.findFirst({
        where: { id: workspaceId, tenantId: req.tenantId },
        select: { id: true, tenantId: true, companyId: true },
      });
      if (!ws) return res.status(404).json({ error: 'Not found' });
      const exists = await prisma.canonicalProductModel.findFirst({
        where: { workspaceId: ws.id, name: data.name },
        select: { id: true },
      });
      if (exists) {
        return res.status(409).json({ error: 'A canonical model with that name already exists' });
      }
      const created = await prisma.canonicalProductModel.create({
        data: { ...data, tenantId: ws.tenantId, companyId: ws.companyId, workspaceId: ws.id },
        include: CANONICAL_INCLUDE,
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'ProductModelWorkspace',
        entityId: ws.id,
        action: 'CREATE_CANONICAL_MODEL',
        diff: { subject: created.name },
      });
      res.status(201).json(toDto(created));
    } catch (e) {
      next(e);
    }
  });

  // PATCH /product-models/canonical-models/:id — edit + re-link components.
  router.patch('/canonical-models/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const { componentIds, ...data } = parsed.data;
      const before = await prisma.canonicalProductModel.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });

      if (componentIds) {
        // Every listed component must live on the same board.
        const owned = await prisma.productModelComponent.count({
          where: {
            id: { in: componentIds },
            tenantId: req.tenantId,
            workspaceId: before.workspaceId,
          },
        });
        if (owned !== componentIds.length) {
          return res.status(400).json({ error: 'Unknown componentIds' });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (componentIds) {
          await tx.productModelComponent.updateMany({
            where: { canonicalModelId: before.id },
            data: { canonicalModelId: null },
          });
          await tx.productModelComponent.updateMany({
            where: { id: { in: componentIds } },
            data: { canonicalModelId: before.id },
          });
        }
        return tx.canonicalProductModel.update({
          where: { id: before.id },
          data,
          include: CANONICAL_INCLUDE,
        });
      });

      const changes = computeDiff(before, updated, [...CANONICAL_FIELDS]);
      if (Object.keys(changes).length || componentIds) {
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ProductModelWorkspace',
          entityId: updated.workspaceId,
          action: 'UPDATE_CANONICAL_MODEL',
          diff: {
            subject: updated.name,
            changes,
            ...(componentIds ? { componentsLinked: componentIds.length } : {}),
          },
        });
      }
      res.json(toDto(updated));
    } catch (e) {
      next(e);
    }
  });

  // DELETE /product-models/canonical-models/:id — retire a north-star model
  // (plan §2-C CRUD). Linked components detach via the FK's SetNull — their
  // rows (and findings) are untouched. Tenant walk → 404, never 403; audited.
  router.delete(
    '/canonical-models/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const before = await prisma.canonicalProductModel.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          select: { id: true, workspaceId: true, name: true },
        });
        if (!before) return res.status(404).json({ error: 'Not found' });
        await prisma.canonicalProductModel.delete({ where: { id: before.id } });
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ProductModelWorkspace',
          entityId: before.workspaceId,
          action: 'DELETE_CANONICAL_MODEL',
          diff: { subject: before.name },
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );

  // GET /product-models/anatomy-catalog?component=&scope= — the reference
  // taxonomy (per component × scope × view, incl. MISPLACED rows).
  router.get('/anatomy-catalog', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await prisma.company.findFirst({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!company) return res.status(404).json({ error: 'No company found' });
      const component = typeof req.query.component === 'string' ? req.query.component : undefined;
      const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
      const rows = await prisma.productModelAnatomyCategory.findMany({
        where: {
          companyId: company.id,
          ...(component ? { component } : {}),
          ...(scope ? { scope } : {}),
        },
        orderBy: [{ component: 'asc' }, { scope: 'asc' }, { view: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          component: true,
          scope: true,
          view: true,
          slug: true,
          name: true,
          description: true,
          recommendedComponent: true,
        },
      });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });
}
