// Shared helpers for the /forms feature router (FORMS-RATION module).
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';

/** Resolve the active company for this tenant (mirrors portfolio/helpers). */
export async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

/** Tenant-scoped ownership guard for a form (null ⇒ caller 404s). */
export function ownForm(id: string, tenantId: string) {
  return prisma.policyForm.findFirst({ where: { id, tenantId } });
}

/** Tenant-scoped ownership guard for a working set. */
export function ownWorkingSet(id: string, tenantId: string) {
  return prisma.formWorkingSet.findFirst({ where: { id, tenantId } });
}

/** Tenant-scoped ownership guard for a clause cluster (via its working set). */
export function ownCluster(id: string, tenantId: string) {
  return prisma.clauseCluster.findFirst({ where: { id, tenantId } });
}

/** Citation shape persisted on FormFinding.citations (LLD §1 Citation). */
export type FindingCitation = {
  formVersionId: string;
  clauseId: string;
  charStart: number;
  charEnd: number;
  quote: string; // full cited clause text — never truncated (SM-003)
};
