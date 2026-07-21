// One-off: merge scattered wp-batch-*.json fragments (from a fanned-out author)
// into a final workplan-<slug>.json, validated against the area seed.
// Usage: node scripts/enrich/merge-batches.mjs <slug> "<Area Name>" <dir> <prefix>
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const [slug, area, dir, prefix] = process.argv.slice(2);
if (!slug || !area || !dir || !prefix) throw new Error('usage: <slug> "<Area>" <dir> <prefix>');

const seed = JSON.parse(readFileSync(`scripts/output/enrich-tasks-${slug}.json`, 'utf8'));
const want = new Set(seed.tasks.map((t) => t.id));
const byId = new Map();
const re = new RegExp(`^${prefix}-\\d+\\.json$`);
for (const f of readdirSync(dir).filter((f) => re.test(f))) {
  const a = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const arr = Array.isArray(a) ? a : a.tasks;
  for (const x of arr) if (x && x.taskId) byId.set(x.taskId, x);
}
const tasks = [...byId.values()].filter((x) => want.has(x.taskId));
const missing = [...want].filter((id) => !byId.has(id));
const out = `scripts/output/workplan-${slug}.json`;
if (missing.length) { console.error(`INCOMPLETE ${tasks.length}/${want.size} missing ${missing.length}: ${missing.slice(0, 8).join(',')}`); process.exit(2); }
writeFileSync(out, JSON.stringify({ area, tasks }, null, 2));
console.log(`merged ${tasks.length}/${want.size} → ${out}`);
