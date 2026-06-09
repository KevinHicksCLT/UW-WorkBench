import { prisma } from '../db/prisma.js';

// Read-only data-health checks for the Data Admin "Data Health" panel (audit A2).
// Each check reports pass/warn/fail plus a few sample offending rows the UI can
// deep-link to. NOTHING here mutates data — it surfaces drift so an admin can fix
// it through the normal editors.

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type Sample = { entity?: string; id: string; label: string; hint?: string };
export type Check = {
  id: string;
  label: string;
  area: string; // audit story id(s) this covers
  status: CheckStatus;
  summary: string;
  count: number; // number of offending rows (0 when pass)
  samples: Sample[];
};

const SAMPLE_CAP = 12;

// Singular leadership roles that should have exactly one incumbent (audit L2).
const SINGLETON_ACRONYMS = new Set(['CEO', 'CFO', 'COO', 'CIO', 'CISO', 'CHRO', 'CTO', 'CMO', 'CDO', 'CRO', 'CPO']);
function isSingletonRole(name: string): boolean {
  const n = name.trim();
  if (SINGLETON_ACRONYMS.has(n.toUpperCase())) return true;
  return /^(chief\b|general counsel\b|head of\b)/i.test(n);
}

// Mirrors recomputeInitiative(): ACTUAL always, FORECAST only for future periods.
function accumulate(lines: { values: { dataset: string; periodStart: Date; amount: number }[] }[], today: Date): number {
  let total = 0;
  for (const line of lines)
    for (const v of line.values)
      if (v.dataset === 'ACTUAL' || (v.dataset === 'FORECAST' && v.periodStart > today)) total += v.amount;
  return total;
}

export async function runValidations(companyId: string): Promise<{ companyId: string; checks: Check[] }> {
  const checks: Check[] = [];

  // ── People headcount integrity (D2) ─────────────────────────────────────
  const [people, byRegion, byEmployment, unassigned] = await Promise.all([
    prisma.person.count({ where: { companyId } }),
    prisma.person.groupBy({ by: ['region'], where: { companyId }, _count: { _all: true } }),
    prisma.person.groupBy({ by: ['employmentType'], where: { companyId }, _count: { _all: true } }),
    prisma.person.findMany({ where: { companyId, assignments: { none: {} } }, select: { id: true, name: true }, take: SAMPLE_CAP + 1 }),
  ]);
  const regionSum = byRegion.reduce((a, r) => a + r._count._all, 0);
  const employmentSum = byEmployment.reduce((a, r) => a + r._count._all, 0);
  const nullRegion = byRegion.find((r) => r.region == null)?._count._all ?? 0;
  const unassignedCount = await prisma.person.count({ where: { companyId, assignments: { none: {} } } });
  const peopleConsistent = regionSum === people && employmentSum === people && nullRegion === 0;
  checks.push({
    id: 'people-headcount',
    label: 'People headcount reconciles',
    area: 'D2',
    status: peopleConsistent ? 'pass' : 'fail',
    summary: `${people} people · region buckets sum ${regionSum} · employment buckets sum ${employmentSum}` +
      (nullRegion ? ` · ${nullRegion} with no region` : '') +
      (unassignedCount ? ` · ${unassignedCount} with no role assignment (dropped by role-based screens)` : ''),
    count: peopleConsistent ? 0 : (people - regionSum) + nullRegion,
    samples: unassigned.slice(0, SAMPLE_CAP).map((p) => ({ entity: 'person', id: p.id, label: p.name, hint: 'no role assignment' })),
  });

  // ── Role reconciliation (D1) ────────────────────────────────────────────
  const [totalRoles, emptyRoles] = await Promise.all([
    prisma.role.count({ where: { companyId } }),
    prisma.role.findMany({ where: { companyId, assignments: { none: {} } }, select: { id: true, name: true }, take: SAMPLE_CAP + 1 }),
  ]);
  const emptyRoleCount = await prisma.role.count({ where: { companyId, assignments: { none: {} } } });
  checks.push({
    id: 'role-reconciliation',
    label: 'Roles reconcile (total vs roles-with-people)',
    area: 'D1',
    status: emptyRoleCount === 0 ? 'pass' : 'warn',
    summary: `${totalRoles} roles · ${totalRoles - emptyRoleCount} with people · ${emptyRoleCount} with none ` +
      `(role-based screens show ${totalRoles - emptyRoleCount}, headline shows ${totalRoles})`,
    count: emptyRoleCount,
    samples: emptyRoles.slice(0, SAMPLE_CAP).map((r) => ({ entity: 'role', id: r.id, label: r.name, hint: 'no people assigned' })),
  });

  // ── Singleton leadership roles over-filled (L2) ─────────────────────────
  const roleCounts = await prisma.$queryRaw<{ roleId: string; name: string; c: number }[]>`
    SELECT r.id AS "roleId", r.name, COUNT(DISTINCT a."personId")::int AS c
    FROM "Role" r LEFT JOIN "Assignment" a ON a."roleId" = r.id
    WHERE r."companyId" = ${companyId}
    GROUP BY r.id, r.name`;
  const overfilled = roleCounts.filter((r) => r.c > 1 && isSingletonRole(r.name)).sort((a, b) => b.c - a.c);
  checks.push({
    id: 'singleton-roles',
    label: 'Singular leadership roles have one incumbent',
    area: 'L2',
    status: overfilled.length === 0 ? 'pass' : 'fail',
    summary: overfilled.length === 0
      ? 'No singular C-level / Head / General Counsel role is over-filled'
      : `${overfilled.length} singular leadership role(s) have multiple incumbents`,
    count: overfilled.length,
    samples: overfilled.slice(0, SAMPLE_CAP).map((r) => ({ entity: 'role', id: r.roleId, label: r.name, hint: `${r.c} incumbents` })),
  });

  // ── Region × employment plausibility (L4) ───────────────────────────────
  const cross = await prisma.person.groupBy({ by: ['region', 'employmentType'], where: { companyId }, _count: { _all: true } });
  const offshore = cross.filter((c) => c.region === 'Offshore').reduce((a, c) => a + c._count._all, 0);
  const offshoreBadged = cross.find((c) => c.region === 'Offshore' && c.employmentType === 'badged')?._count._all ?? 0;
  const offshorePct = people ? Math.round((offshore / people) * 100) : 0;
  const implausible = offshorePct > 40 || offshoreBadged > 0;
  checks.push({
    id: 'region-employment',
    label: 'Region × employment mix is plausible for a carrier',
    area: 'L4',
    status: implausible ? 'warn' : 'pass',
    summary: `Offshore ${offshore}/${people} (${offshorePct}%)` +
      (offshoreBadged ? ` · ${offshoreBadged} offshore badged employees (captive/GCC?)` : '') +
      (offshorePct > 40 ? ' · offshore share high for a regulated insurer' : ''),
    count: implausible ? offshore : 0,
    samples: [],
  });

  // ── Rollup staleness (ARCH-8) ───────────────────────────────────────────
  const inits = await prisma.portfolioInitiative.findMany({
    where: { companyId },
    include: { benefits: { include: { values: true } }, costs: { include: { values: true } } },
  });
  const today = new Date();
  const stale: Sample[] = [];
  for (const i of inits) {
    const benefit = accumulate(i.benefits, today);
    const cost = accumulate(i.costs, today);
    const driftB = Math.abs(benefit - i.cumulativeBenefit);
    const driftC = Math.abs(cost - i.cumulativeCost);
    if (driftB > 0.01 || driftC > 0.01)
      stale.push({ entity: 'portfolioInitiative', id: i.id, label: i.name, hint: `stored ${i.cumulativeNetBenefit.toFixed(0)} vs computed ${(benefit - cost).toFixed(0)}` });
  }
  checks.push({
    id: 'rollup-staleness',
    label: 'Initiative financial rollups are up to date',
    area: 'ARCH-8',
    status: stale.length === 0 ? 'pass' : 'fail',
    summary: stale.length === 0 ? `${inits.length} initiatives, rollups match their lines` : `${stale.length} initiative(s) have stale cumulative totals`,
    count: stale.length,
    samples: stale.slice(0, SAMPLE_CAP),
  });

  return { companyId, checks };
}
