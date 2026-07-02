// Initiative Tracker API — the strategic-portfolio module behind the
// "Initiatives" tab. Everything is scoped to tenant (from the JWT) + the active
// company (from ?companyId, falling back to the tenant's first company). Mounted
// at /portfolio; the frontend calls it via the /api prefix.

/**
 * Router assembly for /portfolio. Handler registration order is preserved from
 * the original single-file router (dashboard → programs → initiatives →
 * objectives → resources/activities → finance/RAID/change-requests); route
 * behavior and response bodies are unchanged.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerProgramRoutes } from './programs.js';
import { registerInitiativeRoutes } from './initiatives.js';
import { registerObjectiveRoutes } from './objectives.js';
import { registerResourceActivityRoutes } from './resources.js';
import { registerFinanceRaidRoutes } from './finance.js';

const router = Router();
router.use(requireAuth);

registerDashboardRoutes(router);
registerProgramRoutes(router);
registerInitiativeRoutes(router);
registerObjectiveRoutes(router);
registerResourceActivityRoutes(router);
registerFinanceRaidRoutes(router);

export default router;
