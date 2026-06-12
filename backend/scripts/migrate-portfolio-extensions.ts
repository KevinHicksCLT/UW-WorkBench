// Additive DDL for gap backlog I3/I4/I6/I9 (2026-06-10): strategic alignment
// (objectives + impact links + value score), charter scores, resources, and
// workplan activities for the PortfolioInitiative tracker. Raw SQL because the
// live DB carries drift `prisma db push` would destroy (see memory/CLAUDE.md).
// Idempotent (IF NOT EXISTS everywhere).
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `CREATE TABLE IF NOT EXISTS "StrategicObjective" (
     id text PRIMARY KEY,
     "tenantId" text NOT NULL,
     "companyId" text NOT NULL,
     name text NOT NULL,
     description text,
     weight double precision NOT NULL DEFAULT 1,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "StrategicObjective_companyId_idx" ON "StrategicObjective"("companyId")`,
  `CREATE TABLE IF NOT EXISTS "InitiativeObjective" (
     id text PRIMARY KEY,
     "initiativeId" text NOT NULL REFERENCES "PortfolioInitiative"(id) ON DELETE CASCADE,
     "objectiveId" text NOT NULL REFERENCES "StrategicObjective"(id) ON DELETE CASCADE,
     impact integer NOT NULL DEFAULT 3,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "InitiativeObjective_initiativeId_objectiveId_key" ON "InitiativeObjective"("initiativeId","objectiveId")`,
  `CREATE TABLE IF NOT EXISTS "InitiativeResource" (
     id text PRIMARY KEY,
     "initiativeId" text NOT NULL REFERENCES "PortfolioInitiative"(id) ON DELETE CASCADE,
     "roleName" text,
     name text NOT NULL,
     "allocationPct" integer NOT NULL DEFAULT 50,
     "startDate" timestamp(3) NOT NULL,
     "endDate" timestamp(3) NOT NULL,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "InitiativeResource_initiativeId_idx" ON "InitiativeResource"("initiativeId")`,
  `CREATE TABLE IF NOT EXISTS "WorkplanActivity" (
     id text PRIMARY KEY,
     "initiativeId" text NOT NULL REFERENCES "PortfolioInitiative"(id) ON DELETE CASCADE,
     name text NOT NULL,
     "startDate" timestamp(3) NOT NULL,
     "endDate" timestamp(3) NOT NULL,
     status text NOT NULL DEFAULT 'PLANNED',
     "dependsOnId" text REFERENCES "WorkplanActivity"(id) ON DELETE SET NULL,
     "sortOrder" integer NOT NULL DEFAULT 0,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "WorkplanActivity_initiativeId_idx" ON "WorkplanActivity"("initiativeId")`,
  `ALTER TABLE "PortfolioInitiative" ADD COLUMN IF NOT EXISTS "complexityScore" double precision NOT NULL DEFAULT 5`,
  `ALTER TABLE "PortfolioInitiative" ADD COLUMN IF NOT EXISTS "valueScore" double precision NOT NULL DEFAULT 0`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql.trim().slice(0, 72).replace(/\s+/g, ' '), '…');
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
