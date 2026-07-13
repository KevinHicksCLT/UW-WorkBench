// Product Model Rationalization — the fourth rationalizable structure
// (alongside Applications / Value Streams / Roles). Legacy product definitions
// decompose by the 11 product components; findings are scoped Common | Segment
// | Geography | Eliminate, normalized via the ontology matcher, and land on
// canonical (north-star) product models.
//
// Registration order preserves the literal-before-/:id constraint: workspaces,
// findings, canonical-models and anatomy-catalog register before the models
// module whose PATCH /:id would otherwise swallow them.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerWorkspaceRoutes } from './workspaces.js';
import { registerFindingRoutes } from './findings.js';
import { registerCanonicalRoutes } from './canonical.js';
import { registerModelRoutes } from './models.js';

const router = Router();
router.use(requireAuth);
// Product-model rationalization lives in the Workspace module (menu key
// `workspace`); switch to a dedicated `product-models` key if/when the menu
// registry gains one (Agent 4's D-2).
router.use(requirePermission('workspace'));

registerWorkspaceRoutes(router);
registerFindingRoutes(router);
registerCanonicalRoutes(router);
registerModelRoutes(router);

export default router;
