// Applications catalog — the systems where work is executed and memorialized
// (Bridge Input "Cap – Application Catalog" + pre-existing illustrative apps).
// Feeds the Applications tab; sidebar app items deep-link here.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const apps = await prisma.application.findMany({
      where: { companyId: company.id },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true, code: true, name: true, kind: true, category: true, vendor: true,
        criticality: true, description: true, systemOfRecord: true, illustrative: true,
        totalTco: true, primaryDivisionName: true,
        _count: { select: { stepUsages: true, sorDeliverables: true } },
      },
    });
    res.json({ applications: apps.map((a) => ({ ...a, stepUsages: a._count.stepUsages, sorDeliverables: a._count.sorDeliverables, _count: undefined })) });
  } catch (e) { next(e); }
});

export default router;
