import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { summarizeProgram } from '../services/rollup.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programs = await prisma.program.findMany({
      where: { tenantId: req.tenantId },
      include: {
        workstreams: {
          include: {
            initiatives: { select: { id: true, status: true, stage: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(programs);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const program = await prisma.program.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        workstreams: {
          include: {
            initiatives: {
              include: {
                owner: { select: { id: true, name: true, email: true } },
                sponsor: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!program) return res.status(404).json({ error: 'Not found' });
    res.json(program);
  } catch (e) { next(e); }
});

router.get('/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await summarizeProgram(req.params.id);
    if (!summary) return res.status(404).json({ error: 'Not found' });
    res.json(summary);
  } catch (e) { next(e); }
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    const program = await prisma.program.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        tenantId: req.tenantId,
      },
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Program', entityId: program.id, action: 'CREATE',
    });
    res.status(201).json(program);
  } catch (e) { next(e); }
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateSchema.parse(req.body);
    const patch: any = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    const program = await prisma.program.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: patch,
    });
    if (program.count === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.program.findUnique({ where: { id: req.params.id } });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Program', entityId: req.params.id, action: 'UPDATE', diff: data,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.program.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Program', entityId: req.params.id, action: 'DELETE',
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
