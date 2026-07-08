/**
 * Shared helpers for the Regulations API — active-company resolution, query
 * param coercers, and the NodeRegulation→value-stream rollup shaping every
 * lens applies (withValueStreamLinks). See index.ts for the module map.
 */
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';

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

export const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
// Multi-select filters arrive as comma-separated values.
export const list = (v: unknown) =>
  typeof v === 'string' && v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

// Lens → the set of regulator types it covers, so every drill-down (sources,
// rules, jurisdictions, catalog) scopes to the active tab in the DB rather than
// showing the global set. Returns null for an absent/unknown lens (no filter).
export function lensRegulatorTypes(lens: unknown): string[] | null {
  const v = str(lens);
  if (v === 'federal') return ['FEDERAL', 'FEDERAL_SECURITIES'];
  if (v === 'international') return ['INTERNATIONAL'];
  if (v === 'state') return ['STATE_INSURANCE_REGULATOR'];
  return null;
}
// erd_v5: requirement ↔ value-stream is NodeRegulation — and those rows now
// attach to TASK nodes only (single source of truth at the atomic grain). The
// `valueStreamLinks[]` the frontend consumes are a ROLLUP of the linked tasks'
// L2 ancestors (vsForRegulations / govRollup.ts); link ids are synthetic
// `${regId}:${vsId}` because the underlying rows live per task.
// erd_v5: reg ↔ role is RoleRegulation (Owner|Contributor), carried alongside.
export const NODE_REG_INCLUDE = {
  roleRegulations: { include: { role: { select: { id: true, displayValue: true } } } },
} as const;

export type RoleRegRow = {
  id: string;
  roleId: string;
  role_: string;
  role: { id: string; displayValue: string };
};
export type VsRollup = Map<string, { id: string; name: string; domain: string | null }[]>;
export function withValueStreamLinks<T extends { id: string; roleRegulations: RoleRegRow[] }>(
  r: T,
  vsMap: VsRollup,
) {
  const { roleRegulations, ...rest } = r;
  const owner = roleRegulations.find((x) => x.role_ === 'Owner');
  const contributors = roleRegulations.filter((x) => x.role_ === 'Contributor');
  return {
    ...rest,
    valueStreamLinks: (vsMap.get(r.id) ?? []).map((vs) => ({
      id: `${r.id}:${vs.id}`,
      valueStreamId: vs.id,
      relationship: 'GOVERNS',
      notes: null,
      valueStream: { id: vs.id, name: vs.name },
    })),
    owner: owner ? { id: owner.role.id, name: owner.role.displayValue } : null,
    contributors: contributors.map((c) => ({ id: c.role.id, name: c.role.displayValue })),
  };
}
