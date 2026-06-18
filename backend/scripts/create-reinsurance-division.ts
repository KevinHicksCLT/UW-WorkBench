// G-04 — give Reinsurance its own division (L2). The three reinsurance value
// streams sat under the Underwriting division; reinsurance is a distinct
// risk-transfer function with its own L3 process areas, so create a dedicated
// "Reinsurance" division (Node graph + Level tree) under the Core Business
// segment and move Ceded / Assumed / Retrocession under it. Idempotent.
//   npx tsx scripts/create-reinsurance-division.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const STREAMS = ['Ceded Reinsurance Management', 'Assumed Reinsurance Underwriting', 'Retrocession Management'];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  const uwNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'division', name: 'Underwriting' }, select: { parentId: true, sortOrder: true } });
  const uwLevel = await prisma.level.findFirst({ where: { companyId, levelNumber: 2, name: 'Underwriting' }, select: { parentId: true } });
  if (!uwNode?.parentId || !uwLevel?.parentId) throw new Error('Underwriting division parent not found');

  // Create (or reuse) the Reinsurance division node + level.
  let divNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'division', name: 'Reinsurance' }, select: { id: true } });
  if (!divNode) {
    divNode = await prisma.node.create({ data: { companyId, typeKey: 'division', name: 'Reinsurance', parentId: uwNode.parentId, provenance: 'real', sortOrder: (uwNode.sortOrder ?? 0) + 1 } });
  }
  let divLevel = await prisma.level.findFirst({ where: { companyId, levelNumber: 2, name: 'Reinsurance' }, select: { id: true } });
  if (!divLevel) {
    divLevel = await prisma.level.create({ data: { tenantId, companyId, levelNumber: 2, name: 'Reinsurance', parentId: uwLevel.parentId, sourceType: 'division' } });
  }

  let moved = 0;
  for (const name of STREAMS) {
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name }, select: { id: true } });
    if (!vs) { console.log('SKIP (not found):', name); continue; }
    await prisma.node.updateMany({ where: { companyId, typeKey: 'value_stream', code: vs.id }, data: { parentId: divNode.id } });
    await prisma.level.updateMany({ where: { companyId, levelNumber: 3, name }, data: { parentId: divLevel.id } });
    moved++;
  }
  console.log(`Reinsurance division created; moved ${moved} streams under it (node + level).`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
