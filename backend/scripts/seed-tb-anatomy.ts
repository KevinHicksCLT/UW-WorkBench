// Seed the "Transformation Bridge — Self Anatomy" rationalization workspace
// (WR-07): the app inspecting itself. Findings were produced by an in-session
// Claude analysis of this repo (documents in data/seed/tb-anatomy.json — no
// API-key usage) and land as real RationalizationCapability rows with the
// WR-06 anatomy fields (view, screenRef, plainSummary, recommendedLayer), so
// the board, drill-downs, and the /chat assistant's SQL all see them.
// Idempotent: the workspace is deleted and rebuilt. Run from backend/:
//   npx tsx --env-file=.env scripts/seed-tb-anatomy.ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, '../data/seed/tb-anatomy.json');

type Finding = {
  app: 'frontend' | 'backend';
  layer: string;
  view: 'COMPONENT' | 'BEHAVIOR';
  category: string;
  name: string;
  plainSummary: string;
  codeRef: string;
  screenRef: string | null;
  capdan: 'Common' | 'Relocate' | 'Eliminate';
  recommendedLayer: string | null;
  rationale: string | null;
  sharedService?: string; // WR-15: relocation lands in this shared service, not a layer
};
type Payload = {
  apps: { key: 'frontend' | 'backend'; name: string; techStack: string }[];
  // WR-15: shared applications (MDM/RDM, IAM) that absorb Relocate findings.
  sharedServices: { key: string; name: string; techStack: string }[];
  screens: { name: string; kind: 'SCREEN' | 'MODAL'; route: string | null }[];
  findings: Finding[];
};

const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'];
const WORKSPACE_NAME = 'Transformation Bridge — Self Anatomy';

const payload = JSON.parse(readFileSync(DATA, 'utf8')) as Payload;
const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
if (!company) throw new Error('No company found');
const scope = { tenantId: company.tenantId, companyId: company.id };

// Rebuild wholesale (cascade removes apps/components/findings/screens).
await prisma.rationalizationWorkspace.deleteMany({
  where: { ...scope, name: WORKSPACE_NAME },
});
const w = await prisma.rationalizationWorkspace.create({
  data: {
    ...scope,
    name: WORKSPACE_NAME,
    application: 'Transformation Bridge',
    stageOrder: 99,
    businessProcess: 'Operating-model management (self-inspection)',
    description:
      'Transformation Bridge anatomizing itself: every finding is a real element of this application, tagged by layer, anatomy view, and screen — including the honest list of things sitting in the wrong layer.',
    status: 'In Progress',
    illustrative: false,
  },
});

const appRows = await Promise.all(
  payload.apps.map((a, i) =>
    prisma.rationalizationApp.create({
      data: {
        ...scope,
        workspaceId: w.id,
        name: a.name,
        techStack: a.techStack,
        disposition: 'Retain',
        position: i,
        illustrative: false,
      },
    }),
  ),
);
const appIdByKey = Object.fromEntries(payload.apps.map((a, i) => [a.key, appRows[i].id]));
const frontendAppId = appIdByKey.frontend;

// Shared services (WR-15) — SHARED_SERVICE apps render in their own lane and
// receive the Relocate findings whose local implementation a call replaces.
const sharedRows = await Promise.all(
  payload.sharedServices.map((s, i) =>
    prisma.rationalizationApp.create({
      data: {
        ...scope,
        workspaceId: w.id,
        name: s.name,
        kind: 'SHARED_SERVICE',
        techStack: s.techStack,
        disposition: 'Retain',
        position: payload.apps.length + i,
        illustrative: false,
      },
    }),
  ),
);
const sharedIdByKey = Object.fromEntries(
  payload.sharedServices.map((s, i) => [s.key, sharedRows[i].id]),
);

await prisma.screenAsset.createMany({
  data: payload.screens.map((s) => ({
    ...scope,
    workspaceId: w.id,
    appId: frontendAppId,
    name: s.name,
    kind: s.kind,
    url: s.route, // relative route — the app itself IS the screen
  })),
});

// One "greenfield" target: TB is already the target-state implementation.
const svc = await prisma.rationalizationMicroservice.create({
  data: {
    ...scope,
    workspaceId: w.id,
    name: 'Transformation Bridge (target state)',
    kind: 'Application',
    status: 'Live',
    techStack: 'React 18 + Express + Prisma on Neon/Vercel',
    position: 0,
    illustrative: false,
  },
});
const componentIdByLayer: Record<string, string> = {};
for (const layer of LAYERS) {
  const c = await prisma.rationalizationComponent.create({
    data: {
      ...scope,
      workspaceId: w.id,
      layer,
      name: `${layer} — normalized`,
      destination: svc.name,
      microserviceId: svc.id,
      migrationStatus: 'Normalized',
      illustrative: false,
    },
  });
  componentIdByLayer[layer] = c.id;
}

await prisma.rationalizationCapability.createMany({
  data: payload.findings.map((f) => ({
    ...scope,
    workspaceId: w.id,
    appId: appIdByKey[f.app],
    layer: f.layer,
    view: f.view,
    category: f.category,
    name: f.name,
    plainSummary: f.plainSummary,
    codeRef: f.codeRef,
    screenRef: f.screenRef,
    capdan: f.capdan,
    // A relocation lands either in a shared service (WR-15) or a layer;
    // targetLayer drives the layer arrows and stays null for shared-service
    // relocations so a finding never draws both. The recommendation IS the
    // target until a human overrides it.
    sharedServiceId: f.sharedService ? (sharedIdByKey[f.sharedService] ?? null) : null,
    targetLayer: f.capdan === 'Relocate' && !f.sharedService ? f.recommendedLayer : null,
    recommendedLayer: f.recommendedLayer,
    rationale: f.rationale,
    treatment: f.capdan === 'Eliminate' ? 'Eliminate' : 'Retain',
    migrationStatus: f.capdan === 'Common' ? 'Normalized' : 'Identified',
    componentId: componentIdByLayer[f.layer] ?? null,
    illustrative: false,
  })),
});

const counts = {
  findings: payload.findings.length,
  misplaced: payload.findings.filter((f) => f.capdan !== 'Common').length,
  screens: payload.screens.length,
  sharedServices: payload.sharedServices.length,
  sharedRelocations: payload.findings.filter((f) => f.sharedService).length,
};
console.log(`Seeded "${WORKSPACE_NAME}":`, JSON.stringify(counts));
await prisma.$disconnect();
