// migrate-agent-scores.ts — additive DDL for the Work-tab agent-automatability
// assessment:
//   • Task.agentScore     — 1 (an AI agent can do this end-to-end today) … 5
//     (human-only); NULL = not yet scored
//   • Task.agentRationale — Claude's one-line justification for the score
//   • Task.agentScoredAt  — when the score was written
// Raw SQL because the live DB carries drift `prisma db push` would try to drop.
// Idempotent (IF NOT EXISTS throughout). Run (cwd = backend):
//   npx tsx scripts/migrate-agent-scores.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `ALTER TABLE public."Task" ADD COLUMN IF NOT EXISTS "agentScore" INTEGER`,
  `ALTER TABLE public."Task" ADD COLUMN IF NOT EXISTS "agentRationale" TEXT`,
  `ALTER TABLE public."Task" ADD COLUMN IF NOT EXISTS "agentScoredAt" TIMESTAMP(3)`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql.replace(/\s+/g, ' ').slice(0, 88));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
