// Regulations baseline seeder — loads backend/seed/regulations-baseline.json
// (produced by scripts/extract-regulations-baseline.ts from the checked-in
// 50-state source doc) for one company.
//
// Idempotent: no-op when jurisdictions already exist for the company unless
// SEED_FORCE=1, in which case the company's regulations data is wiped and
// rebuilt deterministically (FK cascades clear the per-jurisdiction children).
// Runnable standalone (`npx tsx src/seed/seedRegulations.ts`) and from the
// main seed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';

const BASELINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../seed/regulations-baseline.json');

// Category → operating-model value streams the requirement plausibly touches.
// Names must match the company's ValueStream rows; misses are skipped silently
// (the Coverage lens in the UI surfaces unmapped requirements for curation).
// Every seeded link is annotated "auto-suggested at seed" so admins know it is
// a starting point, not an attestation.
const CATEGORY_VS: Record<string, { name: string; relationship: string }[]> = {
  PRODUCT_FILING: [
    { name: 'Product & Proposition Management', relationship: 'GOVERNS' },
    { name: 'Risk, Compliance & Regulatory Management', relationship: 'GOVERNS' },
  ],
  LICENSING: [
    { name: 'Distribution & Channel Management', relationship: 'GOVERNS' },
    { name: 'Risk, Compliance & Regulatory Management', relationship: 'INFORMS' },
  ],
  PREMIUM_TAX: [{ name: 'Finance, Treasury & Capital Management', relationship: 'GOVERNS' }],
  SURPLUS_LINES: [
    { name: 'Submission-to-Bind / Underwriting', relationship: 'GOVERNS' },
    { name: 'Finance, Treasury & Capital Management', relationship: 'REQUIRES_INTEGRATION' },
  ],
  WORKERS_COMP_REPORTING: [{ name: 'Claims Intake-to-Settlement', relationship: 'REQUIRES_INTEGRATION' }],
  AUTO_VERIFICATION: [{ name: 'Policy Administration & Servicing', relationship: 'REQUIRES_INTEGRATION' }],
  APCD_REPORTING: [
    { name: 'Claims Intake-to-Settlement', relationship: 'REQUIRES_INTEGRATION' },
    { name: 'Data, Analytics & AI Management', relationship: 'REQUIRES_INTEGRATION' },
  ],
  FINANCIAL_REPORTING: [{ name: 'Finance, Treasury & Capital Management', relationship: 'GOVERNS' }],
  MARKET_CONDUCT: [{ name: 'Risk, Compliance & Regulatory Management', relationship: 'GOVERNS' }],
  DATA_CALL: [{ name: 'Data, Analytics & AI Management', relationship: 'REQUIRES_INTEGRATION' }],
  CYBERSECURITY: [{ name: 'Cybersecurity, Identity & Resilience', relationship: 'GOVERNS' }],
};

export async function seedRegulations(prisma: PrismaClient, ids: { tenantId: string; companyId: string }) {
  const { tenantId, companyId } = ids;
  const existing = await prisma.jurisdiction.count({ where: { companyId } });
  if (existing > 0 && process.env.SEED_FORCE !== '1') {
    console.log(`Regulations: ${existing} jurisdictions exist — skipping (SEED_FORCE=1 to rebuild)`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

  // Wipe (cascades clear requirements/bulletins/rules/per-state sources/integrations).
  await prisma.jurisdiction.deleteMany({ where: { companyId } });
  await prisma.regulatorySource.deleteMany({ where: { companyId } });
  await prisma.integrationSystem.deleteMany({ where: { companyId } });

  // Shared system catalog.
  const systemIdByName = new Map<string, string>();
  for (const s of baseline.integrationSystems) {
    const row = await prisma.integrationSystem.create({
      data: { tenantId, companyId, name: s.name, kind: s.kind, operator: s.operator, website: s.website, description: s.description, apiAvailability: s.apiAvailability },
    });
    systemIdByName.set(s.name, row.id);
  }

  // Value streams for the auto-suggested requirement links.
  const valueStreams = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
  const vsIdByName = new Map(valueStreams.map((v) => [v.name, v.id]));

  let nReq = 0, nLink = 0, nInt = 0, nBul = 0, nRule = 0, nSrc = 0;
  for (const j of baseline.jurisdictions) {
    const jur = await prisma.jurisdiction.create({
      data: {
        tenantId, companyId,
        code: j.code, name: j.name,
        regulatorName: j.regulatorName, regulatorWebsite: j.regulatorWebsite, regulatorType: j.regulatorType,
        filingPortal: j.filingPortal, filingPortalDetail: j.filingPortalDetail,
        compactStatus: j.compactStatus,
        autoVerification: j.autoVerification, autoVerificationDetail: j.autoVerificationDetail,
        workersCompModel: j.workersCompModel, workersCompDetail: j.workersCompDetail,
        apcd: j.apcd, sbs: j.sbs,
        statutoryAuthority: j.statutoryAuthority,
        summaryRegulator: j.summaryRegulator, summaryStatutes: j.summaryStatutes, summaryIntegration: j.summaryIntegration,
        executiveSummary: j.executiveSummary, operatingModel: j.operatingModel,
        signalsJson: j.signalsJson ?? undefined,
        priorityTier: j.priorityTier, profileDepth: j.profileDepth,
      },
    });

    for (const r of j.requirements) {
      const req = await prisma.regulatoryRequirement.create({
        data: {
          tenantId, companyId, jurisdictionId: jur.id,
          category: r.category, title: r.title, requirement: r.requirement,
          lineOfBusiness: r.lineOfBusiness, citation: r.citation, citationUrl: r.citationUrl,
          obligationType: r.obligationType, frequency: r.frequency,
          confidence: r.confidence, sourceNote: r.sourceNote,
        },
      });
      nReq++;
      for (const cand of CATEGORY_VS[r.category] ?? []) {
        const vsId = vsIdByName.get(cand.name);
        if (!vsId) continue;
        await prisma.requirementValueStream.create({
          data: { requirementId: req.id, valueStreamId: vsId, relationship: cand.relationship, notes: 'auto-suggested at seed' },
        });
        nLink++;
      }
    }

    for (const i of j.integrations) {
      const systemId = systemIdByName.get(i.system);
      if (!systemId) continue;
      await prisma.jurisdictionIntegration.create({
        data: { jurisdictionId: jur.id, systemId, usage: i.usage, scope: i.scope, notes: i.notes },
      });
      nInt++;
    }

    for (const b of j.bulletins) {
      await prisma.regulatoryBulletin.create({
        data: { tenantId, companyId, jurisdictionId: jur.id, reference: b.reference, title: b.title, summary: b.summary, url: b.url, discoveredVia: 'BASELINE' },
      });
      nBul++;
    }

    for (const r of j.rules) {
      await prisma.complianceRule.create({
        data: { tenantId, companyId, jurisdictionId: jur.id, ruleCode: r.ruleCode, category: r.category, description: r.description, ruleJson: r.ruleJson, origin: r.origin },
      });
      nRule++;
    }

    for (const s of j.sources) {
      await prisma.regulatorySource.create({
        data: { tenantId, companyId, jurisdictionId: jur.id, name: s.name, url: s.url, sourceType: s.sourceType, authority: s.authority, monitor: s.monitor, checkTier: s.checkTier },
      });
      nSrc++;
    }
  }

  for (const s of baseline.nationalSources) {
    await prisma.regulatorySource.create({
      data: { tenantId, companyId, jurisdictionId: null, name: s.name, url: s.url, sourceType: s.sourceType, authority: s.authority, monitor: s.monitor, checkTier: s.checkTier },
    });
    nSrc++;
  }

  console.log(`Regulations: ${baseline.jurisdictions.length} jurisdictions, ${nReq} requirements (${nLink} VS links), ${nInt} integrations, ${nBul} bulletins, ${nRule} rules, ${nSrc} sources`);
}

// Standalone entry point: seed the (single) demo company.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
    if (!company) throw new Error('No company found — run the main seed first.');
    console.log(`Seeding regulations for ${company.name}…`);
    await seedRegulations(prisma, { tenantId: company.tenantId, companyId: company.id });
  } finally {
    await prisma.$disconnect();
  }
}
