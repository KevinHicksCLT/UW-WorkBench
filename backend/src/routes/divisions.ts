import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('organization'));

// GET /divisions/:id — division → (departments) → roles.
// erd_v5: a division is an OrgUnit at level 2; there is no Department tier, so
// departments is always empty and roles homed on the OrgUnit are returned directly.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await prisma.orgUnit.findFirst({
      where: { id: req.params.id },
      select: {
        id: true,
        displayValue: true,
        company: { select: { id: true, name: true, tenantId: true } },
        roles: { orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true } },
      },
    });
    if (!unit || unit.company.tenantId !== req.tenantId)
      return res.status(404).json({ error: 'Not found' });
    res.json({
      id: unit.id,
      name: unit.displayValue,
      company: { id: unit.company.id, name: unit.company.name },
      departments: [],
      roles: unit.roles.map((r) => ({ id: r.id, name: r.displayValue, roleFamily: null })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
