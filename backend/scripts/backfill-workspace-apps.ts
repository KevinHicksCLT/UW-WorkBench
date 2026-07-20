// backfill-workspace-apps.ts — put every Workspace board app into the estate
// catalog (Application) and wire the FKs so the catalog is the single source of
// truth for the Workspace map:
//   • each RationalizationApp gets an Application row (created if missing) via
//     applicationId,
//   • each RationalizationWorkspace.applicationId points at its primary
//     (position 0) app's catalog row,
//   • the legacy apps the boards decomposed are marked SCANNED with their real
//     repo URLs — the map only shows scanned applications.
// Idempotent: matches by name, only fills missing links/fields. DRY_RUN=1 to preview.
import { prisma } from '../src/db/prisma.js';

const DRY = process.env.DRY_RUN === '1';

// Repo/app URLs + descriptions for the seeded board apps. Shared services have
// no codebase to scan and stay NOT_SCANNED.
const APP_META: Record<
  string,
  { repoUrl?: string; appUrl?: string; description: string; kind?: string }
> = {
  openIMIS: {
    repoUrl: 'https://github.com/openimis/openimis-be_py',
    appUrl: 'https://demo.openimis.org',
    description:
      'Open-source insurance management information system — policies, insurees, claims and contributions for social health protection schemes.',
  },
  'OpenMRS Insurance Claims': {
    repoUrl: 'https://github.com/openmrs/openmrs-module-insuranceclaims',
    description:
      'OpenMRS module that captures clinical encounters and packages them as insurance claims for adjudication.',
  },
  'Transformation Bridge': {
    repoUrl: 'https://github.com/KevinHicksCLT/transform-platform',
    appUrl: 'http://localhost:5173',
    description:
      'The Transformation Bridge platform itself — React SPA + Express/Prisma API over the typed operating-model graph.',
  },
  'Identity & Access (shared authorization)': {
    kind: 'Service',
    description: 'Shared authorization service — authentication, roles and permissions.',
  },
  'Enterprise Reference Data (MDM/RDM)': {
    kind: 'Service',
    description: 'Shared master/reference data service — canonical codes and entities.',
  },
};

const norm = (s: string) => s.trim().toLowerCase();

const [workspaces, apps] = await Promise.all([
  prisma.rationalizationWorkspace.findMany({
    where: { domain: 'APPLICATION' },
    select: {
      id: true,
      name: true,
      companyId: true,
      applicationId: true,
      apps: {
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          kind: true,
          vendor: true,
          criticality: true,
          description: true,
          applicationId: true,
          position: true,
          illustrative: true,
        },
      },
    },
  }),
  prisma.application.findMany({ select: { id: true, name: true } }),
]);

const byName = new Map(apps.map((a) => [norm(a.name), a.id]));

for (const ws of workspaces) {
  console.log(`board "${ws.name}" (${ws.id})`);
  for (const rApp of ws.apps) {
    const meta = APP_META[rApp.name];
    let appId = byName.get(norm(rApp.name));
    if (!appId) {
      console.log(`  + create Application "${rApp.name}"`);
      if (!DRY) {
        const created = await prisma.application.create({
          data: {
            companyId: ws.companyId,
            name: rApp.name,
            kind: meta?.kind ?? (rApp.kind === 'SHARED_SERVICE' ? 'Service' : 'Tool'),
            vendor: rApp.vendor ?? 'In-house',
            criticality: rApp.criticality ?? 'Medium',
            description: meta?.description ?? rApp.description,
            illustrative: rApp.illustrative,
          },
          select: { id: true },
        });
        appId = created.id;
        byName.set(norm(rApp.name), appId);
      }
    }
    if (!appId) continue; // dry-run for a missing row

    // Legacy board columns have a scanned codebase; record it on the catalog row.
    if (rApp.kind === 'LEGACY' && meta?.repoUrl) {
      console.log(`  ~ mark "${rApp.name}" SCANNED (${meta.repoUrl})`);
      if (!DRY) {
        await prisma.application.update({
          where: { id: appId },
          data: {
            repoUrl: meta.repoUrl,
            appUrl: meta.appUrl ?? null,
            scanStatus: 'SCANNED',
            scannedAt: new Date(),
            description: meta.description,
          },
        });
      }
    }
    if (rApp.applicationId !== appId) {
      console.log(`  ~ link board app "${rApp.name}" -> ${appId}`);
      if (!DRY)
        await prisma.rationalizationApp.update({
          where: { id: rApp.id },
          data: { applicationId: appId },
        });
    }
  }
  // The board itself points at its primary (position 0) application.
  const primary = ws.apps[0];
  const primaryAppId = primary ? byName.get(norm(primary.name)) : undefined;
  if (primaryAppId && ws.applicationId !== primaryAppId) {
    console.log(`  ~ link board -> primary app "${primary.name}"`);
    if (!DRY)
      await prisma.rationalizationWorkspace.update({
        where: { id: ws.id },
        data: { applicationId: primaryAppId },
      });
  }
}

const scanned = await prisma.application.count({ where: { scanStatus: 'SCANNED' } });
const total = await prisma.application.count();
console.log(`${DRY ? '[dry-run] ' : ''}applications=${total} scanned=${scanned}`);
await prisma.$disconnect();
