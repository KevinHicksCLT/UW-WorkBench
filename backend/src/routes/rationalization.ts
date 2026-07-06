import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { LAYERS, progressOf, STATUS_WEIGHT } from '../lib/rationalization.js';
import { logAudit, computeDiff } from '../services/audit.js';

// "Evergreen" Application Rationalization — read API for the value-stream board.
// An application's value stream is broken into business-process STAGES (chevrons);
// each stage's code is decomposed by IT layer into findings, grouped into CAPDAN
// categories (Common | Different | Relocate | Eliminate). Migration status rolls
// up into progress. Read-only here; edits flow through the generic /admin CRUD.

const router = Router();
router.use(requireAuth);
// Rationalization lives on the Applications tab; method-derived CRUD replaces
// the old per-route requireRole('ADMIN','MANAGER') write guards.
router.use(requirePermission('applications'));

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

function capdanCounts(rows: { capdan: string }[]) {
  const m: Record<string, number> = { Common: 0, Different: 0, Relocate: 0, Eliminate: 0 };
  for (const r of rows) m[r.capdan] = (m[r.capdan] ?? 0) + 1;
  return m;
}

/** CSV query param → id list (empty array when absent). */
const csv = (v: unknown): string[] =>
  typeof v === 'string' && v.trim()
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * WR-01 roles lens: roles → the tasks they own/participate in (NodeRole) →
 * the L2 value streams above those tasks (closure) — the streams a role
 * actually works in. Batched: two queries + one level lookup, no fan-out.
 */
async function valueStreamIdsForRoles(companyId: string, roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const links = await prisma.nodeRole.findMany({
    where: { companyId, roleId: { in: roleIds } },
    select: { processNodeId: true },
  });
  const nodeIds = [...new Set(links.map((l) => l.processNodeId))];
  if (nodeIds.length === 0) return [];
  const l2 = await prisma.processNode.findMany({
    where: {
      companyId,
      processLevelType: { levelNumber: 2 },
      ancestorEdges: { some: { descendantId: { in: nodeIds } } },
    },
    select: { id: true },
  });
  return l2.map((n) => n.id);
}

// GET /rationalization — value-stream stages (chevrons) for the active company,
// ordered along the stream, each with its rollup. Powers the chevron flow.
// WR-01 lens filters: ?applicationIds=a,b · ?valueStreamIds=v1,v2 (L2 node
// ids) · ?roleIds=r1,r2 (roles → owned/participated tasks → their L2 streams).
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const applicationIds = csv(req.query.applicationIds);
    const roleIds = csv(req.query.roleIds);
    let valueStreamIds = csv(req.query.valueStreamIds);
    if (roleIds.length > 0) {
      const fromRoles = await valueStreamIdsForRoles(companyId, roleIds);
      valueStreamIds = [...new Set([...valueStreamIds, ...fromRoles])];
      // A role lens that resolves to no streams must return no boards, not all.
      if (valueStreamIds.length === 0) return res.json([]);
    }

    const stages = await prisma.rationalizationWorkspace.findMany({
      where: {
        tenantId: req.tenantId,
        companyId,
        ...(applicationIds.length > 0 ? { applicationId: { in: applicationIds } } : {}),
        ...(valueStreamIds.length > 0 ? { valueStreamNodeId: { in: valueStreamIds } } : {}),
      },
      orderBy: [{ stageOrder: 'asc' }, { name: 'asc' }],
      include: { capabilities: { select: { migrationStatus: true, capdan: true } } },
    });

    res.json(
      stages.map((s) => ({
        id: s.id,
        name: s.name,
        application: s.application,
        applicationId: s.applicationId,
        valueStreamNodeId: s.valueStreamNodeId,
        stageOrder: s.stageOrder,
        businessProcess: s.businessProcess,
        status: s.status,
        illustrative: s.illustrative,
        findings: s.capabilities.length,
        byCapdan: capdanCounts(s.capabilities),
        progress: progressOf(s.capabilities.map((c) => c.migrationStatus)),
      })),
    );
  } catch (e) {
    next(e);
  }
});

// POST /rationalization/initiatives — scaffold a new initiative (application)
// with one starter stage: 2 placeholder legacy apps, the five per-layer CAPDAN
// components, and five layer-appropriate green-field targets (no findings yet).
// Findings are then authored via the generic /admin CRUD.
const GF_NEW: Record<string, { suffix: string; kind: string; tech: string; owner: string }> = {
  UI: {
    suffix: 'Web App',
    kind: 'Web App',
    tech: 'React 18 + TypeScript',
    owner: 'UX Engineering',
  },
  Integration: {
    suffix: 'API Gateway',
    kind: 'API Service',
    tech: 'Spring Cloud Gateway, Kafka',
    owner: 'Integration Squad',
  },
  'Business Service': {
    suffix: 'Domain Service',
    kind: 'Microservice',
    tech: 'Java 21 / Spring Boot',
    owner: 'Domain Squad',
  },
  Data: {
    suffix: 'Data Store',
    kind: 'Data Platform',
    tech: 'Postgres, Debezium CDC',
    owner: 'Data Platform Team',
  },
  Infrastructure: {
    suffix: 'Platform & Security',
    kind: 'Platform',
    tech: 'OPA, mTLS, OpenTelemetry',
    owner: 'Platform Security',
  },
};
const COMP_NEW: Record<string, string> = {
  UI: 'UI Components / Fields',
  Integration: 'Integration Logic',
  'Business Service': 'Business Service Logic',
  Data: 'Data Schema & Payload',
  Infrastructure: 'Infra Security Rules & Logs',
};

router.post('/initiatives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const stageName =
      typeof req.body?.stageName === 'string' && req.body.stageName.trim()
        ? req.body.stageName.trim()
        : 'Stage 1';
    if (!name) return res.status(400).json({ error: 'name is required' });

    const exists = await prisma.rationalizationWorkspace.findFirst({
      where: { tenantId: req.tenantId, companyId, application: name },
    });
    if (exists)
      return res.status(409).json({ error: 'An initiative with that name already exists' });

    const base = `rwn_${Date.now().toString(36)}`;
    const tenantId = req.tenantId;
    const ws = await prisma.rationalizationWorkspace.create({
      data: {
        id: base,
        tenantId,
        companyId,
        name: stageName,
        application: name,
        stageOrder: 0,
        businessProcess: stageName,
        description: `Rationalize the "${stageName}" stage of the ${name} value stream.`,
        status: 'Proposed',
        illustrative: true,
      },
    });
    await prisma.rationalizationApp.createMany({
      data: [0, 1].map((i) => ({
        id: `${base}_a${i}`,
        tenantId,
        companyId,
        workspaceId: ws.id,
        name: `Legacy App ${i + 1}`,
        disposition: 'Replace',
        position: i,
        illustrative: true,
      })),
    });
    await prisma.rationalizationMicroservice.createMany({
      // erd_v5: ownerRole is now an optional Role FK (ownerRoleId); the scaffold's
      // illustrative free-text owner is dropped (no free-text column).
      data: LAYERS.map((layer, li) => {
        const g = GF_NEW[layer];
        return {
          id: `${base}_s${li}`,
          tenantId,
          companyId,
          workspaceId: ws.id,
          name: `${stageName} ${g.suffix}`,
          kind: g.kind,
          status: 'Planned',
          techStack: g.tech,
          position: li,
          illustrative: true,
        };
      }),
    });
    await prisma.rationalizationComponent.createMany({
      data: LAYERS.map((layer, li) => ({
        id: `${base}_c${li}`,
        tenantId,
        companyId,
        workspaceId: ws.id,
        layer,
        name: COMP_NEW[layer],
        destination: `${stageName} ${GF_NEW[layer].suffix}`,
        microserviceId: `${base}_s${li}`,
        migrationStatus: 'Identified',
        illustrative: true,
      })),
    });

    res.status(201).json({ id: ws.id, application: name });
  } catch (e) {
    next(e);
  }
});

// GET /rationalization/anatomy-catalog — the WR-06 reference taxonomy: per
// layer × view (COMPONENT | BEHAVIOR | MISPLACED), what belongs and what must
// not be there. Registered BEFORE /:id so the literal path isn't swallowed.
router.get('/anatomy-catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const rows = await prisma.anatomyCategory.findMany({
      where: { companyId },
      orderBy: [{ layer: 'asc' }, { view: 'asc' }, { sortOrder: 'asc' }],
      select: {
        layer: true,
        view: true,
        name: true,
        description: true,
        recommendedLayer: true,
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /rationalization/:id — one stage's full decomposition: findings by layer,
// CAPDAN rollups, relocation targets, and per-finding code + migration detail.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.rationalizationWorkspace.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        apps: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
        microservices: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: { ownerRole: { select: { displayValue: true } } },
        },
        components: true,
        capabilities: true,
        screens: { orderBy: { name: 'asc' } },
      },
    });
    if (!w) return res.status(404).json({ error: 'Not found' });

    const caps = w.capabilities;
    const progressFor = (rows: { migrationStatus: string }[]) =>
      progressOf(rows.map((r) => r.migrationStatus));

    const byLayer = LAYERS.map((layer) => {
      const layerCaps = caps.filter((c) => c.layer === layer);
      return {
        layer,
        findings: layerCaps.length,
        progress: progressFor(layerCaps),
        byCapdan: capdanCounts(layerCaps),
        relocateOut: layerCaps.filter((c) => c.capdan === 'Relocate' && c.targetLayer).length,
      };
    });

    res.json({
      id: w.id,
      name: w.name,
      application: w.application,
      stageOrder: w.stageOrder,
      businessProcess: w.businessProcess,
      description: w.description,
      northstar: w.northstar,
      status: w.status,
      illustrative: w.illustrative,
      layout: w.layout ?? null,
      progress: progressFor(caps),
      counts: { findings: caps.length, ...capdanCounts(caps) },
      byLayer,
      // Brown-field apps (the grid columns).
      apps: w.apps.map((a) => ({
        id: a.id,
        name: a.name,
        techStack: a.techStack,
        disposition: a.disposition,
        position: a.position,
      })),
      // CAPDAN normalized components (one per layer), with destination service.
      components: w.components.map((c) => ({
        id: c.id,
        layer: c.layer,
        name: c.name,
        principle: c.principle,
        pattern: c.pattern,
        targetTech: c.targetTech,
        destination: c.destination,
        microserviceId: c.microserviceId,
        migrationStatus: c.migrationStatus,
      })),
      // Green-field target services.
      microservices: w.microservices.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        status: m.status,
        techStack: m.techStack,
        // ownerRole is the linked Role's display label (erd_v5 ownerRoleId FK).
        ownerRole: m.ownerRole?.displayValue ?? null,
      })),
      // Screens/modals of the legacy apps (WR-06: clickable per-L4 links).
      screens: w.screens.map((s) => ({
        id: s.id,
        appId: s.appId,
        name: s.name,
        kind: s.kind,
        url: s.url,
        processNodeId: s.processNodeId,
      })),
      // Flat findings; the board groups by (appId, layer, view, category).
      findings: caps.map((c) => ({
        id: c.id,
        appId: c.appId,
        layer: c.layer,
        category: c.category,
        view: c.view,
        screenRef: c.screenRef,
        plainSummary: c.plainSummary,
        recommendedLayer: c.recommendedLayer,
        capdan: c.capdan,
        targetLayer: c.targetLayer,
        name: c.name,
        codeRef: c.codeRef,
        migrationApproach: c.migrationApproach,
        rationale: c.rationale,
        effort: c.effort,
        complexity: c.complexity,
        migrationStatus: c.migrationStatus,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /rationalization/components/:id — edit a CAPDAN normalize component
// (the "Edit CAPDAN" panel). Every change is audited against the parent
// workspace so the workspace change log captures the full edit history.
const COMPONENT_FIELDS = [
  'name',
  'principle',
  'pattern',
  'targetTech',
  'destination',
  'migrationStatus',
] as const;

router.patch('/components/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const before = await prisma.rationalizationComponent.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!before) return res.status(404).json({ error: 'Not found' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const f of COMPONENT_FIELDS) {
      if (!(f in body)) continue;
      const v = body[f];
      if (v !== null && typeof v !== 'string')
        return res.status(400).json({ error: `${f} must be a string` });
      data[f] = typeof v === 'string' && v.trim() === '' ? null : v;
    }
    if (data.name === null) return res.status(400).json({ error: 'name is required' });
    if (typeof data.migrationStatus === 'string' && !(data.migrationStatus in STATUS_WEIGHT)) {
      return res.status(400).json({ error: 'Invalid migrationStatus' });
    }
    if (Object.keys(data).length === 0) return res.json(toComponentDto(before));

    const updated = await prisma.rationalizationComponent.update({
      where: { id: before.id },
      data,
    });
    const changes = computeDiff(before, updated, [...COMPONENT_FIELDS]);
    if (Object.keys(changes).length) {
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'RationalizationWorkspace',
        entityId: updated.workspaceId,
        action: 'UPDATE_CAPDAN',
        diff: { subject: updated.name, layer: updated.layer, changes },
      });
    }
    res.json(toComponentDto(updated));
  } catch (e) {
    next(e);
  }
});

function toComponentDto(c: {
  id: string;
  layer: string;
  name: string;
  principle: string | null;
  pattern: string | null;
  targetTech: string | null;
  destination: string | null;
  microserviceId: string | null;
  migrationStatus: string;
}) {
  return {
    id: c.id,
    layer: c.layer,
    name: c.name,
    principle: c.principle,
    pattern: c.pattern,
    targetTech: c.targetTech,
    destination: c.destination,
    microserviceId: c.microserviceId,
    migrationStatus: c.migrationStatus,
  };
}

// Shared string-field patch: whitelist fields, blank → null, diff + audit
// against the parent workspace so every box edit lands in the change log.
async function patchBoxEntity(
  req: Request,
  res: Response,
  load: () => Promise<
    ({ id: string; workspaceId: string; name: string } & Record<string, unknown>) | null
  >,
  update: (
    id: string,
    data: Record<string, unknown>,
  ) => Promise<{ id: string; workspaceId: string; name: string } & Record<string, unknown>>,
  fields: readonly string[],
  action: string,
) {
  const before = await load();
  if (!before) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v !== null && typeof v !== 'string') {
      res.status(400).json({ error: `${f} must be a string` });
      return null;
    }
    data[f] = typeof v === 'string' && v.trim() === '' ? null : v;
  }
  if (data.name === null) {
    res.status(400).json({ error: 'name is required' });
    return null;
  }
  if (Object.keys(data).length === 0) return before;
  const updated = await update(before.id, data);
  const changes = computeDiff(before, updated, [...fields]);
  if (Object.keys(changes).length) {
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'RationalizationWorkspace',
      entityId: updated.workspaceId,
      action,
      diff: { subject: updated.name, changes },
    });
  }
  return updated;
}

// PATCH /rationalization/apps/:id — edit a brown-field legacy app (column).
const APP_FIELDS = [
  'name',
  'techStack',
  'disposition',
  'vendor',
  'hosting',
  'criticality',
] as const;
router.patch('/apps/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await patchBoxEntity(
      req,
      res,
      () =>
        prisma.rationalizationApp.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        }),
      (id, data) => prisma.rationalizationApp.update({ where: { id }, data }),
      APP_FIELDS,
      'UPDATE_BROWNFIELD',
    );
    if (updated)
      res.json({
        id: updated.id,
        name: updated.name,
        techStack: updated.techStack ?? null,
        disposition: updated.disposition ?? null,
        position: updated.position,
      });
  } catch (e) {
    next(e);
  }
});

// PATCH /rationalization/microservices/:id — edit a green-field target service.
// ownerRole is now an optional Role FK (ownerRoleId), not free text, so it is no
// longer a directly-patchable string field on this box.
const MS_FIELDS = ['name', 'kind', 'status', 'techStack'] as const;
router.patch('/microservices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await patchBoxEntity(
      req,
      res,
      () =>
        prisma.rationalizationMicroservice.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        }),
      (id, data) => prisma.rationalizationMicroservice.update({ where: { id }, data }),
      MS_FIELDS,
      'UPDATE_GREENFIELD',
    );
    if (updated)
      res.json({
        id: updated.id,
        name: updated.name,
        kind: updated.kind,
        status: updated.status,
        techStack: updated.techStack ?? null,
        ownerRole: null,
      });
  } catch (e) {
    next(e);
  }
});

// POST /rationalization/:id/layout — commit the user-curated board overlay
// (node positions + added/removed arrows). The submitted `changes` list is the
// commit: it is recorded in the workspace change log so the history reads like
// a commit tree. Stores the full overlay so the board restores on reload.
router.post('/:id/layout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.rationalizationWorkspace.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { id: true },
    });
    if (!w) return res.status(404).json({ error: 'Not found' });

    const body = (req.body ?? {}) as { layout?: unknown; changes?: unknown };
    const raw = (body.layout ?? {}) as Record<string, unknown>;
    if (typeof raw !== 'object' || Array.isArray(raw))
      return res.status(400).json({ error: 'layout must be an object' });
    // Normalize to the known overlay shape; ignore anything unexpected.
    const layout = {
      positions:
        raw.positions && typeof raw.positions === 'object' && !Array.isArray(raw.positions)
          ? raw.positions
          : {},
      addedEdges: Array.isArray(raw.addedEdges) ? raw.addedEdges : [],
      removedEdges: Array.isArray(raw.removedEdges)
        ? raw.removedEdges.filter((x) => typeof x === 'string')
        : [],
    };
    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 200) : [];

    await prisma.rationalizationWorkspace.update({ where: { id: w.id }, data: { layout } });

    if (changes.length) {
      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'RationalizationWorkspace',
        entityId: w.id,
        action: 'COMMIT_BOARD',
        diff: {
          summary: `${changes.length} board change${changes.length === 1 ? '' : 's'}`,
          changes,
        },
      });
    }
    res.json({ ok: true, layout });
  } catch (e) {
    next(e);
  }
});

export default router;
