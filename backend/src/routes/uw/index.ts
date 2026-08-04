// UW Workbench API — AI-native underwriting decisioning module (UW-WORK).
// Submission → clearance → enrichment → triage → desk decision → authority /
// referral → quote (priced-by RATE-PRICING, documented-by FORMS-RATION) → bind
// (PAS Application node), on an append-only governance spine shared by humans
// and agents. Everything is scoped to tenant (JWT) + active company
// (?companyId). Mounted at /uw; the frontend calls it via the /api prefix.
//
// Validation convention (UW-WORK-11): syntax gates are inline zod (the shared
// error handler renders 422 with per-field violations); semantic gates return
// 403/409 with the violated invariant (INV-1..7 / ADR-02) named in the body.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerSubmissionRoutes } from './submissions.js';
import { registerClearanceRoutes } from './clearance.js';
import { registerAppetiteRoutes } from './appetite.js';
import { registerAuthorityRoutes } from './authority.js';
import { registerQuoteRoutes } from './quotes.js';
import { registerGovernanceRoutes } from './governance.js';
import { registerMcpRoutes } from './mcp.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('uw-workbench'));

registerSubmissionRoutes(router);
registerClearanceRoutes(router);
registerAppetiteRoutes(router);
registerAuthorityRoutes(router);
registerQuoteRoutes(router);
registerGovernanceRoutes(router);
registerMcpRoutes(router);

export default router;
