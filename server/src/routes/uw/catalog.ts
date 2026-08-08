/**
 * Catalog reads — the company's Roles catalog (authority binding + escalation),
 * org units (appetite ownership), and registered Applications (PAS bind
 * targets). Pure dropdown fodder for the workbench forms.
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompanyId } from './helpers.js';

/** Registers catalog routes on the shared /uw router. */
export function registerCatalogRoutes(router: Router): void {
router.get('/catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const [roles, orgUnits, applications] = await Promise.all([
      prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true, managerRoleId: true }, orderBy: { displayValue: 'asc' } }),
      prisma.orgUnit.findMany({ where: { companyId }, select: { id: true, displayValue: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.application.findMany({ where: { companyId }, select: { id: true, name: true, kind: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ roles, orgUnits, applications });
  } catch (e) { next(e); }
});
}
