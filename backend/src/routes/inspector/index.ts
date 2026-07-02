// Value-Streams Inspector (Sidebar-Rework-v2) — the unified read + CRUD surface
// behind the shared inspector that the List and Map both dock on the right.
// ONE canonical record per association (single source of truth): every write
// here lands on an existing junction/entity — never a per-screen copy and never
// a new table. Level semantics (LOCKED, see explorer): a value stream is
// process L2; L3/L4 are rollup containers; L5 isTask nodes are the editable
// leaf steps.

/**
 * Router assembly for /inspector. Handler registration order is preserved from
 * the original single-file router (reads then mutations); bodies unchanged.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerDetailRoutes } from './detail.js';
import { registerMutationRoutes } from './mutations.js';

const router = Router();
router.use(requireAuth);

registerDetailRoutes(router);
registerMutationRoutes(router);

export default router;
