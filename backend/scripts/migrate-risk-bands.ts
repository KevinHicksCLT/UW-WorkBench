// Risk-scoring bands (defect: "initiative risk values look way too high").
// RAID severity is the standard ISO 31000 / COSO-style 5×5 matrix —
// probability (1–5) × impact (1–5) = 1–25. What was missing is the BANDING
// that makes the number readable. Bands are data: stored per company and
// editable in Data Admin → Initiatives → Risk scoring bands. Classic 5×5
// banding seeded: Low 1–4 · Moderate 5–9 · High 10–16 · Critical 17–25.
// Additive raw SQL (live DB has drift; prisma db push is forbidden). Idempotent.
import { prisma } from '../src/db/prisma.js';

const DDL = [
  `CREATE TABLE IF NOT EXISTS "RiskScoringBand" (
     id text PRIMARY KEY,
     "tenantId" text NOT NULL,
     "companyId" text NOT NULL,
     label text NOT NULL,
     "minScore" integer NOT NULL,
     "maxScore" integer NOT NULL,
     color text NOT NULL,
     description text,
     "sortOrder" integer NOT NULL DEFAULT 0,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "RiskScoringBand_companyId_idx" ON "RiskScoringBand"("companyId")`,
];

const BANDS = [
  { label: 'Low', minScore: 1, maxScore: 4, color: '#047857', description: 'Accept or monitor — routine controls suffice.', sortOrder: 0 },
  { label: 'Moderate', minScore: 5, maxScore: 9, color: '#b45309', description: 'Management attention — mitigation planned and tracked.', sortOrder: 1 },
  { label: 'High', minScore: 10, maxScore: 16, color: '#ea580c', description: 'Senior ownership — active mitigation before proceeding.', sortOrder: 2 },
  { label: 'Critical', minScore: 17, maxScore: 25, color: '#be123c', description: 'Executive escalation — immediate action required.', sortOrder: 3 },
];

async function main() {
  for (const sql of DDL) await prisma.$executeRawUnsafe(sql);
  for (const company of await prisma.company.findMany({ select: { id: true, tenantId: true, name: true } })) {
    const existing = await prisma.riskScoringBand.count({ where: { companyId: company.id } });
    if (existing > 0) { console.log(`${company.name}: ${existing} bands already present — skipped`); continue; }
    await prisma.riskScoringBand.createMany({
      data: BANDS.map((b) => ({ ...b, tenantId: company.tenantId, companyId: company.id })),
    });
    console.log(`${company.name}: seeded ${BANDS.length} bands (5×5 P×I, ISO 31000-style)`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
