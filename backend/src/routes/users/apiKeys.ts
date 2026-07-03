// API-key management (User Admin → API Keys & Provisioning). SITE_ADMIN only.
// The raw key (and webhook secret) is returned exactly ONCE from POST — reads
// only ever expose the prefix. Registered before manage.ts's /:id catch-all.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { generateApiKey, generateWebhookSecret } from '../../lib/apiKeys.js';
import { logAudit } from '../../services/audit.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  withWebhookSecret: z.boolean().optional(),
});

export function registerApiKeyRoutes(router: Router): void {
  const guard = requireRole('SITE_ADMIN');

  router.get('/api-keys', guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { tenantId: req.tenantId },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
          webhookSecret: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(
        keys.map(({ webhookSecret, ...rest }) => ({
          ...rest,
          hasWebhookSecret: webhookSecret !== null,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  router.post('/api-keys', guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSchema.parse(req.body);
      const generated = generateApiKey();
      const webhookSecret = body.withWebhookSecret ? generateWebhookSecret() : null;
      const key = await prisma.apiKey.create({
        data: {
          tenantId: req.tenantId,
          name: body.name,
          keyPrefix: generated.prefix,
          keyHash: generated.hash,
          webhookSecret,
        },
      });
      await logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'ApiKey',
        entityId: key.id,
        action: 'CREATE',
        diff: {
          name: key.name,
          keyPrefix: key.keyPrefix,
          hasWebhookSecret: webhookSecret !== null,
        },
      });
      // The one and only exposure of the raw secret(s).
      res.status(201).json({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        key: generated.raw,
        ...(webhookSecret ? { webhookSecret } : {}),
      });
    } catch (e) {
      next(e);
    }
  });

  router.post(
    '/api-keys/:id/revoke',
    guard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = await prisma.apiKey.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
        });
        if (!key) return res.status(404).json({ error: 'API key not found' });
        const revoked = key.revokedAt
          ? key
          : await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
        await logAudit({
          tenantId: req.tenantId,
          actorEmail: req.user.email,
          entityType: 'ApiKey',
          entityId: key.id,
          action: 'REVOKE',
          diff: { name: key.name, revokedAt: revoked.revokedAt },
        });
        res.json({ id: revoked.id, revokedAt: revoked.revokedAt });
      } catch (e) {
        next(e);
      }
    },
  );
}
