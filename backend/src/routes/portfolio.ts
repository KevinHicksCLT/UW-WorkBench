import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit, computeDiff } from '../services/audit.js';
import { recomputeInitiative, summarizeProgram } from '../services/portfolioRollup.js';
import { applyWorkflowAction } from '../services/portfolioWorkflow.js';
import { linkNames } from '../lib/resolvers/index.js';

// Initiative Tracker API — the strategic-portfolio module behind the
// "Initiatives" tab. Everything is scoped to tenant (from the JWT) + the active
// company (from ?companyId, falling back to the tenant's first company). Mounted
// at /portfolio; the frontend calls it via the /api prefix.

const router = Router();
router.use(requireAuth);

// Resolve the active company: the requested one (validated against the tenant)
// or the tenant's first company. Sends 404 and returns null when none exist.
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

// Tenant-scoped fetch of a single initiative (ownership guard for nested writes).
function ownInitiative(id: string, tenantId: string) {
  return prisma.portfolioInitiative.findFirst({ where: { id, tenantId } });
}

// ── Health rollup (I13): a parent's effective health is its WORST child's.
// The stored status stays editable (manual override) — the API returns both,
// plus a flag so the UI can show the override visibly.
const STATUS_SEV: Record<string, number> = { ON_TRACK: 0, AT_RISK: 1, OFF_TRACK: 2 };
const worstStatus = (statuses: string[], fallback: string) =>
  statuses.length ? statuses.reduce((a, s) => ((STATUS_SEV[s] ?? 0) > (STATUS_SEV[a] ?? 0) ? s : a), 'ON_TRACK') : fallback;

function withHealthRollup<P extends { status: string; workstreams: (W & { initiatives: { status: string }[] })[] }, W extends { status: string }>(program: P) {
  const workstreams = program.workstreams.map((w) => {
    const computedStatus = worstStatus(w.initiatives.map((i) => i.status), w.status);
    return { ...w, computedStatus, statusOverridden: computedStatus !== w.status };
  });
  const computedStatus = worstStatus(workstreams.map((w) => w.computedStatus), program.status);
  return { ...program, workstreams, computedStatus, statusOverridden: computedStatus !== program.status };
}

// Resolve the operating-model links (value stream / division / owner+sponsor
// role) on a set of initiatives into display names, in one batched pass.
// erd_v5: the FK columns are valueStreamNodeId → ProcessNode, orgUnitId → OrgUnit,
// owner/sponsorRoleId → Role. The frontend still wants the legacy display keys
// (valueStreamName / divisionName / ownerRoleName / sponsorRoleName), so this maps
// the new FKs through the spine displayValue and exposes the old key names.
type InitLinks = { valueStreamNodeId: string | null; orgUnitId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null };
async function resolveLinks(inits: InitLinks[]) {
  const vsIds: (string | null)[] = [], orgIds: (string | null)[] = [], roleIds: (string | null)[] = [];
  for (const i of inits) {
    vsIds.push(i.valueStreamNodeId);
    orgIds.push(i.orgUnitId);
    roleIds.push(i.ownerRoleId, i.sponsorRoleId);
  }
  const [valueStream, division, role] = await Promise.all([
    linkNames(prisma, vsIds, 'processNode'),
    linkNames(prisma, orgIds, 'orgUnit'),
    linkNames(prisma, roleIds, 'role'),
  ]);
  return { valueStream, division, role };
}

function withLinkNames<T extends InitLinks>(
  i: T,
  maps: Awaited<ReturnType<typeof resolveLinks>>,
) {
  // Expose BOTH the new FK columns (already on the row via ...i) and the legacy
  // display aliases the frontend reads.
  return {
    ...i,
    valueStreamId: i.valueStreamNodeId,
    divisionId: i.orgUnitId,
    valueStreamName: i.valueStreamNodeId ? maps.valueStream.get(i.valueStreamNodeId) ?? null : null,
    divisionName: i.orgUnitId ? maps.division.get(i.orgUnitId) ?? null : null,
    ownerRoleName: i.ownerRoleId ? maps.role.get(i.ownerRoleId) ?? null : null,
    sponsorRoleName: i.sponsorRoleId ? maps.role.get(i.sponsorRoleId) ?? null : null,
  };
}

// ─── Dropdown source for operating-model links ─────────────────────────────
router.get('/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    // Value streams = ProcessNode at level 2; divisions = OrgUnit at level 2; roles
    // = Role. Each spine entity's editable displayValue is exposed as `name` to
    // keep the dropdown option shape ({ id, name }) the frontend consumes.
    const [vsNodes, orgUnits, roles] = await Promise.all([
      prisma.processNode.findMany({ where: { companyId, processLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.orgUnit.findMany({ where: { companyId, orgLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
    ]);
    const toOpt = (rows: { id: string; displayValue: string }[]) => rows.map((r) => ({ id: r.id, name: r.displayValue }));
    res.json({ valueStreams: toOpt(vsNodes), divisions: toOpt(orgUnits), roles: toOpt(roles) });
  } catch (e) { next(e); }
});

// ─── Risk scoring bands ──────────────────────────────────────────────────────
// How a 5×5 probability×impact score (1–25) reads as a rating. Company-scoped
// data (Data Admin → Initiatives → Risk scoring bands), consumed by every
// severity cell in the tracker.
router.get('/risk-bands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const bands = await prisma.riskScoringBand.findMany({
      where: { companyId },
      orderBy: { minScore: 'asc' },
      select: { id: true, label: true, minScore: true, maxScore: true, color: true, description: true },
    });
    res.json({ bands });
  } catch (e) { next(e); }
});

// ─── Portfolio dashboard ───────────────────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const tenantId = req.tenantId;

    const initiatives = await prisma.portfolioInitiative.findMany({ where: { tenantId, companyId } });

    const totals = initiatives.reduce(
      (a, i) => ({
        benefit: a.benefit + i.cumulativeBenefit,
        cost: a.cost + i.cumulativeCost,
        net: a.net + i.cumulativeNetBenefit,
      }),
      { benefit: 0, cost: 0, net: 0 },
    );

    const tally = (key: 'stage' | 'status') =>
      initiatives.reduce<Record<string, number>>((acc, i) => {
        acc[i[key]] = (acc[i[key]] || 0) + 1;
        return acc;
      }, {});

    // Monthly Actual/Target/Forecast across all benefit lines in this company.
    const benefitValues = await prisma.metricValue.findMany({
      where: { benefitLine: { initiative: { companyId } } },
      select: { dataset: true, periodStart: true, amount: true },
    });
    const monthly: Record<string, { period: string; ACTUAL: number; TARGET: number; FORECAST: number }> = {};
    for (const v of benefitValues) {
      const key = v.periodStart.toISOString().slice(0, 7);
      if (!monthly[key]) monthly[key] = { period: key, ACTUAL: 0, TARGET: 0, FORECAST: 0 };
      monthly[key][v.dataset as 'ACTUAL' | 'TARGET' | 'FORECAST'] += v.amount;
    }
    const monthlyBenefits = Object.values(monthly).sort((a, b) => a.period.localeCompare(b.period));

    const topRisksRaw = await prisma.raidItem.findMany({
      where: { type: 'RISK', status: 'OPEN', initiative: { companyId } },
      include: { initiative: { select: { id: true, name: true } } },
      orderBy: { severity: 'desc' },
      take: 5,
    });

    const [programCount, raidOpenGroups] = await Promise.all([
      prisma.program.count({ where: { tenantId, companyId } }),
      prisma.raidItem.groupBy({ by: ['type'], where: { status: 'OPEN', initiative: { companyId } }, _count: { _all: true } }),
    ]);
    const raidOpen = Object.fromEntries(raidOpenGroups.map((g) => [g.type, g._count._all]));

    res.json({
      totals,
      counts: { programs: programCount, initiatives: initiatives.length },
      byStage: tally('stage'),
      byStatus: tally('status'),
      raidOpen,
      monthlyBenefits,
      topRisks: topRisksRaw,
    });
  } catch (e) { next(e); }
});

// ─── Programs ──────────────────────────────────────────────────────────────
router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const programs = await prisma.program.findMany({
      where: { tenantId: req.tenantId, companyId },
      include: {
        workstreams: { include: { initiatives: { select: { id: true, status: true, stage: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(programs.map((p) => withHealthRollup(p)));
  } catch (e) { next(e); }
});

router.get('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { workstreams: { include: { initiatives: true } } },
    });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const allInits = program.workstreams.flatMap((w) => w.initiatives);
    const maps = await resolveLinks(allInits);
    const rolled = withHealthRollup(program);
    res.json({
      ...rolled,
      workstreams: rolled.workstreams.map((w) => ({
        ...w,
        initiatives: w.initiatives.map((i) => withLinkNames(i, maps)),
      })),
    });
  } catch (e) { next(e); }
});

router.get('/programs/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const summary = await summarizeProgram(req.params.id);
    res.json(summary);
  } catch (e) { next(e); }
});

const programCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const data = programCreateSchema.parse(req.body);
    const program = await prisma.program.create({
      data: {
        tenantId: req.tenantId,
        companyId,
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: program.id, action: 'PROGRAM_CREATED', diff: { program: data.name } });
    res.status(201).json(program);
  } catch (e) { next(e); }
});

const programUpdateSchema = programCreateSchema.partial().extend({
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
});

router.patch('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = programUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const updated = await prisma.program.update({ where: { id: req.params.id }, data: patch });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Program', entityId: req.params.id, action: 'PROGRAM_UPDATED',
      diff: { program: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { name: true } });
    const r = await prisma.program.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: req.params.id, action: 'PROGRAM_DELETED', diff: { program: existing?.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Workstreams ───────────────────────────────────────────────────────────
const workstreamCreateSchema = z.object({
  programId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post('/workstreams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = workstreamCreateSchema.parse(req.body);
    const program = await prisma.program.findFirst({ where: { id: data.programId, tenantId: req.tenantId }, select: { id: true, companyId: true } });
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const ws = await prisma.workstream.create({
      data: { tenantId: req.tenantId, companyId: program.companyId, programId: data.programId, name: data.name, description: data.description },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: ws.id, action: 'WORKSTREAM_CREATED', diff: { workstream: data.name } });
    res.status(201).json(ws);
  } catch (e) { next(e); }
});

router.patch('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workstream.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
      statusNote: z.string().optional(),
    }).parse(req.body);
    const updated = await prisma.workstream.update({ where: { id: req.params.id }, data });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Workstream', entityId: req.params.id, action: 'WORKSTREAM_UPDATED',
      diff: { workstream: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workstream.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { name: true } });
    const r = await prisma.workstream.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: req.params.id, action: 'WORKSTREAM_DELETED', diff: { workstream: existing?.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Initiatives ───────────────────────────────────────────────────────────
router.get('/initiatives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const where: Record<string, unknown> = { tenantId: req.tenantId, companyId };
    if (typeof req.query.programId === 'string') where.workstream = { programId: req.query.programId };
    if (typeof req.query.workstreamId === 'string') where.workstreamId = req.query.workstreamId;
    if (typeof req.query.stage === 'string') where.stage = req.query.stage;
    if (typeof req.query.status === 'string') where.status = req.query.status;
    const initiatives = await prisma.portfolioInitiative.findMany({
      where,
      include: {
        workstream: { include: { program: { select: { id: true, name: true } } } },
        _count: { select: { raidItems: true, milestones: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const maps = await resolveLinks(initiatives);
    res.json(initiatives.map((i) => withLinkNames(i, maps)));
  } catch (e) { next(e); }
});

router.get('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await prisma.portfolioInitiative.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        workstream: { include: { program: true } },
        benefits: { include: { values: true } },
        costs: { include: { values: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        raidItems: { orderBy: { severity: 'desc' } },
        objectives: { include: { objective: { select: { id: true, name: true, weight: true } } }, orderBy: { createdAt: 'asc' } },
        resources: { orderBy: { startDate: 'asc' }, include: { role: { select: { displayValue: true } } } },
        activities: { orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }] },
      },
    });
    if (!init) return res.status(404).json({ error: 'Not found' });
    const maps = await resolveLinks([init]);
    // Expose the legacy resource.roleName (resolved from the linked Role).
    const resources = init.resources.map(({ role, ...r }) => ({ ...r, roleName: role?.displayValue ?? null }));
    res.json({ ...withLinkNames(init, maps), resources });
  } catch (e) { next(e); }
});

const initiativeCreateSchema = z.object({
  workstreamId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  dueDate: z.string(),
  valueStreamId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  ownerRoleId: z.string().nullable().optional(),
  sponsorRoleId: z.string().nullable().optional(),
});

router.post('/initiatives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = initiativeCreateSchema.parse(req.body);
    const ws = await prisma.workstream.findFirst({ where: { id: data.workstreamId, tenantId: req.tenantId }, select: { id: true, companyId: true } });
    if (!ws) return res.status(404).json({ error: 'Workstream not found' });
    const init = await prisma.portfolioInitiative.create({
      data: {
        tenantId: req.tenantId,
        companyId: ws.companyId,
        workstreamId: data.workstreamId,
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        dueDate: new Date(data.dueDate),
        // Frontend still sends the legacy keys; map to the erd_v5 FK columns.
        valueStreamNodeId: data.valueStreamId ?? null,
        orgUnitId: data.divisionId ?? null,
        ownerRoleId: data.ownerRoleId ?? null,
        sponsorRoleId: data.sponsorRoleId ?? null,
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: init.id, action: 'INITIATIVE_CREATED', diff: { initiative: data.name } });
    res.status(201).json(init);
  } catch (e) { next(e); }
});

const initiativeUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
  complexityScore: z.number().min(0).max(10).optional(),
  valueStreamId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  ownerRoleId: z.string().nullable().optional(),
  sponsorRoleId: z.string().nullable().optional(),
});

router.patch('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = initiativeUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);
    // Translate the legacy link keys to the erd_v5 FK columns (and drop the
    // legacy keys, which are not columns on PortfolioInitiative).
    if ('valueStreamId' in data) { patch.valueStreamNodeId = data.valueStreamId ?? null; delete patch.valueStreamId; }
    if ('divisionId' in data) { patch.orgUnitId = data.divisionId ?? null; delete patch.divisionId; }
    const updated = await prisma.portfolioInitiative.update({ where: { id: req.params.id }, data: patch });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'INITIATIVE_UPDATED',
      diff: { initiative: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.portfolioInitiative.delete({ where: { id: req.params.id } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'INITIATIVE_DELETED', diff: { initiative: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/initiatives/:id/workflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { action } = z.object({ action: z.enum(['SUBMIT', 'APPROVE', 'MOVE_BACK']) }).parse(req.body);
    const updated = await applyWorkflowAction({ initiativeId: req.params.id, action, actor: { tenantId: req.tenantId, email: req.user.email } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/initiatives/:id/recompute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await recomputeInitiative(req.params.id);
    res.json(updated);
  } catch (e) { next(e); }
});

// ─── AI-generated Project Charter (FB-13) ───────────────────────────────────
// Drafts a narrative project charter for an initiative, grounded ONLY in that
// initiative's real data (program, dates, owner/sponsor, objectives, time-phased
// benefits & costs, milestones, risks). Returns Markdown; the frontend renders it
// under the Charter tab and caches it client-side so it isn't regenerated on
// every visit. Works for any initiative ("for all projects displayed").
let charterClient: Anthropic | null = null;
function charterAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('Charter generation is not configured (ANTHROPIC_API_KEY missing)'), { status: 503 });
  }
  if (!charterClient) charterClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return charterClient;
}
const CHARTER_MODEL = process.env.CHARTER_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';

router.post('/initiatives/:id/charter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await prisma.portfolioInitiative.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        workstream: { include: { program: { select: { name: true } } } },
        benefits: { include: { values: true } },
        costs: { include: { values: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        raidItems: { where: { type: 'RISK' }, orderBy: { severity: 'desc' }, take: 6 },
        objectives: { include: { objective: { select: { name: true, weight: true } } } },
      },
    });
    if (!init) return res.status(404).json({ error: 'Not found' });
    const maps = await resolveLinks([init]);
    const linked = withLinkNames(init, maps);

    const sumDataset = (lines: { values: { dataset: string; amount: number }[] }[], dataset: string) =>
      lines.reduce((a, l) => a + l.values.filter((v) => v.dataset === dataset).reduce((x, v) => x + v.amount, 0), 0);
    const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
    const day = (d: Date) => d.toISOString().slice(0, 10);

    // Compact, factual brief the model writes from — no invented numbers.
    const facts = [
      `Initiative: ${init.name}`,
      init.description ? `Description: ${init.description}` : null,
      `Program: ${init.workstream.program.name} › Workstream: ${init.workstream.name}`,
      `Stage: ${init.stage} | Status: ${init.status} | Start: ${day(init.startDate)} | Due: ${day(init.dueDate)}`,
      `Value stream: ${linked.valueStreamName ?? '—'} | Division: ${linked.divisionName ?? '—'}`,
      `Owner role: ${linked.ownerRoleName ?? '—'} | Sponsor role: ${linked.sponsorRoleName ?? '—'}`,
      `Complexity score: ${init.complexityScore}/10 | Value score: ${init.valueScore}`,
      `Cumulative benefit: ${money(init.cumulativeBenefit)} | Cumulative cost: ${money(init.cumulativeCost)} | Net benefit: ${money(init.cumulativeNetBenefit)}`,
      `Budget (planned cost): ${money(sumDataset(init.costs, 'TARGET'))} | Forecast cost: ${money(sumDataset(init.costs, 'FORECAST'))} | Actual cost to date: ${money(sumDataset(init.costs, 'ACTUAL'))}`,
      init.objectives.length
        ? `Linked strategic objectives: ${init.objectives.map((o) => `${o.objective.name} (impact ${o.impact}×weight ${o.objective.weight})`).join('; ')}`
        : 'Linked strategic objectives: none',
      init.milestones.length
        ? `Milestones: ${init.milestones.map((m) => `${m.name} — due ${day(m.dueDate)}${m.isGate ? ' [gate]' : ''}`).join('; ')}`
        : 'Milestones: none defined',
      init.raidItems.length
        ? `Top risks: ${init.raidItems.map((r) => `${r.title} (severity ${r.severity})`).join('; ')}`
        : 'Top risks: none logged',
    ].filter(Boolean).join('\n');

    const system = [
      'You are a transformation PMO lead drafting a concise Project Charter for an executive audience.',
      'Write ONLY from the facts provided — never invent figures, dates, names or scope not present in them.',
      'Where a fact is missing, say so briefly (e.g. "Scope to be confirmed") rather than fabricating.',
      'Output clean GitHub-flavoured Markdown with these ## sections, in order:',
      'Purpose & Background, Objectives & Strategic Alignment, Scope, Business Case (benefits, costs, net),',
      'Key Milestones, Risks & Mitigations, Governance (sponsor/owner), Success Criteria.',
      'Be tight and executive: short paragraphs and bullets, the key figures in **bold**. No preamble, no title line, no emojis.',
    ].join('\n');

    const resp = await charterAnthropic().messages.create({
      model: CHARTER_MODEL,
      max_tokens: 1600,
      system,
      messages: [{ role: 'user', content: `Draft the Project Charter from these facts:\n\n${facts}` }],
    });
    const charter = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: init.id, action: 'CHARTER_GENERATED', diff: { initiative: init.name } });
    res.json({ charter });
  } catch (e) { next(e); }
});

// Milestones (nested under an initiative)
router.post('/initiatives/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ name: z.string().min(1), dueDate: z.string(), isGate: z.boolean().optional() }).parse(req.body);
    const m = await prisma.milestone.create({ data: { initiativeId: req.params.id, name: data.name, dueDate: new Date(data.dueDate), isGate: data.isGate ?? false } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'MILESTONE_CREATED', diff: { milestone: data.name, dueDate: data.dueDate } });
    res.status(201).json(m);
  } catch (e) { next(e); }
});

async function ownMilestone(id: string, tenantId: string) {
  const m = await prisma.milestone.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return m && m.initiative.tenantId === tenantId ? m : null;
}

router.patch('/initiatives/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownMilestone(req.params.milestoneId, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({
      name: z.string().optional(),
      dueDate: z.string().optional(),
      status: z.enum(['PENDING', 'DONE', 'MISSED']).optional(),
      isGate: z.boolean().optional(),
    }).parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);
    if (data.status === 'DONE') patch.completedAt = new Date();
    if (data.status && data.status !== 'DONE') patch.completedAt = null;
    const updated = await prisma.milestone.update({ where: { id: req.params.milestoneId }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'MILESTONE_UPDATED', diff: { milestone: existing.name, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownMilestone(req.params.milestoneId, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.milestone.delete({ where: { id: req.params.milestoneId } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'MILESTONE_DELETED', diff: { milestone: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Strategic objectives + alignment links (I3/I4) ────────────────────────
// valueScore = Σ(link.impact × objective.weight), persisted on the initiative
// after every link/weight change so list views can sort without joins.
async function recomputeValueScore(initiativeId: string) {
  const links = await prisma.initiativeObjective.findMany({
    where: { initiativeId },
    include: { objective: { select: { weight: true } } },
  });
  const valueScore = Math.round(links.reduce((a, l) => a + l.impact * l.objective.weight, 0) * 10) / 10;
  return prisma.portfolioInitiative.update({ where: { id: initiativeId }, data: { valueScore } });
}

router.get('/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const objectives = await prisma.strategicObjective.findMany({
      where: { tenantId: req.tenantId, companyId },
      include: { _count: { select: { links: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(objectives);
  } catch (e) { next(e); }
});

const objectiveCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  weight: z.number().min(0).max(10).optional(),
});

router.post('/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const data = objectiveCreateSchema.parse(req.body);
    const obj = await prisma.strategicObjective.create({
      data: { tenantId: req.tenantId, companyId, name: data.name, description: data.description, weight: data.weight ?? 1 },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'StrategicObjective', entityId: obj.id, action: 'OBJECTIVE_CREATED', diff: { objective: data.name, weight: data.weight ?? 1 } });
    res.status(201).json(obj);
  } catch (e) { next(e); }
});

router.patch('/objectives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.strategicObjective.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = objectiveCreateSchema.partial().parse(req.body);
    const updated = await prisma.strategicObjective.update({ where: { id: req.params.id }, data });
    // A weight change shifts every linked initiative's value score.
    if (data.weight !== undefined && data.weight !== existing.weight) {
      const links = await prisma.initiativeObjective.findMany({ where: { objectiveId: req.params.id }, select: { initiativeId: true } });
      for (const l of links) await recomputeValueScore(l.initiativeId);
    }
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'StrategicObjective', entityId: req.params.id, action: 'OBJECTIVE_UPDATED',
      diff: { objective: existing.name, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/objectives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.strategicObjective.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const links = await prisma.initiativeObjective.findMany({ where: { objectiveId: req.params.id }, select: { initiativeId: true } });
    await prisma.strategicObjective.delete({ where: { id: req.params.id } }); // cascades the links
    for (const l of links) await recomputeValueScore(l.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'StrategicObjective', entityId: req.params.id, action: 'OBJECTIVE_DELETED', diff: { objective: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/initiatives/:id/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ objectiveId: z.string(), impact: z.number().int().min(1).max(5) }).parse(req.body);
    const objective = await prisma.strategicObjective.findFirst({ where: { id: data.objectiveId, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!objective) return res.status(404).json({ error: 'Objective not found' });
    const link = await prisma.initiativeObjective.create({ data: { initiativeId: req.params.id, objectiveId: data.objectiveId, impact: data.impact } });
    await recomputeValueScore(req.params.id);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'OBJECTIVE_LINKED', diff: { objective: objective.name, impact: data.impact } });
    res.status(201).json(link);
  } catch (e) { next(e); }
});

// Walk an alignment link up to its initiative's tenant for the ownership guard.
async function ownObjectiveLink(id: string, tenantId: string) {
  const l = await prisma.initiativeObjective.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } }, objective: { select: { name: true } } } });
  return l && l.initiative.tenantId === tenantId ? l : null;
}

router.patch('/initiatives/objectives/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await ownObjectiveLink(req.params.linkId, req.tenantId);
    if (!link) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ impact: z.number().int().min(1).max(5) }).parse(req.body);
    const updated = await prisma.initiativeObjective.update({ where: { id: req.params.linkId }, data });
    await recomputeValueScore(link.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: link.initiativeId, action: 'OBJECTIVE_IMPACT_UPDATED', diff: { objective: link.objective.name, impact: { from: link.impact, to: data.impact } } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/objectives/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await ownObjectiveLink(req.params.linkId, req.tenantId);
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.initiativeObjective.delete({ where: { id: req.params.linkId } });
    await recomputeValueScore(link.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: link.initiativeId, action: 'OBJECTIVE_UNLINKED', diff: { objective: link.objective.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Resources (I6) ─────────────────────────────────────────────────────────
const resourceCreateSchema = z.object({
  name: z.string().min(1),
  roleName: z.string().nullable().optional(),
  allocationPct: z.number().int().min(1).max(100),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/initiatives/:id/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = resourceCreateSchema.parse(req.body);
    // erd_v5 InitiativeResource has no free-text roleName column (role is now an
    // optional Role FK). The legacy free-text roleName is accepted but not stored;
    // reads resolve roleName from the linked Role's displayValue.
    const resource = await prisma.initiativeResource.create({
      data: {
        initiativeId: req.params.id,
        name: data.name,
        allocationPct: data.allocationPct,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'RESOURCE_ADDED', diff: { resource: data.name, allocationPct: data.allocationPct } });
    res.status(201).json(resource);
  } catch (e) { next(e); }
});

async function ownResource(id: string, tenantId: string) {
  const r = await prisma.initiativeResource.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return r && r.initiative.tenantId === tenantId ? r : null;
}

router.patch('/initiatives/resources/:rid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownResource(req.params.rid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = resourceCreateSchema.partial().parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    // roleName is not an erd_v5 column — never write it through.
    delete patch.roleName;
    const updated = await prisma.initiativeResource.update({ where: { id: req.params.rid }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'RESOURCE_UPDATED', diff: { resource: existing.name, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/resources/:rid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownResource(req.params.rid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.initiativeResource.delete({ where: { id: req.params.rid } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'RESOURCE_REMOVED', diff: { resource: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Per-resource-name utilization across a program's initiatives. The total only
// counts assignments whose date range covers today (active allocations).
router.get('/programs/:id/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!program) return res.status(404).json({ error: 'Not found' });
    const resources = await prisma.initiativeResource.findMany({
      where: { initiative: { workstream: { programId: req.params.id } } },
      include: { initiative: { select: { id: true, name: true } }, role: { select: { displayValue: true } } },
      orderBy: { name: 'asc' },
    });
    const today = new Date();
    type Row = {
      name: string; roleName: string | null; totalAllocationPct: number;
      assignments: { initiativeId: string; initiativeName: string; allocationPct: number; startDate: Date; endDate: Date }[];
    };
    const byName = new Map<string, Row>();
    for (const r of resources) {
      // roleName is resolved from the linked Role (erd_v5 dropped the free-text column).
      const roleName = r.role?.displayValue ?? null;
      const row = byName.get(r.name) ?? { name: r.name, roleName, totalAllocationPct: 0, assignments: [] };
      if (!row.roleName && roleName) row.roleName = roleName;
      row.assignments.push({ initiativeId: r.initiative.id, initiativeName: r.initiative.name, allocationPct: r.allocationPct, startDate: r.startDate, endDate: r.endDate });
      if (r.startDate <= today && r.endDate >= today) row.totalAllocationPct += r.allocationPct;
      byName.set(r.name, row);
    }
    res.json([...byName.values()].map((row) => ({ ...row, overUtilized: row.totalAllocationPct > 100 })));
  } catch (e) { next(e); }
});

// ─── Workplan activities (I9) ───────────────────────────────────────────────
const activityCreateSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  assignedTo: z.string().nullable().optional(),
  dependsOnId: z.string().nullable().optional(),
  // Typed dependency (FB-19): type + the chosen value (refId from a list, or a
  // free-text label for Person / Change-control approval).
  dependencyType: z.enum(['TEAM', 'ROLE', 'PERSON', 'PROJECT', 'CHANGE_APPROVAL']).nullable().optional(),
  dependencyRefId: z.string().nullable().optional(),
  dependencyLabel: z.string().nullable().optional(),
});

// Cascading dependency options for the workplan-activity modal: the second
// dropdown is populated from these per the selected type. Person and
// change-control approval are free-text (no canonical list in the model).
router.get('/dependency-options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const [teams, roles, projects] = await Promise.all([
      prisma.orgUnit.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } }),
      prisma.program.findMany({ where: { tenantId: req.tenantId, companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({
      TEAM: teams.map((t) => ({ id: t.id, name: t.displayValue })),
      ROLE: roles.map((r) => ({ id: r.id, name: r.displayValue })),
      PROJECT: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (e) { next(e); }
});

// A dependency must point at another activity of the same initiative.
async function validDependency(dependsOnId: string, initiativeId: string, selfId?: string): Promise<boolean> {
  if (dependsOnId === selfId) return false;
  const dep = await prisma.workplanActivity.findFirst({ where: { id: dependsOnId, initiativeId }, select: { id: true } });
  return !!dep;
}

router.post('/initiatives/:id/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const init = await ownInitiative(req.params.id, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Not found' });
    const data = activityCreateSchema.parse(req.body);
    if (data.dependsOnId && !(await validDependency(data.dependsOnId, req.params.id))) {
      return res.status(400).json({ error: 'dependsOnId must reference an activity of the same initiative' });
    }
    const last = await prisma.workplanActivity.aggregate({ where: { initiativeId: req.params.id }, _max: { sortOrder: true } });
    const activity = await prisma.workplanActivity.create({
      data: {
        initiativeId: req.params.id,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        assignedTo: data.assignedTo ?? null,
        dependsOnId: data.dependsOnId ?? null,
        dependencyType: data.dependencyType ?? null,
        dependencyRefId: data.dependencyRefId ?? null,
        dependencyLabel: data.dependencyLabel ?? null,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'ACTIVITY_CREATED', diff: { activity: data.name } });
    res.status(201).json(activity);
  } catch (e) { next(e); }
});

async function ownActivity(id: string, tenantId: string) {
  const a = await prisma.workplanActivity.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return a && a.initiative.tenantId === tenantId ? a : null;
}

router.patch('/initiatives/activities/:aid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activity = await ownActivity(req.params.aid, req.tenantId);
    if (!activity) return res.status(404).json({ error: 'Not found' });
    const data = activityCreateSchema.partial().extend({
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
    }).parse(req.body);
    if (data.dependsOnId && !(await validDependency(data.dependsOnId, activity.initiativeId, activity.id))) {
      return res.status(400).json({ error: 'dependsOnId must reference an activity of the same initiative' });
    }
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const updated = await prisma.workplanActivity.update({ where: { id: req.params.aid }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: activity.initiativeId, action: 'ACTIVITY_UPDATED', diff: { activity: activity.name, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/activities/:aid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownActivity(req.params.aid, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.workplanActivity.delete({ where: { id: req.params.aid } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'ACTIVITY_DELETED', diff: { activity: existing.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Benefit / Cost lines + time-phased values ─────────────────────────────
const lineSchema = z.object({
  initiativeId: z.string(),
  name: z.string().min(1),
  category: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  type: z.enum(['BENEFIT', 'COST']),
});

router.post('/lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = lineSchema.parse(req.body);
    const init = await ownInitiative(data.initiativeId, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Initiative not found' });
    const payload = { initiativeId: data.initiativeId, name: data.name, category: data.category, startDate: new Date(data.startDate), endDate: new Date(data.endDate) };
    const line = data.type === 'BENEFIT'
      ? await prisma.benefitLine.create({ data: payload })
      : await prisma.costLine.create({ data: payload });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: data.initiativeId, action: data.type === 'BENEFIT' ? 'BENEFIT_LINE_CREATED' : 'COST_LINE_CREATED', diff: { line: data.name, category: data.category ?? null } });
    res.status(201).json({ ...line, type: data.type });
  } catch (e) { next(e); }
});

// Walk a benefit/cost line up to its initiative's tenant for the ownership guard.
async function ownLine(type: string, id: string, tenantId: string) {
  if (type === 'BENEFIT') {
    const l = await prisma.benefitLine.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
    return l && l.initiative.tenantId === tenantId ? l : null;
  }
  const l = await prisma.costLine.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return l && l.initiative.tenantId === tenantId ? l : null;
}

router.delete('/lines/:type/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.params;
    const line = await ownLine(type, id, req.tenantId);
    if (!line) return res.status(404).json({ error: 'Not found' });
    if (type === 'BENEFIT') await prisma.benefitLine.delete({ where: { id } });
    else await prisma.costLine.delete({ where: { id } });
    await recomputeInitiative(line.initiativeId);
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: line.initiativeId, action: type === 'BENEFIT' ? 'BENEFIT_LINE_DELETED' : 'COST_LINE_DELETED', diff: { line: line.name } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/lines/:type/:id/values', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.params;
    const line = await ownLine(type, id, req.tenantId);
    if (!line) return res.status(404).json({ error: 'Not found' });
    const fk = type === 'BENEFIT' ? { benefitLineId: id } : { costLineId: id };
    const values = await prisma.metricValue.findMany({ where: fk });
    res.json(values);
  } catch (e) { next(e); }
});

const valuesSchema = z.object({
  type: z.enum(['BENEFIT', 'COST']),
  lineId: z.string(),
  dataset: z.enum(['ACTUAL', 'TARGET', 'FORECAST']),
  values: z.array(z.object({ periodStart: z.string(), amount: z.number() })),
});

router.post('/values', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = valuesSchema.parse(req.body);
    const line = await ownLine(data.type, data.lineId, req.tenantId);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    const fkField = data.type === 'BENEFIT' ? 'benefitLineId' : 'costLineId';

    // Capture the before-state so the audit records the exact month-level
    // before→after changes (and so an unchanged dataset logs nothing).
    const prior = await prisma.metricValue.findMany({ where: { [fkField]: data.lineId, dataset: data.dataset }, select: { periodStart: true, amount: true } });
    const monthKey = (d: string | Date) => new Date(d).toISOString().slice(0, 7);
    const beforeByMonth = new Map<string, number>();
    for (const v of prior) beforeByMonth.set(monthKey(v.periodStart), v.amount);
    const afterByMonth = new Map<string, number>();
    for (const v of data.values) afterByMonth.set(monthKey(v.periodStart), v.amount);
    const months = [...new Set([...beforeByMonth.keys(), ...afterByMonth.keys()])].sort();
    const changes = months
      .map((m) => ({ period: m, from: beforeByMonth.get(m) ?? 0, to: afterByMonth.get(m) ?? 0 }))
      .filter((c) => c.from !== c.to);

    await prisma.metricValue.deleteMany({ where: { [fkField]: data.lineId, dataset: data.dataset } });
    if (data.values.length > 0) {
      await prisma.metricValue.createMany({
        data: data.values.map((v) => ({ [fkField]: data.lineId, dataset: data.dataset, periodStart: new Date(v.periodStart), amount: v.amount })),
      });
    }
    await recomputeInitiative(line.initiativeId);
    // Only audit datasets that actually changed — no more 3-rows-per-save noise.
    const DATASET_LABEL: Record<string, string> = { ACTUAL: 'Actual', TARGET: 'Budget', FORECAST: 'Forecast' };
    if (changes.length > 0) logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'PortfolioInitiative', entityId: line.initiativeId,
      action: data.type === 'BENEFIT' ? 'BENEFIT_VALUES_UPDATED' : 'COST_VALUES_UPDATED',
      diff: { line: line.name, field: `${DATASET_LABEL[data.dataset]} (${data.type === 'BENEFIT' ? 'benefit' : 'cost'})`, changes },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── RAID ──────────────────────────────────────────────────────────────────
router.get('/raid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const where: Record<string, unknown> = { initiative: { companyId } };
    if (typeof req.query.programId === 'string') where.initiative = { companyId, workstream: { programId: req.query.programId } };
    if (typeof req.query.initiativeId === 'string') where.initiativeId = req.query.initiativeId;
    if (typeof req.query.type === 'string') where.type = req.query.type;
    if (typeof req.query.status === 'string') where.status = req.query.status;
    const items = await prisma.raidItem.findMany({
      where,
      include: { initiative: { select: { id: true, name: true } } },
      orderBy: { severity: 'desc' },
    });
    res.json(items);
  } catch (e) { next(e); }
});

const raidCreateSchema = z.object({
  initiativeId: z.string(),
  type: z.enum(['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION']),
  title: z.string().min(1),
  description: z.string().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  mitigation: z.string().optional(),
  ownerRoleId: z.string().nullable().optional(),
  dueDate: z.string().optional(),
});

router.post('/raid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = raidCreateSchema.parse(req.body);
    const init = await ownInitiative(data.initiativeId, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Initiative not found' });
    const probability = data.probability ?? 3;
    const impact = data.impact ?? 3;
    const item = await prisma.raidItem.create({
      data: {
        initiativeId: data.initiativeId,
        type: data.type,
        title: data.title,
        description: data.description,
        probability,
        impact,
        severity: probability * impact,
        mitigation: data.mitigation,
        ownerRoleId: data.ownerRoleId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: data.initiativeId, action: 'RAID_CREATED', diff: { type: data.type, title: data.title } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

const raidUpdateSchema = raidCreateSchema.partial().omit({ initiativeId: true }).extend({
  status: z.enum(['OPEN', 'MITIGATED', 'CLOSED']).optional(),
});

router.patch('/raid/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.raidItem.findUnique({ where: { id: req.params.id }, include: { initiative: { select: { tenantId: true } } } });
    if (!item || item.initiative.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    const data = raidUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);
    const probability = data.probability ?? item.probability;
    const impact = data.impact ?? item.impact;
    if (data.probability !== undefined || data.impact !== undefined) patch.severity = probability * impact;
    const updated = await prisma.raidItem.update({ where: { id: req.params.id }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: item.initiativeId, action: 'RAID_UPDATED', diff: { title: item.title, ...data } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/raid/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.raidItem.findUnique({ where: { id: req.params.id }, include: { initiative: { select: { tenantId: true } } } });
    if (!item || item.initiative.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    await prisma.raidItem.delete({ where: { id: req.params.id } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: item.initiativeId, action: 'RAID_DELETED', diff: { title: item.title } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Change requests / change log (FB-27) ──────────────────────────────────
router.get('/initiatives/:id/change-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await ownInitiative(req.params.id, req.tenantId))) return res.status(404).json({ error: 'Not found' });
    const items = await prisma.changeRequest.findMany({ where: { initiativeId: req.params.id }, orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (e) { next(e); }
});

const changeRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  raisedBy: z.string().optional(),
  costImpact: z.number().optional(),
  scheduleImpactDays: z.number().int().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

router.post('/initiatives/:id/change-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await ownInitiative(req.params.id, req.tenantId))) return res.status(404).json({ error: 'Not found' });
    const data = changeRequestSchema.parse(req.body);
    const cr = await prisma.changeRequest.create({
      data: {
        initiativeId: req.params.id,
        title: data.title,
        description: data.description ?? null,
        raisedBy: data.raisedBy?.trim() || req.user.email,
        costImpact: data.costImpact ?? 0,
        scheduleImpactDays: data.scheduleImpactDays ?? 0,
        status: data.status ?? 'PENDING',
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'CHANGE_REQUEST_CREATED', diff: { changeRequest: data.title, costImpact: data.costImpact ?? 0, scheduleImpactDays: data.scheduleImpactDays ?? 0 } });
    res.status(201).json(cr);
  } catch (e) { next(e); }
});

router.patch('/change-requests/:cid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id: req.params.cid }, include: { initiative: { select: { tenantId: true } } } });
    if (!existing || existing.initiative.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    const data = changeRequestSchema.partial().parse(req.body);
    const updated = await prisma.changeRequest.update({ where: { id: req.params.cid }, data });
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'CHANGE_REQUEST_UPDATED',
      diff: { changeRequest: existing.title, ...computeDiff(existing, data, Object.keys(data)) },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/change-requests/:cid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id: req.params.cid }, include: { initiative: { select: { tenantId: true } } } });
    if (!existing || existing.initiative.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    await prisma.changeRequest.delete({ where: { id: req.params.cid } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: existing.initiativeId, action: 'CHANGE_REQUEST_DELETED', diff: { changeRequest: existing.title } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
