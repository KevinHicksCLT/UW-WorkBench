// migrate-step-lens.ts — additive DDL for the step-lens (apps + deliverables)
// schema additions. Raw SQL because the live DB carries drift `prisma db push`
// would try to drop. Idempotent (IF NOT EXISTS throughout). Run (cwd = backend):
//   npx tsx scripts/migrate-step-lens.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `ALTER TABLE public."ProcessStep" ADD COLUMN IF NOT EXISTS "code" TEXT`,
  `ALTER TABLE public."ProcessStep" ADD COLUMN IF NOT EXISTS "parentProcessId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ProcessStep_code_idx" ON public."ProcessStep"("code")`,
  `ALTER TABLE public."SubValueStream" ADD COLUMN IF NOT EXISTS "code" TEXT`,
  `ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "code" TEXT`,
  `ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "systemOfRecord" BOOLEAN`,
  `ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "fte" DOUBLE PRECISION`,
  `ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "netAvailableHrs" DOUBLE PRECISION`,
  `CREATE TABLE IF NOT EXISTS public."StepAppUsage" (
     "id"            TEXT NOT NULL,
     "tenantId"      TEXT NOT NULL,
     "companyId"     TEXT NOT NULL,
     "activityCode"  TEXT NOT NULL,
     "processStepId" TEXT,
     "applicationId" TEXT NOT NULL,
     "usageType"     TEXT NOT NULL,
     "isPrimary"     BOOLEAN NOT NULL DEFAULT false,
     "notes"         TEXT,
     "illustrative"  BOOLEAN NOT NULL DEFAULT true,
     "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "StepAppUsage_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "StepAppUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "StepAppUsage_processStepId_fkey" FOREIGN KEY ("processStepId") REFERENCES public."ProcessStep"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "StepAppUsage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "StepAppUsage_companyId_idx" ON public."StepAppUsage"("companyId")`,
  `CREATE INDEX IF NOT EXISTS "StepAppUsage_activityCode_idx" ON public."StepAppUsage"("activityCode")`,
  `CREATE INDEX IF NOT EXISTS "StepAppUsage_processStepId_idx" ON public."StepAppUsage"("processStepId")`,
  `CREATE INDEX IF NOT EXISTS "StepAppUsage_applicationId_idx" ON public."StepAppUsage"("applicationId")`,
  `CREATE TABLE IF NOT EXISTS public."StepDeliverable" (
     "id"                    TEXT NOT NULL,
     "tenantId"              TEXT NOT NULL,
     "companyId"             TEXT NOT NULL,
     "code"                  TEXT,
     "activityCode"          TEXT NOT NULL,
     "processStepId"         TEXT,
     "name"                  TEXT NOT NULL,
     "sorApplicationId"      TEXT,
     "approverRoleId"        TEXT,
     "approverRoleRaw"       TEXT,
     "approvalApplicationId" TEXT,
     "approvalType"          TEXT,
     "notes"                 TEXT,
     "illustrative"          BOOLEAN NOT NULL DEFAULT true,
     "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "StepDeliverable_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "StepDeliverable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "StepDeliverable_processStepId_fkey" FOREIGN KEY ("processStepId") REFERENCES public."ProcessStep"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "StepDeliverable_sorApplicationId_fkey" FOREIGN KEY ("sorApplicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     CONSTRAINT "StepDeliverable_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     CONSTRAINT "StepDeliverable_approvalApplicationId_fkey" FOREIGN KEY ("approvalApplicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "StepDeliverable_companyId_idx" ON public."StepDeliverable"("companyId")`,
  `CREATE INDEX IF NOT EXISTS "StepDeliverable_activityCode_idx" ON public."StepDeliverable"("activityCode")`,
  `CREATE INDEX IF NOT EXISTS "StepDeliverable_processStepId_idx" ON public."StepDeliverable"("processStepId")`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql.replace(/\s+/g, ' ').slice(0, 88));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
