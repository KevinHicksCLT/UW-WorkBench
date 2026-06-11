import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02 final pass — why does the VS list show 29 streams while the
// Home tile says 36? Compare the unified-graph value_stream nodes against what
// /explorer/tree exposes (streams parented under divisions).

async function main() {
  const all = await prisma.node.findMany({
    where: { typeKey: 'value_stream' },
    select: { id: true, name: true, parentId: true, parent: { select: { name: true, typeKey: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(`value_stream nodes: ${all.length}`);
  const byParentType = new Map<string, number>();
  for (const n of all) byParentType.set(n.parent?.typeKey ?? '(none)', (byParentType.get(n.parent?.typeKey ?? '(none)') ?? 0) + 1);
  console.log('Parent types: ' + [...byParentType.entries()].map(([t, n]) => `${t}=${n}`).join(', '));
  const notDivision = all.filter((n) => n.parent?.typeKey !== 'division');
  console.log('\nStreams NOT parented under a division:');
  for (const n of notDivision) console.log(`  ${n.name}  (parent: ${n.parent ? `${n.parent.name} [${n.parent.typeKey}]` : 'none'})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
