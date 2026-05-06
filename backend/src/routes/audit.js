import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const where = { tenantId: req.tenantId };
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
