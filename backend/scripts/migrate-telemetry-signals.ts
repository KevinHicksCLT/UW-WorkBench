// Additive DDL (2026-06-10): TelemetrySignal — the trackable-signal catalog the
// Telemetry "Trackable Metrics" tab renders, moved out of route constants +
// backend/data/telemetry-catalog.json into the DB so it is admin-editable.
// Raw SQL because the live DB carries drift `prisma db push` would destroy
// (see memory/CLAUDE.md). Idempotent (IF NOT EXISTS everywhere).
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `CREATE TABLE IF NOT EXISTS "TelemetrySignal" (
     id text PRIMARY KEY,
     "tenantId" text NOT NULL,
     "companyId" text NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
     kind text NOT NULL,
     name text NOT NULL,
     description text,
     source text,
     category text,
     unit text,
     frequency text,
     direction text NOT NULL DEFAULT 'up',
     origin text,
     "queryType" text,
     "isLive" boolean NOT NULL DEFAULT false,
     "sortOrder" integer NOT NULL DEFAULT 0,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "TelemetrySignal_companyId_idx" ON "TelemetrySignal"("companyId")`,
];

async function main() {
  for (const sql of DDL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('ok:', sql.trim().slice(0, 72).replace(/\s+/g, ' '), '…');
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
