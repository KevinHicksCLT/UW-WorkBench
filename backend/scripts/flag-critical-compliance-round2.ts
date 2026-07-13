/**
 * Adds 32 more RegulatoryRequirement rows to the compliance-flagged bucket
 * (105 → 137), on top of flag-critical-compliance.ts's original picks.
 * Split: State +17, Federal +11, International +4 — same ~48/33/19 tier
 * ratio as the first round. Only touches rows not already flagged.
 *
 * Run: npx tsx --env-file=.env scripts/flag-critical-compliance-round2.ts
 */
import { prisma } from '../src/db/prisma.js';

type Pick = { jurisdiction: string; regime?: string };

// ── State (+17) — the remaining foundational NAIC-model obligation
// categories not covered in round 1, rotated across the same 5 states.
const STATE_STATES = ['New York', 'California', 'Texas', 'Florida', 'Delaware'];
const STATE_REGIMES = [
  'Policy Form Filing',
  'Rate Filing',
  'Statutory Reserve Valuation',
  'Rating Rule / Manual Filing',
  'Statistical Data Reporting',
  'Cancellation & Non-Renewal Notice',
  'Premium Tax',
  'Retaliatory Tax',
  'Unclaimed Property / Escheat',
  'Producer Continuing Education',
  'Privacy of Consumer Financial Information (NAIC 672)',
  'NAIC Quarterly Statement',
  'Insurance Fraud Prevention (NAIC 680)',
  'Network Adequacy (NAIC 74)',
  'Unfair Trade Practices (NAIC 880)',
  'Complaint Handling & Record',
  'Health Rate Review',
];
const STATE_PICKS: Pick[] = STATE_REGIMES.map((regime, i) => ({
  jurisdiction: STATE_STATES[i % STATE_STATES.length],
  regime,
}));

// ── Federal (+11) — additional prudential/consumer/anti-crime regimes.
const FEDERAL_PICKS: Pick[] = [
  { jurisdiction: 'Centers for Medicare & Medicaid Services', regime: 'Medicare Part D' },
  { jurisdiction: 'Centers for Medicare & Medicaid Services', regime: 'Medicare Supplement' },
  { jurisdiction: 'Equal Employment Opportunity Commission', regime: 'ADEA' },
  { jurisdiction: 'U.S. Department of Justice', regime: 'Antitrust (Sherman/Clayton)' },
  { jurisdiction: 'U.S. Department of Justice', regime: 'FCPA' },
  { jurisdiction: 'Internal Revenue Service', regime: 'IRC §7702/§7702A' },
  { jurisdiction: 'Office for Civil Rights', regime: 'ACA §1557' },
  { jurisdiction: 'Federal Trade Commission', regime: 'CAN-SPAM' },
  { jurisdiction: 'Federal Communications Commission', regime: 'Do-Not-Call' },
  {
    jurisdiction: 'National Association of Insurance Commissioners',
    regime: 'NAIC Quarterly Statement',
  },
  { jurisdiction: 'U.S. federal regulators', regime: 'TRIA/TRIPRA' },
];

// ── International (+4) — additional EU/UK/Canada/Japan regimes.
const INTL_PICKS: Pick[] = [
  { jurisdiction: 'European Union', regime: 'CSRD/ESRS' },
  { jurisdiction: 'United Kingdom', regime: 'FCA Handbook' },
  { jurisdiction: 'Canada', regime: 'MCT' },
  { jurisdiction: 'Japan', regime: 'FSA Supervisory Guidelines' },
];

async function resolveOne(p: Pick, used: Set<string>): Promise<string | null> {
  const row = await prisma.regulatoryRequirement.findFirst({
    where: {
      status: 'ACTIVE',
      complianceFlagged: false,
      id: { notIn: [...used] },
      jurisdiction: { name: { contains: p.jurisdiction, mode: 'insensitive' } },
      ...(p.regime ? { regime: { contains: p.regime, mode: 'insensitive' } } : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function topUp(
  jurisdictionNames: string[],
  used: Set<string>,
  need: number,
): Promise<string[]> {
  if (need <= 0) return [];
  const rows = await prisma.regulatoryRequirement.findMany({
    where: {
      status: 'ACTIVE',
      complianceFlagged: false,
      id: { notIn: [...used] },
      jurisdiction: { name: { in: jurisdictionNames } },
    },
    distinct: ['regime'],
    orderBy: { id: 'asc' },
    take: need,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function runTier(name: string, picks: Pick[], target: number, jurisdictionPool: string[]) {
  const used = new Set<string>();
  const misses: Pick[] = [];
  for (const p of picks) {
    const id = await resolveOne(p, used);
    if (id) used.add(id);
    else misses.push(p);
  }
  if (used.size < target) {
    const extra = await topUp(jurisdictionPool, used, target - used.size);
    extra.forEach((id) => used.add(id));
  }
  const ids = [...used].slice(0, target);
  console.log(
    `${name}: ${ids.length}/${target} flagged (${misses.length} direct misses, backfilled via top-up). Misses: ${misses.map((m) => `${m.jurisdiction}${m.regime ? '/' + m.regime : ''}`).join('; ')}`,
  );
  return ids;
}

async function main() {
  const stateIds = await runTier('State', STATE_PICKS, 17, STATE_STATES);
  const federalIds = await runTier(
    'Federal',
    FEDERAL_PICKS,
    11,
    FEDERAL_PICKS.map((p) => p.jurisdiction),
  );
  const intlIds = await runTier(
    'International',
    INTL_PICKS,
    4,
    INTL_PICKS.map((p) => p.jurisdiction),
  );

  const allIds = [...stateIds, ...federalIds, ...intlIds];
  const result = await prisma.regulatoryRequirement.updateMany({
    where: { id: { in: allIds } },
    data: { complianceFlagged: true },
  });
  console.log(`Newly flagged: ${result.count} (target 32)`);
  const total = await prisma.regulatoryRequirement.count({ where: { complianceFlagged: true } });
  console.log(`Total compliance-flagged now: ${total} (target 137)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
