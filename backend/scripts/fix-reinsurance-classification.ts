// Re-home the reinsurance value streams and simplify their names.
//   - They were mis-filed under the CLAIMS division. Ceded/assumed reinsurance
//     and retrocession are risk-transfer / underwriting functions, not claims —
//     move all three to the UNDERWRITING division (Node graph + Level tree).
//   - Drop the "Outward (...)" / "Assumed (Inward)" dual-naming; keep the precise
//     industry term (Ceded / Assumed).
// Updates every name-keyed surface (ValueStream, value_stream Node, Level L3,
// ExternalInteraction.relatedValueStream, Role.primaryValueStream). FK-keyed
// children (SubValueStream, ProcessStep, links) follow the id. Idempotent: finds
// each stream by its old OR new name and re-applies harmlessly.
//   npx tsx scripts/fix-reinsurance-classification.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ITEMS: { names: string[]; to: string }[] = [
  { names: ['Outward (Ceded) Reinsurance Management', 'Ceded Reinsurance Management'], to: 'Ceded Reinsurance Management' },
  { names: ['Assumed (Inward) Reinsurance Underwriting', 'Assumed Reinsurance Underwriting'], to: 'Assumed Reinsurance Underwriting' },
  { names: ['Retrocession Management'], to: 'Retrocession Management' },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  const uwNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'division', name: 'Underwriting' }, select: { id: true } });
  const uwLevel = await prisma.level.findFirst({ where: { companyId, levelNumber: 2, name: 'Underwriting' }, select: { id: true } });
  if (!uwNode || !uwLevel) throw new Error('Underwriting division node/level not found');

  for (const item of ITEMS) {
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name: { in: item.names } }, select: { id: true, name: true } });
    if (!vs) { console.log('SKIP (not found):', item.names[0]); continue; }
    const from = vs.name;

    // Rename (no-op if already at target)
    if (from !== item.to) {
      await prisma.valueStream.update({ where: { id: vs.id }, data: { name: item.to } });
      await prisma.node.updateMany({ where: { companyId, typeKey: 'value_stream', code: vs.id }, data: { name: item.to } });
      await prisma.level.updateMany({ where: { companyId, levelNumber: 3, name: from }, data: { name: item.to } });
      await prisma.externalInteraction.updateMany({ where: { companyId, relatedValueStream: from }, data: { relatedValueStream: item.to } });
      await prisma.role.updateMany({ where: { companyId, primaryValueStream: from }, data: { primaryValueStream: item.to } });
    }

    // Re-home to Underwriting: value_stream Node parent + Level-L3 parent
    const node = await prisma.node.updateMany({ where: { companyId, typeKey: 'value_stream', code: vs.id }, data: { parentId: uwNode.id } });
    const level = await prisma.level.updateMany({ where: { companyId, levelNumber: 3, name: item.to }, data: { parentId: uwLevel.id } });
    console.log(`"${from}" → "${item.to}", re-homed to Underwriting (node:${node.count} level:${level.count})`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
