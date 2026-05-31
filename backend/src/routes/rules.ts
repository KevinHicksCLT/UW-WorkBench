import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.businessRule.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (e) { next(e); }
});

const ruleSchema = z.object({
  name: z.string().min(1),
  entityType: z.enum(['Initiative', 'RaidItem', 'Program', 'Workstream']),
  trigger: z.enum(['ON_CREATE', 'ON_UPDATE', 'ON_FIELD_CHANGE']),
  fieldName: z.string().optional(),
  fieldValue: z.string().optional(),
  action: z.enum(['SET_VALUE', 'NOTIFY', 'RUN_RULE']),
  actionConfig: z.string(),
  enabled: z.boolean().default(true),
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ruleSchema.parse(req.body);
    const rule = await prisma.businessRule.create({
      data: { ...data, tenantId: req.tenantId },
    });
    res.status(201).json(rule);
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ruleSchema.partial().parse(req.body);
    const r = await prisma.businessRule.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId }, data,
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    res.json(await prisma.businessRule.findUnique({ where: { id: req.params.id } }));
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.businessRule.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
