// diff-api.mjs — deep-compares each api-after/*.json against api-before/*.json.
// Usage: node diff-api.mjs [beforeDir] [afterDir]   (defaults: api-before api-after)
// Reports per-file PASS/FAIL with the first differing JSON path.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const beforeDir = process.argv[2] ?? 'api-before';
const afterDir = process.argv[3] ?? 'api-after';

/** Returns the first differing path between a and b, or null if deep-equal. */
function firstDiff(a, b, path = '$') {
  if (a === b) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${path} (before=${JSON.stringify(a)?.slice(0, 120)} after=${JSON.stringify(b)?.slice(0, 120)})`;
  }
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return `${path} (array/object mismatch)`;
  if (aArr) {
    if (a.length !== b.length) return `${path}.length (before=${a.length} after=${b.length})`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const aKeys = Object.keys(a), bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    const missing = aKeys.filter((k) => !(k in b));
    const extra = bKeys.filter((k) => !(k in a));
    return `${path} keys differ (missing after: [${missing}] extra after: [${extra}])`;
  }
  for (const k of aKeys) {
    if (!(k in b)) return `${path}.${k} (missing after)`;
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

let pass = 0, fail = 0;
const files = readdirSync(beforeDir).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const afterPath = join(afterDir, f);
  if (!existsSync(afterPath)) { console.log(`FAIL ${f} — missing in ${afterDir}`); fail++; continue; }
  let before, after;
  try { before = JSON.parse(readFileSync(join(beforeDir, f), 'utf8')); }
  catch (e) { console.log(`SKIP ${f} — before unparseable: ${e.message}`); continue; }
  try { after = JSON.parse(readFileSync(afterPath, 'utf8')); }
  catch (e) { console.log(`FAIL ${f} — after unparseable: ${e.message}`); fail++; continue; }
  const d = firstDiff(before, after);
  if (d) { console.log(`FAIL ${f} — first diff at ${d}`); fail++; }
  else { console.log(`PASS ${f}`); pass++; }
}
console.log(`\n${pass} PASS, ${fail} FAIL of ${files.length}`);
process.exit(fail ? 1 : 0);
