/**
 * SCRUM-46 — feasibility check: can every workbook L3 row be matched to an
 * existing RegulatoryRequirement row? Matching key: jurisdiction name + title
 * (+ citation as tiebreak). Read-only.
 * Run: npx tsx --env-file=.env scripts/compliance-match-test.ts
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { prisma } from '../src/db/prisma.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx') as typeof import('xlsx');

const WB = path.resolve(
  '..',
  'documents',
  'regulations',
  'Regulation-Compliance-Determination-Ready.xlsx',
);

type L3Row = Record<string, string>;

async function main() {
  const wb = XLSX.readFile(WB);
  const l3 = XLSX.utils.sheet_to_json<L3Row>(wb.Sheets['Requirements Flagged (L3)'], {
    defval: '',
  });

  const dbRows = await prisma.regulatoryRequirement.findMany({
    select: {
      id: true,
      title: true,
      citation: true,
      category: true,
      lineOfBusiness: true,
      jurisdiction: { select: { name: true, code: true } },
    },
  });
  console.log('workbook L3:', l3.length, '| db rows:', dbRows.length);

  const keyOf = (jur: string, title: string) =>
    `${jur.trim().toLowerCase()}||${title.trim().toLowerCase()}`;
  const dbByKey = new Map<string, typeof dbRows>();
  for (const r of dbRows) {
    const k = keyOf(r.jurisdiction.name, r.title);
    const arr = dbByKey.get(k) ?? [];
    arr.push(r);
    dbByKey.set(k, arr);
  }

  let exact = 0,
    multi = 0,
    miss = 0;
  const misses: string[] = [];
  const multis: string[] = [];
  for (const row of l3) {
    const k = keyOf(row['Jurisdiction'], row['Requirement Title']);
    const cands = dbByKey.get(k);
    if (!cands || cands.length === 0) {
      miss++;
      if (misses.length < 10) misses.push(`${row['Jurisdiction']} :: ${row['Requirement Title']}`);
    } else if (cands.length === 1) {
      exact++;
    } else {
      // tiebreak on citation + lob + category
      const tb = cands.filter(
        (c) =>
          (c.citation ?? '') === row['Citation'] &&
          c.lineOfBusiness === row['Line of Business'] &&
          c.category === row['Category'],
      );
      if (tb.length === 1) exact++;
      else {
        multi++;
        if (multis.length < 10)
          multis.push(
            `${row['Jurisdiction']} :: ${row['Requirement Title']} (cands=${cands.length}, tb=${tb.length})`,
          );
      }
    }
  }
  console.log({ exact, multi, miss });
  console.log('sample misses:', misses);
  console.log('sample multis:', multis);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
