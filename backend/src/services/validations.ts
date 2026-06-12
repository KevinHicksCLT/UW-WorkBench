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
