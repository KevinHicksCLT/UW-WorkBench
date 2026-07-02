// export-regs-for-classify.ts — offline (no-API) analog of enrich-regulations.ts.
// Dumps the SAME inputs the AI call would see (numbered role + value-stream
// catalogs, unprocessed source requirements) so MAX-plan subagents can do the
// decomposition, then apply-reg-decisions.ts writes them back identically.
//
// Run (cwd = backend):
//   npx tsx scripts/export-regs-for-classify.ts --out <dir> [--chunk 20]
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = opt('out'); if (!OUT) throw new Error('provide --out <dir>');
const CHUNK = Number(opt('chunk', '20')) || 20;

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  const cid = company!.id;

  // Value-stream catalog: L2 Division + L3 Process nodes (identical to enrich-regulations.ts)
  const plts = await prisma.processLevelType.findMany({ where: { companyId: cid }, select: { id: true, levelNumber: true } });
  const l2l3 = plts.filter((p) => p.levelNumber === 2 || p.levelNumber === 3).map((p) => p.id);
  const nodes = await prisma.processNode.findMany({
    where: { companyId: cid, processLevelTypeId: { in: l2l3 } },
    select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } }, parent: { select: { displayValue: true } } },
    orderBy: [{ sortOrder: 'asc' }],
  });
  const catNodes = nodes.map((n) => ({ id: n.id, label: `L${n.processLevelType.levelNumber} ${n.displayValue}${n.parent ? ` (in ${n.parent.displayValue})` : ''}` }));

  // Role catalog (identical ordering: displayValue asc)
  const roles = await prisma.role.findMany({ where: { companyId: cid }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } });

  // Unprocessed sources: ACTIVE, no role links, not derived (identical selection to enrich-regulations.ts, all jurisdictions)
  const sources = await prisma.regulatoryRequirement.findMany({
    where: { companyId: cid, status: 'ACTIVE', roleRegulations: { none: {} }, NOT: { sourceNote: { startsWith: 'derivedFrom:' } } },
    orderBy: [{ jurisdictionId: 'asc' }, { category: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, category: true, requirement: true, lineOfBusiness: true, citation: true, citationUrl: true, agentSkill: true, confidence: true, tenantId: true, jurisdictionId: true,
      jurisdiction: { select: { code: true, name: true, regulatorType: true } } },
  });

  // Persist catalogs (1-indexed refs = position+1)
  writeFileSync(join(OUT, 'roles.json'), JSON.stringify(roles, null, 0));
  writeFileSync(join(OUT, 'nodes.json'), JSON.stringify(catNodes, null, 0));
  const roleTxt = roles.map((r, i) => `${i + 1}. ${r.displayValue}`).join('\n');
  const nodeTxt = catNodes.map((n, i) => `${i + 1}. ${n.label}`).join('\n');
  writeFileSync(join(OUT, 'roles.txt'), roleTxt);
  writeFileSync(join(OUT, 'nodes.txt'), nodeTxt);

  // Chunk the sources for subagents
  const chunks: (typeof sources)[] = [];
  for (let i = 0; i < sources.length; i += CHUNK) chunks.push(sources.slice(i, i + CHUNK));
  chunks.forEach((c, k) => {
    const slim = c.map((s) => ({ id: s.id, title: s.title, category: s.category, requirement: s.requirement, jurCode: s.jurisdiction?.code, jurName: s.jurisdiction?.name, regulatorType: s.jurisdiction?.regulatorType }));
    writeFileSync(join(OUT, `sources-chunk-${String(k + 1).padStart(2, '0')}.json`), JSON.stringify(slim, null, 2));
  });
  // Full source detail (for the apply step: tenantId, citation, etc.)
  writeFileSync(join(OUT, 'sources-full.json'), JSON.stringify(sources, null, 0));

  console.log(`company: ${company!.name} (${cid})`);
  console.log(`roles: ${roles.length}  nodes(L2/L3): ${catNodes.length}  sources: ${sources.length}  chunks: ${chunks.length} (size ${CHUNK})`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
