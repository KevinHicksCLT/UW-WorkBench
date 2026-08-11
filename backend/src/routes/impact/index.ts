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
import { registerAnalyzeRoutes } from './analyze.js';
import { registerAssessmentRoutes } from './assessments.js';

const router = Router();
router.use(requireAuth);
registerAssessRoutes(router);
registerSummaryRoutes(router);
registerAnalyzeRoutes(router);
// Persisted decision packets (POST/GET/PATCH) — the only impact routes that
// write; the assess/summary/analyze reads above stay pure.
registerAssessmentRoutes(router);

export default router;
