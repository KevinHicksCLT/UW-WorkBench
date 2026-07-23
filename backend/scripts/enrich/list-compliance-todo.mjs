/**
 * Print the compliance-plan chunks still needing authoring, as a JSON array of
 * chunk ids — the exact `args` for the compliance-plan-rollout workflow. A
 * chunk is todo when its pack is missing, unparseable, or lacks a complete
 * entry (itemCode + 15 checklist + 10 testing steps) for any chunk item.
 *
 *   node scripts/enrich/list-compliance-todo.mjs          # JSON array
 *   node scripts/enrich/list-compliance-todo.mjs --stats  # human summary
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const CHUNKS = path.resolve(process.cwd(), 'scripts/output/compliance-chunks');
const PACKS = path.resolve(process.cwd(), 'data/compliance-plans');

const index = JSON.parse(readFileSync(path.join(CHUNKS, '_index.json'), 'utf8'));
const todo = [];
let doneChunks = 0;
let doneItems = 0;

for (const { id } of index) {
  const packPath = path.join(PACKS, `${id}.json`);
  if (!existsSync(packPath)) {
    todo.push(id);
    continue;
  }
  let pack;
  try {
    pack = JSON.parse(readFileSync(packPath, 'utf8'));
  } catch {
    todo.push(id);
    continue;
  }
  const want = JSON.parse(readFileSync(path.join(CHUNKS, `${id}.json`), 'utf8')).items.map(
    (i) => i.itemCode,
  );
  const byCode = new Map((pack.items ?? []).map((i) => [i?.itemCode, i]));
  const complete = want.every((code) => {
    const it = byCode.get(code);
    return it && (it.checklist?.length ?? 0) >= 15 && (it.testing?.length ?? 0) >= 10;
  });
  if (complete) {
    doneChunks++;
    doneItems += want.length;
  } else {
    todo.push(id);
  }
}

if (process.argv.includes('--stats')) {
  console.log(`chunks: done=${doneChunks} todo=${todo.length} of ${index.length}`);
  console.log(`items authored (complete chunks only): ${doneItems}`);
  console.log(`next 20: ${todo.slice(0, 20).join(', ')}`);
} else {
  console.log(JSON.stringify(todo));
}
