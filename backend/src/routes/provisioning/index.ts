/**
 * Router assembly for /provisioning — the machine-to-machine surface for
 * external IAM (Okta-style) user lifecycle. NO requireAuth here: every route
 * authenticates via apiKeyAuth (tenant comes from the key, req.user stays
 * unset). Sub-modules: REST upserts/deprovision (users.ts) and the signed
 * inbound webhook (webhook.ts).
 */
import { Router } from 'express';
import { apiKeyAuth } from '../../middleware/apiKeyAuth.js';
import { registerProvisioningUserRoutes } from './users.js';
import { registerWebhookRoutes } from './webhook.js';

const router = Router();
router.use(apiKeyAuth);

registerProvisioningUserRoutes(router);
registerWebhookRoutes(router);

export default router;
