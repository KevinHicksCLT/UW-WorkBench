import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// FB-59 — CCPA/CPRA, GDPR and NYDFS 500 belong under Regulations, not Standards.
// Moves (not copies) the three Data-Privacy/Cyber regimes out of the
// "Information Security" Standards area and into the regulatory model:
//   • Data Privacy (CCPA/CPRA)            → California (CA)   · category DATA_PRIVACY
//   • Data Privacy (GDPR)                 → European Union (EU, new)  · DATA_PRIVACY
//   • NYDFS 23 NYCRR 500 (Cybersecurity)  → New York (NY)     · category CYBERSECURITY
//
// Each privacy Standard becomes a RegulatoryRequirement under its real legal
// jurisdiction; its value-stream links (NodeStandard) are re-pointed as
// NodeRegulation links so no association is lost; its SDLC agent skill rides
// along on RegulatoryRequirement.agentSkill so the regulation surfaces the same
// downloadable skill. The source Standard rows are then deleted — single source
// of truth, zero duplicated data. Idempotent: re-running after migration is a
// no-op (the source standards are gone and the requirements already exist).

const REGIMES = [
  { category: 'Data Privacy (CCPA/CPRA)', jurCode: 'CA', regCategory: 'DATA_PRIVACY', skill: 'ccpa-cpra-sdlc-compliance', regime: 'CCPA/CPRA' },
  { category: 'Data Privacy (GDPR)', jurCode: 'EU', regCategory: 'DATA_PRIVACY', skill: 'gdpr-sdlc-compliance', regime: 'GDPR' },
  { category: 'NYDFS 23 NYCRR 500 (Cybersecurity)', jurCode: 'NY', regCategory: 'CYBERSECURITY', skill: 'nydfs-500-sdlc-compliance', regime: 'NYDFS 500' },
] as const;

const SOURCE_NOTE = 'migrated from Standards (FB-59)';

async function ensureEuJurisdiction(tenantId: string, companyId: string) {
  const existing = await prisma.jurisdiction.findFirst({ where: { companyId, code: 'EU' } });
  if (existing) return existing;
  return prisma.jurisdiction.create({
    data: {
      tenantId, companyId,
      code: 'EU', name: 'European Union',
      regulatorName: 'European Data Protection Board (EDPB) & national supervisory authorities',
      regulatorWebsite: 'https://www.edpb.europa.eu',
      regulatorType: 'INTERNATIONAL', // not a US state — surfaces in the International lens
      // Flag columns are NOT NULL but never rendered for non-state regulators.
      filingPortal: 'PROPRIETARY', compactStatus: 'NON_MEMBER', autoVerification: 'NO',
      workersCompModel: 'STATE_SPECIFIC', apcd: 'NO', sbs: 'NO',
      summaryRegulator: 'EU General Data Protection Regulation (Regulation (EU) 2016/679). Enforced by national supervisory authorities, coordinated by the European Data Protection Board.',
      priorityTier: 'PRIORITY', profileDepth: 'FULL_PROFILE',
    },
  });
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name} (${companyId})`);

  // Source standards still present?
  const sources = await prisma.standard.findMany({
    where: { companyId, isArea: false, category: { in: REGIMES.map((r) => r.category) } },
    include: { nodeStandards: { select: { processNodeId: true } } },
  });
  if (sources.length === 0) {
    const already = await prisma.regulatoryRequirement.count({ where: { companyId, sourceNote: SOURCE_NOTE } });
    console.log(`No source privacy standards found — already migrated (${already} requirements carry the FB-59 marker). No-op.`);
    return;
  }
  console.log(`Found ${sources.length} privacy standards to migrate.`);

  const euJur = await ensureEuJurisdiction(tenantId, companyId);
  const jurByCode = new Map<string, string>([['EU', euJur.id]]);
  for (const code of ['CA', 'NY']) {
    const j = await prisma.jurisdiction.findFirst({ where: { companyId, code }, select: { id: true } });
    if (!j) throw new Error(`Jurisdiction ${code} not found`);
    jurByCode.set(code, j.id);
  }

  let created = 0, links = 0, deleted = 0;
  for (const regime of REGIMES) {
    const rows = sources.filter((s) => s.category === regime.category);
    const jurisdictionId = jurByCode.get(regime.jurCode)!;
    for (const s of rows) {
      // Idempotent create: skip if an FB-59 requirement with the same jurisdiction+title already exists.
      const dup = await prisma.regulatoryRequirement.findFirst({
        where: { companyId, jurisdictionId, title: s.name, sourceNote: SOURCE_NOTE }, select: { id: true },
      });
      const req = dup
        ? { id: dup.id }
        : await prisma.regulatoryRequirement.create({
            data: {
              tenantId, companyId, jurisdictionId,
              category: regime.regCategory,
              title: s.name,
              requirement: s.description ?? s.name,
              lineOfBusiness: 'ALL',
              citation: s.regCitation ?? null,
              obligationType: 'ONGOING',
              status: 'ACTIVE',
              confidence: 'BASELINE',
              agentSkill: regime.skill,
              sourceNote: SOURCE_NOTE,
            },
            select: { id: true },
          });
      if (!dup) created++;

      // Re-point value-stream links: NodeStandard → NodeRegulation (deduped).
      for (const ns of s.nodeStandards) {
        const existing = await prisma.nodeRegulation.findFirst({ where: { regId: req.id, processNodeId: ns.processNodeId }, select: { id: true } });
        if (existing) continue;
        await prisma.nodeRegulation.create({ data: { companyId, regId: req.id, processNodeId: ns.processNodeId, relationship: 'GOVERNS' } });
        links++;
      }
    }
  }

  // Delete the source standards (cascades NodeStandard / RoleStandard / StandardDeliverable).
  const del = await prisma.standard.deleteMany({ where: { id: { in: sources.map((s) => s.id) } } });
  deleted = del.count;

  console.log(`Created ${created} requirements, ${links} value-stream links; deleted ${deleted} source standards.`);
  console.log('FB-59 migration complete.');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
