/**
 * Flags 105 hand-picked RegulatoryRequirement rows as complianceFlagged=true —
 * the most critical obligations for a US insurer to actively follow, spanning
 * State (50), Federal (35), and International (20). Selection is judgment-
 * based (see comments per tier), not a random/statistical sample.
 *
 * Run: npx tsx --env-file=.env scripts/flag-critical-compliance.ts
 */
import { prisma } from '../src/db/prisma.js';

type Pick = { jurisdiction: string; regime?: string };

// ── State (50) — 5 representative states × 10 foundational NAIC-model
// obligation categories every licensed carrier must satisfy (solvency,
// licensing, market conduct, consumer protection, data security).
const STATE_STATES = ['New York', 'California', 'Texas', 'Florida', 'Delaware'];
const STATE_REGIMES = [
  'Model Audit Rule (NAIC 205)',
  'Risk-Based Capital (NAIC 312)',
  'Actuarial Opinion (NAIC 820/822)',
  'NAIC Annual Statement',
  'Certificate of Authority',
  'Producer Licensing (NAIC Model 218)',
  'Unfair Claims Settlement Practices (NAIC 900)',
  'Market Conduct Annual Statement (MCAS)',
  'Insurance Data Security Law (NAIC 668)',
  'Guaranty Association Membership',
];
const STATE_PICKS: Pick[] = STATE_STATES.flatMap((jurisdiction) =>
  STATE_REGIMES.map((regime) => ({ jurisdiction, regime })),
);

// ── Federal (35) — the core prudential/financial-crime/consumer regimes a
// public US insurance holding company answers to.
const FEDERAL_PICKS: Pick[] = [
  { jurisdiction: 'U.S. Securities and Exchange Commission', regime: 'Exchange Act Reporting' },
  { jurisdiction: 'U.S. Securities and Exchange Commission', regime: 'Securities Act 1933' },
  {
    jurisdiction: 'U.S. Securities and Exchange Commission',
    regime: 'Investment Company Act 1940',
  },
  { jurisdiction: 'Financial Industry Regulatory Authority', regime: 'FINRA' },
  { jurisdiction: 'Financial Industry Regulatory Authority', regime: 'Reg BI' },
  { jurisdiction: 'Municipal Securities Rulemaking Board' },
  { jurisdiction: 'Public Company Accounting Oversight Board', regime: 'Sarbanes-Oxley' },
  { jurisdiction: 'Public Company Accounting Oversight Board', regime: 'PCAOB Standards' },
  { jurisdiction: 'Financial Crimes Enforcement Network', regime: 'BSA/AML (FinCEN)' },
  { jurisdiction: 'Office of Foreign Assets Control', regime: 'OFAC Sanctions' },
  { jurisdiction: 'Consumer Financial Protection Bureau', regime: 'UDAAP' },
  { jurisdiction: 'Consumer Financial Protection Bureau', regime: 'RESPA' },
  { jurisdiction: 'Employee Benefits Security Administration', regime: 'ERISA' },
  { jurisdiction: 'Employee Benefits Security Administration' },
  { jurisdiction: 'Internal Revenue Service', regime: 'IRC Subchapter L' },
  { jurisdiction: 'Internal Revenue Service', regime: 'FATCA' },
  { jurisdiction: 'Office for Civil Rights', regime: 'HIPAA Privacy' },
  { jurisdiction: 'Office for Civil Rights', regime: 'HIPAA Security' },
  { jurisdiction: 'Office for Civil Rights', regime: 'HIPAA Breach Notification' },
  { jurisdiction: 'Federal Communications Commission', regime: 'TCPA' },
  { jurisdiction: 'Federal Trade Commission', regime: 'FTC Act §5' },
  { jurisdiction: 'Federal Trade Commission', regime: 'GLBA Safeguards' },
  { jurisdiction: 'Federal Trade Commission', regime: 'GLBA Privacy' },
  { jurisdiction: 'Equal Employment Opportunity Commission', regime: 'Title VII' },
  { jurisdiction: 'Equal Employment Opportunity Commission', regime: 'ADA (Employment)' },
  { jurisdiction: 'Occupational Safety and Health Administration', regime: 'OSHA' },
  {
    jurisdiction: 'Centers for Medicare & Medicaid Services',
    regime: 'Medicare Advantage (Part C)',
  },
  { jurisdiction: 'Centers for Medicare & Medicaid Services', regime: 'Medicaid Managed Care' },
  { jurisdiction: 'Centers for Medicare & Medicaid Services', regime: 'ACA / PHSA' },
  { jurisdiction: 'Federal Emergency Management Agency', regime: 'NFIP (Write-Your-Own)' },
  { jurisdiction: 'Office of Personnel Management', regime: 'FEHB' },
  { jurisdiction: 'Risk Management Agency', regime: 'Federal Crop Insurance (SRA/FCIC)' },
  { jurisdiction: 'Federal Housing Finance Agency', regime: 'PMIERs' },
  { jurisdiction: 'U.S. federal regulators', regime: 'Sarbanes-Oxley' },
  {
    jurisdiction: 'National Association of Insurance Commissioners',
    regime: 'NAIC Annual Statement',
  },
];

// ── International (20) — the regimes that matter for a US insurer with EU/UK/
// Bermuda/Canada/Japan exposure (reinsurance, data protection, global groups).
const INTL_PICKS: Pick[] = [
  { jurisdiction: 'European Union', regime: 'Solvency II' },
  { jurisdiction: 'European Union', regime: 'GDPR' },
  { jurisdiction: 'European Union', regime: 'DORA' },
  { jurisdiction: 'European Union', regime: 'IDD' },
  { jurisdiction: 'European Union', regime: 'EU AI Act' },
  { jurisdiction: 'European Union', regime: 'SFDR' },
  { jurisdiction: 'United Kingdom', regime: 'Solvency UK' },
  { jurisdiction: 'United Kingdom', regime: 'SM&CR' },
  { jurisdiction: 'United Kingdom', regime: 'FCA Consumer Duty' },
  { jurisdiction: 'United Kingdom', regime: 'UK GDPR' },
  { jurisdiction: 'Bermuda', regime: 'BSCR/EBS' },
  { jurisdiction: 'Bermuda', regime: 'Insurance Act 1978' },
  { jurisdiction: 'Bermuda', regime: 'CISSA/GSSA' },
  { jurisdiction: 'Bermuda', regime: 'Insurance Code of Conduct' },
  { jurisdiction: 'Canada', regime: 'OSFI Guidelines' },
  { jurisdiction: 'Canada', regime: 'LICAT' },
  { jurisdiction: 'Canada', regime: 'PIPEDA' },
  { jurisdiction: 'Japan', regime: 'Insurance Business Act' },
  { jurisdiction: 'Japan', regime: 'APPI' },
  { jurisdiction: 'International (IAIS global standards)', regime: 'IAIS ICPs' },
];

async function resolveOne(p: Pick, used: Set<string>): Promise<string | null> {
  const row = await prisma.regulatoryRequirement.findFirst({
    where: {
      status: 'ACTIVE',
      id: { notIn: [...used] },
      jurisdiction: { name: { contains: p.jurisdiction, mode: 'insensitive' } },
      ...(p.regime ? { regime: { contains: p.regime, mode: 'insensitive' } } : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

// Top-up: any other ACTIVE row for the same jurisdiction pool, preferring a
// regime not already picked, so a tier still reaches its target count if a
// specific pick misses (naming drift, etc).
async function topUp(
  jurisdictionNames: string[],
  used: Set<string>,
  need: number,
): Promise<string[]> {
  if (need <= 0) return [];
  const rows = await prisma.regulatoryRequirement.findMany({
    where: {
      status: 'ACTIVE',
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
  const stateIds = await runTier('State', STATE_PICKS, 50, STATE_STATES);
  const federalIds = await runTier(
    'Federal',
    FEDERAL_PICKS,
    35,
    FEDERAL_PICKS.map((p) => p.jurisdiction),
  );
  const intlIds = await runTier(
    'International',
    INTL_PICKS,
    20,
    INTL_PICKS.map((p) => p.jurisdiction),
  );

  const allIds = [...stateIds, ...federalIds, ...intlIds];
  const result = await prisma.regulatoryRequirement.updateMany({
    where: { id: { in: allIds } },
    data: { complianceFlagged: true },
  });
  console.log(`Total flagged: ${result.count} (target 105)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
