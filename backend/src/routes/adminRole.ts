import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { roleMatcher, cellMentionsRole } from '../lib/roleMatch.js';

// ─── Role context for Data Admin (GET /admin/role-context/:id) ───────────────
// A role's deliverables, inputs, and process tasks are NOT linked to it by a
// foreign key — the Role-detail screen resolves them at read time by matching the
// role's name against the free-text `keyRoles` (IoItem) and `leads`/`supporting`
// (ProcessStep) columns (see lib/roleMatch.ts). So the Data Admin Role Studio
// can't filter them with a simple WHERE; it asks this endpoint which IoItem and
// ProcessStep rows resolve to the role, and then edits those exact rows through
// the normal audited /admin/ioItem/:id and /admin/processStep/:id endpoints.
// Mounted at /admin/role-context (before the generic /admin router) so it isn't
// captured by the `/:entity/:id` catch-all. ADMIN-only.

const router = Router();
router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!companyId) return res.status(400).json({ error: 'companyId query parameter is required' });

    const role = await prisma.role.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, companyId },
      select: { id: true, name: true, itemRole: true, companyId: true },
    });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const [ioRows, stepRows] = await Promise.all([
      prisma.ioItem.findMany({
        where: { valueStream: { companyId: role.companyId } },
        select: {
          id: true, type: true, name: true, l3: true, l4: true, keyRoles: true,
          dataElements: true, illustrative: true, valueStreamId: true,
          valueStream: { select: { name: true } },
        },
      }),
      prisma.processStep.findMany({
        where: { valueStream: { companyId: role.companyId } },
        select: {
          id: true, stepNumber: true, name: true, l3: true, l4: true, leads: true,
          supporting: true, inputs: true, outputs: true, notes: true,
          externalParticipants: true, description: true, illustrative: true, valueStreamId: true,
          valueStream: { select: { name: true } },
        },
      }),
    ]);

    const matches = roleMatcher({ name: role.name, itemRole: role.itemRole });
    const mine = (cell: string | null) => cellMentionsRole(cell, matches);

    const flat = <T extends { valueStream: { name: string } }>(r: T) => {
      const { valueStream, ...rest } = r;
      return { ...rest, valueStreamName: valueStream?.name ?? null };
    };

    const ioItems = ioRows.filter((io) => mine(io.keyRoles)).map(flat);
    const processSteps = stepRows
      .filter((st) => mine(st.leads) || mine(st.supporting))
      .map((st) => ({ ...flat(st), relation: mine(st.leads) ? 'Lead' : 'Support' }));

    res.json({
      role: { id: role.id, name: role.name, itemRole: role.itemRole },
      ioItems,
      processSteps,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
