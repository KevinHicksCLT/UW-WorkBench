// Minimal operating-model catalog reads — the three lookups the UW frontend
// needs beyond /uw itself: the company switcher (/companies), the Roles
// catalog for authority grants (/roles → { rows }), and the registered
// application estate for PAS bind targets (/applications → { applications }).
// Response shapes match the Transformation Bridge endpoints the UW pages were
// written against.
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

async function activeCompanyId(req: Request): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return company?.id ?? null;
}

export const companiesRouter = Router();
companiesRouter.use(requireAuth);
companiesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await prisma.company.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    res.json(companies);
  } catch (e) {
    next(e);
  }
});

export const rolesRouter = Router();
rolesRouter.use(requireAuth);
rolesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req);
    if (!companyId) return res.status(404).json({ error: 'No company found' });
    const roles = await prisma.role.findMany({
      where: { companyId },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true },
    });
    res.json({ rows: roles.map((r) => ({ roleId: r.id, role: r.displayValue })) });
  } catch (e) {
    next(e);
  }
});

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);
applicationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req);
    if (!companyId) return res.status(404).json({ error: 'No company found' });
    const apps = await prisma.application.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, kind: true },
    });
    res.json({ applications: apps });
  } catch (e) {
    next(e);
  }
});
