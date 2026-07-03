// Tenant permission-set editor (User Admin → User Types & Permissions).
// SITE_ADMIN only. Registered BEFORE manage.ts so /permission-sets is never
// swallowed by the /:id catch-all.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { permissionGrantSchema, isUserType, USER_TYPES } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { invalidateTenantPermissions } from '../../services/permissionService.js';
import { logAudit } from '../../services/audit.js';

const putBodySchema = z.object({ grants: z.array(permissionGrantSchema) });

export function registerPermissionSetRoutes(router: Router): void {
  const guard = requireRole('SITE_ADMIN');

  // Always returns all six sets (one per user type) — missing ones are created
  // empty on the fly so the UI never has to special-case absence.
  router.get('/permission-sets', guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.permissionSet.findMany({
        where: { tenantId: req.tenantId },
        include: { grants: true },
      });
      const byType = new Map(existing.map((s) => [s.userType, s]));
      for (const userType of USER_TYPES) {
        if (byType.has(userType)) continue;
        const created = await prisma.permissionSet.create({
          data: { tenantId: req.tenantId, userType },
          include: { grants: true },
        });
        byType.set(userType, created);
      }
      res.json(USER_TYPES.map((t) => byType.get(t)));
    } catch (e) {
      next(e);
    }
  });

  router.put(
    '/permission-sets/:userType',
    guard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userType = req.params.userType;
        if (!isUserType(userType)) return res.status(404).json({ error: 'Unknown user type' });
        const { grants } = putBodySchema.parse(req.body);

        const set = await prisma.permissionSet.upsert({
          where: { tenantId_userType: { tenantId: req.tenantId, userType } },
          update: {},
          create: { tenantId: req.tenantId, userType },
        });

        await prisma.$transaction(async (tx) => {
          await tx.permissionGrant.deleteMany({ where: { permissionSetId: set.id } });
          if (grants.length > 0) {
            await tx.permissionGrant.createMany({
              data: grants.map((g) => ({
                permissionSetId: set.id,
                menuKey: g.menuKey,
                canCreate: g.canCreate,
                canRead: g.canRead,
                canUpdate: g.canUpdate,
                canDelete: g.canDelete,
              })),
            });
          }
        });
        invalidateTenantPermissions(req.tenantId);

        await logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'PermissionSet',
          entityId: set.id,
          action: 'UPDATE',
          diff: { userType, menuKeys: grants.map((g) => g.menuKey) },
        });

        const fresh = await prisma.permissionSet.findUnique({
          where: { id: set.id },
          include: { grants: true },
        });
        res.json(fresh);
      } catch (e) {
        next(e);
      }
    },
  );
}
