// Board reads + initiative scaffolding + the board layout commit: the chevron
// list (with WR-01 lens filters), the per-stage full decomposition, the
// new-initiative starter stage, and the user-curated layout overlay.
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { LAYERS, progressOf } from '../../lib/rationalization.js';
import { logAudit } from '../../services/audit.js';
import { activeCompanyId, capdanCounts, csv, valueStreamIdsForRoles } from './helpers.js';

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

export function registerBoardRoutes(router: Router) {
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
        // Brown-field apps (the grid columns) + shared services (own lane, WR-15).
        apps: w.apps.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
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
          sharedServiceId: c.sharedServiceId,
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
}
