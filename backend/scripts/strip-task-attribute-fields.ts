// Sidebar cleanup (user request 2026-07-01): the workbook step fields that used
// to render in the Inspector "Process detail" panel are removed from the UI and
// from ProcessNode.attributes — they were the SEED source for the Work Library
// (templates + assignments already materialized) and the dedup Disposition audit
// trail, both now superseded. Other attribute keys (deliverable, ordinals, …)
// are kept. Idempotent.
// Run: npx tsx --env-file=.env scripts/strip-task-attribute-fields.ts
import { prisma } from '../src/db/prisma.js';

const KEYS = ['how', 'testByPattern', 'checklistPattern', 'checklistDifferences', 'l4l5Mapping', 'disposition', 'l5num'];

async function main() {
  const minus = KEYS.map((k) => `- '${k}'`).join(' ');
  const n = await prisma.$executeRawUnsafe(`
    UPDATE public."ProcessNode"
    SET attributes = attributes ${minus}
    WHERE "isTask" AND attributes IS NOT NULL AND attributes ?| array[${KEYS.map((k) => `'${k}'`).join(',')}]`);
  const left = await prisma.$queryRawUnsafe<{ n: number }[]>(`
    SELECT count(*)::int AS n FROM public."ProcessNode"
    WHERE "isTask" AND attributes IS NOT NULL AND attributes ?| array[${KEYS.map((k) => `'${k}'`).join(',')}]`);
  console.log(`stripped ${KEYS.join('/')} from ${n} task rows; remaining with those keys: ${left[0].n}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
