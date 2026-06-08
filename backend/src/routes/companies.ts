import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { tenantCompany } from '../lib/tenant.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// Kebab-case a company name into a URL-safe slug.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'company';
}

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

// POST /companies — onboard a new company. ADMIN only. Creates the Company row
// (tenant-scoped, unique slug) and, unless opted out, seeds the two root nodes of
// the configurable trees — Level 0 (value streams) and OrgLevel 0 (organization)
// — both named after the company, so the Data Admin tree editors have a root to
// grow from immediately. Audited.
const createSchema = z.object({
  name: z.string().min(1).max(120),
  seedRoots: z.boolean().optional().default(true),
});

router.post('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, seedRoots } = createSchema.parse(req.body);

    // Ensure a slug that's unique within the tenant.
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await prisma.company.findFirst({ where: { tenantId: req.tenantId, slug }, select: { id: true } }); i++) {
      slug = `${base}-${i}`;
    }

    const company = await prisma.company.create({
      data: { tenantId: req.tenantId, name, slug },
    });

    if (seedRoots) {
      await prisma.level.create({
        data: { tenantId: req.tenantId, companyId: company.id, name, levelNumber: 0, sourceType: 'company', sourceRefId: company.id },
      });
      await prisma.orgLevel.create({
        data: { tenantId: req.tenantId, companyId: company.id, name, levelNumber: 0, sourceType: 'company', sourceRefId: company.id },
      });
    }

    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Company', entityId: company.id, action: 'CREATE', diff: { name, slug } });
    res.status(201).json({ id: company.id, name: company.name, slug: company.slug });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid body' });
    next(e);
  }
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
