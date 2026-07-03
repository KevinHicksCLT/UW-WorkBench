// Work Library API — reusable checklist/testing templates (WorkTemplate/
// WorkTemplateKey) applied to atomic work items (task ProcessNodes, leaf
// Standards, RegulatoryRequirements) as plans. Answers live per (subject,
// templateKey) independent of the assignment junctions so switching patterns
// preserves saved values. Entity-typed values are FKs (never copied names).
// Standards/regs attach to TASK nodes only (atomic single source of truth);
// higher levels roll up from tasks (lib/govRollup.ts).

/**
 * Router assembly for /work-library. Handler registration order is preserved
 * from the original single-file router; bodies unchanged.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerTemplateRoutes } from './templates.js';
import { registerPlanRoutes } from './plan.js';
import { registerOptionRoutes } from './options.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('work-library'));

registerTemplateRoutes(router);
registerPlanRoutes(router);
registerOptionRoutes(router);

export default router;
