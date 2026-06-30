// Federal securities regulations seeder — additive. Inserts the 3
// FEDERAL_SECURITIES Jurisdictions (FINRA / SEC / MSRB) and their 8
// RegulatoryRequirements (extracted from the `develop` Neon branch into
// backend/data/seed/standards-federal-from-develop.json), then wires each
// requirement to value-stream ProcessNodes via NodeRegulation by mapping its
// category onto current VS node names (resolveSpineRefs; unmatched → no link,
// logged). Runs alongside the existing state-insurance seedRegulations, which
// owns the 51 state jurisdictions — this only ADDS the federal regime.
//
// Idempotent: deletes the company's FEDERAL_SECURITIES jurisdictions (cascading
// their requirements + NodeRegulation links) and rebuilds.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { resolveSpineRefs, type SpineRefs } from './resolveSpineRefs.js';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/standards-federal-from-develop.json');

// Federal-regulation category → the value streams the obligation plausibly
// governs. SECURITIES_DISTRIBUTION = the registered-product distribution gate,
// so it touches distribution and compliance. Names resolve via refs.nodeByName.
const CATEGORY_VS: Record<string, { name: string; relationship: string }[]> = {
  SECURITIES_DISTRIBUTION: [
    { name: 'Sales, Distribution & Marketing', relationship: 'GOVERNS' },
    { name: 'Risk, Compliance & Audit', relationship: 'GOVERNS' },
  ],
};

type Jur = {
  code: string; name: string; regulatorName: string; regulatorWebsite: string | null;
  regulatorType: string; filingPortal: string | null; filingPortalDetail: string | null;
  compactStatus: string | null; statutoryAuthority: string | null; summaryRegulator: string | null;
  summaryStatutes: string | null; summaryIntegration: string | null; executiveSummary: string | null;
  operatingModel: string | null; signalsJson: unknown; priorityTier: string | null; profileDepth: string | null;
};
type Req = {
  jurisdictionCode: string; category: string; title: string; requirement: string;
  lineOfBusiness: string | null; citation: string | null; citationUrl: string | null;
  obligationType: string | null; frequency: string | null; status: string | null;
  confidence: string | null; sourceNote: string | null;
};

export async function seedFederalRegs(
  prisma: PrismaClient,
  ids: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { tenantId, companyId } = ids;
  const refs = ids.refs ?? (await resolveSpineRefs(prisma, companyId));
  const data = JSON.parse(readFileSync(DATA, 'utf8')) as { jurisdictions: Jur[]; requirements: Req[] };

  // Wipe only the federal regime (cascades requirements + NodeRegulation links).
  await prisma.jurisdiction.deleteMany({ where: { companyId, regulatorType: 'FEDERAL_SECURITIES' } });

  const reqsByJur = new Map<string, Req[]>();
  for (const r of data.requirements) {
    if (!reqsByJur.has(r.jurisdictionCode)) reqsByJur.set(r.jurisdictionCode, []);
    reqsByJur.get(r.jurisdictionCode)!.push(r);
  }

  let nReq = 0, nLink = 0;
  for (const j of data.jurisdictions) {
    const jur = await prisma.jurisdiction.create({
      data: {
        tenantId, companyId,
        code: j.code, name: j.name,
        regulatorName: j.regulatorName, regulatorWebsite: j.regulatorWebsite, regulatorType: j.regulatorType,
        // Federal regulators carry no state taxonomy flags — use NA/non-member.
        filingPortal: j.filingPortal ?? 'NA', filingPortalDetail: j.filingPortalDetail,
        compactStatus: j.compactStatus ?? 'NA',
        autoVerification: 'NO', workersCompModel: 'STATE_SPECIFIC', apcd: 'NO', sbs: 'NO',
        statutoryAuthority: j.statutoryAuthority,
        summaryRegulator: j.summaryRegulator, summaryStatutes: j.summaryStatutes, summaryIntegration: j.summaryIntegration,
        executiveSummary: j.executiveSummary, operatingModel: j.operatingModel,
        signalsJson: (j.signalsJson ?? undefined) as never,
        priorityTier: j.priorityTier ?? 'STANDARD', profileDepth: j.profileDepth ?? 'NARRATIVE',
      },
      select: { id: true },
    });

    for (const r of reqsByJur.get(j.code) ?? []) {
      const req = await prisma.regulatoryRequirement.create({
        data: {
          tenantId, companyId, jurisdictionId: jur.id,
          category: r.category, title: r.title, requirement: r.requirement,
          lineOfBusiness: r.lineOfBusiness ?? 'ALL', citation: r.citation, citationUrl: r.citationUrl,
          obligationType: r.obligationType ?? 'ONGOING', frequency: r.frequency,
          status: r.status ?? 'ACTIVE', confidence: r.confidence ?? 'VERIFIED', sourceNote: r.sourceNote,
        },
        select: { id: true },
      });
      nReq++;
      const linked = new Set<string>();
      for (const cand of CATEGORY_VS[r.category] ?? []) {
        const nodeId = refs.nodeByName(cand.name);
        if (!nodeId || linked.has(nodeId)) continue;
        linked.add(nodeId);
        await prisma.nodeRegulation.create({
          data: { companyId, processNodeId: nodeId, regId: req.id, relationship: cand.relationship, notes: 'federal securities — auto-suggested at seed' },
        });
        nLink++;
      }
    }
  }

  console.log(`Federal regs: ${data.jurisdictions.length} jurisdictions, ${nReq} requirements (${nLink} VS links)`);
  return { jurisdictions: data.jurisdictions.length, requirements: nReq, vsLinks: nLink };
}

// Standalone entry point.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
    if (!company) throw new Error('No company found — run the main seed first.');
    console.log(`Seeding federal regs for ${company.name}…`);
    await seedFederalRegs(prisma, { tenantId: company.tenantId, companyId: company.id });
  } finally {
    await prisma.$disconnect();
  }
}
