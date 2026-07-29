/**
 * Router assembly for /impact — the workspace's common change-impact
 * assessment. Reports are derived on read from the live closures and
 * junctions; nothing is persisted and nothing is cached (a report must
 * reflect the graph at the moment the user is about to decide).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerAssessRoutes } from './assess.js';
import { registerSummaryRoutes } from './summary.js';

const router = Router();
router.use(requireAuth);
registerAssessRoutes(router);
registerSummaryRoutes(router);

export default router;
