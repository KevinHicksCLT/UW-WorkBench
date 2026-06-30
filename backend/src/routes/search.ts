import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /search?q= — unified search across the spine for the global search box.
// erd_v5: divisions = OrgUnit (L2), roles = Role, value streams = ProcessNode (L2),
// sub-streams = ProcessNode (L3/L4). Names come from the editable `displayValue`.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    const tenantId = req.tenantId;
    const take = 8;
    const match = { contains: q, mode: 'insensitive' as const };
    const inTenant = { company: { tenantId } };

    const [divisions, roles, valueStreams, subStreams] = await Promise.all([
      // Organization tiers (Segment/Division) — sublabel = parent name.
      prisma.orgUnit.findMany({
        where: { ...inTenant, displayValue: match },
        take,
        select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
      }),
      prisma.role.findMany({
        where: { ...inTenant, displayValue: match },
        take,
        select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
      }),
      // Value streams = process L2; sub-streams = process L3/L4.
      prisma.processNode.findMany({
        where: { ...inTenant, displayValue: match, processLevelType: { levelNumber: 2 } },
        take,
        select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
      }),
      prisma.processNode.findMany({
        where: { ...inTenant, displayValue: match, processLevelType: { levelNumber: { in: [3, 4] } } },
        take,
        select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
      }),
    ]);

    const results = [
      ...divisions.map((d) => ({ type: 'Division', id: d.id, name: d.displayValue, sublabel: d.parent?.displayValue ?? null, href: `/divisions/${d.id}` })),
      ...roles.map((r) => ({ type: 'Role', id: r.id, name: r.displayValue, sublabel: r.orgUnit?.displayValue ?? null, href: `/roles/${r.id}` })),
      ...valueStreams.map((v) => ({ type: 'Value Stream', id: v.id, name: v.displayValue, sublabel: v.parent?.displayValue ?? null, href: `/value-streams/${v.id}` })),
      ...subStreams.map((s) => ({ type: 'Sub-stream', id: s.id, name: s.displayValue, sublabel: s.parent?.displayValue ?? null, href: `/value-streams/${s.id}` })),
    ];
    res.json(results);
  } catch (e) { next(e); }
});

export default router;
