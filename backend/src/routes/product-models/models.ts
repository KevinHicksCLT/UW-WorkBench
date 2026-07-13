// Legacy product models — the master list behind the /product-models page
// (PM-03) and CRUD for the board's left-hand columns. Mirrors the
// applications-catalog read pattern: one batched query, aggregate in memory.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { activeCompanyId, DISPOSITIONS } from './helpers.js';

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  sourceSystem: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  geography: z.string().nullable().optional(),
  disposition: z.enum(DISPOSITIONS).optional(),
  position: z.number().int().min(0).optional(),
});

const patchSchema = createSchema.omit({ workspaceId: true }).partial();

const MODEL_FIELDS = [
  'name',
  'description',
  'sourceSystem',
  'segment',
  'geography',
  'disposition',
] as const;

export function registerModelRoutes(router: Router) {
  // GET /product-models — every legacy product model for the active company
  // with its workspace membership and finding count (§6.2 DTO).
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const models = await prisma.legacyProductModel.findMany({
        where: { tenantId: req.tenantId, companyId },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: {
          workspace: { select: { id: true, name: true } },
          _count: { select: { findings: true } },
        },
      });
      res.json({
        productModels: models.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          sourceSystem: m.sourceSystem,
          segment: m.segment,
          geography: m.geography,
          disposition: m.disposition,
          workspaces: [{ id: m.workspace.id, name: m.workspace.name }],
          findingCount: m._count.findings,
          illustrative: m.illustrative,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  // POST /product-models — add a legacy product model to a workspace.
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
      const exists = await prisma.legacyProductModel.findFirst({
        where: { workspaceId: ws.id, name: data.name },
        select: { id: true },
      });
      if (exists) {
        return res.status(409).json({ error: 'A product model with that name already exists' });
      }
      const created = await prisma.legacyProductModel.create({
        data: { ...data, tenantId: ws.tenantId, companyId: ws.companyId, workspaceId: ws.id },
      });
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'ProductModelWorkspace',
        entityId: ws.id,
        action: 'CREATE_LEGACY_MODEL',
        diff: { subject: created.name },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  });

  // PATCH /product-models/:id — edit a legacy product model (column panel).
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const before = await prisma.legacyProductModel.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!before) return res.status(404).json({ error: 'Not found' });
      if (Object.keys(parsed.data).length === 0) return res.json(before);

      const updated = await prisma.legacyProductModel.update({
        where: { id: before.id },
        data: parsed.data,
      });
      const changes = computeDiff(before, updated, [...MODEL_FIELDS]);
      if (Object.keys(changes).length) {
        logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ProductModelWorkspace',
          entityId: updated.workspaceId,
          action: 'UPDATE_LEGACY_MODEL',
          diff: { subject: updated.name, changes },
        });
      }
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });
}
