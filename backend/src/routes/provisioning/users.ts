/**
 * REST user-provisioning surface for external IAM (SCIM-flavoured, key-authed).
 * Authentication is apiKeyAuth (router-level in provisioning/index.ts) — there
 * is NO req.user on this surface; the tenant comes from the API key and the
 * audit actor is "apiKey:<name>".
 *
 * Accepted body shape (ids, not names — resolve names on the IAM side or use
 * the spreadsheet import for name-based loading):
 *   {
 *     email: string (required), name: string (required — or supply
 *       firstName + lastName and the write path composes it),
 *     firstName?: string, lastName?: string,
 *     role?:  SITE_ADMIN|CORE_BUSINESS_ADMIN|TECHNOLOGY_ADMIN|
 *             CORPORATE_FUNCTIONS_ADMIN|SUPER_USER|MEMBER,
 *     status?: ACTIVE|DEACTIVATED,
 *     externalId?: string (POST only; PUT takes it from the path),
 *     orgUnitId?: string|null, geography?: GLOBAL|NORTH_AMERICA|UK_EUROPE|APAC|LATAM|null,
 *     operatingRoleId?: string|null, isManager?: boolean,
 *     reportsToId?: string|null, isApprover?: boolean,
 *     valueStreamIds?: string[] (L2 ProcessNode ids — replaces links)
 *   }
 * No password field: provisioned users authenticate via IAM.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userUpsertSchema } from '@cascade/shared';
import {
  upsertUser,
  deactivateUser,
  validateUserRefs,
  sanitizeUser,
} from '../../services/userProvisioning.js';

const provisionBodySchema = userUpsertSchema.omit({ password: true }).extend({
  status: z.enum(['ACTIVE', 'DEACTIVATED']).optional(),
  externalId: z.string().min(1).optional(),
});

function actorLabel(req: Request): string {
  return `apiKey:${req.apiKey?.name ?? 'unknown'}`;
}

export function registerProvisioningUserRoutes(router: Router): void {
  // Idempotent upsert keyed by the IAM subject id.
  router.put('/users/:externalId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = provisionBodySchema.parse(req.body);
      const refErrors = await validateUserRefs(req.tenantId, body);
      if (refErrors.length > 0)
        return res.status(400).json({ error: 'Invalid references', fields: refErrors });
      const { user, created } = await upsertUser({
        tenantId: req.tenantId,
        actorLabel: actorLabel(req),
        source: 'PROVISION',
        byExternalId: req.params.externalId,
        data: { ...body, externalId: req.params.externalId },
      });
      res.status(created ? 201 : 200).json(sanitizeUser(user));
    } catch (e) {
      next(e);
    }
  });

  // Upsert keyed by email (for IAMs that don't carry a stable subject id).
  router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = provisionBodySchema.parse(req.body);
      const refErrors = await validateUserRefs(req.tenantId, body);
      if (refErrors.length > 0)
        return res.status(400).json({ error: 'Invalid references', fields: refErrors });
      const { user, created } = await upsertUser({
        tenantId: req.tenantId,
        actorLabel: actorLabel(req),
        source: 'PROVISION',
        data: body,
      });
      res.status(created ? 201 : 200).json(sanitizeUser(user));
    } catch (e) {
      next(e);
    }
  });

  // Deprovision (soft-delete). Unknown externalId → 404.
  router.delete('/users/:externalId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await deactivateUser(
        req.tenantId,
        { externalId: req.params.externalId },
        actorLabel(req),
        'PROVISION',
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ id: user.id, status: user.status });
    } catch (e) {
      next(e);
    }
  });
}
