// SCRUM-134 — a TRUE many-to-one normalization demo board.
//
// Two real, functionally-overlapping open-source claims applications —
// openIMIS (insurance back-end: enrollment, policy/benefit rules, claims
// intake & adjudication) and the OpenMRS Insurance Claims module (clinical
// front-end: eligibility check, claim creation from encounters, status
// tracking) — are decomposed into their own current-state steps. Overlapping
// steps consolidate 2→1 into shared normalized capability buckets; steps only
// one application has carry 1→1. The pairing is authentic: OpenMRS + openIMIS
// are commonly integrated in production (OpenMRS as EMR, openIMIS as the
// claims/eligibility platform), so the overlap is real, not invented.
//
// Run from backend/:  npx tsx --env-file=.env scripts/seed-claims-normalization.ts
// Idempotent: deletes this workspace (by name) and reinserts it. The board is
// illustrative:false so the evergreen reseed never wipes it.
import { prisma } from '../src/db/prisma.js';

const WS_NAME = 'Claims Intake & Adjudication (openIMIS + OpenMRS)';
const WS_ID = 'rw_claims_interop';
const APP_LABEL = 'openIMIS + OpenMRS Insurance Claims';

type Layer = 'UI' | 'Integration' | 'Business Service' | 'Data' | 'Infrastructure';
const LAYERS: Layer[] = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'];

const IM = 0; // openIMIS
const MRS = 1; // OpenMRS Insurance Claims module

interface SourceStep {
  app: typeof IM | typeof MRS;
  name: string;
  screen: string;
  summary: string;
  codeRef: string;
  capdan?: 'Common' | 'Different';
  why?: { captured?: string; sent?: string; processed?: string; validation?: string };
}

/** One normalized bucket: 1..n source steps → one capability. */
interface Bucket {
  layer: Layer;
  name: string;
  category: string;
  steps: SourceStep[];
  status?: 'AUTO' | 'REVIEW';
  basis?: string;
  note?: string;
  resolution?: string;
}

const BUCKETS: Bucket[] = [
  // ── UI ──────────────────────────────────────────────────────────────────
  {
    layer: 'UI',
    name: 'Member / patient eligibility lookup',
    category: 'Eligibility & enrollment',
    basis:
      'Both screens answer "is this person covered right now?" — matched on intent, inputs (member id) and outputs (active policy + remaining benefit); 2→1.',
    steps: [
      {
        app: IM,
        name: 'Insuree enquiry & policy status panel',
        screen: 'Insurees & Policies',
        summary:
          'Search an insuree by insurance number; shows photo, family, active policy and remaining benefit ceiling.',
        codeRef: 'openimis-fe-insuree: InsureeSearcher / EnquiryDialog',
      },
      {
        app: MRS,
        name: 'Patient insurance eligibility widget',
        screen: 'Patient Dashboard — Insurance',
        summary: 'Point-of-care coverage check on the patient dashboard before a visit is billed.',
        codeRef: 'openmrs-module-insuranceclaims: eligibility dashboard fragment',
      },
    ],
  },
  {
    layer: 'UI',
    name: 'Claim capture form',
    category: 'Claim intake',
    basis:
      'Both forms capture the same claim shape — diagnoses (ICD), items/services, amounts; 2→1.',
    steps: [
      {
        app: IM,
        name: 'Health facility claim entry form',
        screen: 'Health Facility Claims',
        summary:
          'Manual claim entry for a health facility: diagnoses, items, services and claimed amounts.',
        codeRef: 'openimis-fe-claim: ClaimForm / ClaimMasterPanel',
      },
      {
        app: MRS,
        name: 'Create claim from encounter',
        screen: 'Create Insurance Claim',
        summary:
          'Claim form pre-filled from the clinical visit — diagnoses and billable services come from the encounter.',
        codeRef: 'openmrs-module-insuranceclaims: claim create page',
      },
    ],
  },
  {
    layer: 'UI',
    name: 'Claims review & feedback workbench',
    category: 'Adjudication',
    steps: [
      {
        app: IM,
        name: 'Claims review & feedback workbench',
        screen: 'Claims Review',
        summary:
          'Adjudicator-side batch selection, medical review and feedback status — only the insurer has this.',
        codeRef: 'openimis-fe-claim: ClaimReviewsPage',
      },
    ],
  },
  {
    layer: 'UI',
    name: 'Claim status tracker',
    category: 'Claim intake',
    steps: [
      {
        app: MRS,
        name: 'Claim status tracker',
        screen: 'Claim Status Tracker',
        summary:
          'Provider-side list of submitted claims with their adjudication status — only the EMR has this.',
        codeRef: 'openmrs-module-insuranceclaims: claim list page',
      },
    ],
  },
  {
    layer: 'UI',
    name: 'Product & policy administration',
    category: 'Policy administration',
    steps: [
      {
        app: IM,
        name: 'Product & policy administration screens',
        screen: 'Product & Policy Administration',
        summary:
          'Benefit packages, contribution plans and policy renewals — insurer back-office only.',
        codeRef: 'openimis-fe-product / openimis-fe-policy',
      },
    ],
  },
  // ── Integration ─────────────────────────────────────────────────────────
  {
    layer: 'Integration',
    name: 'Claim submission API (FHIR R4 Claim)',
    category: 'Claim exchange',
    basis:
      'Server and client of the SAME FHIR R4 Claim exchange — one submits what the other accepts; 2→1.',
    steps: [
      {
        app: IM,
        name: 'FHIR R4 Claim endpoint',
        screen: 'Health Facility Claims',
        summary: 'openIMIS FHIR module accepts Claim bundles submitted by provider systems.',
        codeRef: 'openimis-be-api_fhir_r4: ClaimSerializer / /api_fhir_r4/Claim',
      },
      {
        app: MRS,
        name: 'FHIR Claim submission client',
        screen: 'Create Insurance Claim',
        summary: 'Posts the encounter-built Claim bundle to the insurer over FHIR R4.',
        codeRef: 'openmrs-module-insuranceclaims: FHIR client service',
      },
    ],
  },
  {
    layer: 'Integration',
    name: 'Eligibility check API (CoverageEligibilityRequest)',
    category: 'Eligibility exchange',
    basis: 'Same FHIR CoverageEligibilityRequest/Response pair, server side and client side; 2→1.',
    steps: [
      {
        app: IM,
        name: 'FHIR CoverageEligibilityRequest endpoint',
        screen: 'Insurees & Policies',
        summary: 'Answers coverage-eligibility requests against live policy and product rules.',
        codeRef: 'openimis-be-api_fhir_r4: CoverageEligibilityRequest',
      },
      {
        app: MRS,
        name: 'CoverageEligibilityRequest client',
        screen: 'Patient Dashboard — Insurance',
        summary: 'Sends the point-of-care eligibility question to the insurer.',
        codeRef: 'openmrs-module-insuranceclaims: eligibility client',
      },
    ],
  },
  {
    layer: 'Integration',
    name: 'Encounter → claim event listener',
    category: 'Claim intake',
    steps: [
      {
        app: MRS,
        name: 'Encounter → claim event listener',
        screen: 'Create Insurance Claim',
        summary: 'Builds a draft claim automatically when a billable visit is closed — EMR only.',
        codeRef: 'openmrs-module-insuranceclaims: encounter event listener',
      },
    ],
  },
  {
    layer: 'Integration',
    name: 'Batch runs & reporting extracts',
    category: 'Reporting',
    steps: [
      {
        app: IM,
        name: 'Batch runs & reporting extracts',
        screen: 'Claims Review',
        summary: 'Periodic batch valuation runs and operational report extracts — insurer only.',
        codeRef: 'openimis-be-claim_batch: batch run tasks',
      },
    ],
  },
  // ── Business Service ────────────────────────────────────────────────────
  {
    layer: 'Business Service',
    name: 'Eligibility verification',
    category: 'Eligibility & enrollment',
    status: 'REVIEW',
    note: 'Same question — "is this patient covered for this care?" — answered two ways: openIMIS computes live against policy, product and remaining ceilings; OpenMRS trusts a possibly-stale local coverage cache.',
    resolution:
      'Normalize on the live eligibility service; the point-of-care check calls it synchronously and only falls back to the cache when offline.',
    steps: [
      {
        app: IM,
        name: 'Policy & benefit eligibility calculation',
        screen: 'Insurees & Policies',
        summary:
          'Full check: policy active, product covers the service, ceilings and deductibles not exhausted.',
        codeRef: 'openimis-be-policy: eligibility service',
        capdan: 'Different',
        why: {
          captured: 'Member id + requested service/item',
          processed: 'Live policy lookup, product rule match, remaining-benefit math',
          validation: 'Authoritative — computed against the master policy record at call time',
        },
      },
      {
        app: MRS,
        name: 'Cached coverage pre-check',
        screen: 'Patient Dashboard — Insurance',
        summary: 'Lightweight check against the last-synced local copy of the patient coverage.',
        codeRef: 'openmrs-module-insuranceclaims: local eligibility check',
        capdan: 'Different',
        why: {
          captured: 'Patient id',
          processed: 'Reads the locally-cached coverage row, no benefit math',
          validation: 'Best-effort — can approve a visit the insurer later rejects',
        },
      },
    ],
  },
  {
    layer: 'Business Service',
    name: 'Claim validation & coding',
    category: 'Claim intake',
    basis:
      'Both validate the same claim shape before it counts — ICD codes exist, items/services are priceable, totals add up; 2→1.',
    steps: [
      {
        app: IM,
        name: 'Claim submission validation',
        screen: 'Health Facility Claims',
        summary:
          'Checks ICD codes, item/service validity and pricing before a claim enters review.',
        codeRef: 'openimis-be-claim: claim submit service',
      },
      {
        app: MRS,
        name: 'Claim assembly & mapping',
        screen: 'Create Insurance Claim',
        summary:
          'Maps encounter diagnoses and services onto billable items and validates the result.',
        codeRef: 'openmrs-module-insuranceclaims: claim builder service',
      },
    ],
  },
  {
    layer: 'Business Service',
    name: 'Auto-adjudication rules engine',
    category: 'Adjudication',
    steps: [
      {
        app: IM,
        name: 'Auto-adjudication rules engine',
        screen: 'Claims Review',
        summary:
          'Approves/rejects claim lines automatically: service validity, ceilings, deductibles, duplicate checks — insurer only.',
        codeRef: 'openimis-be-claim: review/adjudication rules',
      },
    ],
  },
  {
    layer: 'Business Service',
    name: 'Contribution & premium management',
    category: 'Policy administration',
    steps: [
      {
        app: IM,
        name: 'Contribution & premium management',
        screen: 'Product & Policy Administration',
        summary: 'Premium collection, contribution plans and policy renewal logic — insurer only.',
        codeRef: 'openimis-be-contribution',
      },
    ],
  },
  // ── Data ────────────────────────────────────────────────────────────────
  {
    layer: 'Data',
    name: 'Member & coverage master',
    category: 'Member data',
    status: 'REVIEW',
    note: 'Member demographics and coverage live TWICE — master records in openIMIS, a shadow copy cached in OpenMRS; drift between them is a top cause of rejected claims.',
    resolution:
      'One member & coverage master in the Claims Data Platform; OpenMRS reads it through the gateway and keeps no local copy.',
    steps: [
      {
        app: IM,
        name: 'Insuree / family / policy schema',
        screen: 'Insurees & Policies',
        summary: 'Master tables for insurees, families, policies and their benefit state.',
        codeRef: 'openIMIS DB: tblInsuree / tblFamilies / tblPolicy',
        capdan: 'Different',
        why: {
          captured: 'Member demographics, family links, policy + product state',
          validation: 'System of record',
        },
      },
      {
        app: MRS,
        name: 'Patient + coverage cache tables',
        screen: 'Patient Dashboard — Insurance',
        summary: 'Locally-synced copy of patient coverage used by the module offline.',
        codeRef: 'insuranceclaims module tables: iclm_patient_coverage',
        capdan: 'Different',
        why: {
          captured: 'A subset of the same member + coverage fields, synced periodically',
          validation: 'Shadow copy — drifts between syncs',
        },
      },
    ],
  },
  {
    layer: 'Data',
    name: 'Claims repository',
    category: 'Claims data',
    basis: 'Same claim + claim-line shape stored on both sides of the exchange; 2→1.',
    steps: [
      {
        app: IM,
        name: 'Claim & adjudication results tables',
        screen: 'Health Facility Claims',
        summary: 'Claims, claim items/services and their adjudication outcomes.',
        codeRef: 'openIMIS DB: tblClaim / tblClaimItems / tblClaimServices',
      },
      {
        app: MRS,
        name: 'Module claim & claim-line tables',
        screen: 'Claim Status Tracker',
        summary: "The module's own claim and claim-line records mirroring what was submitted.",
        codeRef: 'insuranceclaims module tables: iclm_claim / iclm_claim_item',
      },
    ],
  },
  {
    layer: 'Data',
    name: 'Product & benefit package tables',
    category: 'Policy administration',
    steps: [
      {
        app: IM,
        name: 'Product & benefit package tables',
        screen: 'Product & Policy Administration',
        summary: 'Benefit packages, pricing and coverage rules — insurer only.',
        codeRef: 'openIMIS DB: tblProduct / tblProductItems / tblProductServices',
      },
    ],
  },
  // ── Infrastructure ──────────────────────────────────────────────────────
  {
    layer: 'Infrastructure',
    name: 'Identity & access management',
    category: 'Security',
    basis:
      'Both are role-based access control over the same user population (district staff, clinicians); 2→1.',
    steps: [
      {
        app: IM,
        name: 'Role-based access with district scoping',
        screen: 'Product & Policy Administration',
        summary: 'openIMIS roles/rights with location (district) scoping of what a user may touch.',
        codeRef: 'openimis-be-core: role & rights model',
      },
      {
        app: MRS,
        name: 'OpenMRS privileges & roles',
        screen: 'Patient Dashboard — Insurance',
        summary: 'OpenMRS user roles and privileges guarding the claims module pages.',
        codeRef: 'OpenMRS Platform: user service privileges',
      },
    ],
  },
  {
    layer: 'Infrastructure',
    name: 'Audit logging',
    category: 'Security',
    basis: 'Both keep a who-changed-what trail for the same claim lifecycle; 2→1.',
    steps: [
      {
        app: IM,
        name: 'Mutation log',
        screen: 'Claims Review',
        summary: 'Every change is a logged mutation with actor and timestamp.',
        codeRef: 'openimis-be-core: mutation log',
      },
      {
        app: MRS,
        name: 'Module audit trail',
        screen: 'Claim Status Tracker',
        summary: 'Claim submissions and status changes recorded in the module audit table.',
        codeRef: 'insuranceclaims module: audit interceptor',
      },
    ],
  },
];

/** Green-field target — one service per layer, layer-appropriate stack. */
const GF: Record<
  Layer,
  { ms: string; kind: string; tech: string; comp: string; status: string; compStatus: string }
> = {
  UI: {
    ms: 'Claims Experience Web App',
    kind: 'Web App',
    tech: 'React 18 + TypeScript, Module Federation',
    comp: 'Unified claims & eligibility UI',
    status: 'Building',
    compStatus: 'In Analysis',
  },
  Integration: {
    ms: 'Claims Interop Gateway',
    kind: 'API Service',
    tech: 'HAPI FHIR R4, Spring Cloud Gateway, Kafka',
    comp: 'FHIR R4 claim & eligibility APIs',
    status: 'Building',
    compStatus: 'In Analysis',
  },
  'Business Service': {
    ms: 'Claims & Eligibility Domain Service',
    kind: 'Microservice',
    tech: 'Java 21 / Spring Boot, Drools rules',
    comp: 'Adjudication & eligibility logic',
    status: 'Planned',
    compStatus: 'Identified',
  },
  Data: {
    ms: 'Claims Data Platform',
    kind: 'Data Platform',
    tech: 'Postgres 16, Debezium CDC',
    comp: 'Member, coverage & claims master schema',
    status: 'Planned',
    compStatus: 'Identified',
  },
  Infrastructure: {
    ms: 'Claims Platform Security',
    kind: 'Platform',
    tech: 'Keycloak OIDC, OPA, OpenTelemetry',
    comp: 'Shared IAM, audit & observability',
    status: 'Planned',
    compStatus: 'Identified',
  },
};

const APPS = [
  {
    name: 'openIMIS',
    techStack:
      'openIMIS modular: Python/Django back-end + React front-end modules, MySQL/PostgreSQL',
    description:
      'Open-source insurance management: member enrollment, policy & benefit rules, claims intake and adjudication.',
    screens: [
      'Insurees & Policies',
      'Health Facility Claims',
      'Claims Review',
      'Product & Policy Administration',
    ],
  },
  {
    name: 'OpenMRS Insurance Claims',
    techStack: 'OpenMRS Platform module: Java/Spring, OpenMRS UI framework, MySQL',
    description:
      'EMR-side claims module: patient eligibility check, claim creation from clinical encounters, billing status.',
    screens: ['Patient Dashboard — Insurance', 'Create Insurance Claim', 'Claim Status Tracker'],
  },
];

async function main() {
  // Home the board where the existing boards live (single-company demo data).
  const anyWs = await prisma.rationalizationWorkspace.findFirst({
    select: { tenantId: true, companyId: true },
  });
  const company =
    anyWs ??
    (await prisma.company
      .findFirst({ select: { tenantId: true, id: true } })
      .then((c) => (c ? { tenantId: c.tenantId, companyId: c.id } : null)));
  if (!company) throw new Error('No company found');
  const { tenantId, companyId } = company;

  const claimsVs = await prisma.processNode.findFirst({
    where: { companyId, displayValue: 'Claims', processLevelType: { levelNumber: 2 } },
    select: { id: true },
  });

  await prisma.rationalizationWorkspace.deleteMany({
    where: { companyId, OR: [{ id: WS_ID }, { name: WS_NAME }] },
  });

  await prisma.rationalizationWorkspace.create({
    data: {
      id: WS_ID,
      tenantId,
      companyId,
      name: WS_NAME,
      application: APP_LABEL,
      stageOrder: 98, // ahead of the Self-Anatomy board (99) — the demo default
      businessProcess: 'Claims Intake & Adjudication',
      description:
        'Two functionally-overlapping claims systems (openIMIS insurer back-end, OpenMRS EMR claims module) normalized into one shared capability model — overlapping steps consolidate many-to-one, unique steps carry 1→1.',
      northstar:
        'One claims & eligibility platform: shared capabilities built once, app-specific capabilities migrated as-is.',
      valueStreamNodeId: claimsVs?.id ?? null,
      status: 'In Progress',
      illustrative: false,
    },
  });

  const appIds = [] as string[];
  for (let i = 0; i < APPS.length; i++) {
    const a = APPS[i];
    const id = `${WS_ID}_a${i}`;
    appIds.push(id);
    await prisma.rationalizationApp.create({
      data: {
        id,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        name: a.name,
        description: a.description,
        techStack: a.techStack,
        disposition: 'Replace',
        position: i,
        illustrative: false,
      },
    });
    await prisma.screenAsset.createMany({
      data: a.screens.map((name, si) => ({
        id: `${WS_ID}_scr${i}_${si}`,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        appId: id,
        name,
        kind: 'SCREEN',
      })),
    });
  }

  const compIdByLayer = new Map<Layer, string>();
  for (let li = 0; li < LAYERS.length; li++) {
    const layer = LAYERS[li];
    const g = GF[layer];
    const msId = `${WS_ID}_s${li}`;
    const compId = `${WS_ID}_c${li}`;
    compIdByLayer.set(layer, compId);
    await prisma.rationalizationMicroservice.create({
      data: {
        id: msId,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        name: g.ms,
        kind: g.kind,
        status: g.status,
        techStack: g.tech,
        position: li,
        targetDate: new Date(Date.UTC(2026, 9 + li, 1)),
        illustrative: false,
      },
    });
    await prisma.rationalizationComponent.create({
      data: {
        id: compId,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        layer,
        name: g.comp,
        principle:
          'Common As Possible, Different As Needed — shared steps build once, unique steps migrate as-is.',
        targetTech: g.tech,
        destination: g.ms,
        microserviceId: msId,
        migrationStatus: g.compStatus,
        illustrative: false,
      },
    });
  }

  let normSeq = 101;
  let bi = 0;
  for (const b of BUCKETS) {
    const entryId = `${WS_ID}_n${bi}`;
    const shared = b.steps.length > 1;
    await prisma.normalizationEntry.create({
      data: {
        id: entryId,
        tenantId,
        companyId,
        workspaceId: WS_ID,
        layer: b.layer,
        notation: `N-${normSeq++}`,
        name: b.name,
        matchStatus: b.status ?? 'AUTO',
        matchBasis:
          b.basis ??
          (shared
            ? null
            : `Single source (${APPS[b.steps[0].app].name}) — unique capability, carried forward 1→1.`),
        differenceNote: b.note ?? null,
        proposedResolution: b.resolution ?? null,
        componentId: compIdByLayer.get(b.layer) ?? null,
        sortOrder: bi,
        illustrative: false,
      },
    });
    let si = 0;
    for (const s of b.steps) {
      await prisma.rationalizationCapability.create({
        data: {
          id: `${WS_ID}_f${bi}_${si++}`,
          tenantId,
          companyId,
          workspaceId: WS_ID,
          appId: appIds[s.app],
          layer: b.layer,
          name: s.name,
          category: b.category,
          screenRef: s.screen,
          plainSummary: s.summary,
          capdan: s.capdan ?? 'Common',
          treatment: 'Retain',
          migrationStatus: 'In Analysis',
          componentId: compIdByLayer.get(b.layer) ?? null,
          codeRef: s.codeRef,
          normalizationEntryId: entryId,
          whyThisMoves: s.why ?? undefined,
          illustrative: false,
        },
      });
    }
    bi++;
  }

  const counts = {
    findings: await prisma.rationalizationCapability.count({ where: { workspaceId: WS_ID } }),
    entries: await prisma.normalizationEntry.count({ where: { workspaceId: WS_ID } }),
    shared: BUCKETS.filter((b) => b.steps.length > 1).length,
  };
  console.log(
    `Seeded "${WS_NAME}": ${counts.findings} findings → ${counts.entries} normalized (${counts.shared} shared 2→1, ${counts.entries - counts.shared} unique 1→1)`,
  );
}

main().finally(() => prisma.$disconnect());
