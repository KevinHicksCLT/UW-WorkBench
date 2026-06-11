// migrate-jira-keys.ts — additive DDL for the Jira integration stub (D1.7):
//   • Task.jiraKey        — external Jira issue key (TEXT, nullable)
//   • Deliverable.jiraKey — external Jira issue key (TEXT, nullable)
// No live sync — the column only carries the key so the UI can show a "Jira"
// affordance. Raw SQL because the live DB carries drift `prisma db push` would
// try to drop. Idempotent (IF NOT EXISTS throughout). Run (cwd = backend):
//   npx tsx scripts/migrate-jira-keys.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `ALTER TABLE public."Task" ADD COLUMN IF NOT EXISTS "jiraKey" TEXT`,
  `ALTER TABLE public."Deliverable" ADD COLUMN IF NOT EXISTS "jiraKey" TEXT`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
