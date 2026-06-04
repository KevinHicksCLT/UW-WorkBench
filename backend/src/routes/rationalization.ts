import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { LAYERS, progressOf } from '../lib/rationalization.js';

// "Evergreen" Application Rationalization — read API for the value-stream board.
// An application's value stream is broken into business-process STAGES (chevrons);
// each stage's code is decomposed by IT layer into findings, grouped into CAPDAN
// categories (Common | Different | Relocate | Eliminate). Migration status rolls
// up into progress. Read-only here; edits flow through the generic /admin CRUD.

const router = Router();
router.use(requireAuth);

const CAPDAN = ['Common', 'Different', 'Relocate', 'Eliminate'] as const;

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) { res.status(404).json({ error: 'No company found' }); return null; }
  return company.id;
}

function capdanCounts(rows: { capdan: string }[]) {
  const m: Record<string, number> = { Common: 0, Different: 0, Relocate: 0, Eliminate: 0 };
  for (const r of rows) m[r.capdan] = (m[r.capdan] ?? 0) + 1;
  return m;
}

// GET /rationalization — value-stream stages (chevrons) for the active company,
// ordered along the stream, each with its rollup. Powers the chevron flow.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    const stages = await prisma.rationalizationWorkspace.findMany({
      where: { tenantId: req.tenantId, companyId },
      orderBy: [{ stageOrder: 'asc' }, { name: 'asc' }],
      include: { capabilities: { select: { migrationStatus: true, capdan: true } } },
    });

    res.json(
      stages.map((s) => ({
        id: s.id,
        name: s.name,
        application: s.application,
        stageOrder: s.stageOrder,
        businessProcess: s.businessProcess,
        status: s.status,
        illustrative: s.illustrative,
        findings: s.capabilities.length,
        byCapdan: capdanCounts(s.capabilities),
        progress: progressOf(s.capabilities.map((c) => c.migrationStatus)),
      })),
    );
  } catch (e) { next(e); }
});

// POST /rationalization/initiatives — scaffold a new initiative (application)
// with one starter stage: 2 placeholder legacy apps, the five per-layer CAPDAN
// components, and five layer-appropriate green-field targets (no findings yet).
// Findings are then authored via the generic /admin CRUD.
const GF_NEW: Record<string, { suffix: string; kind: string; tech: string; owner: string }> = {
  UI: { suffix: 'Web App', kind: 'Web App', tech: 'React 18 + TypeScript', owner: 'UX Engineering' },
  Integration: { suffix: 'API Gateway', kind: 'API Service', tech: 'Spring Cloud Gateway, Kafka', owner: 'Integration Squad' },
  'Business Service': { suffix: 'Domain Service', kind: 'Microservice', tech: 'Java 21 / Spring Boot', owner: 'Domain Squad' },
  Data: { suffix: 'Data Store', kind: 'Data Platform', tech: 'Postgres, Debezium CDC', owner: 'Data Platform Team' },
  Infrastructure: { suffix: 'Platform & Security', kind: 'Platform', tech: 'OPA, mTLS, OpenTelemetry', owner: 'Platform Security' },
};
const COMP_NEW: Record<string, string> = {
  UI: 'UI Components / Fields', Integration: 'Integration Logic', 'Business Service': 'Business Service Logic',
  Data: 'Data Schema & Payload', Infrastructure: 'Infra Security Rules & Logs',
};

router.post('/initiatives', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const stageName = typeof req.body?.stageName === 'string' && req.body.stageName.trim() ? req.body.stageName.trim() : 'Stage 1';
    if (!name) return res.status(400).json({ error: 'name is required' });

    const exists = await prisma.rationalizationWorkspace.findFirst({ where: { tenantId: req.tenantId, companyId, application: name } });
    if (exists) return res.status(409).json({ error: 'An initiative with that name already exists' });

    const base = `rwn_${Date.now().toString(36)}`;
    const tenantId = req.tenantId;
    const ws = await prisma.rationalizationWorkspace.create({
      data: { id: base, tenantId, companyId, name: stageName, application: name, stageOrder: 0, businessProcess: stageName, description: `Rationalize the "${stageName}" stage of the ${name} value stream.`, status: 'Proposed', illustrative: true },
    });
    await prisma.rationalizationApp.createMany({
      data: [0, 1].map((i) => ({ id: `${base}_a${i}`, tenantId, companyId, workspaceId: ws.id, name: `Legacy App ${i + 1}`, disposition: 'Replace', position: i, illustrative: true })),
    });
    await prisma.rationalizationMicroservice.createMany({
      data: LAYERS.map((layer, li) => { const g = GF_NEW[layer]; return { id: `${base}_s${li}`, tenantId, companyId, workspaceId: ws.id, name: `${stageName} ${g.suffix}`, kind: g.kind, status: 'Planned', techStack: g.tech, ownerRole: g.owner, position: li, illustrative: true }; }),
    });
    await prisma.rationalizationComponent.createMany({
      data: LAYERS.map((layer, li) => ({ id: `${base}_c${li}`, tenantId, companyId, workspaceId: ws.id, layer, name: COMP_NEW[layer], destination: `${stageName} ${GF_NEW[layer].suffix}`, microserviceId: `${base}_s${li}`, migrationStatus: 'Identified', illustrative: true })),
    });

    res.status(201).json({ id: ws.id, application: name });
  } catch (e) { next(e); }
});

// GET /rationalization/:id — one stage's full decomposition: findings by layer,
// CAPDAN rollups, relocation targets, and per-finding code + migration detail.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.rationalizationWorkspace.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        apps: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
        microservices: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
        components: true,
        capabilities: true,
      },
    });
    if (!w) return res.status(404).json({ error: 'Not found' });

    const caps = w.capabilities;
    const progressFor = (rows: { migrationStatus: string }[]) => progressOf(rows.map((r) => r.migrationStatus));

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
      progress: progressFor(caps),
      counts: { findings: caps.length, ...capdanCounts(caps) },
      byLayer,
      // Brown-field apps (the grid columns).
      apps: w.apps.map((a) => ({ id: a.id, name: a.name, techStack: a.techStack, position: a.position })),
      // CAPDAN normalized components (one per layer), with destination service.
      components: w.components.map((c) => ({
        id: c.id, layer: c.layer, name: c.name, pattern: c.pattern, targetTech: c.targetTech,
        destination: c.destination, microserviceId: c.microserviceId,
        migrationStatus: c.migrationStatus,
      })),
      // Green-field target services.
      microservices: w.microservices.map((m) => ({
        id: m.id, name: m.name, kind: m.kind, status: m.status, techStack: m.techStack, ownerRole: m.ownerRole,
      })),
      // Flat findings; the board groups by (appId, layer, category).
      findings: caps.map((c) => ({
        id: c.id, appId: c.appId, layer: c.layer, category: c.category, capdan: c.capdan,
        targetLayer: c.targetLayer, name: c.name, codeRef: c.codeRef,
        migrationApproach: c.migrationApproach, rationale: c.rationale,
        effort: c.effort, complexity: c.complexity, migrationStatus: c.migrationStatus,
      })),
    });
  } catch (e) { next(e); }
});

export default router;
