// Manual user CRUD for the User Admin → Users sheet. Every route is gated by
// requirePermission('user-admin.users') + requireUserAdmin() (ABAC org scope);
// out-of-scope targets return 404, never 403. All writes funnel through
// services/userProvisioning (the single user write path).
import type { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { userUpsertSchema } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';
import {
  requirePermission,
  requireUserAdmin,
  userScopeWhere,
} from '../../middleware/permissions.js';
import {
  upsertUser,
  deactivateUser,
  validateUserRefs,
  sanitizeUser,
} from '../../services/userProvisioning.js';
import { escalationError, targetIsProtectedFrom, USER_LIST_INCLUDE } from './helpers.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  managersOnly: z.string().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/** Scope-filtered target fetch shared by GET/:id, PATCH/:id, DELETE/:id. */
async function findScopedUser(req: Request, id: string) {
  return prisma.user.findFirst({
    where: { id, tenantId: req.tenantId, ...userScopeWhere(req) },
  });
}

export function registerManageRoutes(router: Router): void {
  const guards: RequestHandler[] = [requirePermission('user-admin.users'), requireUserAdmin()];

  router.get('/', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const users = await prisma.user.findMany({
        where: {
          tenantId: req.tenantId,
          ...userScopeWhere(req),
          ...(q.managersOnly === '1' ? { isManager: true } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { email: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        omit: { password: true },
        include: USER_LIST_INCLUDE,
        orderBy: { name: 'asc' },
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      });
      res.json(users);
    } catch (e) {
      next(e);
    }
  });

  router.get('/:id', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId, ...userScopeWhere(req) },
        omit: { password: true },
        include: USER_LIST_INCLUDE,
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e) {
      next(e);
    }
  });

  router.post('/', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = userUpsertSchema.parse(req.body);
      // Domain admins must place new users inside their own scope (absent
      // orgUnitId would put the user outside every domain admin's reach).
      const escalation = escalationError(req, {
        role: body.role,
        orgUnitId: body.orgUnitId ?? null,
        orgUnitProvided: true,
      });
      if (escalation) return res.status(403).json({ error: escalation });

      const refErrors = await validateUserRefs(req.tenantId, body);
      if (refErrors.length > 0)
        return res.status(400).json({ error: 'Invalid references', fields: refErrors });

      const { user, created } = await upsertUser({
        tenantId: req.tenantId,
        actorLabel: req.user.email,
        data: body,
      });
      res.status(created ? 201 : 200).json(sanitizeUser(user));
    } catch (e) {
      next(e);
    }
  });

  router.patch('/:id', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const target = await findScopedUser(req, req.params.id);
      if (!target) return res.status(404).json({ error: 'User not found' });

      const body = userUpsertSchema.partial().parse(req.body);

      // A domain admin cannot touch a user whose CURRENT role is an admin type.
      if (targetIsProtectedFrom(req, target.role)) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Nobody — SITE_ADMIN included — may change their own role.
      if (target.id === req.user.id && body.role !== undefined && body.role !== req.user.role) {
        return res.status(403).json({ error: 'You cannot change your own role' });
      }
      const escalation = escalationError(req, {
        role: body.role,
        orgUnitId: body.orgUnitId ?? null,
        orgUnitProvided: 'orgUnitId' in body,
      });
      if (escalation) return res.status(403).json({ error: escalation });

      const refErrors = await validateUserRefs(req.tenantId, body);
      if (refErrors.length > 0)
        return res.status(400).json({ error: 'Invalid references', fields: refErrors });

      const { user } = await upsertUser({
        tenantId: req.tenantId,
        actorLabel: req.user.email,
        data: body,
        byId: target.id,
      });
      res.json(sanitizeUser(user));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/:id', ...guards, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const target = await findScopedUser(req, req.params.id);
      if (!target || targetIsProtectedFrom(req, target.role)) {
        return res.status(404).json({ error: 'User not found' });
      }
      await deactivateUser(req.tenantId, { id: target.id }, req.user.email);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
}
