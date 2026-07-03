/**
 * Router assembly for /admin (Data Admin studio). Registration order preserved:
 * specific routes (meta / dashboard / validations / ai-adoption) BEFORE the
 * generic /:entity catch-alls; bodies unchanged. The AI overlay (adminAi) and
 * role-context (adminRole) routers are mounted separately in app.ts.
 * Gated by the data-admin.configure permission (SITE_ADMIN always passes; other
 * user types reach it only via an explicit grant).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { registerMetaRoutes } from './meta.js';
import { registerCrudRoutes } from './crud.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('data-admin.configure'));

registerMetaRoutes(router);
registerCrudRoutes(router);

export default router;
