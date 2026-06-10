// Risk-scoring bands (defect: "initiative risk values look way too high").
// RAID severity is the standard ISO 31000 / COSO-style 5×5 matrix —
// probability (1–5) × impact (1–5) = 1–25. The UI shows only the RATING the
// score falls in (the raw number stays in the tooltip). Bands are data: stored
// per company and editable in Data Admin → Initiatives → Risk scoring bands.
// Three-tier banding seeded: Low 1–8 · Medium 9–16 · High 17–25.
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
  { label: 'Low', minScore: 1, maxScore: 8, color: '#047857', description: 'Accept or monitor — routine controls suffice.', sortOrder: 0 },
  { label: 'Medium', minScore: 9, maxScore: 16, color: '#b45309', description: 'Management attention — mitigation planned and tracked.', sortOrder: 1 },
  { label: 'High', minScore: 17, maxScore: 25, color: '#be123c', description: 'Senior ownership — immediate mitigation and escalation.', sortOrder: 2 },
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
