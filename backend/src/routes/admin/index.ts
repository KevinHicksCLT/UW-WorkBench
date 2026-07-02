/**
 * Router assembly for /admin (ADMIN-role gated). Registration order preserved:
 * specific routes (meta / dashboard / validations / ai-adoption) BEFORE the
 * generic /:entity catch-alls; bodies unchanged. The AI overlay (adminAi) and
 * role-context (adminRole) routers are mounted separately in app.ts.
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { registerMetaRoutes } from './meta.js';
import { registerCrudRoutes } from './crud.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('ADMIN'));

registerMetaRoutes(router);
registerCrudRoutes(router);

export default router;
