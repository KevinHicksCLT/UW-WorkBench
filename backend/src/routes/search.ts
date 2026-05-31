import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /search?q= — unified search across the spine for the global search box.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    const tenantId = req.tenantId;
    const take = 8;
    const match = { contains: q, mode: 'insensitive' as const };

    const [divisions, departments, roles, valueStreams, subStreams] = await Promise.all([
      prisma.division.findMany({ where: { tenantId, name: match }, take, select: { id: true, name: true } }),
      prisma.department.findMany({
        where: { tenantId, name: match }, take,
        select: { id: true, name: true, division: { select: { name: true } } },
      }),
      prisma.role.findMany({ where: { tenantId, name: match }, take, select: { id: true, name: true, roleFamily: true } }),
      prisma.valueStream.findMany({ where: { tenantId, name: match }, take, select: { id: true, name: true, domain: true } }),
      prisma.subValueStream.findMany({
        where: { tenantId, name: match }, take,
        select: { id: true, name: true, valueStreamId: true, valueStream: { select: { name: true } } },
      }),
    ]);

    const results = [
      ...divisions.map((d) => ({ type: 'Division', id: d.id, name: d.name, sublabel: null, href: `/divisions/${d.id}` })),
      ...departments.map((d) => ({ type: 'Department', id: d.id, name: d.name, sublabel: d.division?.name ?? null, href: `/departments/${d.id}` })),
      ...roles.map((r) => ({ type: 'Role', id: r.id, name: r.name, sublabel: r.roleFamily, href: `/roles/${r.id}` })),
      ...valueStreams.map((v) => ({ type: 'Value Stream', id: v.id, name: v.name, sublabel: v.domain, href: `/value-streams/${v.id}` })),
      ...subStreams.map((s) => ({ type: 'Sub-stream', id: s.id, name: s.name, sublabel: s.valueStream?.name ?? null, href: `/value-streams/${s.valueStreamId}` })),
    ];
    res.json(results);
  } catch (e) { next(e); }
});

export default router;
