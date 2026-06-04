import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// One-off: bring existing illustrative people in line with the corrected region
// mix (~60% Offshore, ~10% Nearshore, ~30% Onshore — i.e. ~70% off/near-shore).
// Non-destructive: it only rewrites region/location/vendor on the person rows,
// using the SAME deterministic logic as src/seed/illustrative.ts, so the live DB
// matches what a fresh seed would now produce. Safe to re-run.

const prisma = new PrismaClient();

const VENDORS = ['Infosys', 'TCS', 'Accenture', 'Cognizant', 'Capgemini', 'Wipro'];
const OFFSHORE_LOC = ['Bengaluru, IN', 'Pune, IN', 'Hyderabad, IN', 'Manila, PH'];
const NEARSHORE_LOC = ['Krakow, PL', 'Lisbon, PT', 'San Jose, CR'];
const ONSHORE_LOC = ['London, UK', 'New York, US', 'Chicago, US', 'Toronto, CA'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pickFrom = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];

async function main() {
  const people = await prisma.person.findMany({
    select: {
      id: true, employmentType: true,
      assignments: { where: { isPrimary: true }, select: { roleId: true, role: { select: { name: true } } }, take: 1 },
    },
  });

  let updated = 0;
  for (const p of people) {
    const asg = p.assignments[0];
    if (!asg) continue; // no primary role → leave as-is
    const roleId = asg.roleId;
    const i = Number(p.id.slice(p.id.lastIndexOf('_') + 1));
    const h = hash(`${roleId}:${i}`);

    const r = h % 100;
    let region = r < 60 ? 'Offshore' : r < 70 ? 'Nearshore' : 'Onshore';
    let vendor: string | null = p.employmentType !== 'badged' ? pickFrom(h >> 3, VENDORS) : null;
    let location = region === 'Offshore' ? pickFrom(h >> 7, OFFSHORE_LOC) : region === 'Nearshore' ? pickFrom(h >> 7, NEARSHORE_LOC) : pickFrom(h >> 7, ONSHORE_LOC);

    // Mirror the seed's UI-developer special case.
    if (/ui developer/i.test(asg.role?.name ?? '') && i === 0) {
      region = 'Offshore'; vendor = pickFrom(h, VENDORS); location = pickFrom(h, OFFSHORE_LOC);
    }

    await prisma.person.update({ where: { id: p.id }, data: { region, location, vendor } });
    updated++;
  }

  const byRegion = await prisma.person.groupBy({ by: ['region'], _count: { _all: true } });
  console.log(`Updated ${updated}/${people.length} people`);
  console.log('New region mix:', JSON.stringify(byRegion.map((g) => ({ region: g.region, count: g._count._all }))));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
