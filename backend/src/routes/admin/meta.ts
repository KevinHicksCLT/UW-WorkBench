/**
 * Admin non-generic endpoints — entity metadata (GET /_meta), the company
 * dashboard-config editor, data validations, and the AI-adoption editor.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { ENTITY_LIST } from '../../lib/adminRegistry.js';
import { logAudit } from '../../services/audit.js';
import { runValidations } from '../../services/validations.js';

/** Registers the specific admin routes; MUST precede the /:entity catch-alls. */
export function registerMetaRoutes(router: Router): void {
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
    const FOOTPRINT_KEYS = new Set(['subProcesses', 'ioItems', 'externalParties', 'externalInteractions', 'standards', 'programs', 'objectives', 'openRaid', 'connections', 'signals']);
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
    // Per-widget custom display titles ({ widgetId: title }); empty titles drop
    // back to the catalog default.
    const wtRaw = (req.body ?? {}).widgetTitles;
    let widgetTitles: Record<string, string> | undefined;
    if (wtRaw !== undefined) {
      if (typeof wtRaw !== 'object' || wtRaw === null || Array.isArray(wtRaw)) {
        return res.status(400).json({ error: 'widgetTitles must be an object of widgetId → title' });
      }
      widgetTitles = {};
      for (const [k, v] of Object.entries(wtRaw)) {
        if (typeof v !== 'string') return res.status(400).json({ error: 'widgetTitles values must be strings' });
        const t = v.trim().slice(0, 60);
        if (t) widgetTitles[k] = t;
      }
      if (Object.keys(widgetTitles).length === 0) widgetTitles = undefined;
    } else {
      widgetTitles = (company.dashboardConfig as { widgetTitles?: Record<string, string> } | null)?.widgetTitles;
    }
    const config: { widgets: string[]; footprintStats?: string[]; widgetTitles?: Record<string, string> } = { widgets };
    if (footprintStats) config.footprintStats = footprintStats;
    if (widgetTitles) config.widgetTitles = widgetTitles;

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
    // One row per value-stream ProcessNode (level 2); adoption stores on the
    // node-keyed NodeAiAdoption table (1:1 with the ProcessNode).
    const nodes = await prisma.processNode.findMany({
      where: { companyId: cid, processLevelType: { levelNumber: 2 } },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } }, aiAdoption: true },
    });
    res.json({
      levels: [...AI_LEVELS],
      rows: nodes.map((n) => ({
        levelId: n.id, // canonical ProcessNode id (PATCH accepts it)
        name: n.displayValue,
        domain: n.parent?.displayValue ?? null,
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
    // The value-stream ProcessNode id — adoption stores directly on NodeAiAdoption.
    const vsNode = await prisma.processNode.findFirst({ where: { id: req.params.levelId, companyId: cid, processLevelType: { levelNumber: 2 } }, select: { id: true } });
    if (!vsNode) return res.status(404).json({ error: 'Not found' });
    const node = { id: vsNode.id };

    const data: Record<string, string | AiUseCasesByMode | AiStatsByMode> = {};
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

    const before = await prisma.nodeAiAdoption.findUnique({ where: { processNodeId: node.id } });
    const updated = await prisma.nodeAiAdoption.upsert({
      where: { processNodeId: node.id },
      create: { processNodeId: node.id, ...data },
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
}
