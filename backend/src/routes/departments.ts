import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /departments/:id — department → roles (+ parent division/company for breadcrumbs).
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const department = await prisma.department.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        company: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        roles: { orderBy: { name: 'asc' }, select: { id: true, name: true, roleFamily: true } },
      },
    });
    if (!department) return res.status(404).json({ error: 'Not found' });
    res.json(department);
  } catch (e) { next(e); }
});

export default router;
