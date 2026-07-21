// Remap a workplan file's generic keys (positional) to the canonical template
// labels the loader expects. Use when an author emitted camelCase/short keys.
// Usage: node scripts/enrich/remap-generic-keys.mjs <workplan.json>
import { readFileSync, writeFileSync } from 'node:fs';

const CANON = [
  'Defined scope/population', 'In-scope period', 'Required fields populated and valid',
  'Control totals or record counts reconcile', 'Evidence retained with timestamp/version',
  'Exceptions logged with disposition', 'Test population', 'Pass/fail thresholds',
  'Exception handling path', 'Documented acceptance criteria', 'Evidence location',
];
const file = process.argv[2];
const doc = JSON.parse(readFileSync(file, 'utf8'));
let fixed = 0;
for (const t of doc.tasks) {
  const vals = Object.values(t.generic ?? {});
  if (vals.length !== 11) { console.error(`task ${t.taskId}: ${vals.length} generic keys, expected 11`); process.exit(2); }
  const already = CANON.every((k) => k in t.generic);
  if (already) continue;
  t.generic = Object.fromEntries(CANON.map((k, i) => [k, vals[i]]));
  fixed++;
}
writeFileSync(file, JSON.stringify(doc, null, 2));
console.log(`remapped ${fixed}/${doc.tasks.length} tasks → ${file}`);
