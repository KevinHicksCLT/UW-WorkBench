/**
 * Shared helpers for the Initiative Tracker (/portfolio) API — active-company
 * resolution, tenant-scoped initiative ownership checks, program health
 * rollups, and the FK→name link resolution every initiative read applies.
 */
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { linkNames } from '../../lib/resolvers/index.js';

// Resolve the active company: the requested one (validated against the tenant)
// or the tenant's first company. Sends 404 and returns null when none exist.
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

// Tenant-scoped fetch of a single initiative (ownership guard for nested writes).
export function ownInitiative(id: string, tenantId: string) {
  return prisma.portfolioInitiative.findFirst({ where: { id, tenantId } });
}

// ── Health rollup (I13): a parent's effective health is its WORST child's.
// The stored status stays editable (manual override) — the API returns both,
// plus a flag so the UI can show the override visibly.
const STATUS_SEV: Record<string, number> = { ON_TRACK: 0, AT_RISK: 1, OFF_TRACK: 2 };
const worstStatus = (statuses: string[], fallback: string) =>
  statuses.length ? statuses.reduce((a, s) => ((STATUS_SEV[s] ?? 0) > (STATUS_SEV[a] ?? 0) ? s : a), 'ON_TRACK') : fallback;

export function withHealthRollup<P extends { status: string; workstreams: (W & { initiatives: { status: string }[] })[] }, W extends { status: string }>(program: P) {
  const workstreams = program.workstreams.map((w) => {
    const computedStatus = worstStatus(w.initiatives.map((i) => i.status), w.status);
    return { ...w, computedStatus, statusOverridden: computedStatus !== w.status };
  });
  const computedStatus = worstStatus(workstreams.map((w) => w.computedStatus), program.status);
  return { ...program, workstreams, computedStatus, statusOverridden: computedStatus !== program.status };
}

// Resolve the operating-model links (value stream / division / owner+sponsor
// role) on a set of initiatives into display names, in one batched pass.
// erd_v5: the FK columns are valueStreamNodeId → ProcessNode, orgUnitId → OrgUnit,
// owner/sponsorRoleId → Role. The frontend still wants the legacy display keys
// (valueStreamName / divisionName / ownerRoleName / sponsorRoleName), so this maps
// the new FKs through the spine displayValue and exposes the old key names.
export type InitLinks = { valueStreamNodeId: string | null; orgUnitId: string | null; ownerRoleId: string | null; sponsorRoleId: string | null };
export async function resolveLinks(inits: InitLinks[]) {
  const vsIds: (string | null)[] = [], orgIds: (string | null)[] = [], roleIds: (string | null)[] = [];
  for (const i of inits) {
    vsIds.push(i.valueStreamNodeId);
    orgIds.push(i.orgUnitId);
    roleIds.push(i.ownerRoleId, i.sponsorRoleId);
  }
  const [valueStream, division, role] = await Promise.all([
    linkNames(prisma, vsIds, 'processNode'),
    linkNames(prisma, orgIds, 'orgUnit'),
    linkNames(prisma, roleIds, 'role'),
  ]);
  return { valueStream, division, role };
}

export function withLinkNames<T extends InitLinks>(
  i: T,
  maps: Awaited<ReturnType<typeof resolveLinks>>,
) {
  // Expose BOTH the new FK columns (already on the row via ...i) and the legacy
  // display aliases the frontend reads.
  return {
    ...i,
    valueStreamId: i.valueStreamNodeId,
    divisionId: i.orgUnitId,
    valueStreamName: i.valueStreamNodeId ? maps.valueStream.get(i.valueStreamNodeId) ?? null : null,
    divisionName: i.orgUnitId ? maps.division.get(i.orgUnitId) ?? null : null,
    ownerRoleName: i.ownerRoleId ? maps.role.get(i.ownerRoleId) ?? null : null,
    sponsorRoleName: i.sponsorRoleId ? maps.role.get(i.sponsorRoleId) ?? null : null,
  };
}

// ─── Dropdown source for operating-model links ─────────────────────────────
