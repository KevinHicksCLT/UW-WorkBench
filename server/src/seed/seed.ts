// Demo seed: provisions "Meridian Mutual Demo" via the same self-service path
// a real signup uses (starter pack included), then adds a small live pipeline —
// an IN-appetite risk, an EDGE risk carrying a pending agent proposal, and a
// watchlist hold awaiting dual-control release — so the workbench demos every
// invariant out of the box. Idempotent: re-running resets the demo tenant.
//
// Demo login: demo@uw-workbench.dev / underwrite!
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { provisionCompany } from '../services/provisioning.js';
import { loadBundledPacks } from '../lib/packStore.js';
import { computeTriageScore } from '../lib/uw/engine.js';

const prisma = new PrismaClient();
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v) ?? 'null').digest('hex');

async function main() {
  const existing = await prisma.tenant.findFirst({ where: { slug: { startsWith: 'meridian-mutual-demo' } } });
  if (existing) await prisma.tenant.delete({ where: { id: existing.id } });

  const packs = await loadBundledPacks();
  const starter = packs.find((p) => p.slug === 'commercial-property-starter');
  const result = await provisionCompany(prisma, {
    companyName: 'Meridian Mutual Demo',
    adminEmail: 'demo@uw-workbench.dev',
    adminName: 'Demo Underwriter',
    password: 'underwrite!',
    starterPack: starter,
  });
  const { tenantId, companyId } = result;
  const uwRole = result.roles.underwriter;
  const valueStream = await prisma.processNode.findFirst({ where: { companyId }, select: { id: true } });

  const mkAccount = (name: string, naics: string, domicile: string) =>
    prisma.uwAccount.create({ data: { tenantId, companyId, name, identifiers: { naics }, domicile } });
  const harbor = await mkAccount('Harbor Freight Logistics', '4931', 'SC');
  const bluegrass = await mkAccount('Bluegrass Cold Storage', '4931', 'NC');
  const ridgeline = await mkAccount('Ridgeline Crane Co', '2389', 'GA');

  const now = Date.now();
  const h = 3_600_000;
  const sub = (args: { ref: string; accountId: string; lob: string; broker?: string; status: string; verdict?: string; citations?: object[]; tiv?: number; sla: number; desc: string; fields?: object[]; risks?: { name: string; situs?: string; tiv?: number; exposureData?: object }[] }) =>
    prisma.uwSubmission.create({
      data: {
        tenantId, companyId, ref: args.ref, accountId: args.accountId, channel: 'PORTAL', lob: args.lob,
        brokerName: args.broker, status: args.status, slaDueAt: new Date(now + args.sla * h),
        effectiveDate: new Date(now + 60 * 24 * h), tivTotal: args.tiv, description: args.desc,
        appetiteVerdict: args.verdict ?? null, appetiteCitations: args.citations, extractedFields: args.fields,
        assignedRoleId: uwRole, valueStreamNodeId: valueStream?.id,
        riskObjects: { create: (args.risks ?? []).map((r) => ({ tenantId, companyId, kind: 'LOCATION', name: r.name, situs: r.situs, tiv: r.tiv, exposureData: r.exposureData })) },
      },
    });

  const s1 = await sub({
    ref: 'SUB-00001', accountId: harbor.id, lob: 'CP', broker: 'Marsh', status: 'IN_REVIEW', verdict: 'IN',
    citations: [{ ref: 'AS-114', version: 1, stance: 'TARGET' }], tiv: 32_000_000, sla: 6,
    desc: 'Commercial property — 3 distribution warehouses, Southeast.',
    fields: [{ field: 'Sprinkler class', value: 'ESFR', confidence: 0.97, provenance: { docId: 'sov.xlsx', page: 1, extractorVersion: 'ext-1.0' } }],
    risks: [{ name: 'Charleston DC', situs: 'Charleston, SC', tiv: 14_000_000, exposureData: { sprinklerClass: 'ESFR' } }],
  });
  const s2 = await sub({
    ref: 'SUB-00002', accountId: bluegrass.id, lob: 'CP', broker: 'Aon', status: 'IN_REVIEW', verdict: 'EDGE',
    citations: [{ ref: 'AS-114', version: 1, stance: 'TARGET' }, { ref: 'AS-201', version: 1, stance: 'REFER' }],
    tiv: 48_000_000, sla: 3,
    desc: 'Cold storage — 4 locations, ammonia refrigeration, flood-exposed annex.',
    fields: [
      { field: 'Ammonia refrigeration', value: 'Present', confidence: 0.99, provenance: { docId: 'sov.xlsx', page: 1, extractorVersion: 'ext-1.0' } },
      { field: 'Flood zone (Loc 3)', value: 'AE', confidence: 0.92, provenance: { docId: 'flood.json', extractorVersion: 'ext-1.0' } },
      { field: 'Roof age (Loc 4)', value: 'unknown', confidence: 0.41, provenance: { docId: 'acord-140.pdf', page: 3, extractorVersion: 'ext-1.0' } },
    ],
    risks: [{ name: 'Riverside annex', situs: 'Wilmington, NC', tiv: 9_000_000, exposureData: { floodZone: 'AE' } }],
  });
  const s3 = await sub({
    ref: 'SUB-00003', accountId: ridgeline.id, lob: 'GL', status: 'IN_CLEARANCE', tiv: 12_000_000, sla: 18,
    desc: 'GL / Excess — crane operations; direct submission.',
  });

  await prisma.uwClearanceCheck.createMany({
    data: [
      { tenantId, companyId, submissionId: s1.id, checkType: 'WATCHLIST', verdict: 'CLEAR' },
      { tenantId, companyId, submissionId: s2.id, checkType: 'WATCHLIST', verdict: 'CLEAR' },
      { tenantId, companyId, submissionId: s3.id, checkType: 'WATCHLIST', verdict: 'HIT', matchEvidence: { matchScore: 0.91, list: 'OFAC SDN — partial name match, pending dual-control release' } },
    ],
  });

  for (const [s, brokerKnown, gaps] of [[s1, true, 0], [s2, true, 1], [s3, false, 2]] as const) {
    const score = computeTriageScore({ appetiteVerdict: (s.appetiteVerdict as 'IN' | 'EDGE' | 'OUT' | null) ?? 'NO_STATEMENT', brokerKnown, tivTotal: s.tivTotal, extractionGaps: gaps, enrichmentCount: 1 });
    await prisma.uwTriageScore.create({ data: { tenantId, companyId, submissionId: s.id, ...score, rationale: score.rationale } });
  }

  const proposal = {
    summary: 'Quote with $250k flood sublimit at the Riverside annex; cite GR-2201. Indicative premium $412k.',
    premium: 412_000,
    sublimits: [{ peril: 'Flood — Riverside annex', amount: 250_000 }],
  };
  const event = await prisma.uwGovernanceEvent.create({
    data: { tenantId, companyId, eventType: 'ProposalIssued', actorKind: 'AGENT', actorId: 'underwriting-agent-01', payloadHash: hash(proposal), payload: proposal, correlationId: s2.id, submissionId: s2.id },
  });
  await prisma.uwAgentAction.create({
    data: { tenantId, companyId, agentId: 'underwriting-agent-01', kind: 'PROPOSAL', modelRef: 'claude-fable-5', promptHash: hash({ submission: s2.ref }), confidence: 0.84, proposal, disposition: 'PENDING', submissionId: s2.id, governanceEventId: event.id },
  });
  for (const s of [s1, s2, s3]) {
    await prisma.uwGovernanceEvent.create({
      data: { tenantId, companyId, eventType: 'SubmissionCreated', actorKind: 'SYSTEM', actorId: 'intake-service', payloadHash: hash({ ref: s.ref }), payload: { ref: s.ref }, correlationId: s.id, submissionId: s.id },
    });
  }

  console.log('Seeded demo tenant. Login: demo@uw-workbench.dev / underwrite!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
