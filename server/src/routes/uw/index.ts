// UW Workbench API — submission → clearance → enrichment → triage → desk
// decision → authority/referral → quote → bind, on an append-only governance
// spine shared by humans and agents. Mounted at /uw.
//
// Validation convention: syntax gates are inline zod (the shared error handler
// renders 422 with per-field violations); semantic gates return 403/409 with
// the violated invariant (INV-1..7 / ADR-02) named in the body.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerSubmissionRoutes } from './submissions.js';
import { registerClearanceRoutes } from './clearance.js';
import { registerAppetiteRoutes } from './appetite.js';
import { registerAuthorityRoutes } from './authority.js';
import { registerQuoteRoutes } from './quotes.js';
import { registerGovernanceRoutes } from './governance.js';
import { registerMcpRoutes } from './mcp.js';
import { registerPackRoutes } from './packs.js';
import { registerCatalogRoutes } from './catalog.js';

const router = Router();
router.use(requireAuth);

registerSubmissionRoutes(router);
registerClearanceRoutes(router);
registerAppetiteRoutes(router);
registerAuthorityRoutes(router);
registerQuoteRoutes(router);
registerGovernanceRoutes(router);
registerMcpRoutes(router);
registerPackRoutes(router);
registerCatalogRoutes(router);

export default router;
