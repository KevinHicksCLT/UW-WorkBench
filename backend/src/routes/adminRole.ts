import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ancestorNames } from '../lib/resolvers/index.js';

// ─── Role context for Data Admin (GET /admin/role-context/:id) ───────────────
// erd_v5: a role's deliverables and process tasks are now REAL FK links, not
// free-text matches. Deliverables come from the RoleDeliverable junction
// (role ↔ Deliverable, with role_ = Owner|Contributor); process tasks come from
// the NodeRole junction (role ↔ ProcessNode, with role_ = Owner|Participant). The
// Role Studio renders these so the admin can see what a role owns/participates in.
// Mounted at /admin/role-context (before the generic /admin router) so it isn't
// captured by the `/:entity/:id` catch-all. ADMIN-only.

const router = Router();
router.use(requireAuth);
router.use(requirePermission('data-admin.configure'));

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!companyId) return res.status(400).json({ error: 'companyId query parameter is required' });

    const role = await prisma.role.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true, displayValue: true, companyId: true },
    });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const [delivLinks, nodeLinks] = await Promise.all([
      // Deliverables this role owns / contributes to.
      prisma.roleDeliverable.findMany({
        where: { roleId: role.id },
        select: { id: true, role_: true, deliverable: { select: { id: true, title: true } } },
      }),
      // Process-tree tasks this role leads (Owner) or supports (Participant).
      prisma.nodeRole.findMany({
        where: { roleId: role.id },
        select: {
          id: true,
          role_: true,
          processNode: { select: { id: true, displayValue: true } },
        },
      }),
    ]);

    // Resolve each process node's value-stream (L2) name for display.
    const names = await ancestorNames(nodeLinks.map((n) => n.processNode.id));

    const ioItems = delivLinks.map((d) => ({
      id: d.deliverable.id,
      linkId: d.id,
      type: d.role_, // Owner | Contributor
      name: d.deliverable.title,
      valueStreamName: null,
    }));

    const processSteps = nodeLinks.map((n) => ({
      id: n.processNode.id,
      linkId: n.id,
      name: n.processNode.displayValue,
      valueStreamName: names.get(n.processNode.id)?.valueStreamName ?? null,
      relation: n.role_ === 'Owner' ? 'Lead' : 'Support',
    }));

    res.json({
      role: { id: role.id, name: role.displayValue, itemRole: null },
      ioItems,
      processSteps,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
