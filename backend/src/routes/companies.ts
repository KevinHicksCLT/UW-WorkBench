import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantCompany } from '../lib/tenant.js';

const router = Router();
router.use(requireAuth);

// GET /companies — companies in the tenant, with spine counts (Home overview).
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await prisma.company.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' },
    });
    const withCounts = await Promise.all(
      companies.map(async (co) => {
        const [divisions, departments, roles, valueStreams, checklistItems, roleTasks] = await Promise.all([
          prisma.division.count({ where: { companyId: co.id } }),
          prisma.department.count({ where: { companyId: co.id } }),
          prisma.role.count({ where: { companyId: co.id } }),
          prisma.valueStream.count({ where: { companyId: co.id } }),
          prisma.checklistItem.count({ where: { role: { companyId: co.id } } }),
          prisma.roleTask.count({ where: { role: { companyId: co.id } } }),
        ]);
        return {
          id: co.id, name: co.name, slug: co.slug,
          counts: { divisions, departments, roles, valueStreams, checklistItems, roleTasks },
        };
      })
    );
    res.json(withCounts);
  } catch (e) { next(e); }
});

// GET /companies/:id/tree — division → department → role hierarchy.
// Fixed depth across explicit relations, so a typed nested include is the right
// tool (the genuinely recursive drill-down lives in /value-streams/:id).
router.get('/:id/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await tenantCompany(req.params.id, req.tenantId);
    if (!company) return res.status(404).json({ error: 'Not found' });
    const divisions = await prisma.division.findMany({
      where: { companyId: company.id },
      orderBy: { name: 'asc' },
      include: {
        departments: {
          orderBy: { name: 'asc' },
          include: {
            roles: { orderBy: { name: 'asc' }, select: { id: true, name: true, roleFamily: true } },
          },
        },
      },
    });
    res.json({ id: company.id, name: company.name, divisions });
  } catch (e) { next(e); }
});

export default router;
