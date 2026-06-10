import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ENTITY_LIST, getEntity, buildData, companyWhere, coerceValue, type AdminEntity } from '../lib/adminRegistry.js';
import { logAudit, computeDiff } from '../services/audit.js';
import { recomputeInitiative } from '../services/portfolioRollup.js';
import { runValidations } from '../services/validations.js';
import { syncSubProcessNode } from '../services/nodeSync.js';

// Line items whose writes change an initiative's denormalized money rollup, so the
// admin recomputes the parent after create/update/delete (audit A3/ARCH-8).
const RECOMPUTE_MODELS = new Set(['benefitLine', 'costLine']);
function maybeRecompute(entity: AdminEntity, row: { initiativeId?: string } | null) {
  if (row?.initiativeId && RECOMPUTE_MODELS.has(entity.model)) void recomputeInitiative(row.initiativeId);
}

// Entities whose rows have a DERIVED copy in the unified Node graph — refresh it
// after any admin write so the map/builder never render stale detail.
function maybeSyncNode(entity: AdminEntity, action: 'CREATE' | 'UPDATE' | 'DELETE', row: Record<string, any> | null) {
  if (row && entity.slug === 'subValueStream') void syncSubProcessNode(action, row as any);
}

// tenantId filter fragment — empty for tenant-less line items (isolation comes from
// the company/parent scope instead).
function tenantWhere(req: Request, entity: AdminEntity): Record<string, unknown> {
  return entity.hasTenantId === false ? {} : { tenantId: req.tenantId };
}

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
  return companyWhere(entity, cid, req.tenantId);
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

// PATCH /admin/company/:id/dashboard — save the Home-dashboard layout (the
// ordered list of widget ids chosen in Data Admin → Home). dashboardConfig is
// structured JSON, so it bypasses the generic scalar CRUD and is handled here.
// Registered before the generic routes; tenant-scoped, audited.
router.patch('/company/:id/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { id: true, dashboardConfig: true },
    });
    if (!company) return res.status(404).json({ error: 'Not found' });

    const raw = (req.body ?? {}).widgets;
    if (!Array.isArray(raw) || !raw.every((w) => typeof w === 'string' && w.trim())) {
      return res.status(400).json({ error: 'widgets must be an array of widget id strings' });
    }
    // Order-preserving de-dupe; cap to a sane number of widgets.
    const widgets = [...new Set(raw.map((w) => w.trim()))].slice(0, 40);
    // Which stats the "Model footprint" card lists (Data Admin → Home). The
    // valid keys are the dashboard totals the frontend catalog exposes.
    const FOOTPRINT_KEYS = new Set(['processSteps', 'applications', 'departments', 'domains', 'valueStreams', 'deliverables', 'tasks', 'metrics']);
    const fpRaw = (req.body ?? {}).footprintStats;
    let footprintStats: string[] | undefined;
    if (fpRaw !== undefined) {
      if (!Array.isArray(fpRaw) || !fpRaw.every((k) => typeof k === 'string' && FOOTPRINT_KEYS.has(k))) {
        return res.status(400).json({ error: `footprintStats must be an array of ${[...FOOTPRINT_KEYS].join(' | ')}` });
      }
      footprintStats = [...new Set(fpRaw as string[])];
    } else {
      footprintStats = (company.dashboardConfig as { footprintStats?: string[] } | null)?.footprintStats;
    }
    const config = footprintStats ? { widgets, footprintStats } : { widgets };

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { dashboardConfig: config },
      select: { id: true, dashboardConfig: true },
    });

    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'company',
      entityId: company.id,
      action: 'UPDATE',
      diff: { dashboardConfig: { from: company.dashboardConfig ?? null, to: config } },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// GET /admin/validations — read-only data-health checks for the active company
// (audit A2). Registered before the generic /:entity route. ADMIN-only.
router.get('/validations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!cid) return res.status(400).json({ error: 'companyId query parameter is required' });
    const company = await prisma.company.findFirst({ where: { id: cid, tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'Unknown company for this tenant' });
    res.json(await runValidations(cid));
  } catch (e) {
    next(e);
  }
});

// ─── AI-adoption (Telemetry) per value-stream Level node ───────────────────
// Flat editor surface (audit D3/A1): one row per canonical value-stream node
// (levelNumber = 3) with the four AI autonomy modes. Registered before /:entity.
const AI_LEVELS = new Set(['not_used', 'pilot', 'emerging', 'scaling', 'embedded']);
const AI_FIELDS = ['aiAssist', 'aiAugment', 'aiWorkflow', 'aiAutonomous'] as const;
const AI_MODES = ['assistant', 'augmented', 'workflow', 'agent'] as const;

// Validate + normalize a NodeAiAdoption.useCases payload: an object keyed by AI
// mode, each an array of { title, persona, detail } strings. Returns the
// normalized shape (all four modes present), or null when malformed.
type AiUseCase = { title: string; persona: string; detail: string };
type AiUseCasesByMode = Record<(typeof AI_MODES)[number], AiUseCase[]>;
function parseUseCases(raw: unknown): AiUseCasesByMode | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: AiUseCasesByMode = { assistant: [], augmented: [], workflow: [], agent: [] };
  for (const mode of AI_MODES) {
    const list = (raw as Record<string, unknown>)[mode] ?? [];
    if (!Array.isArray(list)) return null;
    for (const uc of list) {
      if (typeof uc !== 'object' || uc === null) return null;
      const { title, persona, detail } = uc as Record<string, unknown>;
      if (typeof title !== 'string' || !title.trim()) return null;
      if (typeof persona !== 'string' || typeof detail !== 'string') return null;
      out[mode].push({ title: title.trim(), persona, detail });
    }
  }
  return out;
}

// Per-mode adoption statistics: { <mode>: { rolesUsingPct, efficiencyGainPct } }, 0–100.
type AiStatsByMode = Record<(typeof AI_MODES)[number], { rolesUsingPct: number; efficiencyGainPct: number }>;
function parseStats(raw: unknown): AiStatsByMode | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const pct = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);
  const out = {} as AiStatsByMode;
  for (const mode of AI_MODES) {
    const s = (raw as Record<string, unknown>)[mode] ?? {};
    if (typeof s !== 'object' || s === null) return null;
    const roles = pct((s as Record<string, unknown>).rolesUsingPct ?? 0);
    const eff = pct((s as Record<string, unknown>).efficiencyGainPct ?? 0);
    if (roles === null || eff === null) return null;
    out[mode] = { rolesUsingPct: roles, efficiencyGainPct: eff };
  }
  return out;
}

async function companyForReq(req: Request): Promise<string | null> {
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) return null;
  const company = await prisma.company.findFirst({ where: { id: cid, tenantId: req.tenantId }, select: { id: true } });
  return company ? cid : null;
}

router.get('/ai-adoption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    // One row per canonical value_stream NODE; adoption stores on the node-keyed
    // NodeAiAdoption table (the legacy Level-keyed copy is retired).
    const nodes = await prisma.node.findMany({
      where: { companyId: cid, typeKey: 'value_stream' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parent: { select: { name: true } }, aiAdoption: true },
    });
    res.json({
      levels: [...AI_LEVELS],
      rows: nodes.map((n) => ({
        levelId: n.id, // canonical node id (PATCH accepts it)
        name: n.name,
        domain: n.parent?.name ?? null,
        aiAssist: n.aiAdoption?.aiAssist ?? 'not_used',
        aiAugment: n.aiAdoption?.aiAugment ?? 'not_used',
        aiWorkflow: n.aiAdoption?.aiWorkflow ?? 'not_used',
        aiAutonomous: n.aiAdoption?.aiAutonomous ?? 'not_used',
        useCases: n.aiAdoption?.useCases ?? null,
        stats: n.aiAdoption?.stats ?? null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/ai-adoption/:levelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    // The value_stream node id — adoption stores directly on NodeAiAdoption.
    const vsNode = await prisma.node.findFirst({ where: { id: req.params.levelId, companyId: cid, typeKey: 'value_stream' }, select: { id: true } });
    if (!vsNode) return res.status(404).json({ error: 'Not found' });
    const node = { id: vsNode.id };

    const data: Record<string, any> = {};
    for (const f of AI_FIELDS) {
      const v = (req.body ?? {})[f];
      if (v === undefined) continue;
      if (typeof v !== 'string' || !AI_LEVELS.has(v)) return res.status(400).json({ error: `${f} must be one of ${[...AI_LEVELS].join(' | ')}` });
      data[f] = v;
    }
    // Per-mode use cases (the content the Active AI drill-in renders).
    if ((req.body ?? {}).useCases !== undefined) {
      const parsed = parseUseCases(req.body.useCases);
      if (!parsed) return res.status(400).json({ error: 'useCases must be { assistant|augmented|workflow|agent: [{ title, persona, detail }] } with non-empty titles' });
      data.useCases = parsed;
    }
    // Per-mode adoption statistics ({ <mode>: { rolesUsingPct, efficiencyGainPct } }, 0–100).
    if ((req.body ?? {}).stats !== undefined) {
      const parsed = parseStats(req.body.stats);
      if (!parsed) return res.status(400).json({ error: 'stats must be { assistant|augmented|workflow|agent: { rolesUsingPct, efficiencyGainPct } } with values 0–100' });
      data.stats = parsed;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No AI-adoption fields to update' });

    const before = await prisma.nodeAiAdoption.findUnique({ where: { nodeId: node.id } });
    const updated = await prisma.nodeAiAdoption.upsert({
      where: { nodeId: node.id },
      create: { nodeId: node.id, ...data },
      update: data,
    });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'LevelAiAdoption', entityId: node.id,
      action: before ? 'UPDATE' : 'CREATE', diff: data,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
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
    maybeSyncNode(entity, 'CREATE', created);
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
    maybeSyncNode(entity, 'UPDATE', updated);
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


    const scope = readScope(req, res, entity);
    if (scope === null) return;
    const before = await delegate(entity).findFirst({ where: { id: req.params.id, ...tenantWhere(req, entity), ...scope } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    await delegate(entity).delete({ where: { id: req.params.id } });
    maybeRecompute(entity, before);
    maybeSyncNode(entity, 'DELETE', before);
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
