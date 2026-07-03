/**
 * Router assembly for /me — the signed-in user's own surface (preferences).
 * requireAuth only: every route operates strictly on req.user.id, so there is
 * no menu-key permission to check and no cross-user reach.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerPreferenceRoutes } from './preferences.js';

const router = Router();
router.use(requireAuth);

registerPreferenceRoutes(router);

export default router;
