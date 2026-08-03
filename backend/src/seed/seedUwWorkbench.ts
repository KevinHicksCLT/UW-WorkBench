// UW Workbench demo estate (UW-WORK): appetite statements, guideline rules,
// authority grants (bound to seeded Roles-catalog roles, ADR-03), enrichment
// sources, and four pipeline submissions mirroring the UW-WORK-06 wireframe
// scenarios — including a watchlist hold awaiting dual-control release, an
// EDGE-appetite risk carrying an undispositioned agent proposal, and the
// cross-estate divergence pairs. Idempotent: delete-then-recreate by company.
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { computeTriageScore } from '../lib/uw/engine.js';

const hash = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(v) ?? 'null')
    .digest('hex');

type Ctx = { tenantId: string; companyId: string };

async function pickRole(
  prisma: PrismaClient,
  companyId: string,
  needles: string[],
  fallbackFirst = true,
) {
  for (const n of needles) {
    const role = await prisma.role.findFirst({
      where: { companyId, displayValue: { contains: n, mode: 'insensitive' } },
      select: { id: true, displayValue: true },
    });
    if (role) return role;
  }
  if (!fallbackFirst) return null;
  return prisma.role.findFirst({ where: { companyId }, select: { id: true, displayValue: true } });
}

export async function seedUwWorkbench(prisma: PrismaClient, ctx: Ctx) {
  const { tenantId, companyId } = ctx;

  // Idempotency: clear the UW domain for this company (children cascade).
  await prisma.uwDivergencePair.deleteMany({ where: { companyId } });
  await prisma.uwGovernanceEvent.deleteMany({ where: { companyId } });
  await prisma.uwSubmission.deleteMany({ where: { companyId } });
  await prisma.uwAccount.deleteMany({ where: { companyId } });
  await prisma.uwAuthorityGrant.deleteMany({ where: { companyId } });
  await prisma.uwGuidelineRule.deleteMany({ where: { companyId } });
  await prisma.uwAppetiteStatement.deleteMany({ where: { companyId } });
  await prisma.uwEnrichmentSource.deleteMany({ where: { companyId } });

  const uwRole = await pickRole(prisma, companyId, ['Underwriter', 'Underwriting']);
  const cuoRole = await pickRole(prisma, companyId, ['Chief Underwriting', 'CUO', 'Chief Risk']);
  const propertyOrg = await prisma.orgUnit.findFirst({
    where: { companyId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  const pasApp = await prisma.application.findFirst({
    where: {
      companyId,
      OR: [{ name: { contains: 'Policy', mode: 'insensitive' } }, { kind: 'SystemOfRecord' }],
    },
    select: { id: true, name: true },
  });
  const valueStream = await prisma.processNode.findFirst({
    where: { companyId, displayValue: { contains: 'Underwrit', mode: 'insensitive' } },
    select: { id: true },
  });
  if (!uwRole) return; // org spine not seeded — nothing to bind authority to

  // ── Enrichment source registry (CAP-05) ─────────────────────────────────
  await prisma.uwEnrichmentSource.createMany({
    data: [
      {
        tenantId,
        companyId,
        name: 'HazardHub Property Risk',
        kind: 'HAZARD',
        costClass: 'MEDIUM',
        ttlHours: 720,
        jurisdictions: null,
      },
      {
        tenantId,
        companyId,
        name: 'D&B Firmographics',
        kind: 'FIRMOGRAPHIC',
        costClass: 'LOW',
        ttlHours: 2160,
        jurisdictions: null,
      },
      {
        tenantId,
        companyId,
        name: 'FEMA Flood Zone Lookup',
        kind: 'CAT_MODEL',
        costClass: 'FREE',
        ttlHours: 8760,
        jurisdictions: 'SC,NC,GA,FL,TX',
      },
      {
        tenantId,
        companyId,
        name: 'OFAC/SDN Screening',
        kind: 'SANCTIONS',
        costClass: 'LOW',
        ttlHours: 24,
        jurisdictions: null,
      },
    ],
  });

  // ── Appetite statements (CAP-03) — AS-114 / AS-201 / AS-090 ────────────
  await prisma.uwAppetiteStatement.createMany({
    data: [
      {
        tenantId,
        companyId,
        ref: 'AS-114',
        version: 9,
        stance: 'TARGET',
        lob: 'CP',
        segment: 'Warehousing & Storage',
        naicsCodes: '4931',
        geographies: 'SC,NC,GA,FL,TN',
        tivMax: 75_000_000,
        capacityLimit: 250_000_000,
        effectiveFrom: new Date('2026-07-01'),
        rationale:
          'Target class: Southeast warehousing with sprinklered construction; strong loss experience 2019-2025.',
        status: 'ACTIVE',
        ownerOrgUnitId: propertyOrg?.id,
        publishedBy: 'kevin.hicks@capgemini.com',
      },
      {
        tenantId,
        companyId,
        ref: 'AS-201',
        version: 3,
        stance: 'REFER',
        lob: 'EB',
        segment: 'Ammonia refrigeration',
        naicsCodes: '4931',
        geographies: 'SC,NC,GA,FL',
        tivMax: 50_000_000,
        effectiveFrom: new Date('2026-05-15'),
        rationale:
          'Equipment breakdown with ammonia refrigeration systems refers to Specialty for engineering review.',
        status: 'ACTIVE',
        ownerOrgUnitId: propertyOrg?.id,
        publishedBy: 'kevin.hicks@capgemini.com',
      },
      {
        tenantId,
        companyId,
        ref: 'AS-090',
        version: 5,
        stance: 'DECLINE',
        lob: 'BOP',
        segment: 'Florists — coastal FL',
        naicsCodes: '4531',
        geographies: 'FL',
        effectiveFrom: new Date('2026-01-01'),
        rationale:
          'Coastal FL BOP retail declined: cat aggregation exceeds appetite; reinsurance treaty exclusion.',
        status: 'ACTIVE',
        ownerOrgUnitId: propertyOrg?.id,
        publishedBy: 'kevin.hicks@capgemini.com',
      },
    ],
  });

  // ── Guideline rules (CAP-07) — GR-2201 incl. one G4-approved STP path ──
  await prisma.uwGuidelineRule.createMany({
    data: [
      {
        tenantId,
        companyId,
        ref: 'GR-2201',
        version: 7,
        name: 'CP flood sublimit floor',
        kind: 'DECISION_TABLE',
        definition: {
          rows: [
            {
              when: { floodZone: 'AE', sublimit: { op: 'lt', value: 250_000 } },
              outcome: 'REFER',
              note: 'AE flood exposure requires >= $250k sublimit or senior referral',
            },
            { when: { floodZone: 'AE' }, outcome: 'PASS', note: 'AE with adequate sublimit' },
          ],
        },
        inputsSchema: { floodZone: 'string', sublimit: 'number' },
        status: 'ACTIVE',
      },
      {
        tenantId,
        companyId,
        ref: 'GR-1104',
        version: 2,
        name: 'Small BOP clean-risk STP',
        kind: 'DECISION_TABLE',
        definition: {
          rows: [
            {
              when: { tivUnder: true, lossFree: true, appetiteIn: true },
              outcome: 'PASS',
              note: 'clean small BOP auto-quote path',
            },
          ],
        },
        stpPath: true,
        stpApprovedBy: 'kevin.hicks@capgemini.com',
        status: 'ACTIVE',
      },
    ],
  });

  // ── Authority grants (CAP-08, ADR-03) — AG-31 / AG-12 / AG-77 ─────────
  await prisma.uwAuthorityGrant.create({
    data: {
      tenantId,
      companyId,
      ref: 'AG-31',
      version: 1,
      roleId: uwRole.id,
      premiumMax: 500_000,
      tivMax: 40_000_000,
      lobs: 'CP,EB',
      territories: 'SC,NC,GA,TN',
      delegable: false,
      breachCount90d: 3,
    },
  });
  if (cuoRole && cuoRole.id !== uwRole.id) {
    await prisma.uwAuthorityGrant.create({
      data: {
        tenantId,
        companyId,
        ref: 'AG-12',
        version: 1,
        roleId: cuoRole.id,
        premiumMax: 2_000_000,
        tivMax: 150_000_000,
        lobs: 'CP,EB,GL,BOP,XS',
        territories: 'US',
        delegable: true,
        bordereauxAttached: true,
      },
    });
  }

  // ── Accounts + submissions (wireframe pipeline) ────────────────────────
  const mkAccount = (name: string, naics: string, domicile: string, blocked = false) =>
    prisma.uwAccount.create({
      data: { tenantId, companyId, name, identifiers: { naics }, domicile, blocked },
    });

  const harbor = await mkAccount('Harbor Freight Logistics', '4931', 'SC');
  const bluegrass = await mkAccount('Bluegrass Cold Storage', '4931', 'NC');
  const ridgeline = await mkAccount('Ridgeline Crane Co', '2389', 'GA');
  const petal = await mkAccount('Petal & Stem Retail', '4531', 'FL');

  const now = Date.now();
  const h = 3_600_000;

  const sub = async (args: {
    ref: string;
    account: { id: string };
    lob: string;
    broker?: string;
    status: string;
    verdict?: string | null;
    citations?: object[];
    tiv?: number;
    sla: number;
    desc: string;
    fields?: object[];
    risks?: { kind?: string; name: string; situs?: string; tiv?: number; exposureData?: object }[];
  }) =>
    prisma.uwSubmission.create({
      data: {
        tenantId,
        companyId,
        ref: args.ref,
        accountId: args.account.id,
        channel: 'PORTAL',
        lob: args.lob,
        brokerName: args.broker,
        status: args.status,
        slaDueAt: new Date(now + args.sla * h),
        effectiveDate: new Date('2026-10-01'),
        tivTotal: args.tiv,
        description: args.desc,
        appetiteVerdict: args.verdict ?? null,
        appetiteCitations: args.citations,
        extractedFields: args.fields,
        assignedRoleId: uwRole.id,
        valueStreamNodeId: valueStream?.id,
        riskObjects: {
          create: (args.risks ?? []).map((r) => ({
            tenantId,
            companyId,
            kind: r.kind ?? 'LOCATION',
            name: r.name,
            situs: r.situs,
            tiv: r.tiv,
            exposureData: r.exposureData,
          })),
        },
      },
      include: { riskObjects: true },
    });

  const s1 = await sub({
    ref: 'SUB-88121',
    account: harbor,
    lob: 'CP',
    broker: 'Marsh',
    status: 'IN_REVIEW',
    verdict: 'IN',
    citations: [{ ref: 'AS-114', version: 9, stance: 'TARGET' }],
    tiv: 32_000_000,
    sla: 6,
    desc: 'Commercial property — 3 distribution warehouses, Southeast.',
    fields: [
      {
        field: 'Sprinkler class',
        value: 'ESFR',
        confidence: 0.97,
        provenance: { docId: 'sov.xlsx', page: 1, extractorVersion: 'ext-2.4' },
      },
      {
        field: 'Year built (Loc 1)',
        value: '2014',
        confidence: 0.95,
        provenance: { docId: 'acord-140.pdf', page: 2, extractorVersion: 'ext-2.4' },
      },
    ],
    risks: [
      {
        name: 'Charleston DC',
        situs: 'Charleston, SC',
        tiv: 14_000_000,
        exposureData: { sprinklerClass: 'ESFR' },
      },
      {
        name: 'Greenville DC',
        situs: 'Greenville, SC',
        tiv: 18_000_000,
        exposureData: { sprinklerClass: 'ESFR' },
      },
    ],
  });
  const s2 = await sub({
    ref: 'SUB-88097',
    account: bluegrass,
    lob: 'CP',
    broker: 'Aon',
    status: 'IN_REVIEW',
    verdict: 'EDGE',
    citations: [
      { ref: 'AS-114', version: 9, stance: 'TARGET' },
      { ref: 'AS-201', version: 3, stance: 'REFER' },
    ],
    tiv: 48_000_000,
    sla: 3,
    desc: 'Cold storage — 4 locations, ammonia refrigeration, TIV $48M, effective 10/01/2026.',
    fields: [
      {
        field: 'Sprinkler class (Loc 2)',
        value: 'ESFR',
        confidence: 0.97,
        provenance: { docId: 'loss-run.pdf', page: 4, extractorVersion: 'ext-2.4' },
      },
      {
        field: 'Ammonia refrigeration',
        value: 'Present',
        confidence: 0.99,
        provenance: { docId: 'sov.xlsx', page: 1, extractorVersion: 'ext-2.4' },
      },
      {
        field: 'Flood zone (Loc 3)',
        value: 'AE',
        confidence: 0.92,
        provenance: { docId: 'hazardhub.json', extractorVersion: 'ext-2.4' },
      },
      {
        field: 'Roof age (Loc 4)',
        value: 'unknown',
        confidence: 0.41,
        provenance: { docId: 'acord-140.pdf', page: 3, extractorVersion: 'ext-2.4' },
      },
    ],
    risks: [
      {
        name: 'Loc 2 — Lexington cold store',
        situs: 'Lexington, NC',
        tiv: 21_000_000,
        exposureData: { sprinklerClass: 'ESFR', ammoniaRefrigeration: true },
      },
      {
        name: 'Loc 3 — Riverside annex',
        situs: 'Wilmington, NC',
        tiv: 9_000_000,
        exposureData: { floodZone: 'AE' },
      },
    ],
  });
  const s3 = await sub({
    ref: 'SUB-88090',
    account: ridgeline,
    lob: 'GL',
    status: 'IN_CLEARANCE',
    verdict: null,
    tiv: 12_000_000,
    sla: 18,
    desc: 'GL / Excess — crane operations; direct submission.',
  });
  const s4 = await sub({
    ref: 'SUB-88061',
    account: petal,
    lob: 'BOP',
    broker: 'Portal',
    status: 'IN_TRIAGE',
    verdict: 'OUT',
    citations: [{ ref: 'AS-090', version: 5, stance: 'DECLINE' }],
    tiv: 2_400_000,
    sla: 22,
    desc: 'BOP — florist retail, coastal FL. Out of appetite per AS-090.',
  });

  // ── Clearance (CAP-02) — Ridgeline carries a watchlist HIT (INV-4 demo) ─
  await prisma.uwClearanceCheck.createMany({
    data: [
      { tenantId, companyId, submissionId: s1.id, checkType: 'DUPLICATE', verdict: 'CLEAR' },
      { tenantId, companyId, submissionId: s1.id, checkType: 'WATCHLIST', verdict: 'CLEAR' },
      { tenantId, companyId, submissionId: s2.id, checkType: 'DUPLICATE', verdict: 'CLEAR' },
      { tenantId, companyId, submissionId: s2.id, checkType: 'WATCHLIST', verdict: 'CLEAR' },
      {
        tenantId,
        companyId,
        submissionId: s3.id,
        checkType: 'WATCHLIST',
        verdict: 'HIT',
        matchEvidence: { matchScore: 0.91, list: 'OFAC SDN — partial name match, pending release' },
      },
      { tenantId, companyId, submissionId: s4.id, checkType: 'DUPLICATE', verdict: 'CLEAR' },
    ],
  });

  // ── Enrichment records + triage scores (versioned) ─────────────────────
  const flood = await prisma.uwEnrichmentSource.findFirst({
    where: { companyId, kind: 'CAT_MODEL' },
  });
  if (flood && s2.riskObjects[1]) {
    const payload = { floodZone: 'AE', source: 'FEMA NFHL', asOf: '2026-07-30' };
    await prisma.uwEnrichmentRecord.create({
      data: {
        tenantId,
        companyId,
        riskObjectId: s2.riskObjects[1].id,
        sourceId: flood.id,
        payload,
        payloadHash: hash(payload),
        cost: 0,
        expiresAt: new Date(now + flood.ttlHours * h),
      },
    });
  }
  for (const [s, brokerKnown, gaps, enr] of [
    [s1, true, 0, 2],
    [s2, true, 1, 3],
    [s3, false, 2, 0],
    [s4, true, 0, 1],
  ] as const) {
    const score = computeTriageScore({
      appetiteVerdict: (s.appetiteVerdict as 'IN' | 'EDGE' | 'OUT' | null) ?? 'NO_STATEMENT',
      brokerKnown,
      tivTotal: s.tivTotal,
      extractionGaps: gaps,
      enrichmentCount: enr,
    });
    await prisma.uwTriageScore.create({
      data: { tenantId, companyId, submissionId: s.id, ...score, rationale: score.rationale },
    });
  }

  // ── Agent proposal awaiting disposition (ADR-02 demo on SUB-88097) ─────
  const proposal = {
    summary: 'Quote with $250k flood sublimit at Loc 3; cite GR-2201 v7. Indicative premium $412k.',
    premium: 412_000,
    sublimits: [{ peril: 'Flood — Loc 3', amount: 250_000 }],
    pricedBy: 'M-CP-04 (RATE-PRICING)',
    formSet: 'FS-CP-STD-26 (FORMS-RATION)',
  };
  const propEvent = await prisma.uwGovernanceEvent.create({
    data: {
      tenantId,
      companyId,
      eventType: 'ProposalIssued',
      actorKind: 'AGENT',
      actorId: 'underwriting-agent-01',
      payloadHash: hash(proposal),
      payload: proposal,
      correlationId: s2.id,
      submissionId: s2.id,
    },
  });
  await prisma.uwAgentAction.create({
    data: {
      tenantId,
      companyId,
      agentId: 'underwriting-agent-01',
      kind: 'PROPOSAL',
      modelRef: 'claude-fable-5',
      promptHash: hash({ submission: s2.ref }),
      confidence: 0.84,
      proposal,
      disposition: 'PENDING',
      submissionId: s2.id,
      governanceEventId: propEvent.id,
    },
  });

  // ── Governance narrative for the pipeline (append-only spine) ──────────
  for (const s of [s1, s2, s3, s4]) {
    await prisma.uwGovernanceEvent.create({
      data: {
        tenantId,
        companyId,
        eventType: 'SubmissionCreated',
        actorKind: 'SYSTEM',
        actorId: 'intake-service',
        payloadHash: hash({ ref: s.ref }),
        payload: { ref: s.ref, channel: 'PORTAL' },
        correlationId: s.id,
        submissionId: s.id,
      },
    });
  }

  // ── Divergence pairs (CAP-14) — DP-018 / DP-021 / DP-034 ───────────────
  await prisma.uwDivergencePair.createMany({
    data: [
      {
        tenantId,
        companyId,
        ref: 'DP-018',
        kind: 'APPETITE',
        leftRef: 'AS-114 v9',
        leftEstate: 'Guidewire estate',
        rightRef: 'APP-77',
        rightEstate: 'Duck Creek estate',
        weight: 0.08,
        proposal: 'MERGE',
        impactPreview: { submissionsAffected: 214, rolesAffected: 3, pasBindingsAffected: 2 },
      },
      {
        tenantId,
        companyId,
        ref: 'DP-021',
        kind: 'RULE',
        leftRef: 'GR-2201 v7',
        leftEstate: 'target',
        rightRef: 'UWR-90',
        rightEstate: 'legacy',
        weight: 0.14,
        proposal: 'MERGE_WITH_EXCEPTION',
      },
      {
        tenantId,
        companyId,
        ref: 'DP-034',
        kind: 'AUTHORITY',
        leftRef: 'AG-31 v1',
        leftEstate: 'admitted',
        rightRef: 'AUTH-E&S-4',
        rightEstate: 'E&S',
        weight: 0.41,
        proposal: 'KEEP_BOTH',
      },
    ],
  });

  // ── PAS binding registration (CAP-09) ──────────────────────────────────
  if (pasApp) {
    await prisma.uwPasBinding.createMany({
      data: [s1, s2].map((s) => ({
        tenantId,
        companyId,
        submissionId: s.id,
        applicationId: pasApp.id,
        status: 'REGISTERED',
      })),
    });
  }
}
