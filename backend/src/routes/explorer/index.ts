// erd_v5 explorer — the operating-model map + its drill sidebars, the value-stream
// list/tree/flow, telemetry catalog, AI-adoption heat map, the Organization table,
// and the (now-empty) Standards endpoints. Every structural read goes through the
// shared resolvers (ProcessNode/OrgUnit closures + FK junctions), never the dropped
// legacy spines, name-matching, or in-memory tree walks.
//
// Fixed level semantics (LOCKED): process L1 = domain/segment (3), L2 = value
// stream / "division" in the map (17), L3 = process area (135), L4 = sub-process
// (867), L5 = task / isTask (3811). Org L1 = segment, L2 = division (no Dept tier).

/**
 * Router assembly for /explorer. Handler registration order is preserved from
 * the original single-file router; route behavior and bodies are unchanged.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { cacheResponses } from '../../lib/responseCache.js';
import { registerOverviewRoutes } from './overview.js';
import { registerTelemetryRoutes } from './telemetry.js';
import { registerTreeFlowRoutes } from './treeFlow.js';
import { registerTestingTemplateRoutes } from './testingTemplates.js';
import { registerDashboardRoutes } from './dashboards.js';
import { registerOrgStandardsRoutes } from './standards.js';

const router = Router();
router.use(requireAuth);
router.use(cacheResponses(15_000));

registerOverviewRoutes(router);
registerTelemetryRoutes(router);
registerTreeFlowRoutes(router);
registerTestingTemplateRoutes(router);
registerDashboardRoutes(router);
registerOrgStandardsRoutes(router);

export default router;
