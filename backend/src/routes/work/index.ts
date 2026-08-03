import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/permissions.js';
import { cacheResponses } from '../../lib/responseCache.js';
import { registerListRoutes } from './list.js';
import { registerDetailRoutes } from './detail.js';

// Deliverables & Tasks API — the standalone work tracker behind the
// "Deliverables & Tasks" tabs. List grain in list.ts, drill-down sidebar
// grain in detail.ts, shared pieces in helpers.ts.

const router = Router();
router.use(requireAuth);
// /work backs BOTH the Deliverables and Tasks tabs — access on either menu key
// admits the request so neither tab's grant breaks the other.
router.use(requireAnyPermission(['tasks', 'deliverables']));
router.use(cacheResponses(15_000));

registerListRoutes(router);
registerDetailRoutes(router);

export default router;
