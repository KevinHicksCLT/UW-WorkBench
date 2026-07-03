// Entitlement middleware — menu-key CRUD enforcement + user-admin ABAC scope.
// Mount AFTER requireAuth and BEFORE cacheResponses (denials must never touch
// the shared response cache; permissions here are router-level, which is what
// keeps the tenant-keyed cache safe — see lib/responseCache.ts).
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  DOMAIN_ADMIN_SCOPE,
  isDomainAdmin,
  type MenuAction,
  type MenuKey,
  type UserType,
} from '@cascade/shared';
import { prisma } from '../db/prisma.js';
import { getEffectivePermissions, hasPermission } from '../services/permissionService.js';

function actionForMethod(method: string): MenuAction {
  switch (method) {
    case 'POST':
      return 'create';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'DELETE':
      return 'delete';
    default: // GET / HEAD / OPTIONS
      return 'read';
  }
}

/**
 * Gate a router (or a single route) behind a menu-key permission. When
 * `action` is omitted it derives from the HTTP method, so one router-level
 * `requirePermission('regulations')` covers reads AND writes with the right
 * CRUD semantics.
 */
export function requirePermission(menuKey: MenuKey, action?: MenuAction): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user.status === 'DEACTIVATED') {
        return res.status(401).json({ error: 'Account deactivated' });
      }
      const perms = await getEffectivePermissions(req.user);
      const needed = action ?? actionForMethod(req.method);
      if (!hasPermission(perms, menuKey, needed)) {
        // In-tenant denial: menu keys aren't secrets (the nav reveals them), so
        // 403 with the missing permission beats an opaque 404 here.
        return res.status(403).json({ error: `Missing permission: ${menuKey}:${needed}` });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * OR-variant for routers that back more than one tab (e.g. /work serves both
 * the Deliverables and Tasks sheets): the request passes if ANY of the keys
 * grants the needed action.
 */
export function requireAnyPermission(
  menuKeys: readonly MenuKey[],
  action?: MenuAction,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user.status === 'DEACTIVATED') {
        return res.status(401).json({ error: 'Account deactivated' });
      }
      const perms = await getEffectivePermissions(req.user);
      const needed = action ?? actionForMethod(req.method);
      if (!menuKeys.some((k) => hasPermission(perms, k, needed))) {
        return res
          .status(403)
          .json({ error: `Missing permission: ${menuKeys.join('|')}:${needed}` });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Resolve the caller's user-administration scope (ABAC). SITE_ADMIN manages
 * everyone; a domain admin manages users homed in the OrgUnit subtree under
 * the L1 whose dbValue matches DOMAIN_ADMIN_SCOPE, unioned across the tenant's
 * companies. Everyone else is rejected. Sets req.userAdminScope.
 */
export function requireUserAdmin(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user.role === 'SITE_ADMIN') {
        req.userAdminScope = 'all';
        return next();
      }
      if (!isDomainAdmin(req.user.role)) {
        return res.status(403).json({ error: 'Requires a user-administration role' });
      }
      const anchor = DOMAIN_ADMIN_SCOPE[req.user.role as UserType];
      const l1s = await prisma.orgUnit.findMany({
        where: { dbValue: anchor, company: { tenantId: req.tenantId } },
        select: { id: true },
      });
      if (l1s.length === 0) {
        // The anchor L1 was renamed/removed — fail closed rather than wide.
        return res.status(403).json({ error: 'No administrable organization scope' });
      }
      const edges = await prisma.orgUnitClosure.findMany({
        where: { ancestorId: { in: l1s.map((u) => u.id) } },
        select: { descendantId: true },
      });
      req.userAdminScope = { orgUnitIds: [...new Set(edges.map((e) => e.descendantId))] };
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Prisma `where` fragment limiting a User query to the caller's admin scope. */
export function userScopeWhere(req: Request): Record<string, unknown> {
  const scope = req.userAdminScope;
  if (scope === 'all' || scope === undefined) return {};
  return { orgUnitId: { in: scope.orgUnitIds } };
}
