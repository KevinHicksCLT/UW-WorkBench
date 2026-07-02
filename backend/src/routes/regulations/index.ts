// Regulations API — the 50-state insurance regulatory baseline behind the
// Regulations tab. Read shapes for the three lenses (States / Requirements /
// Coverage) + the state detail page, and the transactional writes the UI
// needs (requirement create/edit, value-stream link replacement). Generic CRUD
// for every regulations entity additionally comes free via /admin/:entity.
// Scoped to tenant (JWT) + active company (?companyId, falling back to the
// tenant's first company); cross-company misses return 404, never 403.

/**
 * Router assembly for /regulations. Handler registration order is preserved
 * from the original single-file router (lenses → writes → feeds); route
 * behavior and response bodies are unchanged.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerLensRoutes } from './lenses.js';
import { registerWriteRoutes } from './writes.js';
import { registerFeedRoutes } from './feeds.js';

const router = Router();
router.use(requireAuth);

registerLensRoutes(router);
registerWriteRoutes(router);
registerFeedRoutes(router);

export default router;
