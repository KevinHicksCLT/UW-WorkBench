// Merge per-sub-process enrichment part files into one loader input.
//   npx tsx --env-file=.env scripts/enrich/merge-parts.ts <area> <slug> <part1.json> <part2.json> ...
// Reads companyId from enrich-catalog.json. Validates each element has a taskId
// and de-dupes by taskId (last wins). Writes scripts/output/enrichment-<slug>.json.
import { readFileSync, writeFileSync } from 'node:fs';

const [area, slug, ...parts] = process.argv.slice(2);
if (!area || !slug || parts.length === 0)
  throw new Error('usage: merge-parts.ts <area> <slug> <part...>');

const { companyId } = JSON.parse(readFileSync('scripts/output/enrich-catalog.json', 'utf8')) as {
  companyId: string;
};

const byTask = new Map<string, unknown>();
for (const p of parts) {
  const arr = JSON.parse(readFileSync(p, 'utf8')) as Array<{ taskId?: string }>;
  if (!Array.isArray(arr)) throw new Error(`${p} is not a JSON array`);
  for (const el of arr) {
    if (!el.taskId) throw new Error(`element in ${p} missing taskId`);
    byTask.set(el.taskId, el);
  }
}
const tasks = [...byTask.values()];
writeFileSync(
  `scripts/output/enrichment-${slug}.json`,
  JSON.stringify({ area, companyId, tasks }, null, 2),
);
console.log(
  `merged ${parts.length} parts → ${tasks.length} tasks → scripts/output/enrichment-${slug}.json`,
);
