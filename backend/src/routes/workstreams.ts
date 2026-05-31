import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// Tenant-scoped lookup helper
async function tenantWorkstream(id: string, tenantId: string) {
  return prisma.workstream.findFirst({
    where: { id, program: { tenantId } },
  });
}

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ws = await prisma.workstream.findFirst({
      where: { id: req.params.id, program: { tenantId: req.tenantId } },
      include: {
        program: true,
        initiatives: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            sponsor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!ws) return res.status(404).json({ error: 'Not found' });
    res.json(ws);
  } catch (e) { next(e); }
});

const createSchema = z.object({
  programId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    const program = await prisma.program.findFirst({
      where: { id: data.programId, tenantId: req.tenantId },
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const ws = await prisma.workstream.create({ data });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Workstream', entityId: ws.id, action: 'CREATE',
    });
    res.status(201).json(ws);
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  statusNote: z.string().optional(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantWorkstream(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = updateSchema.parse(req.body);
    const updated = await prisma.workstream.update({
      where: { id: req.params.id }, data,
    });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Workstream', entityId: req.params.id, action: 'UPDATE', diff: data,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await tenantWorkstream(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.workstream.delete({ where: { id: req.params.id } });
    await logAudit({
      tenantId: req.tenantId, actorEmail: req.user.email,
      entityType: 'Workstream', entityId: req.params.id, action: 'DELETE',
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
