// One-off: mark the Transformation Bridge rationalization board 100% migrated
// with a prior go-live target (2026-07-01). Idempotent — re-running is a no-op.
import { prisma } from '../src/db/prisma.js';

const TARGET = new Date('2026-07-01T00:00:00.000Z');

async function main() {
  const ws = await prisma.rationalizationWorkspace.findFirst({
    where: { application: { contains: 'Transformation Bridge' } },
    select: { id: true, application: true },
  });
  if (!ws) {
    console.error('No Transformation Bridge workspace found');
    process.exit(1);
  }

  const comps = await prisma.rationalizationComponent.updateMany({
    where: { workspaceId: ws.id },
    data: { migrationStatus: 'Migrated', targetDate: TARGET },
  });
  const caps = await prisma.rationalizationCapability.updateMany({
    where: { workspaceId: ws.id },
    data: { migrationStatus: 'Migrated' },
  });
  const svc = await prisma.rationalizationMicroservice.updateMany({
    where: { workspaceId: ws.id },
    data: { status: 'Live', targetDate: TARGET },
  });

  console.log(
    `Board "${ws.application}" → ${comps.count} components + ${caps.count} capabilities Migrated, ` +
      `${svc.count} microservices Live, target ${TARGET.toISOString().slice(0, 10)}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
