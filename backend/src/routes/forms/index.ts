// FORMS-RATION API — policy forms rationalization: library + ingest
// (FORMS-LIB), working sets/clustering/matrix/compare (FORMS-INTEL/COMPARE),
// findings + dispositions + preferred wordings (FORMS-WFLOW/DRAFT), field
// dictionary + mappings (FORMS-FIELD), and dashboard rollups (FORMS-INSIGHT).
// Trust model per module spec v0.3.0: AI output persists only as findings
// with citations + confidence; τ=0.70 routes to needs-human; disposition
// history is append-only.

/**
 * Router assembly for /forms. Registration order matters: modules with
 * specific path prefixes come first; the library module owns GET /:id and is
 * registered last.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerWorkingSetRoutes } from './workingSets.js';
import { registerGovernanceRoutes } from './governance.js';
import { registerFieldPlaneRoutes } from './fieldPlane.js';
import { registerInsightRoutes } from './insights.js';
import { registerLibraryRoutes } from './library.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('forms'));

registerWorkingSetRoutes(router);
registerGovernanceRoutes(router);
registerFieldPlaneRoutes(router);
registerInsightRoutes(router);
registerLibraryRoutes(router); // owns GET /:id — keep last

export default router;
