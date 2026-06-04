import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ENTITY_LIST, getEntity, buildData, companyWhere, type AdminEntity } from '../lib/adminRegistry.js';
import { VS_MODEL, vsList, vsGetOne, vsCreate, vsUpdate, vsDelete } from '../lib/valueStreamAdmin.js';
import { logAudit, computeDiff } from '../services/audit.js';

// Generic, schema-driven CRUD over every tenant-scoped operating-model table.
// One router serves all ~25 entities: the registry (derived from Prisma DMMF)
// describes each entity's editable fields; this router enforces tenant scoping,
// type coercion, and audit logging uniformly. ADMIN-only.

const router = Router();
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// Typed access to a dynamic Prisma model delegate.
function modelDelegate(slug: string) {
  return (prisma as unknown as Record<string, any>)[slug];
}
function delegate(entity: AdminEntity) {
  return modelDelegate(entity.model);
}

// Resolve `:entity` once; 404 on an unknown slug.
function resolve(req: Request, res: Response): AdminEntity | null {
  const entity = getEntity(req.params.entity);
  if (!entity) {
    res.status(404).json({ error: `Unknown entity: ${req.params.entity}` });
    return null;
  }
  return entity;
}

// Company scoping for reads. Returns the `where` fragment that isolates the
// active company, or null (after sending 400) when a company-scoped entity is
// requested without a companyId. The Company table itself scopes to {} (tenant).
function readScope(req: Request, res: Response, entity: AdminEntity): Record<string, unknown> | null {
  if (!entity.companyVia) return {};
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) {
    res.status(400).json({ error: 'companyId query parameter is required' });
    return null;
  }
  return companyWhere(entity, cid);
}

// The active companyId, or null after sending a 400 (used by the unified
// value-stream handlers, which always scope to a company).
function requireCompanyId(req: Request, res: Response): string | null {
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) {
    res.status(400).json({ error: 'companyId query parameter is required' });
    return null;
  }
  return cid;
}

// Company scoping for writes. Verifies the company belongs to the tenant, sets
// companyId for direct-scoped entities, and validates that a chosen parent FK
// (transitive entities) belongs to the active company. Returns false (after
// sending the error response) when scoping fails.
async function applyWriteScope(req: Request, res: Response, entity: AdminEntity, data: Record<string, unknown>): Promise<boolean> {
  const v = entity.companyVia;
  if (!v) return true; // Company table — tenant scoped only.
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) { res.status(400).json({ error: 'companyId query parameter is required' }); return false; }
  const company = await prisma.company.findFirst({ where: { id: cid, tenantId: req.tenantId }, select: { id: true } });
  if (!company) { res.status(400).json({ error: 'Unknown company for this tenant' }); return false; }

  if (v.kind === 'direct') {
    data.companyId = cid;
  } else if (data[v.scalarField] != null) {
    const parent = await modelDelegate(v.targetSlug).findFirst({
      where: { id: data[v.scalarField], tenantId: req.tenantId, companyId: cid },
      select: { id: true },
    });
    if (!parent) {
      res.status(400).json({ error: `Selected ${v.objectField} does not belong to the active company` });
      return false;
    }
  }
  return true;
}

// GET /admin/_meta — field metadata for every editable entity (drives the UI).
router.get('/_meta', (_req: Request, res: Response) => {
  res.json({ entities: ENTITY_LIST });
});

// GET /admin/:entity — paginated, tenant-scoped list with optional search on
// the entity's label field.
router.get('/:entity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;

    const take = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Number(req.query.offset) || 0;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (entity.model === VS_MODEL) {
      const cid = requireCompanyId(req, res);
      if (!cid) return;
      return res.json(await vsList(req.tenantId, cid, search, take, skip));
    }

    const scope = readScope(req, res, entity);
    if (scope === null) return;

    const where: Record<string, unknown> = { tenantId: req.tenantId, ...scope };
    if (search && entity.labelField !== 'id') {
      where[entity.labelField] = { contains: search, mode: 'insensitive' };
    }

    const orderBy = entity.labelField === 'id' ? { createdAt: 'desc' } : { [entity.labelField]: 'asc' };

    const [rows, total] = await Promise.all([
      delegate(entity).findMany({ where, orderBy, take, skip }),
      delegate(entity).count({ where }),
    ]);

    res.json({ rows, total, limit: take, offset: skip });
  } catch (e) {
    next(e);
  }
});

// GET /admin/:entity/:id — single record (tenant-scoped).
router.get('/:entity/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;
    if (entity.model === VS_MODEL) {
      const cid = requireCompanyId(req, res);
      if (!cid) return;
      const row = await vsGetOne(req.tenantId, cid, req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(row);
    }
    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const row = await delegate(entity).findFirst({ where: { id: req.params.id, tenantId: req.tenantId, ...scope } });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

// POST /admin/:entity — create. tenantId is always taken from the token, never
// the body. Audited as CREATE with the new field values.
router.post('/:entity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;

    if (entity.model === VS_MODEL) {
      const cid = requireCompanyId(req, res);
      if (!cid) return;
      const created = await vsCreate(req.tenantId, cid, req.user.email, req.body ?? {});
      return res.status(201).json(created);
    }

    let data: Record<string, unknown>;
    try {
      data = buildData(entity, req.body ?? {}, false);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    data.tenantId = req.tenantId;
    if (!(await applyWriteScope(req, res, entity, data))) return;

    const created = await delegate(entity).create({ data });
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: entity.model,
      entityId: created.id,
      action: 'CREATE',
      diff: Object.fromEntries(entity.fields.map((f) => [f.name, created[f.name] ?? null])),
    });
    res.status(201).json(created);
  } catch (e) {
    next(handlePrismaError(e));
  }
});

// PATCH /admin/:entity/:id — partial update. Audited as UPDATE with a
// field-level before/after diff.
router.patch('/:entity/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;

    if (entity.model === VS_MODEL) {
      const cid = requireCompanyId(req, res);
      if (!cid) return;
      const updated = await vsUpdate(req.tenantId, cid, req.user.email, req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }

    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const before = await delegate(entity).findFirst({ where: { id: req.params.id, tenantId: req.tenantId, ...scope } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    let data: Record<string, unknown>;
    try {
      data = buildData(entity, req.body ?? {}, true);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    if (!(await applyWriteScope(req, res, entity, data))) return;

    const updated = await delegate(entity).update({ where: { id: req.params.id }, data });
    const diff = computeDiff(before, updated, entity.fields.map((f) => f.name));
    if (Object.keys(diff).length) {
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: entity.model,
        entityId: updated.id,
        action: 'UPDATE',
        diff,
      });
    }
    res.json(updated);
  } catch (e) {
    next(handlePrismaError(e));
  }
});

// DELETE /admin/:entity/:id — delete. Audited as DELETE with the removed
// record's label snapshot.
router.delete('/:entity/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;

    if (entity.model === VS_MODEL) {
      const cid = requireCompanyId(req, res);
      if (!cid) return;
      const ok = await vsDelete(req.tenantId, cid, req.user.email, req.params.id);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      return res.status(204).end();
    }

    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const before = await delegate(entity).findFirst({ where: { id: req.params.id, tenantId: req.tenantId, ...scope } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    await delegate(entity).delete({ where: { id: req.params.id } });
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: entity.model,
      entityId: req.params.id,
      action: 'DELETE',
      diff: { [entity.labelField]: before[entity.labelField] ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(handlePrismaError(e));
  }
});

// Translate common Prisma write failures into clean 4xx errors; pass the rest
// through to the central handler.
function handlePrismaError(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = (e.meta?.target as string[] | undefined)?.join(', ');
      return Object.assign(new Error(`Duplicate value violates a unique constraint${target ? ` (${target})` : ''}`), { status: 400 });
    }
    if (e.code === 'P2003') {
      return Object.assign(new Error('Related record not found (invalid foreign key)'), { status: 400 });
    }
    if (e.code === 'P2025') {
      return Object.assign(new Error('Cannot delete: record is referenced by other rows, or no longer exists'), { status: 409 });
    }
  }
  return e;
}

export default router;
