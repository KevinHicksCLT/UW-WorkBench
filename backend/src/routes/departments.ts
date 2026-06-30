import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /departments/:id — department → roles (rich roles table).
// erd_v5 has NO Department tier in the org spine (OrgUnit only goes L1 Segment →
// L2 Division). This route resolves the id as an OrgUnit and lists the roles homed
// on it. Per-role value-stream participation now comes from NodeRole (role ↔
// process node) and is resolved on the dedicated role-context endpoint, so it is
// not expanded here — the shape (roles[] + totals) is preserved with empty
// participations.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await prisma.orgUnit.findFirst({
      where: { id: req.params.id },
      select: {
        id: true, displayValue: true,
        company: { select: { id: true, name: true, tenantId: true } },
        parent: { select: { id: true, displayValue: true } },
        roles: {
          orderBy: { displayValue: 'asc' },
          select: {
            id: true, displayValue: true,
            _count: { select: { checklistItems: true, nodeRoles: true } },
          },
        },
      },
    });
    if (!unit || unit.company.tenantId !== req.tenantId) return res.status(404).json({ error: 'Not found' });

    const roles = unit.roles.map((r) => ({
      id: r.id, name: r.displayValue, roleLevel: null, roleFamily: null, description: null,
      valueStreamCount: 0,
      checklistCount: r._count.checklistItems,
      taskCount: r._count.nodeRoles,
      participations: [] as unknown[],
    }));

    res.json({
      id: unit.id, name: unit.displayValue,
      company: { id: unit.company.id, name: unit.company.name },
      division: unit.parent ? { id: unit.parent.id, name: unit.parent.displayValue, higherCategory: null } : null,
      totals: { roles: roles.length },
      roles,
    });
  } catch (e) { next(e); }
});

export default router;
