// Rate-Price API — Rating & Pricing Rationalization module (RATE-PRICE).
// Estate registry → immutable versions → reference execution / parallel-run →
// constrained optimization → rate programs / SERFF filing packets → legacy
// rationalization (extract → diverge → migrate). TB is the rationalization
// plane, never the production rating engine (ADR-002); every governed action
// lands on the shared UwGovernanceEvent audit spine (ADR-001). Scoped to
// tenant (JWT) + active company (?companyId). Mounted at /rate-price; the
// frontend calls it via the /api prefix.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerModelRoutes } from './models.js';
import { registerExecutionRoutes } from './execution.js';
import { registerProgramRoutes } from './programs.js';
import { registerJurisdictionRoutes } from './jurisdictions.js';
import { registerRationalizerRoutes } from './rationalizer.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('rate-price'));

registerModelRoutes(router);
registerExecutionRoutes(router);
registerProgramRoutes(router);
registerJurisdictionRoutes(router);
registerRationalizerRoutes(router);

export default router;
