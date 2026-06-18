// Map fix — the map flow drills value_stream -> sub_process (L4) -> step (L5)
// via the Node graph. Rebuilt streams had sub_process nodes but no `step` child
// nodes, so their L4 chevrons were dead-ends ("no PL5 steps"). This mirrors each
// ProcessStep into a Node typeKey='step' under its L4 sub_process node (matching
// the reinsurance streams). Idempotent: rebuilds step nodes for any L4 missing
// them.
//   npx tsx scripts/sync-step-nodes.ts [streamName]
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;
  const only = process.argv[2];

  const streams = await prisma.valueStream.findMany({ where: { companyId, ...(only ? { name: only } : {}) }, select: { id: true, name: true } });
  let created = 0, fixedStreams = 0;
  for (const vs of streams) {
    // sub_process (L4) nodes for this stream, keyed by the L4 name (= SubValueStream.name)
    const l4ids = (await prisma.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 4 }, select: { id: true } })).map((x) => x.id);
    if (!l4ids.length) continue;
    const l4nodes = await prisma.node.findMany({ where: { companyId, typeKey: 'sub_process', code: { in: l4ids } }, select: { id: true, name: true } });
    const nodeByL4Name = new Map(l4nodes.map((n) => [n.name, n.id]));
    let streamCreated = 0;
    for (const l4node of l4nodes) {
      const existing = await prisma.node.count({ where: { typeKey: 'step', parentId: l4node.id } });
      if (existing > 0) continue;
      const steps = await prisma.processStep.findMany({ where: { valueStreamId: vs.id, l4: l4node.name }, orderBy: { stepNumber: 'asc' }, select: { name: true, code: true, stepNumber: true, inputs: true, outputs: true } });
      for (const s of steps) {
        await prisma.node.create({ data: { companyId, typeKey: 'step', name: s.name, code: s.code, parentId: l4node.id, provenance: 'real', sortOrder: s.stepNumber ?? 0, attributes: { inputs: s.inputs, outputs: s.outputs } } });
        created++; streamCreated++;
      }
    }
    if (streamCreated) { fixedStreams++; console.log(`  ${vs.name}: +${streamCreated} step nodes`); }
  }
  console.log(`Created ${created} step nodes across ${fixedStreams} streams.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
