// validate-output.cjs — strict check of the authored decomposition content
// against the input slices before loading: every item present in order, keys
// verbatim, one sub per fragment (none for single-fragment items), all text
// non-empty. Run from repo root: node standards/decomposition/validate-output.cjs
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const IN = join(__dirname, 'input');
const OUT = join(__dirname, 'output');
let errors = 0, items = 0, subs = 0;

for (const f of readdirSync(IN).filter((x) => x.endsWith('.json'))) {
  let out;
  try { out = JSON.parse(readFileSync(join(OUT, f), 'utf8')); }
  catch (e) { console.log(`✗ ${f}: ${e.message}`); errors++; continue; }
  const inp = JSON.parse(readFileSync(join(IN, f), 'utf8'));
  if (out.department !== inp.department) { console.log(`✗ ${f}: department mismatch`); errors++; }
  if (out.items.length !== inp.items.length) { console.log(`✗ ${f}: ${out.items.length} items, expected ${inp.items.length}`); errors++; continue; }
  inp.items.forEach((ii, i) => {
    const oi = out.items[i];
    items++;
    if (oi.name !== ii.name || oi.category !== ii.category) { console.log(`✗ ${f}[${i}]: key mismatch ("${oi.name}" vs "${ii.name}")`); errors++; return; }
    if (!oi.summary || !oi.summary.trim()) { console.log(`✗ ${f}[${i}] ${ii.name}: empty summary`); errors++; }
    const want = ii.fragments.length === 1 ? 0 : ii.fragments.length;
    if (oi.subs.length !== want) { console.log(`✗ ${f}[${i}] ${ii.name}: ${oi.subs.length} subs, expected ${want}`); errors++; }
    oi.subs.forEach((s, j) => {
      subs++;
      if (!s.title || !s.title.trim() || !s.description || !s.description.trim()) { console.log(`✗ ${f}[${i}] ${ii.name} sub[${j}]: empty title/description`); errors++; }
    });
  });
}
console.log(`${items} items, ${subs} subs, ${errors} errors`);
process.exit(errors ? 1 : 0);
