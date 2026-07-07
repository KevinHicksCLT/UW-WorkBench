// Tenant permission-set editor (User Admin → User Types & Permissions).
// SITE_ADMIN only. Registered BEFORE manage.ts so /permission-sets is never
// swallowed by the /:id catch-all.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { permissionGrantSchema, isUserType, USER_TYPES } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { maybeHold } from '../../lib/approvals/engine.js';
import { replacePermissionSetGrants } from '../../services/permissionSetWrites.js';

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

        // DA-01 four-eyes: replacing a user type's entitlements is held for a
        // second SITE_ADMIN when the policy is enabled.
        const held = await maybeHold(
          { tenantId: req.tenantId, userId: req.user.id, email: req.user.email },
          {
            decisionKey: 'user-admin.permission-sets.replace',
            entityType: 'PermissionSet',
            entityId: userType, // stable per tenant; the set row is upserted at apply time
            action: 'REPLACE_GRANTS',
            summary: `Replace the "${userType}" permission set (${grants.length} grant${grants.length === 1 ? '' : 's'})`,
            payload: { userType, grants },
          },
        );
        if (held) return res.status(202).json(held);

        const fresh = await replacePermissionSetGrants(
          req.tenantId,
          userType,
          grants,
          req.user.email,
        );
        res.json(fresh);
      } catch (e) {
        next(e);
      }
    },
  );
}
