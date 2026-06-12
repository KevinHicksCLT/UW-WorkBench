// dump-standards.ts — export every StandardItem (with its area) to JSON so the
// standards-decomposition content can be authored offline. Read-only.
//   npx tsx scripts/dump-standards.ts > ../standards/standards-dump.json
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const areas = await prisma.standard.findMany({
    where: { count: { gt: 0 } },
    orderBy: { department: 'asc' },
    select: {
      id: true, department: true, count: true,
      items: {
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, category: true, name: true, description: true, buildRun: true,
          ownerRole: true, relatedRole: true, relatedCategory: true,
          agentSkill: true, sdlcGates: true, regCitation: true, appliesToValueStreams: true,
        },
      },
    },
  });
  process.stdout.write(JSON.stringify(areas, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
