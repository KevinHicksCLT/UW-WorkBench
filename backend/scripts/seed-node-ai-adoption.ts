// Seeds NodeAiAdoption from the authored frontend profiles (lib/aiAdoption.ts)
// onto canonical value_stream NODES, by EXACT name match. STREAM_PROFILES is
// keyed by the 29 workbook stream names, so after the 29-stream canonicalization
// every stream gets its authored profile. Existing rows (hand edits carried by
// backfill-nodes.ts) are left untouched. Idempotent.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const LEVELS = ['not_used', 'pilot', 'emerging', 'scaling', 'embedded'];
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../frontend/src/lib/aiAdoption.ts'), 'utf8');

// Parse STREAM_PROFILES: stream name -> { assistant, augmented, workflow, agent } level int.
const profiles: Record<string, Record<string, number>> = {};
let current = '';
for (const line of src.split('\n')) {
  const head = line.match(/^ {2}'(.+)':\s*\{/);
  if (head) { current = head[1]; profiles[current] = {}; continue; }
  const mode = line.match(/^\s*(assistant|augmented|workflow|agent):\s*m\((\d)/);
  if (mode && current) profiles[current][mode[1]] = Number(mode[2]);
}

async function main() {
  const nodes = await prisma.node.findMany({ where: { typeKey: 'value_stream' }, select: { id: true, name: true, aiAdoption: { select: { id: true } } } });
  let seeded = 0, kept = 0;
  const unmatched: string[] = [];
  for (const n of nodes) {
    if (n.aiAdoption) { kept++; continue; }
    const p = profiles[n.name];
    if (!p) { unmatched.push(n.name); continue; }
    await prisma.nodeAiAdoption.create({
      data: {
        nodeId: n.id,
        aiAssist: LEVELS[p.assistant ?? 0],
        aiAugment: LEVELS[p.augmented ?? 0],
        aiWorkflow: LEVELS[p.workflow ?? 0],
        aiAutonomous: LEVELS[p.agent ?? 0],
      },
    });
    seeded++;
  }
  console.log(`STREAM_PROFILES parsed: ${Object.keys(profiles).length}`);
  console.log(`value-stream nodes: ${nodes.length} — kept existing ${kept}, seeded ${seeded}, unmatched ${unmatched.length}`);
  unmatched.forEach((u) => console.log(`  - ${u}`));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
