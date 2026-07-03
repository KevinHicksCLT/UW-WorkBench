// Per-user permission surface: effective permissions (set + overrides merged)
// and the tri-state override editor. User-admin gated; targets are scope-
// checked with 404 on miss (never 403).
import type { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { permissionOverrideSchema } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';
import {
  requirePermission,
  requireUserAdmin,
  userScopeWhere,
} from '../../middleware/permissions.js';
import {
  getEffectivePermissions,
  invalidateUserPermissions,
} from '../../services/permissionService.js';
import { logAudit } from '../../services/audit.js';

const overridesBodySchema = z.array(permissionOverrideSchema);

export function registerPermissionRoutes(router: Router): void {
  const guards: RequestHandler[] = [requirePermission('user-admin.users'), requireUserAdmin()];

  router.get(
    '/:id/permissions',
    ...guards,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const target = await prisma.user.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, ...userScopeWhere(req) },
        });
        if (!target) return res.status(404).json({ error: 'User not found' });
        const [effective, overrides] = await Promise.all([
          getEffectivePermissions(target),
          prisma.userPermissionOverride.findMany({ where: { userId: target.id } }),
        ]);
        res.json({ effective, overrides });
      } catch (e) {
        next(e);
      }
    },
  );

  // Replace-all semantics: rows with at least one non-null action are written;
  // everything else is dropped. Implemented as deleteMany + createMany in one
  // transaction (simplest correct form of "upsert non-empty, delete empty").
  router.put(
    '/:id/overrides',
    ...guards,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const target = await prisma.user.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId, ...userScopeWhere(req) },
        });
        if (!target) return res.status(404).json({ error: 'User not found' });

        const body = overridesBodySchema.parse(req.body);
        const nonEmpty = body.filter(
          (o) =>
            (o.canCreate ?? null) !== null ||
            (o.canRead ?? null) !== null ||
            (o.canUpdate ?? null) !== null ||
            (o.canDelete ?? null) !== null,
        );

        const before = await prisma.userPermissionOverride.findMany({
          where: { userId: target.id },
        });
        await prisma.$transaction(async (tx) => {
          await tx.userPermissionOverride.deleteMany({ where: { userId: target.id } });
          if (nonEmpty.length > 0) {
            await tx.userPermissionOverride.createMany({
              data: nonEmpty.map((o) => ({
                userId: target.id,
                menuKey: o.menuKey,
                canCreate: o.canCreate ?? null,
                canRead: o.canRead ?? null,
                canUpdate: o.canUpdate ?? null,
                canDelete: o.canDelete ?? null,
              })),
            });
          }
        });
        invalidateUserPermissions(target.id);

        const beforeKeys = new Set<string>(before.map((o) => o.menuKey));
        const afterKeys = new Set<string>(nonEmpty.map((o) => o.menuKey));
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'User',
          entityId: target.id,
          action: 'PERMISSIONS_OVERRIDE',
          diff: {
            added: [...afterKeys].filter((k) => !beforeKeys.has(k)),
            removed: [...beforeKeys].filter((k) => !afterKeys.has(k)),
            kept: [...afterKeys].filter((k) => beforeKeys.has(k)),
          },
        });

        const overrides = await prisma.userPermissionOverride.findMany({
          where: { userId: target.id },
        });
        res.json({ overrides });
      } catch (e) {
        next(e);
      }
    },
  );
}
