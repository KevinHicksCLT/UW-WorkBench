// Seeds LevelAiAdoption from the authored frontend profiles (lib/aiAdoption.ts)
// onto canonical value-stream Level nodes (levelNumber = 3), by EXACT name match.
// Unmatched canonical streams stay not_used — the 29→21 stream-set reconciliation
// is a later data pass. Idempotent (upsert). Part of defect-fixes_01 task #6.
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
  const nodes = await prisma.level.findMany({ where: { levelNumber: 3 }, select: { id: true, name: true } });
  let matched = 0;
  const unmatched: string[] = [];
  for (const n of nodes) {
    const p = profiles[n.name];
    if (!p) { unmatched.push(n.name); continue; }
    const data = {
      aiAssist: LEVELS[p.assistant ?? 0],
      aiAugment: LEVELS[p.augmented ?? 0],
      aiWorkflow: LEVELS[p.workflow ?? 0],
      aiAutonomous: LEVELS[p.agent ?? 0],
    };
    await prisma.levelAiAdoption.upsert({
      where: { levelId: n.id },
      create: { levelId: n.id, ...data },
      update: data,
    });
    matched++;
  }
  console.log(`STREAM_PROFILES parsed: ${Object.keys(profiles).length}`);
  console.log(`value-stream Level nodes: ${nodes.length}`);
  console.log(`seeded by exact name match: ${matched}`);
  console.log(`unmatched (stay not_used): ${unmatched.length}`);
  unmatched.forEach((u) => console.log(`  - ${u}`));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
