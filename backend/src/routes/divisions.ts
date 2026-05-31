import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /divisions/:id — division → departments → roles.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const division = await prisma.division.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        company: { select: { id: true, name: true } },
        departments: {
          orderBy: { name: 'asc' },
          include: {
            roles: { orderBy: { name: 'asc' }, select: { id: true, name: true, roleFamily: true } },
          },
        },
      },
    });
    if (!division) return res.status(404).json({ error: 'Not found' });
    res.json(division);
  } catch (e) { next(e); }
});

export default router;
