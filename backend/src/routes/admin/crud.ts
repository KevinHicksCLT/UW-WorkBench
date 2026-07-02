/**
 * Admin generic CRUD — the /:entity and /:entity/:id catch-all handlers over
 * every registered admin entity (lib/adminRegistry).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { buildData, coerceValue } from '../../lib/adminRegistry.js';
import { logAudit, computeDiff } from '../../services/audit.js';
import { maybeRecompute, tenantWhere, delegate, resolve, readScope, applyWriteScope, handlePrismaError } from './helpers.js';

/** Registers the generic /:entity CRUD catch-alls (after the specific routes). */
export function registerCrudRoutes(router: Router): void {
router.get('/:entity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = resolve(req, res);
    if (!entity) return;

    // Pagination accepts either ?take/?skip or the legacy ?limit/?offset.
    const take = Math.min(Number(req.query.take ?? req.query.limit) || 50, 200);
    const skip = Number(req.query.skip ?? req.query.offset) || 0;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';


    const scope = readScope(req, res, entity);
    if (scope === null) return;

    const where: Record<string, unknown> = { ...tenantWhere(req, entity), ...scope };
    if (search && entity.labelField !== 'id') {
      where[entity.labelField] = { contains: search, mode: 'insensitive' };
    }
    // Optional exact-match field filters: ?f_<field>=<value> for any registered
    // field (e.g. the Sub-processes section lists SubValueStream with f_level=4).
    for (const f of entity.fields) {
      const raw = req.query[`f_${f.name}`];
      if (typeof raw !== 'string' || raw === '') continue;
      try {
        const v = coerceValue(f, raw);
        if (v !== undefined) where[f.name] = v;
      } catch {
        return res.status(400).json({ error: `Invalid filter value for ${f.name}` });
      }
    }

    // Order by the label field when there is one; otherwise newest-first by
    // createdAt, falling back to id for tables (some junctions) that lack createdAt.
    const orderBy = entity.labelField !== 'id'
      ? { [entity.labelField]: 'asc' }
      : entity.hasCreatedAt ? { createdAt: 'desc' } : { id: 'desc' };

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
    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const row = await delegate(entity).findFirst({ where: { id: req.params.id, ...tenantWhere(req, entity), ...scope } });
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


    let data: Record<string, unknown>;
    try {
      data = buildData(entity, req.body ?? {}, false);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    if (entity.hasTenantId !== false) data.tenantId = req.tenantId;
    if (!(await applyWriteScope(req, res, entity, data))) return;

    const created = await delegate(entity).create({ data });
    maybeRecompute(entity, created);
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: entity.model,
      entityId: created.id as string,
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


    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const before = await delegate(entity).findFirst({ where: { id: req.params.id, ...tenantWhere(req, entity), ...scope } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    let data: Record<string, unknown>;
    try {
      data = buildData(entity, req.body ?? {}, true);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    if (!(await applyWriteScope(req, res, entity, data))) return;

    const updated = await delegate(entity).update({ where: { id: req.params.id }, data });
    maybeRecompute(entity, updated);
    const diff = computeDiff(before, updated, entity.fields.map((f) => f.name));
    if (Object.keys(diff).length) {
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: entity.model,
        entityId: updated.id as string,
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


    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const before = await delegate(entity).findFirst({ where: { id: req.params.id, ...tenantWhere(req, entity), ...scope } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    await delegate(entity).delete({ where: { id: req.params.id } });
    maybeRecompute(entity, before);
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
}
