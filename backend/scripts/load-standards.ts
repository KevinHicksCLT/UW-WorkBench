// load-standards.ts — load the regulatory-compliance standard packs (GDPR,
// CCPA/CPRA, NYDFS 23 NYCRR Part 500) into the operating model and attach each to
// its SDLC agent skill.
//
// Each pack (standards/<reg>-standards.json) becomes a CATEGORY under the existing
// "Cybersecurity & ISO" Standards area, one StandardItem per standard, mapped to
// the UI fields (name / description / Build·Run / owner) plus the regulatory
// traceability fields (agentSkill, sdlcGates, regCitation, appliesToValueStreams).
//
// Idempotent: clears the three regulatory categories for the company, then
// reloads them, and recomputes the area's item count. Run (cwd = backend):
//   npm run load:standards -w cascade-backend
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const STD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards');
// Renamed from "Cybersecurity & ISO" (defect backlog 02, D5.4 — no abbreviations).
const AREA = 'Information Security';

type RawStandard = {
  id: string; standard: string; whatItMeans: string; phase: string; responsibleRole: string;
  appliesToValueStreams?: string[]; sdlcGates?: string[];
  gdprArticles?: string[]; ccpaCitations?: string[]; nydfsSections?: string[];
};
type Pack = { area: string; category: string; accountableOwner: string; standards: RawStandard[] };

// regulation file → the SDLC agent skill that enforces it.
const PACKS: { file: string; skill: string }[] = [
  { file: 'gdpr-standards.json', skill: 'gdpr-sdlc-compliance' },
  { file: 'ccpa-cpra-standards.json', skill: 'ccpa-cpra-sdlc-compliance' },
  { file: 'nydfs-500-standards.json', skill: 'nydfs-500-sdlc-compliance' },
];

const join = (a?: string[]): string | null => (a && a.length ? a.join('; ') : null);
const citation = (s: RawStandard): string | null => join(s.gdprArticles ?? s.ccpaCitations ?? s.nydfsSections);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found');
  const { id: companyId, tenantId } = company;

  // Find or create the Cybersecurity & ISO area.
  let area = await prisma.standard.findFirst({ where: { companyId, department: AREA }, select: { id: true } });
  if (!area) {
    area = await prisma.standard.create({
      data: { tenantId, companyId, department: AREA, owner: 'CISO / ISO Security Architect', charterIncluded: true, illustrative: false, count: 0 },
      select: { id: true },
    });
    console.log(`Created Standards area "${AREA}".`);
  }

  for (const { file, skill } of PACKS) {
    const pack = JSON.parse(readFileSync(resolve(STD_DIR, 'skills', skill, 'data', file), 'utf8')) as Pack;
    // Idempotent reload of this regulatory category.
    const removed = await prisma.standardItem.deleteMany({ where: { standardId: area.id, category: pack.category } });
    let n = 0;
    for (const s of pack.standards) {
      await prisma.standardItem.create({
        data: {
          tenantId, companyId, standardId: area.id,
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
    console.log(`${pack.category}: removed ${removed.count}, loaded ${n} standards → skill "${skill}".`);
  }

  // Recompute the area's denormalized item count (drives /standards visibility).
  const total = await prisma.standardItem.count({ where: { standardId: area.id } });
  await prisma.standard.update({ where: { id: area.id }, data: { count: total } });
  console.log(`"${AREA}" now has ${total} standards.`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
