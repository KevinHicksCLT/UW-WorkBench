import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { tenantCompany } from '../lib/tenant.js';
import { logAudit } from '../services/audit.js';
import { structureCounts } from '../lib/resolvers/index.js';
import { processClosure, orgClosure } from '../lib/closure.js';

const router = Router();
router.use(requireAuth);

// Kebab-case a company name into a URL-safe slug. The [^a-z0-9]+ pass collapses
// every non-alnum run to ONE dash, so at most a single leading/trailing dash can
// remain — ^-|-$ is equivalent to ^-+|-+$.
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'company'
  );
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
        // erd_v5 structural counts (one canonical source). checklistItems is a
        // direct count; roleTasks maps to NodeRole links (role ↔ task node).
        const [counts, checklistItems, roleTasks] = await Promise.all([
          structureCounts(co.id),
          prisma.checklistItem.count({ where: { checklist: { companyId: co.id } } }),
          prisma.nodeRole.count({ where: { companyId: co.id } }),
        ]);
        return {
          id: co.id,
          name: co.name,
          slug: co.slug,
          counts: {
            divisions: counts.divisions,
            departments: counts.departments,
            roles: counts.roles,
            valueStreams: counts.valueStreams,
            checklistItems,
            roleTasks,
          },
        };
      }),
    );
    res.json(withCounts);
  } catch (e) {
    next(e);
  }
});

// POST /companies — onboard a new company. ADMIN only. Creates the Company row
// (tenant-scoped, unique slug) and, unless opted out, seeds the level-1 type +
// root node of each configurable tree — ProcessNode (value streams) and OrgUnit
// (organization) — both named after the company, so the Data Admin tree editors
// have a root to grow from immediately. Audited.
// Closure maintenance: each seeded root gets its self closure row (depth 0) via
// lib/closure.ts insertNode, so the tree editors and subtree reads work immediately.
const createSchema = z.object({
  name: z.string().min(1).max(120),
  seedRoots: z.boolean().optional().default(true),
});

router.post(
  '/',
  requireRole('SITE_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, seedRoots } = createSchema.parse(req.body);

      // Ensure a slug that's unique within the tenant.
      const base = slugify(name);
      let slug = base;
      let suffix = 2;
      while (
        await prisma.company.findFirst({
          where: { tenantId: req.tenantId, slug },
          select: { id: true },
        })
      ) {
        slug = `${base}-${suffix}`;
        suffix++;
      }

      const company = await prisma.company.create({
        data: { tenantId: req.tenantId, name, slug },
      });

      if (seedRoots) {
        const processLevel = await prisma.processLevelType.create({
          data: { companyId: company.id, levelNumber: 1, dbValue: 'L1', displayValue: 'Domain' },
        });
        const processRoot = await prisma.processNode.create({
          data: {
            companyId: company.id,
            processLevelTypeId: processLevel.id,
            dbValue: name,
            displayValue: name,
          },
        });
        await processClosure.insertNode({ nodeId: processRoot.id, parentId: null });
        const orgLevel = await prisma.orgLevelType.create({
          data: { companyId: company.id, levelNumber: 1, dbValue: 'L1', displayValue: 'Segment' },
        });
        const orgRoot = await prisma.orgUnit.create({
          data: {
            companyId: company.id,
            orgLevelTypeId: orgLevel.id,
            dbValue: name,
            displayValue: name,
          },
        });
        await orgClosure.insertNode({ nodeId: orgRoot.id, parentId: null });
      }

      logAudit({
        tenantId: req.tenantId,
        actorEmail: req.user.email,
        entityType: 'Company',
        entityId: company.id,
        action: 'CREATE',
        diff: { name, slug },
      });
      res.status(201).json({ id: company.id, name: company.name, slug: company.slug });
    } catch (e) {
      if (e instanceof z.ZodError)
        return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid body' });
      next(e);
    }
  },
);

// GET /companies/:id/tree — division → (department) → role hierarchy.
// erd_v5: divisions are OrgUnit nodes at level 2; there is no Department tier, so
// the departments array is always empty and roles are listed directly under the
// division (via the roles homed on that OrgUnit). Shape preserved for the UI.
router.get('/:id/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await tenantCompany(req.params.id, req.tenantId);
    if (!company) return res.status(404).json({ error: 'Not found' });
    const units = await prisma.orgUnit.findMany({
      where: { companyId: company.id, orgLevelType: { levelNumber: 2 } },
      orderBy: { displayValue: 'asc' },
      select: {
        id: true,
        displayValue: true,
        roles: { orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true } },
      },
    });
    const divisions = units.map((u) => ({
      id: u.id,
      name: u.displayValue,
      departments: [] as unknown[],
      roles: u.roles.map((r) => ({ id: r.id, name: r.displayValue, roleFamily: null })),
    }));
    res.json({ id: company.id, name: company.name, divisions });
  } catch (e) {
    next(e);
  }
});

export default router;
