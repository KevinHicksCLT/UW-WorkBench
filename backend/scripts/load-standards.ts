// load-standards.ts — load the regulatory / standards packs into the operating model and
// attach each to its SDLC agent skill.
//
// Each pack (standards/skills/<skill>/data/<reg>-standards.json) becomes a CATEGORY under a
// Standards AREA, one StandardItem per standard, mapped to the UI fields (name / description /
// Build·Run / owner) plus the regulatory traceability fields (agentSkill, sdlcGates, regCitation,
// appliesToValueStreams).
//
// Packs now declare which area they belong to (the original three are infosec; SOX is Finance &
// Accounting; ACORD is Enterprise & Solution Architecture). Idempotent: clears each pack's category
// for the company, reloads it, and recomputes the item count of every area it touched. Run (cwd = backend):
//   npm run load:standards -w cascade-backend
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const STD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards');

type RawStandard = {
  id: string; standard: string; whatItMeans: string; phase: string; responsibleRole: string;
  appliesToValueStreams?: string[]; sdlcGates?: string[];
  gdprArticles?: string[]; ccpaCitations?: string[]; nydfsSections?: string[];
  soxSections?: string[]; acordCitations?: string[];
};
type Pack = { area: string; category: string; accountableOwner: string; standards: RawStandard[] };

// regulation file → the SDLC agent skill that enforces it + the Standards area it lands in.
// `area`/`owner` here are authoritative (the JSON `area` field is advisory and historically
// inconsistent), so the infosec packs keep landing under "Information Security" while the new
// packs route to their own areas.
const PACKS: { file: string; skill: string; area: string; owner: string }[] = [
  { file: 'gdpr-standards.json', skill: 'gdpr-sdlc-compliance', area: 'Information Security', owner: 'CISO / ISO Security Architect' },
  { file: 'ccpa-cpra-standards.json', skill: 'ccpa-cpra-sdlc-compliance', area: 'Information Security', owner: 'CISO / ISO Security Architect' },
  { file: 'nydfs-500-standards.json', skill: 'nydfs-500-sdlc-compliance', area: 'Information Security', owner: 'CISO / ISO Security Architect' },
  { file: 'sox-standards.json', skill: 'sox-itgc-sdlc-compliance', area: 'Finance & Accounting', owner: 'CFO / Controller' },
  { file: 'acord-standards.json', skill: 'acord-data-standards-compliance', area: 'Enterprise & Solution Architecture', owner: 'CTO / Enterprise Architect' },
];

const join = (a?: string[]): string | null => (a && a.length ? a.join('; ') : null);
const citation = (s: RawStandard): string | null =>
  join(s.gdprArticles ?? s.ccpaCitations ?? s.nydfsSections ?? s.soxSections ?? s.acordCitations);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found');
  const { id: companyId, tenantId } = company;

  // Ensure a Standards area exists; cache by department name so packs can share an area.
  const areaCache = new Map<string, string>();
  async function ensureArea(department: string, owner: string): Promise<string> {
    if (areaCache.has(department)) return areaCache.get(department)!;
    let area = await prisma.standard.findFirst({ where: { companyId, department }, select: { id: true } });
    if (!area) {
      area = await prisma.standard.create({
        data: { tenantId, companyId, department, owner, charterIncluded: true, illustrative: false, count: 0 },
        select: { id: true },
      });
      console.log(`Created Standards area "${department}".`);
    }
    areaCache.set(department, area.id);
    return area.id;
  }

  for (const { file, skill, area: areaName, owner } of PACKS) {
    const pack = JSON.parse(readFileSync(resolve(STD_DIR, 'skills', skill, 'data', file), 'utf8')) as Pack;
    const areaId = await ensureArea(areaName, owner);
    // Idempotent reload of this pack's category.
    const removed = await prisma.standardItem.deleteMany({ where: { standardId: areaId, category: pack.category } });
    let n = 0;
    for (const s of pack.standards) {
      await prisma.standardItem.create({
        data: {
          tenantId, companyId, standardId: areaId,
          category: pack.category,
          name: s.standard,
          description: s.whatItMeans,
          buildRun: s.phase || null,
          ownerRole: s.responsibleRole || null,
          agentSkill: skill,
          sdlcGates: join(s.sdlcGates),
          regCitation: citation(s),
          appliesToValueStreams: join(s.appliesToValueStreams),
        },
      });
      n++;
    }
    console.log(`${areaName} › ${pack.category}: removed ${removed.count}, loaded ${n} standards → skill "${skill}".`);
  }

  // Recompute the denormalized item count for every area we touched (drives /standards visibility).
  for (const [department, areaId] of areaCache) {
    const total = await prisma.standardItem.count({ where: { standardId: areaId } });
    await prisma.standard.update({ where: { id: areaId }, data: { count: total } });
    console.log(`"${department}" now has ${total} standards.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
