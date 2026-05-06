import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { recomputeKpi, recomputeObjective } from '../services/okr.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// ── Strategic Objectives ─────────────────────────────────────────────

router.get('/objectives', async (req, res, next) => {
  try {
    const objectives = await prisma.strategicObjective.findMany({
      where: { tenantId: req.tenantId },
      include: {
        kpis: true,
        children: { select: { id: true, name: true, achievement: true } },
        initiativeLinks: {
          include: { initiative: { select: { id: true, name: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(objectives);
  } catch (e) { next(e); }
});

router.get('/objectives/:id', async (req, res, next) => {
  try {
    const obj = await prisma.strategicObjective.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        kpis: true,
        parent: { select: { id: true, name: true } },
        children: true,
        initiativeLinks: { include: { initiative: true } },
      },
    });
    if (!obj) return res.status(404).json({ error: 'Not found' });
    res.json(obj);
  } catch (e) { next(e); }
});

const objSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  ownerName: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/objectives', async (req, res, next) => {
  try {
    const data = objSchema.parse(req.body);
    const obj = await prisma.strategicObjective.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        tenantId: req.tenantId,
      },
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'StrategicObjective', entityId: obj.id, action: 'CREATE',
    });
    res.status(201).json(obj);
  } catch (e) { next(e); }
});

router.patch('/objectives/:id', async (req, res, next) => {
  try {
    const data = objSchema.partial().parse(req.body);
    const patch = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const r = await prisma.strategicObjective.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId }, data: patch,
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.strategicObjective.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/objectives/:id', async (req, res, next) => {
  try {
    const r = await prisma.strategicObjective.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/objectives/:id/recompute', async (req, res, next) => {
  try {
    const updated = await recomputeObjective(req.params.id);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── KPIs ─────────────────────────────────────────────────────────────

router.get('/kpis', async (req, res, next) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.objectiveId) where.objectiveId = req.query.objectiveId;
    const kpis = await prisma.kpi.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(kpis);
  } catch (e) { next(e); }
});

const kpiSchema = z.object({
  objectiveId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.enum(['NUMBER', 'CURRENCY', 'PERCENT']).default('NUMBER'),
  direction: z.enum(['MAX', 'MIN']).default('MAX'),
  weight: z.number().default(1.0),
  startingValue: z.number().default(0),
  targetValue: z.number(),
  currentValue: z.number().default(0),
});

router.post('/kpis', async (req, res, next) => {
  try {
    const data = kpiSchema.parse(req.body);
    const kpi = await prisma.kpi.create({ data: { ...data, tenantId: req.tenantId } });
    await recomputeKpi(kpi.id);
    if (data.objectiveId) await recomputeObjective(data.objectiveId);
    res.status(201).json(kpi);
  } catch (e) { next(e); }
});

router.patch('/kpis/:id', async (req, res, next) => {
  try {
    const data = kpiSchema.partial().parse(req.body);
    const existing = await prisma.kpi.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.kpi.update({ where: { id: req.params.id }, data });
    await recomputeKpi(req.params.id);
    if (existing.objectiveId) await recomputeObjective(existing.objectiveId);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/kpis/:id', async (req, res, next) => {
  try {
    const r = await prisma.kpi.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
