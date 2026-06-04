import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { recomputeInitiative, summarizeProgram } from '../services/portfolioRollup.js';
import { applyWorkflowAction } from '../services/portfolioWorkflow.js';

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

// Resolve the operating-model links (value stream / division / owner+sponsor
// role) on a set of initiatives into display names, in one batched pass.
async function resolveLinks(inits: { valueStreamId: string | null; divisionId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null }[]) {
  const vsIds = new Set<string>(), divIds = new Set<string>(), roleIds = new Set<string>();
  for (const i of inits) {
    if (i.valueStreamId) vsIds.add(i.valueStreamId);
    if (i.divisionId) divIds.add(i.divisionId);
    if (i.ownerRoleId) roleIds.add(i.ownerRoleId);
    if (i.sponsorRoleId) roleIds.add(i.sponsorRoleId);
  }
  const [vs, divs, roles] = await Promise.all([
    vsIds.size ? prisma.valueStream.findMany({ where: { id: { in: [...vsIds] } }, select: { id: true, name: true } }) : [],
    divIds.size ? prisma.division.findMany({ where: { id: { in: [...divIds] } }, select: { id: true, name: true } }) : [],
    roleIds.size ? prisma.role.findMany({ where: { id: { in: [...roleIds] } }, select: { id: true, name: true } }) : [],
  ]);
  return {
    valueStream: new Map(vs.map((x) => [x.id, x.name])),
    division: new Map(divs.map((x) => [x.id, x.name])),
    role: new Map(roles.map((x) => [x.id, x.name])),
  };
}

function withLinkNames<T extends { valueStreamId: string | null; divisionId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null }>(
  i: T,
  maps: Awaited<ReturnType<typeof resolveLinks>>,
) {
  return {
    ...i,
    valueStreamName: i.valueStreamId ? maps.valueStream.get(i.valueStreamId) ?? null : null,
    divisionName: i.divisionId ? maps.division.get(i.divisionId) ?? null : null,
    ownerRoleName: i.ownerRoleId ? maps.role.get(i.ownerRoleId) ?? null : null,
    sponsorRoleName: i.sponsorRoleId ? maps.role.get(i.sponsorRoleId) ?? null : null,
  };
}

// ─── Dropdown source for operating-model links ─────────────────────────────
router.get('/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const where = { companyId };
    const [valueStreams, divisions, roles] = await Promise.all([
      prisma.valueStream.findMany({ where, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.division.findMany({ where, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.role.findMany({ where, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ valueStreams, divisions, roles });
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

    const programCount = await prisma.program.count({ where: { tenantId, companyId } });

    res.json({
      totals,
      counts: { programs: programCount, initiatives: initiatives.length },
      byStage: tally('stage'),
      byStatus: tally('status'),
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
    res.json(programs);
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
    res.json({
      ...program,
      workstreams: program.workstreams.map((w) => ({
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
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: program.id, action: 'CREATE' });
    res.status(201).json(program);
  } catch (e) { next(e); }
});

const programUpdateSchema = programCreateSchema.partial().extend({
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
});

router.patch('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.program.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = programUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const updated = await prisma.program.update({ where: { id: req.params.id }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: req.params.id, action: 'UPDATE', diff: data });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.program.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Program', entityId: req.params.id, action: 'DELETE' });
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
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: ws.id, action: 'CREATE' });
    res.status(201).json(ws);
  } catch (e) { next(e); }
});

router.patch('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.workstream.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
      statusNote: z.string().optional(),
    }).parse(req.body);
    const updated = await prisma.workstream.update({ where: { id: req.params.id }, data });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: req.params.id, action: 'UPDATE', diff: data });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/workstreams/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.workstream.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Workstream', entityId: req.params.id, action: 'DELETE' });
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
      },
    });
    if (!init) return res.status(404).json({ error: 'Not found' });
    const maps = await resolveLinks([init]);
    res.json(withLinkNames(init, maps));
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
        valueStreamId: data.valueStreamId ?? null,
        divisionId: data.divisionId ?? null,
        ownerRoleId: data.ownerRoleId ?? null,
        sponsorRoleId: data.sponsorRoleId ?? null,
      },
    });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: init.id, action: 'CREATE' });
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
    const updated = await prisma.portfolioInitiative.update({ where: { id: req.params.id }, data: patch });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'UPDATE', diff: data });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.portfolioInitiative.delete({ where: { id: req.params.id } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'PortfolioInitiative', entityId: req.params.id, action: 'DELETE' });
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

// Milestones (nested under an initiative)
router.post('/initiatives/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await ownInitiative(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = z.object({ name: z.string().min(1), dueDate: z.string(), isGate: z.boolean().optional() }).parse(req.body);
    const m = await prisma.milestone.create({ data: { initiativeId: req.params.id, name: data.name, dueDate: new Date(data.dueDate), isGate: data.isGate ?? false } });
    res.status(201).json(m);
  } catch (e) { next(e); }
});

async function ownMilestone(id: string, tenantId: string) {
  const m = await prisma.milestone.findUnique({ where: { id }, include: { initiative: { select: { tenantId: true } } } });
  return m && m.initiative.tenantId === tenantId ? m : null;
}

router.patch('/initiatives/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await ownMilestone(req.params.milestoneId, req.tenantId))) return res.status(404).json({ error: 'Not found' });
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
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/initiatives/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await ownMilestone(req.params.milestoneId, req.tenantId))) return res.status(404).json({ error: 'Not found' });
    await prisma.milestone.delete({ where: { id: req.params.milestoneId } });
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
    await prisma.metricValue.deleteMany({ where: { [fkField]: data.lineId, dataset: data.dataset } });
    if (data.values.length > 0) {
      await prisma.metricValue.createMany({
        data: data.values.map((v) => ({ [fkField]: data.lineId, dataset: data.dataset, periodStart: new Date(v.periodStart), amount: v.amount })),
      });
    }
    await recomputeInitiative(line.initiativeId);
    logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: data.type === 'BENEFIT' ? 'BenefitLine' : 'CostLine',
      entityId: data.lineId, action: 'UPDATE_VALUES', diff: { dataset: data.dataset, count: data.values.length },
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
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'RaidItem', entityId: item.id, action: 'CREATE' });
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
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'RaidItem', entityId: req.params.id, action: 'UPDATE', diff: data });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/raid/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.raidItem.findUnique({ where: { id: req.params.id }, include: { initiative: { select: { tenantId: true } } } });
    if (!item || item.initiative.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    await prisma.raidItem.delete({ where: { id: req.params.id } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'RaidItem', entityId: req.params.id, action: 'DELETE' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
