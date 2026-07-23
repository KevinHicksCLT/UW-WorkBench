// Strip author-emitted ordinal prefixes from workplan step lines.
//
// load-workplan already numbers every non-final sop/verify line ("1) ", "2) ").
// When an authoring prompt shows an example whose lines are ALREADY numbered,
// agents copy that style and the loader numbers them a second time, so the Work
// tab renders "1) 1) Open the JE approval queue". This removes a single leading
// ordinal marker ("1) ", "1. ", "1 - ") from each sop/verify line so the loader
// remains the only thing that numbers them.
//
//   node scripts/enrich/strip-step-numbering.mjs scripts/output/workplan-<slug>.json
//
// Rewrites the file in place. Idempotent — safe to run on already-clean files.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: strip-step-numbering.mjs <workplan json>');

const ORDINAL = /^\s*\d+\s*[).\-:]\s+/;

const spec = JSON.parse(readFileSync(file, 'utf8'));
let stripped = 0;
let total = 0;

const clean = (lines) =>
  (lines ?? []).map((ln) => {
    total++;
    const out = ln.replace(ORDINAL, '');
    if (out !== ln) stripped++;
    return out;
  });

for (const t of spec.tasks ?? []) {
  for (const s of t.steps ?? []) {
    s.sop = clean(s.sop);
    s.verify = clean(s.verify);
  }
}

writeFileSync(file, JSON.stringify(spec, null, 2));
console.log(`${file}: stripped ${stripped} of ${total} step lines`);
