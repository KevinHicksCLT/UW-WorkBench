// Inbound IAM webhook receiver. HMAC-SHA256 signed (X-Signature over the raw
// body, secret = the API key's webhookSecret), idempotent via the WebhookEvent
// ledger (@@unique tenantId+externalEventId). Deterministic processing
// failures are recorded FAILED and answered 200 — the IAM only retries on 5xx,
// and a retry of a bad payload would fail identically.
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GEOGRAPHIES, USER_TYPES } from '@cascade/shared';
import { prisma } from '../../db/prisma.js';
import { verifyWebhookSignature } from '../../lib/apiKeys.js';
import { upsertUser, deactivateUser, validateUserRefs } from '../../services/userProvisioning.js';
import { logger } from '../../lib/logger.js';

const webhookUserSchema = z.object({
  externalId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(USER_TYPES).optional(),
  status: z.enum(['ACTIVE', 'DEACTIVATED']).optional(),
  orgUnitId: z.string().nullable().optional(),
  geography: z.enum(GEOGRAPHIES).nullable().optional(),
  operatingRoleId: z.string().nullable().optional(),
  isManager: z.boolean().optional(),
  reportsToId: z.string().nullable().optional(),
  isApprover: z.boolean().optional(),
  valueStreamIds: z.array(z.string()).optional(),
});

const envelopeSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(['user.created', 'user.updated', 'user.deactivated']),
  data: z.object({ user: webhookUserSchema }),
});

function isP2002(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

async function dispatch(
  tenantId: string,
  actorLabel: string,
  envelope: z.infer<typeof envelopeSchema>,
): Promise<void> {
  const u = envelope.data.user;
  if (envelope.eventType === 'user.deactivated') {
    const user = await deactivateUser(
      tenantId,
      { externalId: u.externalId },
      actorLabel,
      'PROVISION',
    );
    if (!user) throw new Error(`User not found for externalId ${u.externalId}`);
    return;
  }
  const refErrors = await validateUserRefs(tenantId, u);
  if (refErrors.length > 0) {
    throw new Error(refErrors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }
  await upsertUser({
    tenantId,
    actorLabel,
    source: 'PROVISION',
    byExternalId: u.externalId,
    data: u,
  });
}

export function registerWebhookRoutes(router: Router): void {
  router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.apiKey;
      if (!key?.webhookSecret) {
        return res.status(400).json({ error: 'No webhook secret configured for this API key' });
      }
      if (!req.rawBody) {
        return res.status(400).json({ error: 'Raw body unavailable — cannot verify signature' });
      }
      const signature = req.headers['x-signature'];
      if (
        !verifyWebhookSignature(
          req.rawBody,
          key.webhookSecret,
          typeof signature === 'string' ? signature : undefined,
        )
      ) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const parsed = envelopeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'Invalid webhook envelope', issues: parsed.error.issues });
      }
      const envelope = parsed.data;

      // Idempotency ledger — a replayed eventId short-circuits to "duplicate".
      let ledger;
      try {
        ledger = await prisma.webhookEvent.create({
          data: {
            tenantId: req.tenantId,
            apiKeyId: key.id,
            externalEventId: envelope.eventId,
            eventType: envelope.eventType,
          },
        });
      } catch (e) {
        if (isP2002(e)) return res.json({ status: 'duplicate' });
        throw e;
      }

      try {
        await dispatch(req.tenantId, `apiKey:${key.name}`, envelope);
        res.json({ status: 'processed' });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Processing failed';
        logger.warn({ err: e, eventId: envelope.eventId }, 'webhook event processing failed');
        await prisma.webhookEvent.update({
          where: { id: ledger.id },
          data: { status: 'FAILED', error: message },
        });
        // 200: the event was handled (and recorded); retrying wouldn't change it.
        res.json({ status: 'failed', error: message });
      }
    } catch (e) {
      next(e);
    }
  });
}
