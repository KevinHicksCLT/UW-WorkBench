// slice-inputs.cjs — split standards-dump.json into per-agent input files for
// authoring the standards decomposition content (summary + per-fragment subs).
// Run from repo root: node standards/decomposition/slice-inputs.cjs
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const areas = JSON.parse(readFileSync(join(ROOT, 'standards-dump.json'), 'utf8'));
const OUT = join(__dirname, 'input');
mkdirSync(OUT, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// areas needing more than one authoring agent → number of chunks
const CHUNKS = { 'Information Security': 3, 'Enterprise & Solution Architecture': 2 };

const files = [];
for (const a of areas) {
  const n = CHUNKS[a.department] ?? 1;
  const per = Math.ceil(a.items.length / n);
  for (let c = 0; c < n; c++) {
    const items = a.items.slice(c * per, (c + 1) * per).map((i) => ({
      category: i.category,
      name: i.name,
      description: i.description,
      fragments: i.description.split(';').map((s) => s.trim()).filter(Boolean),
    }));
    if (!items.length) continue;
    const file = `${slug(a.department)}${n > 1 ? `-${c + 1}` : ''}.json`;
    writeFileSync(join(OUT, file), JSON.stringify({ department: a.department, items }, null, 2));
    files.push(`${file}: ${items.length} items, ${items.reduce((s, i) => s + i.fragments.length, 0)} fragments`);
  }
}
console.log(files.join('\n'));
