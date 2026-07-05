// Approvals feature router — My Approvals inbox, request decisions, and the
// policy registry (Phase 1 of the creator → approver framework;
// documents/approvals/approval-framework-plan.md).
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerRequestRoutes } from './requests.js';
import { registerPolicyRoutes } from './policies.js';

const router = Router();
router.use(requireAuth);

registerPolicyRoutes(router); // /policies before /:id-style request routes
registerRequestRoutes(router);

export default router;
