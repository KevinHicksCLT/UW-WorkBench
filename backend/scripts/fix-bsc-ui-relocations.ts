// Re-point the UI-layer relocations on the "Broker Submission Channels" board:
//   - Business validations  → Business Service (was → Integration)
//   - Session state         → Integration       (was Eliminate)
// so the UI row shows two relocation arrows: Session state → Integration and
// Business validations → Business Service. Matches the updated
// seed-rationalization-examples.ts definitions.
//
// Idempotent: plain updateMany on the matching categories. Safe to re-run;
// replay on prod alongside the other defect-fix scripts.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.rationalizationWorkspace.findMany({
    where: { name: 'Broker Submission Channels' },
    select: { id: true, name: true },
  });
  if (workspaces.length === 0) { console.log('No "Broker Submission Channels" workspace found — nothing to do.'); return; }

  for (const ws of workspaces) {
    const validations = await prisma.rationalizationCapability.updateMany({
      where: { workspaceId: ws.id, layer: 'UI', category: 'Business validations' },
      data: {
        capdan: 'Relocate', targetLayer: 'Business Service', treatment: 'Retain', componentId: null,
        migrationApproach: 'Enforce licensing and appetite checks in the producer domain service.',
        rationale: 'Regulated channel checks must live server-side in the domain service.',
      },
    });
    const session = await prisma.rationalizationCapability.updateMany({
      where: { workspaceId: ws.id, layer: 'UI', category: 'Session state' },
      data: {
        capdan: 'Relocate', targetLayer: 'Integration', treatment: 'Retain', componentId: null,
        migrationApproach: 'Move wizard state behind the gateway as resumable submission sessions.',
        rationale: 'Server-session wizard state blocks scale-out — it belongs in the integration tier.',
      },
    });
    console.log(`${ws.id}: Business validations → Business Service (${validations.count} rows), Session state → Integration (${session.count} rows)`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
