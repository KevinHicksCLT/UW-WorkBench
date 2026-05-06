import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

async function tenantInitiative(id, tenantId) {
  return prisma.initiative.findFirst({
    where: { id, workstream: { program: { tenantId } } },
  });
}

router.get('/', async (req, res, next) => {
  try {
    const where = { initiative: { workstream: { program: { tenantId: req.tenantId } } } };
    if (req.query.programId) where.initiative.workstream.programId = req.query.programId;
    if (req.query.initiativeId) where.initiativeId = req.query.initiativeId;
    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    const items = await prisma.raidItem.findMany({
      where,
      include: {
        initiative: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { severity: 'desc' },
    });
    res.json(items);
  } catch (e) { next(e); }
});

const createSchema = z.object({
  initiativeId: z.string(),
  type: z.enum(['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION']),
  title: z.string().min(1),
  description: z.string().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  mitigation: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const init = await tenantInitiative(data.initiativeId, req.tenantId);
    if (!init) return res.status(404).json({ error: 'Initiative not found' });
    const probability = data.probability ?? 3;
    const impact = data.impact ?? 3;
    const item = await prisma.raidItem.create({
      data: {
        ...data,
        probability,
        impact,
        severity: probability * impact,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'RaidItem', entityId: item.id, action: 'CREATE',
    });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

const updateSchema = createSchema.partial().omit({ initiativeId: true }).extend({
  status: z.enum(['OPEN', 'MITIGATED', 'CLOSED']).optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const item = await prisma.raidItem.findUnique({
      where: { id: req.params.id },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!item || item.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    const data = updateSchema.parse(req.body);
    const patch = { ...data };
    if (data.dueDate) patch.dueDate = new Date(data.dueDate);
    const probability = data.probability ?? item.probability;
    const impact = data.impact ?? item.impact;
    if (data.probability !== undefined || data.impact !== undefined) {
      patch.severity = probability * impact;
    }
    const updated = await prisma.raidItem.update({
      where: { id: req.params.id }, data: patch,
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'RaidItem', entityId: req.params.id, action: 'UPDATE', diff: data,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await prisma.raidItem.findUnique({
      where: { id: req.params.id },
      include: { initiative: { include: { workstream: { include: { program: true } } } } },
    });
    if (!item || item.initiative.workstream.program.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    await prisma.raidItem.delete({ where: { id: req.params.id } });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'RaidItem', entityId: req.params.id, action: 'DELETE',
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
