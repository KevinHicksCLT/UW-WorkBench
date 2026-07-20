import { prisma } from '../src/db/prisma.js';

// Workspace board cleanup (SCRUM-134 follow-up): the Transformation Bridge
// self-anatomy board scanned ONE application in two tiers (React SPA +
// Express API), but the compare picker treats each RationalizationApp as a
// separate application. Merge the two tier rows into one "Transformation
// Bridge" app — the tier split stays fully encoded by the findings' IT layers
// — and wire the board to the Technology & Engineering value stream so the
// picker's domain/value-stream filters can scope it. Idempotent.

const TECH_ENG_VS = 'bb67119f-5481-4e4b-9314-0a46acae47e6'; // L2 under Technology

const ws = await prisma.rationalizationWorkspace.findFirst({
  where: { application: 'Transformation Bridge' },
  include: { apps: { where: { kind: 'LEGACY' }, orderBy: { position: 'asc' } } },
});
if (!ws) throw new Error('Transformation Bridge workspace not found');

if (ws.apps.length > 1) {
  const [keep, ...rest] = ws.apps;
  const restIds = rest.map((a) => a.id);
  const techStack = [keep, ...rest]
    .map((a) => a.techStack)
    .filter(Boolean)
    .join(' + ');
  await prisma.$transaction([
    prisma.rationalizationCapability.updateMany({
      where: { appId: { in: restIds } },
      data: { appId: keep.id },
    }),
    prisma.rationalizationCapability.updateMany({
      where: { sharedServiceId: { in: restIds } },
      data: { sharedServiceId: keep.id },
    }),
    prisma.screenAsset.updateMany({
      where: { appId: { in: restIds } },
      data: { appId: keep.id },
    }),
    prisma.rationalizationApp.deleteMany({ where: { id: { in: restIds } } }),
    prisma.rationalizationApp.update({
      where: { id: keep.id },
      data: { name: 'Transformation Bridge', techStack },
    }),
  ]);
  console.log(`merged ${rest.length + 1} tier apps into "${keep.id}" (Transformation Bridge)`);
} else {
  console.log('apps already merged:', ws.apps.map((a) => a.name).join(', '));
}

// Estate catalog: the scan backfill created per-tier Application rows ("TB
// Frontend (React SPA)" / "TB Backend (Express API)") alongside the real
// "Transformation Bridge" estate row. Fold the tier rows' scan block onto the
// real row, repoint the board links, and drop the tier rows.
const canonical = await prisma.application.findFirst({
  where: { name: 'Transformation Bridge' },
  select: { id: true, scanStatus: true },
});
const tierRows = await prisma.application.findMany({
  where: { name: { in: ['TB Frontend (React SPA)', 'TB Backend (Express API)'] } },
  select: { id: true, name: true, repoUrl: true, appUrl: true, description: true, scannedAt: true },
});
if (canonical && tierRows.length > 0) {
  const src = tierRows[0];
  await prisma.$transaction([
    prisma.application.update({
      where: { id: canonical.id },
      data: {
        scanStatus: 'SCANNED',
        repoUrl: src.repoUrl,
        appUrl: src.appUrl,
        scannedAt: src.scannedAt ?? new Date(),
      },
    }),
    prisma.rationalizationApp.updateMany({
      where: { applicationId: { in: tierRows.map((t) => t.id) } },
      data: { applicationId: canonical.id },
    }),
    prisma.rationalizationWorkspace.updateMany({
      where: { applicationId: { in: tierRows.map((t) => t.id) } },
      data: { applicationId: canonical.id },
    }),
    prisma.application.deleteMany({ where: { id: { in: tierRows.map((t) => t.id) } } }),
  ]);
  console.log(`catalog: folded ${tierRows.length} tier rows into "Transformation Bridge"`);
} else {
  console.log('catalog already consolidated');
}

if (ws.valueStreamNodeId !== TECH_ENG_VS) {
  await prisma.rationalizationWorkspace.update({
    where: { id: ws.id },
    data: { valueStreamNodeId: TECH_ENG_VS },
  });
  console.log('workspace wired to Technology & Engineering value stream');
} else {
  console.log('value stream already wired');
}

await prisma.$disconnect();
