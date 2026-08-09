// Rate-Price demo estate (RATE-PRICE): rating models across the volume ↔
// complexity spectrum (Earnix-pattern BOP/WC throughput, hx-pattern GL/XS
// judgment), immutable published versions with evaluable specs, jurisdiction
// rule sets (restricted states block optimization until P6 ack), a rate
// program with a compliance-bound filing packet, and the CAP-19 legacy
// rationalization chain: raters → extracted specs (opaque macro flagged, never
// approximated) → divergence matrix → migration wave. M-CP-04 exists so the UW
// Workbench priced-by cross-module edge resolves. Idempotent:
// delete-then-recreate by company.
import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { computeDivergence, extractCanonicalSpec } from '../lib/rate-price/engine.js';
import type { LegacyDefinition, RatingSpec } from '../lib/rate-price/types.js';

const hash = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(v) ?? 'null')
    .digest('hex');

type Ctx = { tenantId: string; companyId: string };

const glSpec: RatingSpec = {
  inputs: [
    { name: 'payroll', type: 'number', domain: 'USD annual payroll' },
    { name: 'classCode', type: 'string', domain: 'GL class code' },
    { name: 'lossRatio3yr', type: 'number', domain: '3-year loss ratio' },
    { name: 'safetyProgram', type: 'boolean', domain: 'documented safety program' },
  ],
  factors: [
    { name: 'base rate', kind: 'base_rate', rate: 3.42, exposureInput: 'payroll', per: 100 },
    {
      name: 'class factor',
      kind: 'table',
      input: 'classCode',
      rows: [
        { match: '91560', factor: 1.0 },
        { match: '91580', factor: 1.25 },
        { match: '98305', factor: 1.6 },
      ],
      defaultFactor: 1.15,
    },
    {
      name: 'experience mod',
      kind: 'formula',
      input: 'lossRatio3yr',
      slope: 0.45,
      intercept: 0.78,
      min: 0.75,
      max: 1.4,
    },
    { name: 'schedule credit', kind: 'flag', input: 'safetyProgram', factor: 0.95 },
  ],
  minPremium: 750,
  rounding: 'nearest_1',
};

const bopSpec: RatingSpec = {
  inputs: [
    { name: 'tiv', type: 'number', domain: 'USD total insured value' },
    { name: 'territory', type: 'string', domain: 'territory token' },
    { name: 'sprinklered', type: 'boolean' },
  ],
  factors: [
    { name: 'base rate', kind: 'base_rate', rate: 0.35, exposureInput: 'tiv', per: 100 },
    {
      name: 'territory factor',
      kind: 'table',
      input: 'territory',
      rows: [
        { match: 'T1', factor: 0.9 },
        { match: 'T2', factor: 1.0 },
        { match: 'T3', factor: 1.35 },
      ],
      defaultFactor: 1.1,
    },
    { name: 'sprinkler credit', kind: 'flag', input: 'sprinklered', factor: 0.9 },
  ],
  minPremium: 500,
  rounding: 'nearest_10',
};

const cpSpec: RatingSpec = {
  inputs: [
    { name: 'tiv', type: 'number', domain: 'USD total insured value' },
    { name: 'catZone', type: 'string', domain: 'CAT exposure zone' },
  ],
  factors: [
    { name: 'base rate', kind: 'base_rate', rate: 0.52, exposureInput: 'tiv', per: 100 },
    {
      name: 'cat zone factor',
      kind: 'table',
      input: 'catZone',
      rows: [
        { match: 'LOW', factor: 0.85 },
        { match: 'MODERATE', factor: 1.1 },
        { match: 'HIGH', factor: 1.75 },
      ],
      defaultFactor: 1.0,
    },
  ],
  minPremium: 1000,
  rounding: 'nearest_10',
};

const wcSpec: RatingSpec = {
  inputs: [
    { name: 'payroll', type: 'number', domain: 'USD annual payroll' },
    { name: 'classCode', type: 'string', domain: 'NCCI class code' },
  ],
  factors: [
    { name: 'base rate', kind: 'base_rate', rate: 1.85, exposureInput: 'payroll', per: 100 },
    {
      name: 'class factor',
      kind: 'table',
      input: 'classCode',
      rows: [
        { match: '8810', factor: 0.2 },
        { match: '5403', factor: 2.4 },
        { match: '7219', factor: 1.9 },
      ],
      defaultFactor: 1.0,
    },
  ],
  minPremium: 400,
  rounding: 'nearest_1',
};

// The legacy XS judgment spreadsheet — the wireframe scenario. Its experience
// handling is manual (opaque) and the ADJ_OVERRIDE macro cannot be extracted.
const xsLegacyDefinition: LegacyDefinition = {
  inputs: [
    { name: 'payroll', type: 'number', domain: 'USD annual payroll' },
    { name: 'classCode', type: 'string' },
    { name: 'judgmentLoad', type: 'number', domain: 'UW judgment ±25%' },
  ],
  factors: [
    {
      name: 'base rate',
      kind: 'base_rate',
      rate: 3.1,
      exposureInput: 'payroll',
      per: 100,
      confidence: 'high',
    },
    {
      name: 'class factor',
      kind: 'table',
      input: 'classCode',
      rows: [
        { match: '91560', factor: 1.05 },
        { match: '91580', factor: 1.25 },
      ],
      defaultFactor: 1.2,
      confidence: 'medium',
    },
    {
      name: 'experience mod',
      kind: 'formula',
      input: 'lossRatio3yr',
      slope: 0.5,
      intercept: 0.75,
      min: 0.7,
      max: 1.5,
      confidence: 'medium',
      opaque: true, // manual worksheet in the legacy artifact — human review
    },
    {
      name: 'judgment load',
      kind: 'formula',
      input: 'judgmentLoad',
      slope: 1,
      intercept: 1,
      min: 0.75,
      max: 1.25,
      confidence: 'low',
    },
  ],
  macros: [{ ref: 'Macro ADJ_OVERRIDE', reason: 'opaque VBA — human review' }],
  minPremium: 750,
  rounding: 'nearest_1',
};

// Near-identical BOP state variant — the merge-cluster scenario.
const bopVariantDefinition: LegacyDefinition = {
  inputs: [
    { name: 'tiv', type: 'number' },
    { name: 'territory', type: 'string' },
    { name: 'sprinklered', type: 'boolean' },
  ],
  factors: [
    {
      name: 'base rate',
      kind: 'base_rate',
      rate: 0.37,
      exposureInput: 'tiv',
      per: 100,
      confidence: 'high',
    },
    {
      name: 'territory factor',
      kind: 'table',
      input: 'territory',
      rows: [
        { match: 'T1', factor: 0.9 },
        { match: 'T2', factor: 1.0 },
        { match: 'T3', factor: 1.4 },
      ],
      defaultFactor: 1.1,
      confidence: 'high',
    },
    {
      name: 'sprinkler credit',
      kind: 'flag',
      input: 'sprinklered',
      factor: 0.9,
      confidence: 'high',
    },
  ],
  minPremium: 500,
  rounding: 'nearest_10',
};

export async function seedRatePrice(prisma: PrismaClient, ctx: Ctx) {
  const { tenantId, companyId } = ctx;

  // Idempotency: clear the Rate-Price domain for this company (children cascade).
  await prisma.rpMigrationWave.deleteMany({ where: { companyId } });
  await prisma.rpLegacyRater.deleteMany({ where: { companyId } });
  await prisma.rpRateProgram.deleteMany({ where: { companyId } });
  await prisma.rpOptimizationJob.deleteMany({ where: { companyId } });
  await prisma.rpJurisdictionRuleSet.deleteMany({ where: { companyId } });
  await prisma.rpTestBatch.deleteMany({ where: { companyId } });
  await prisma.rpRatingModel.deleteMany({ where: { companyId } });

  const actuaryRole = await prisma.role.findFirst({
    where: { companyId, displayValue: { contains: 'Actuar', mode: 'insensitive' } },
    select: { id: true },
  });
  const pricingRole =
    actuaryRole ??
    (await prisma.role.findFirst({
      where: { companyId, displayValue: { contains: 'Pricing', mode: 'insensitive' } },
      select: { id: true },
    })) ??
    (await prisma.role.findFirst({ where: { companyId }, select: { id: true } }));
  const valueStream = await prisma.processNode.findFirst({
    where: { companyId, displayValue: { contains: 'Underwrit', mode: 'insensitive' } },
    select: { id: true },
  });

  const mkModel = async (args: {
    ref: string;
    name: string;
    lob: string;
    jurisdictions: string;
    engineOfRecord: string;
    lifecycle: string;
    spec?: RatingSpec;
    semver?: string;
    draftSpec?: { semver: string; provenance: string; spec: RatingSpec };
  }) => {
    const model = await prisma.rpRatingModel.create({
      data: {
        tenantId,
        companyId,
        ref: args.ref,
        name: args.name,
        lob: args.lob,
        jurisdictions: args.jurisdictions,
        engineOfRecord: args.engineOfRecord,
        lifecycle: args.lifecycle,
        ownerRoleId: pricingRole?.id ?? null,
        valueStreamNodeId: valueStream?.id ?? null,
      },
    });
    let published: { id: string } | null = null;
    if (args.spec) {
      published = await prisma.rpModelVersion.create({
        data: {
          tenantId,
          companyId,
          modelId: model.id,
          semver: args.semver ?? '1.0.0',
          bundleHash: hash(args.spec),
          provenance: 'human',
          spec: args.spec as unknown as Prisma.InputJsonValue,
          status: 'published',
          publishedBy: 'kevin.hicks@capgemini.com',
          publishedAt: new Date('2026-06-15T12:00:00Z'),
        },
      });
      await prisma.rpRatingModel.update({
        where: { id: model.id },
        data: { currentVersionId: published.id },
      });
    }
    if (args.draftSpec) {
      await prisma.rpModelVersion.create({
        data: {
          tenantId,
          companyId,
          modelId: model.id,
          semver: args.draftSpec.semver,
          bundleHash: hash(args.draftSpec.spec),
          provenance: args.draftSpec.provenance,
          spec: args.draftSpec.spec as unknown as Prisma.InputJsonValue,
          status: 'draft',
        },
      });
    }
    return { model, published };
  };

  // ── Estate registry (CAP-01) ────────────────────────────────────────────
  await mkModel({
    ref: 'M-GL-01',
    name: 'GL Primary — Contractors',
    lob: 'GL',
    jurisdictions: 'NC,SC,GA,TN,VA,AL,FL,TX,OH,PA,IN,MO,KY,WV',
    engineOfRecord: 'hx',
    lifecycle: 'deployed',
    spec: glSpec,
    semver: '4.2.0',
    draftSpec: {
      semver: '4.3.0',
      provenance: 'aglm-proposal', // territory refit awaiting P1 review (ADR-004)
      spec: {
        ...glSpec,
        factors: glSpec.factors.map((f) => (f.kind === 'base_rate' ? { ...f, rate: 3.51 } : f)),
      },
    },
  });
  const bop = await mkModel({
    ref: 'M-BP-01',
    name: 'BOP Small Commercial',
    lob: 'BOP',
    jurisdictions: 'CW',
    engineOfRecord: 'earnix',
    lifecycle: 'deployed',
    spec: bopSpec,
    semver: '7.0.1',
  });
  await mkModel({
    ref: 'M-CP-04', // resolves the UW Workbench priced-by edge (UwQuoteProposal.modelRef)
    name: 'Commercial Property — CAT Exposed',
    lob: 'CP',
    jurisdictions: 'SC,NC,GA,FL,TX,LA,AL,MS',
    engineOfRecord: 'tb-reference',
    lifecycle: 'deployed',
    spec: cpSpec,
    semver: '1.4.0',
  });
  await mkModel({
    ref: 'M-WC-02',
    name: 'WC Class-Rated',
    lob: 'WC',
    jurisdictions: 'NC,SC,GA,TN,VA,AL,OH,PA,IN,MO,KY,WV,TX,FL,AZ,CO,IL,MI',
    engineOfRecord: 'pas-native',
    lifecycle: 'deployed',
    spec: wcSpec,
    semver: '2.9.0',
  });
  const xsTarget = await mkModel({
    ref: 'M-XS-01',
    name: 'Excess Casualty — Judgment (rebuild target)',
    lob: 'XS',
    jurisdictions: 'CW',
    engineOfRecord: 'tb-reference',
    lifecycle: 'review',
    spec: glSpec, // rebuild seeded from the GL grammar — divergence shows the judgment gap
    semver: '0.9.0',
  });

  // ── Jurisdiction rule sets (ADR-006 — data, not code) ───────────────────
  const jurisdictionRows: { code: string; restricted: boolean; note: string }[] = [
    {
      code: 'CW',
      restricted: false,
      note: 'countrywide default — commercial optimization permitted',
    },
    { code: 'CA', restricted: true, note: 'price optimization restricted — CDI Bulletin scrutiny' },
    { code: 'FL', restricted: true, note: 'optimization restricted for this product context' },
    { code: 'WA', restricted: true, note: 'credit/optimization restrictions in force' },
    { code: 'NC', restricted: false, note: 'SERFF filing; optimization permitted with exhibits' },
    { code: 'TX', restricted: false, note: 'file-and-use; disruption exhibits expected' },
  ];
  for (const row of jurisdictionRows) {
    const jurisdiction =
      row.code === 'CW'
        ? null
        : await prisma.jurisdiction.findFirst({
            where: { companyId, code: row.code },
            select: { id: true },
          });
    await prisma.rpJurisdictionRuleSet.create({
      data: {
        tenantId,
        companyId,
        code: row.code,
        jurisdictionId: jurisdiction?.id ?? null,
        optimizationRestricted: row.restricted,
        constraints: [
          { kind: 'note', value: row.note },
          ...(row.restricted
            ? [{ kind: 'optimization', value: 'blocked-until-P6-ack' }]
            : [{ kind: 'per-risk-cap', value: 12 }]),
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ── Rate program + compliance-bound filing packet (CAP-15) ──────────────
  const complianceItem = await prisma.complianceItem.findFirst({
    where: { companyId, itemCode: { startsWith: 'REG-018' } },
    select: { id: true, itemCode: true },
  });
  const fallbackItem =
    complianceItem ??
    (await prisma.complianceItem.findFirst({
      where: { companyId },
      select: { id: true, itemCode: true },
    }));
  const program = await prisma.rpRateProgram.create({
    data: {
      tenantId,
      companyId,
      ref: 'RP-001',
      product: 'BOP rev 2026-Q3',
      lob: 'BOP',
      jurisdiction: 'NC',
      effectiveDate: new Date('2026-10-01T00:00:00Z'),
      filingStatus: 'drafting',
      modelLinks: { create: [{ companyId, modelId: bop.model.id }] },
    },
  });
  if (bop.published && fallbackItem) {
    await prisma.rpFilingPacket.create({
      data: {
        tenantId,
        companyId,
        programId: program.id,
        modelVersionId: bop.published.id,
        sections: [
          { name: 'Rate-change summary + factor deltas', status: 'generated' },
          { name: 'Impact exhibits (disruption, by territory)', status: 'generated' },
          { name: 'Model documentation refs (v7.0.1 bundle)', status: 'linked' },
          {
            name: `Jurisdiction checklist — ${fallbackItem.itemCode}`,
            status: 'bound',
            boundComplianceRef: fallbackItem.itemCode,
          },
        ] as unknown as Prisma.InputJsonValue,
        complianceLinks: { create: [{ companyId, complianceItemId: fallbackItem.id }] },
      },
    });
  }

  // ── Legacy rationalization chain (CAP-19) ───────────────────────────────
  const xsRater = await prisma.rpLegacyRater.create({
    data: {
      tenantId,
      companyId,
      ref: 'LR-001',
      name: 'Excess Casualty judgment spreadsheet',
      lob: 'XS',
      artifactType: 'spreadsheet',
      discoveredVia: 'estate inventory scan 2026-07',
      complexityScore: 78,
      definition: xsLegacyDefinition as unknown as Prisma.InputJsonValue,
      status: 'EXTRACTED',
    },
  });
  const bopRater = await prisma.rpLegacyRater.create({
    data: {
      tenantId,
      companyId,
      ref: 'LR-002',
      name: 'BOP state-variant rater (SC)',
      lob: 'BOP',
      artifactType: 'spreadsheet',
      discoveredVia: 'estate inventory scan 2026-07',
      complexityScore: 22,
      definition: bopVariantDefinition as unknown as Prisma.InputJsonValue,
      status: 'EXTRACTED',
    },
  });
  await prisma.rpLegacyRater.create({
    data: {
      tenantId,
      companyId,
      ref: 'LR-003',
      name: 'GL legacy engine export (pre-2019)',
      lob: 'GL',
      artifactType: 'engine',
      discoveredVia: 'PAS decommission review',
      complexityScore: 55,
      status: 'INVENTORIED', // no definition captured yet — extraction will 409 until it is
    },
  });

  // Deterministic extraction — same pure function the API uses, so the seeded
  // evidence is bit-identical to a live extraction (unextracted list intact).
  const xsExtraction = extractCanonicalSpec(xsLegacyDefinition);
  const xsSpec = await prisma.rpCanonicalSpec.create({
    data: {
      tenantId,
      companyId,
      legacyRaterId: xsRater.id,
      specVersion: 1,
      spec: xsExtraction.spec as unknown as Prisma.InputJsonValue,
      extractionConfidence: xsExtraction.extractionConfidence,
      humanConfirmed: false, // pending — blocks MW-02 cutover (INV-04 demo)
    },
  });
  const bopExtraction = extractCanonicalSpec(bopVariantDefinition);
  const bopVariantSpec = await prisma.rpCanonicalSpec.create({
    data: {
      tenantId,
      companyId,
      legacyRaterId: bopRater.id,
      specVersion: 1,
      spec: bopExtraction.spec as unknown as Prisma.InputJsonValue,
      extractionConfidence: bopExtraction.extractionConfidence,
      humanConfirmed: true,
      confirmedBy: 'kevin.hicks@capgemini.com',
      confirmedAt: new Date('2026-07-20T15:00:00Z'),
    },
  });

  if (bop.published) {
    const bopDivergence = computeDivergence(bopExtraction.spec.factors, bopSpec.factors);
    await prisma.rpDivergenceMatrix.create({
      data: {
        tenantId,
        companyId,
        specId: bopVariantSpec.id,
        targetVersionId: bop.published.id,
        portfolioRef: 'synthetic-10-rater-estate',
        maxDivergencePct: bopDivergence.maxDivergencePct,
        cells: bopDivergence.cells as unknown as Prisma.InputJsonValue,
        recommendation: bopDivergence.recommendation,
      },
    });
  }
  if (xsTarget.published) {
    const xsDivergence = computeDivergence(xsExtraction.spec.factors, glSpec.factors);
    await prisma.rpDivergenceMatrix.create({
      data: {
        tenantId,
        companyId,
        specId: xsSpec.id,
        targetVersionId: xsTarget.published.id,
        portfolioRef: 'synthetic-10-rater-estate',
        maxDivergencePct: xsDivergence.maxDivergencePct,
        cells: xsDivergence.cells as unknown as Prisma.InputJsonValue,
        recommendation: xsDivergence.recommendation,
      },
    });
  }

  // ── Migration waves — MW-01 ready to cut, MW-02 blocked (INV-04) ────────
  await prisma.rpMigrationWave.create({
    data: {
      tenantId,
      companyId,
      ref: 'MW-01',
      name: 'BOP state-variant consolidation',
      sequence: 1,
      tolerancePct: 10,
      rollbackPlan:
        'Re-point PAS rating callout at the SC variant workbook; variants retained 90 days',
      status: 'PLANNED',
      targetModelId: bop.model.id,
      members: { create: [{ companyId, legacyRaterId: bopRater.id }] },
    },
  });
  await prisma.rpMigrationWave.create({
    data: {
      tenantId,
      companyId,
      ref: 'MW-02',
      name: 'Excess Casualty judgment rebuild',
      sequence: 2,
      tolerancePct: 5,
      rollbackPlan: 'Spreadsheet stays authoritative until parallel-run RMSE < 0.5%',
      status: 'PLANNED',
      targetModelId: xsTarget.model.id,
      members: { create: [{ companyId, legacyRaterId: xsRater.id }] },
    },
  });

  // ── Optimization job blocked on restricted jurisdictions (LLR-06.1) ─────
  if (bop.published) {
    await prisma.rpOptimizationJob.create({
      data: {
        tenantId,
        companyId,
        versionId: bop.published.id,
        objective: 'retention-weighted margin, +4% target',
        constraints: {
          targetJurisdictions: ['NC', 'CA', 'FL', 'WA'],
          perRiskCapPct: 12,
          restrictedCodes: ['CA', 'FL', 'WA'],
        } as unknown as Prisma.InputJsonValue,
        ruleSetId: (
          await prisma.rpJurisdictionRuleSet.findFirstOrThrow({
            where: { companyId, code: 'CW' },
            select: { id: true },
          })
        ).id,
        status: 'BLOCKED',
      },
    });
  }
}
