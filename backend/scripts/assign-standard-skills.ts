// assign-standard-skills.ts — give every enriched leaf Standard its OWN tailored
// agent skill (Standard.agentSkill = per-standard slug). The pack itself is built
// on demand from the standard row (lib/skillPacks.ts → generatedStandardPackFiles),
// so this only sets the resolvable slug. Category skills remain derivable from the
// category name (the Standards UI still surfaces them at the category header).
//
// Idempotent: only sets leaves whose agentSkill isn't already the per-standard
// slug. Area-scoped like the enrichment.
//   npx tsx scripts/assign-standard-skills.ts --area "Information Security"
//   npx tsx scripts/assign-standard-skills.ts            # every enriched leaf
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { standardSkillName } from '../src/lib/skillPacks.js';

const args = process.argv.slice(2);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const AREA = opt('area', '');
const COMPANY = opt('company', '');

async function main() {
  const company = await prisma.company.findFirst({ where: COMPANY ? { id: COMPANY } : {}, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('no company');
  const leaves = await prisma.standard.findMany({
    where: { companyId: company.id, isArea: false, children: { none: {} }, ...(AREA ? { department: AREA } : {}) },
    select: { id: true, name: true, department: true, category: true, agentSkill: true },
  });
  let set = 0, coll = new Map<string, number>();
  for (const l of leaves) {
    const slug = standardSkillName(l.department, l.category, l.name);
    coll.set(slug, (coll.get(slug) ?? 0) + 1);
    if (l.agentSkill !== slug) { await prisma.standard.update({ where: { id: l.id }, data: { agentSkill: slug } }); set++; }
  }
  const dupes = [...coll.entries()].filter(([, n]) => n > 1);
  console.log(`${company.name}: assigned per-standard skill to ${set}/${leaves.length} leaves${AREA ? ` (area="${AREA}")` : ''}`);
  if (dupes.length) console.log(`⚠ slug collisions (${dupes.length}): ${dupes.map(([s, n]) => `${s}×${n}`).join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
