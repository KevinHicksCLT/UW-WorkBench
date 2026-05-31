import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { tenantId: req.tenantId };
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.entityId) where.entityId = req.query.entityId;
    const entries = await prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(req.query.limit) || 100,
    });
    res.json(entries);
  } catch (e) { next(e); }
});

export default router;
