// migrate-ai-analysis.ts — additive DDL for the Metrics tab refactor (D6.2–D6.5):
//   • Task.aiDisposition  — stage-2 adoption disposition per task
//     (Automated | Discarded | Augmented | Manual | NULL = not assessed)
//   • AnalysisStatus      — stage-1 analysis coverage, one row per analyzed
//     value-stream / division / role node
// Raw SQL because the live DB carries drift `prisma db push` would try to drop.
// Idempotent (IF NOT EXISTS throughout). Run (cwd = backend):
//   npx tsx scripts/migrate-ai-analysis.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `ALTER TABLE public."Task" ADD COLUMN IF NOT EXISTS "aiDisposition" TEXT`,
  `CREATE TABLE IF NOT EXISTS public."AnalysisStatus" (
     "id"            TEXT NOT NULL,
     "tenantId"      TEXT NOT NULL,
     "companyId"     TEXT NOT NULL,
     "subjectType"   TEXT NOT NULL,
     "subjectId"     TEXT NOT NULL,
     "status"        TEXT NOT NULL DEFAULT 'Not Started',
     "plannedDate"   TIMESTAMP(3),
     "completedDate" TIMESTAMP(3),
     "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "AnalysisStatus_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "AnalysisStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AnalysisStatus_companyId_subjectType_subjectId_key" ON public."AnalysisStatus"("companyId", "subjectType", "subjectId")`,
  `CREATE INDEX IF NOT EXISTS "AnalysisStatus_companyId_idx" ON public."AnalysisStatus"("companyId")`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql.replace(/\s+/g, ' ').slice(0, 88));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
