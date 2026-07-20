// "Evergreen" Application Rationalization — read API for the value-stream board.
// An application's value stream is broken into business-process STAGES (chevrons);
// each stage's code is decomposed by IT layer into findings, grouped into CAPDAN
// categories (Common | Different | Relocate | Eliminate). Migration status rolls
// up into progress. Read-only here; edits flow through the generic /admin CRUD.

/**
 * Router assembly for /rationalization. Handler registration order preserves
 * the original single-file router's constraint: literal paths (/anatomy-catalog)
 * register before the /:id catch-all. Route behavior and response bodies are
 * unchanged by the module split.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerVocabularyRoutes } from './vocabulary.js';
import { registerFindingRoutes } from './findings.js';
import { registerNormalizationRoutes } from './normalization.js';
import { registerSpineRoutes } from './spine.js';
import { registerBoardRoutes } from './boards.js';

const router = Router();
router.use(requireAuth);
// Rationalization lives on the Applications tab; method-derived CRUD replaces
// the old per-route requireRole('ADMIN','MANAGER') write guards.
router.use(requirePermission('applications'));

registerVocabularyRoutes(router);
registerFindingRoutes(router);
registerNormalizationRoutes(router);
// Spine (value-stream / role comparison) routes are literal-prefixed and must
// register before the board routes' /:id catch-all.
registerSpineRoutes(router);
registerBoardRoutes(router);

export default router;
