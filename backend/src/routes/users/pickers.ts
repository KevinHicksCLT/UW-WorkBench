// Picker data for the User Admin detail form — org-unit tree, operating-model
// roles, and value streams (L2 ProcessNodes), tenant-scoped across companies.
// User-admin gated (same chain as manage.ts). For domain admins the org-unit
// list is additionally cut to their administrable subtree, since those are the
// only homes they may assign. Registered BEFORE manage.ts's /:id catch-all.
import type { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../../db/prisma.js';
import { requirePermission, requireUserAdmin } from '../../middleware/permissions.js';

export function registerPickerRoutes(router: Router): void {
  const guards: RequestHandler[] = [requirePermission('user-admin.users'), requireUserAdmin()];

  router.get('/pickers', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = req.userAdminScope;
      const [orgUnits, roles, valueStreams] = await Promise.all([
        prisma.orgUnit.findMany({
          where: {
            company: { tenantId: req.tenantId },
            ...(scope && scope !== 'all' ? { id: { in: scope.orgUnitIds } } : {}),
          },
          select: {
            id: true,
            displayValue: true,
            parentId: true,
            sortOrder: true,
            orgLevelType: { select: { levelNumber: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
        }),
        prisma.role.findMany({
          where: { company: { tenantId: req.tenantId } },
          select: { id: true, displayValue: true },
          orderBy: { displayValue: 'asc' },
        }),
        prisma.processNode.findMany({
          where: { company: { tenantId: req.tenantId }, processLevelType: { levelNumber: 2 } },
          select: { id: true, displayValue: true },
          orderBy: { displayValue: 'asc' },
        }),
      ]);
      res.json({
        orgUnits: orgUnits.map((u) => ({
          id: u.id,
          displayValue: u.displayValue,
          parentId: u.parentId,
          level: u.orgLevelType.levelNumber,
        })),
        roles,
        valueStreams,
      });
    } catch (e) {
      next(e);
    }
  });
}
