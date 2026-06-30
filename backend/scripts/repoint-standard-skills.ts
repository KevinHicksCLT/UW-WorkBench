import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { buildGroupings, skillName } from '../src/lib/skillPacks.js';

// Point each standard at its per-category generated skill pack (Standard.agentSkill).
// The packs themselves are no longer written to disk — they're generated on
// demand from these same standards (see lib/skillPacks.ts). This only maintains
// the standard→skill pointer the UI uses to link a standard to its pack.
// Idempotent.

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  let repointed = 0, packs = 0;
  for (const g of await buildGroupings(companyId)) {
    const r = await prisma.standard.updateMany({
      where: { companyId, isArea: false, category: g.category },
      data: { agentSkill: skillName(g.category) },
    });
    repointed += r.count;
    packs++;
  }
  console.log(`${company.name}: repointed ${repointed} standards across ${packs} category skills.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
