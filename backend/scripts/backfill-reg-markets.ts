// backfill-reg-markets.ts — populate the new market-segment tags and fill any
// empty classification fields on the EXISTING regulation catalog, so no field
// renders blank on the regulation pages. Derives `markets` from the coarse
// lineOfBusiness + regulatorType, and gives null `frequency` a sensible value
// from the obligation type. Idempotent; only touches rows that need it.
//
// Run (cwd = backend): npx tsx --env-file=.env scripts/backfill-reg-markets.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// coarse lineOfBusiness → market segment(s).
const LOB_MARKETS: Record<string, string[]> = {
  ALL: ['PERSONAL', 'COMMERCIAL'],
  PROPERTY: ['PERSONAL', 'COMMERCIAL'],
  AUTO: ['PERSONAL', 'COMMERCIAL'],
  LIFE_ANNUITY: ['PERSONAL', 'COMMERCIAL'],
  HEALTH: ['PERSONAL', 'COMMERCIAL'],
  WORKERS_COMP: ['COMMERCIAL'],
  COMMERCIAL_LIABILITY: ['COMMERCIAL'],
  SURPLUS_LINES: ['COMMERCIAL'],
  REINSURANCE: ['COMMERCIAL'],
};

// obligationType → default cadence when frequency is missing.
const FREQ_DEFAULT: Record<string, string> = {
  FILING_GATE: 'per-filing',
  EVENT_DRIVEN: 'per-event',
  INFORMATIONAL: 'as-needed',
  ONGOING: 'continuous',
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const companyId = company.id;

  const rows = await prisma.regulatoryRequirement.findMany({
    where: { companyId },
    select: {
      id: true,
      lineOfBusiness: true,
      obligationType: true,
      frequency: true,
      markets: true,
      jurisdiction: { select: { regulatorType: true } },
    },
  });

  let mkt = 0;
  let freq = 0;
  for (const r of rows) {
    const data: { markets?: string[]; frequency?: string } = {};
    if (!r.markets || r.markets.length === 0) {
      // Corporate / federal / international obligations apply across both markets;
      // otherwise map from the coarse line.
      const derived =
        r.jurisdiction.regulatorType !== 'STATE_INSURANCE_REGULATOR'
          ? ['PERSONAL', 'COMMERCIAL']
          : (LOB_MARKETS[r.lineOfBusiness] ?? ['PERSONAL', 'COMMERCIAL']);
      data.markets = derived;
      mkt++;
    }
    if (!r.frequency) {
      data.frequency = FREQ_DEFAULT[r.obligationType] ?? 'periodic';
      freq++;
    }
    if (Object.keys(data).length) {
      await prisma.regulatoryRequirement.update({ where: { id: r.id }, data });
    }
  }

  console.log(
    `backfill: markets set on ${mkt} rows · frequency filled on ${freq} rows (of ${rows.length})`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
