// Seeds NodeAiAdoption (levels + per-mode use cases) onto canonical value_stream
// NODES from backend/data/ai-adoption-usecases.json — the authored per-stream
// profiles exported from the old hardcoded frontend copy (lib/aiAdoption.ts
// STREAM_PROFILES, removed in the same change). Replaces and folds in the old
// scripts/seed-node-ai-adoption.ts (which only seeded the levels).
//
// Idempotent / non-destructive:
//   • node has no NodeAiAdoption row  → create it with the profile's levels + use cases
//   • row exists, useCases is NULL    → fill useCases only (hand-edited levels kept)
//   • row exists, useCases is set     → leave untouched
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const LEVELS = ['not_used', 'pilot', 'emerging', 'scaling', 'embedded'];

type UseCase = { title: string; persona: string; detail: string };
type ModeProfile = { level: number; useCases: UseCase[] };
type StreamProfile = { assistant: ModeProfile; augmented: ModeProfile; workflow: ModeProfile; agent: ModeProfile };

const here = dirname(fileURLToPath(import.meta.url));
const PROFILES: Record<string, StreamProfile> = JSON.parse(
  readFileSync(resolve(here, '../data/ai-adoption-usecases.json'), 'utf8'),
);

// NodeAiAdoption.useCases canonical shape: { assistant: UseCase[], augmented: …,
// workflow: …, agent: … } — the levels live in the four ai* columns.
const useCasesOf = (p: StreamProfile) => ({
  assistant: p.assistant.useCases,
  augmented: p.augmented.useCases,
  workflow: p.workflow.useCases,
  agent: p.agent.useCases,
});

async function main() {
  const nodes = await prisma.node.findMany({
    where: { typeKey: 'value_stream' },
    select: { id: true, name: true, aiAdoption: { select: { id: true, useCases: true } } },
  });
  let created = 0, filled = 0, kept = 0;
  const unmatched: string[] = [];
  for (const n of nodes) {
    const p = PROFILES[n.name];
    if (!p) { unmatched.push(n.name); continue; }
    if (!n.aiAdoption) {
      await prisma.nodeAiAdoption.create({
        data: {
          nodeId: n.id,
          aiAssist: LEVELS[p.assistant.level ?? 0],
          aiAugment: LEVELS[p.augmented.level ?? 0],
          aiWorkflow: LEVELS[p.workflow.level ?? 0],
          aiAutonomous: LEVELS[p.agent.level ?? 0],
          useCases: useCasesOf(p),
        },
      });
      created++;
    } else if (n.aiAdoption.useCases == null) {
      await prisma.nodeAiAdoption.update({ where: { id: n.aiAdoption.id }, data: { useCases: useCasesOf(p) } });
      filled++;
    } else {
      kept++;
    }
  }
  console.log(`profiles: ${Object.keys(PROFILES).length} — value-stream nodes: ${nodes.length}`);
  console.log(`created ${created}, useCases filled ${filled}, kept (already had useCases) ${kept}, unmatched ${unmatched.length}`);
  unmatched.forEach((u) => console.log(`  - ${u}`));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
