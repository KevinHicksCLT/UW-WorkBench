import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { recomputeInitiative } from '../services/rollup.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

async function tenantInitiative(initiativeId, tenantId) {
  return prisma.initiative.findFirst({
    where: { id: initiativeId, workstream: { program: { tenantId } } },
  });
}

const lineSchema = z.object({
  initiativeId: z.string(),
  name: z.string().min(1),
  category: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  type: z.enum(['BENEFIT', 'COST']),
});

router.post('/lines', async (req, res, next) => {
  try {
    const data = lineSchema.parse(req.body);
    const init = await tenantInitiative(data.initiativeId, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Initiative not found' });

    const payload = {
      initiativeId: data.initiativeId,
      name: data.name,
      category: data.category,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    };
    const line = data.type === 'BENEFIT'
      ? await prisma.benefitLine.create({ data: payload })
      : await prisma.costLine.create({ data: payload });
    res.status(201).json({ ...line, type: data.type });
  } catch (e) { next(e); }
});

router.delete('/lines/:type/:id', async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const model = type === 'BENEFIT' ? prisma.benefitLine : prisma.costLine;
    const line = await model.findUnique({
      where: { id },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!line || line.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    await model.delete({ where: { id } });
    await recomputeInitiative(line.initiativeId);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Bulk upsert of monthly metric values
const valuesSchema = z.object({
  type: z.enum(['BENEFIT', 'COST']),
  lineId: z.string(),
  dataset: z.enum(['ACTUAL', 'TARGET', 'FORECAST']),
  values: z.array(z.object({
    periodStart: z.string(), // ISO date for first day of month
    amount: z.number(),
  })),
});

router.post('/values', async (req, res, next) => {
  try {
    const data = valuesSchema.parse(req.body);
    const model = data.type === 'BENEFIT' ? prisma.benefitLine : prisma.costLine;
    const line = await model.findUnique({
      where: { id: data.lineId },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!line || line.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Line not found' });

    // Delete existing values for this dataset, then re-create
    const fkField = data.type === 'BENEFIT' ? 'benefitLineId' : 'costLineId';
    await prisma.metricValue.deleteMany({
      where: { [fkField]: data.lineId, dataset: data.dataset },
    });
    if (data.values.length > 0) {
      await prisma.metricValue.createMany({
        data: data.values.map((v) => ({
          [fkField]: data.lineId,
          dataset: data.dataset,
          periodStart: new Date(v.periodStart),
          amount: v.amount,
        })),
      });
    }
    await recomputeInitiative(line.initiativeId);
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: data.type === 'BENEFIT' ? 'BenefitLine' : 'CostLine',
      entityId: data.lineId, action: 'UPDATE_VALUES',
      diff: { dataset: data.dataset, count: data.values.length },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/lines/:type/:id/values', async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const model = type === 'BENEFIT' ? prisma.benefitLine : prisma.costLine;
    const line = await model.findUnique({
      where: { id },
      include: {
        values: true,
        initiative: { include: { workstream: { include: { program: true } } } },
      },
    });
    if (!line || line.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    res.json(line.values);
  } catch (e) { next(e); }
});

export default router;
