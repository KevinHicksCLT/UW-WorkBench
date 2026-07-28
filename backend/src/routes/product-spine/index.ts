/**
 * Router assembly for /product-spine — the product hierarchy tab
 * (ProductLevelType + ProductNode + ProductNodeClosure spine): the TOC / Map /
 * List bootstrap. Distinct from /product-models, which serves the workspace
 * rationalization boards (LegacyProductModel / CanonicalProductModel).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { cacheResponses } from '../../lib/responseCache.js';
import { registerProductTableRoutes } from './table.js';
import { registerProductNodeRoutes } from './node.js';
import { registerProductDecisionRoutes } from './decisions.js';
import { registerProductFrameworkRoutes } from './framework.js';

const router = Router();
router.use(requireAuth);
// Permission BEFORE the cache: a denial must never be served from (or write
// into) the tenant-keyed response cache.
router.use(requirePermission('product-models'));

// Review decisions are read/written live — register them BEFORE the response
// cache so an approval is never served stale (nor a PUT cached).
registerProductDecisionRoutes(router);

router.use(cacheResponses(15_000));

registerProductTableRoutes(router);
registerProductNodeRoutes(router);
registerProductFrameworkRoutes(router);

export default router;
