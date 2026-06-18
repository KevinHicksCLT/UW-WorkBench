// VS-08 / VS-09 / VS-10 — drop the "/" alias from value-stream names (the slash
// was an alias, e.g. Submission-to-Bind IS the underwriting journey — one thing,
// two names). Renames the stream across every name-keyed surface: the legacy
// ValueStream row, its value_stream Node, the Level-tree L3 row (keyed by name),
// plus free-text references (ExternalInteraction.relatedValueStream,
// Role.primaryValueStream). FK-keyed links (SubValueStream, ProcessStep, Metric,
// RoleValueStream, ApplicationValueStream, RequirementValueStream, Deliverable,
// InitiativeValueStream) follow the id and need no change.
// Idempotent: applying a no-op rename (old==new already applied) is harmless.
//   npx tsx scripts/rename-value-streams.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RENAMES: { from: string; to: string }[] = [
  // Final label is "New Business Underwriting" (no parenthetical). Both prior
  // spellings map to it so this is correct on fresh prod and on proud-lab.
  { from: 'Submission-to-Bind / Underwriting', to: 'New Business Underwriting' },
  { from: 'New Business Underwriting (Submission-to-Bind)', to: 'New Business Underwriting' },
  { from: 'FinOps / Cloud Financial Management', to: 'FinOps (Cloud Financial Management)' },
  { from: 'MLOps / ML Lifecycle Management', to: 'MLOps (ML Lifecycle Management)' },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  for (const { from, to } of RENAMES) {
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name: from }, select: { id: true } });
    if (!vs) { console.log(`SKIP (not found): ${from}`); continue; }

    await prisma.valueStream.update({ where: { id: vs.id }, data: { name: to } });
    const node = await prisma.node.updateMany({ where: { companyId, typeKey: 'value_stream', code: vs.id }, data: { name: to } });
    const level = await prisma.level.updateMany({ where: { companyId, levelNumber: 3, name: from }, data: { name: to } });
    const ext = await prisma.externalInteraction.updateMany({ where: { companyId, relatedValueStream: from }, data: { relatedValueStream: to } });
    const role = await prisma.role.updateMany({ where: { companyId, primaryValueStream: from }, data: { primaryValueStream: to } });
    console.log(`Renamed "${from}" → "${to}"  (node:${node.count} level:${level.count} ext:${ext.count} role:${role.count})`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
