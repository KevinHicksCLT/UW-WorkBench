import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.AuditEntryWhereInput = { tenantId: req.tenantId };
    if (req.query.entityType) where.entityType = req.query.entityType as string;
    if (req.query.entityId) where.entityId = req.query.entityId as string;
    const entries = await prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 100, 500),
    });
    res.json(entries);
  } catch (e) { next(e); }
});

export default router;
