// fill-catalog-blanks.ts — fill the remaining list-view blanks that are real
// data gaps (not endpoint-derivable):
//   1. Application TCO / yr — totalTco + cost components (was null on 64/65 apps).
//   2. TelemetrySignal.frequency — null on all 52 non-live catalog signals.
// Realistic, deterministic (no RNG → reproducible), idempotent (only fills nulls).
//
// Run from backend/:  npx tsx scripts/fill-catalog-blanks.ts        (apply)
//                     npx tsx scripts/fill-catalog-blanks.ts --dry   (report)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

// deterministic 0..1 from a string (stable across runs).
const hash01 = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
};

// annual TCO band by criticality (USD); jittered deterministically by name.
const TCO_BAND: Record<string, [number, number]> = { High: [1_200_000, 3_000_000], Medium: [400_000, 900_000], Low: [120_000, 300_000] };
// component split (sums to 1).
const SPLIT = { licenseCost: 0.35, laborCost: 0.30, infraCost: 0.15, vendorServicesCost: 0.10, depreciationCost: 0.05, overheadCost: 0.05 };

// frequency by signal name/kind keyword.
function freqFor(name: string, kind: string): string {
  const n = name.toLowerCase();
  if (/latency|uptime|availability|error rate|throughput|incident|response time/.test(n)) return 'Real-time';
  if (/login|active user|session|usage|deployment|build|ticket/.test(n)) return 'Daily';
  if (/adoption|engagement|backlog|velocity|coverage|satisfaction/.test(n)) return 'Weekly';
  if (/cost|spend|roi|revenue|retention|capacity|headcount/.test(n)) return 'Monthly';
  return kind === 'system' ? 'Daily' : 'Monthly';
}

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('no company');
  const companyId = company.id;
  console.log(`\n=== fill-catalog-blanks ${DRY ? '(DRY RUN)' : '(APPLY)'} — ${company.name} ===`);
  const counts = { tco: 0, frequency: 0 };

  // 1. Application TCO ------------------------------------------------------
  const apps = await prisma.application.findMany({ where: { companyId, totalTco: null }, select: { id: true, name: true, criticality: true } });
  for (const a of apps) {
    const [lo, hi] = TCO_BAND[a.criticality] ?? TCO_BAND.Medium;
    const total = Math.round((lo + (hi - lo) * hash01(a.name)) / 1000) * 1000; // round to $1K
    const data = {
      totalTco: total,
      licenseCost: Math.round(total * SPLIT.licenseCost),
      laborCost: Math.round(total * SPLIT.laborCost),
      infraCost: Math.round(total * SPLIT.infraCost),
      vendorServicesCost: Math.round(total * SPLIT.vendorServicesCost),
      depreciationCost: Math.round(total * SPLIT.depreciationCost),
      overheadCost: Math.round(total * SPLIT.overheadCost),
    };
    counts.tco++;
    if (counts.tco <= 5) console.log(`  ${a.name} [${a.criticality}] → $${Math.round(total / 1000)}K/yr`);
    if (!DRY) await prisma.application.update({ where: { id: a.id }, data });
  }
  if (counts.tco > 5) console.log(`  …and ${counts.tco - 5} more apps`);

  // 2. TelemetrySignal frequency -------------------------------------------
  const sigs = await prisma.telemetrySignal.findMany({ where: { companyId, frequency: null }, select: { id: true, name: true, kind: true } });
  for (const s of sigs) {
    counts.frequency++;
    if (!DRY) await prisma.telemetrySignal.update({ where: { id: s.id }, data: { frequency: freqFor(s.name, s.kind) } });
  }

  console.log('\n--- summary ---');
  console.table(counts);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
