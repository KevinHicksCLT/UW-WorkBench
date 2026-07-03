/**
 * Router assembly for /users — user management, per-user permissions,
 * permission sets, API keys, and spreadsheet import. requireAuth applies to
 * the whole surface; each module carries its own authorization (menu-key
 * permission + user-admin ABAC scope, or SITE_ADMIN role for permission sets
 * and API keys).
 *
 * Registration order matters: the fixed-path modules (/permission-sets,
 * /api-keys, /import) must land BEFORE manage.ts, whose /:id catch-all would
 * otherwise swallow them.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { registerPermissionSetRoutes } from './permissionSets.js';
import { registerApiKeyRoutes } from './apiKeys.js';
import { registerImportRoutes } from './import.js';
import { registerPickerRoutes } from './pickers.js';
import { registerPermissionRoutes } from './permissions.js';
import { registerManageRoutes } from './manage.js';

const router = Router();
router.use(requireAuth);

registerPermissionSetRoutes(router);
registerApiKeyRoutes(router);
registerImportRoutes(router);
registerPickerRoutes(router);
registerPermissionRoutes(router);
registerManageRoutes(router);

export default router;
