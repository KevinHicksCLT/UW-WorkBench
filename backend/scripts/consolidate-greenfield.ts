// consolidate-greenfield.ts — one greenfield platform per Workspace board.
//
// Boards authored before the pattern change carried a separate greenfield
// service PER IT LAYER (five cards in the Greenfield column). The canonical
// shape is the Transformation Bridge one: a single greenfield platform whose
// layer components are slots inside it. For every APPLICATION-domain board
// with more than one microservice this script creates the single platform,
// repoints the layer components, and deletes the per-layer services.
// Idempotent: boards already on one microservice are untouched. DRY_RUN=1.
import { prisma } from '../src/db/prisma.js';

const DRY = process.env.DRY_RUN === '1';

// Live > Building > Planned — the platform reads as far along as its
// furthest layer.
const WEIGHT: Record<string, number> = { Planned: 0, Building: 1, Live: 2 };

const boards = await prisma.rationalizationWorkspace.findMany({
  where: { domain: 'APPLICATION' },
  select: {
    id: true,
    name: true,
    tenantId: true,
    companyId: true,
    businessProcess: true,
    microservices: { orderBy: { position: 'asc' } },
    components: { select: { id: true, layer: true, microserviceId: true } },
  },
});

for (const b of boards) {
  if (b.microservices.length <= 1) {
    console.log(`board "${b.name}": ${b.microservices.length} service — ok`);
    continue;
  }
  const label = b.businessProcess ?? b.name;
  const gfName = `${label} — Greenfield`;
  const best = [...b.microservices].sort(
    (x, y) => (WEIGHT[y.status] ?? 0) - (WEIGHT[x.status] ?? 0),
  )[0];
  console.log(
    `board "${b.name}": ${b.microservices.length} services -> "${gfName}" (status ${best.status})`,
  );
  if (DRY) continue;

  const gf = await prisma.rationalizationMicroservice.create({
    data: {
      id: `${b.id}_gf`,
      tenantId: b.tenantId,
      companyId: b.companyId,
      workspaceId: b.id,
      name: gfName,
      kind: 'Platform',
      status: best.status,
      techStack: best.techStack,
      ownerRoleId: best.ownerRoleId,
      targetDate: best.targetDate,
      position: 0,
      illustrative: b.microservices.every((m) => m.illustrative),
    },
  });
  await prisma.rationalizationComponent.updateMany({
    where: { workspaceId: b.id },
    data: { microserviceId: gf.id },
  });
  await prisma.rationalizationMicroservice.deleteMany({
    where: { workspaceId: b.id, id: { not: gf.id } },
  });
}

const after = await prisma.rationalizationWorkspace.findMany({
  where: { domain: 'APPLICATION' },
  select: { name: true, microservices: { select: { name: true, status: true } } },
});
console.log(JSON.stringify(after, null, 1));
await prisma.$disconnect();
