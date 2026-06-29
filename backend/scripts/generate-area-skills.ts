import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { generatedPackFiles, skillName, type Grouping, type Control } from '../src/lib/skillPacks.js';

// Generate one in-depth agent skill PER (area, category) for EVERY standards area
// — the same generated pack format as all skills. Packs are persisted to the
// SkillFile table (DB, not local disk); each standard's `agentSkill` pointer is
// repointed to its area+category skill (e.g. "actuarial-pricing-sdlc-compliance").
// Slug prefix = slugify(area.department) so the UI can strip it in-context
// (see frontend/src/lib/skills.ts skillLabel). Idempotent.

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

type Node = {
  id: string; name: string; description: string | null; isArea: boolean; parentId: string | null;
  department: string | null; category: string | null;
  testProcedure: string | null; evidence: string | null; ownerLabel: string | null;
  buildRun: string | null; regCitation: string | null;
  nodeStandards: { processNode: { displayValue: string } | null }[];
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const cid = company.id;

  const all = (await prisma.standard.findMany({
    where: { companyId: cid },
    select: {
      id: true, name: true, description: true, isArea: true, parentId: true, department: true, category: true,
      testProcedure: true, evidence: true, ownerLabel: true, buildRun: true, regCitation: true,
      nodeStandards: { select: { processNode: { select: { displayValue: true } } } },
    },
  })) as Node[];

  const byId = new Map(all.map((n) => [n.id, n]));
  const childrenOf = new Map<string, Node[]>();
  for (const n of all) if (n.parentId) (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
  const isLeaf = (n: Node) => !childrenOf.has(n.id);

  // Resolve a node's category by walking up to the first non-null category (not past the area).
  const resolveCat = (n: Node): string | null => {
    let cur: Node | undefined = n;
    while (cur && !cur.isArea) { if (cur.category) return cur.category; cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return null;
  };
  // Collect every non-area descendant of an area.
  const descendants = (areaId: string): Node[] => {
    const out: Node[] = [];
    const stack = [...(childrenOf.get(areaId) ?? [])];
    while (stack.length) { const n = stack.pop()!; out.push(n); for (const c of childrenOf.get(n.id) ?? []) stack.push(c); }
    return out;
  };

  const areas = all.filter((n) => n.isArea);
  console.log(`${company.name}: ${areas.length} areas\n`);

  let totSkills = 0, totFiles = 0, totRepointed = 0;
  for (const area of areas.sort((a, b) => a.name.localeCompare(b.name))) {
    const areaName = area.department || area.name; // prefix the UI strips
    const desc = descendants(area.id);
    // controls = leaves grouped by resolved category
    const byCat = new Map<string, { cat: string; controls: Control[]; ids: string[] }>();
    const repointIds = new Map<string, string[]>(); // skill → standard ids (groups + leaves)
    for (const n of desc) {
      const cat = resolveCat(n);
      if (!cat) { console.warn(`  ! ${area.name}: node without category: ${n.name}`); continue; }
      const skill = skillName(`${areaName} ${cat}`);
      (repointIds.get(skill) ?? repointIds.set(skill, []).get(skill)!).push(n.id);
      if (isLeaf(n)) {
        if (!byCat.has(cat)) byCat.set(cat, { cat, controls: [], ids: [] });
        const g = byCat.get(cat)!;
        g.controls.push({
          name: n.name, description: n.description ?? '', testProcedure: n.testProcedure, evidence: n.evidence,
          ownerLabel: n.ownerLabel, buildRun: n.buildRun, regCitation: n.regCitation,
          department: n.department ?? areaName,
          valueStreams: n.nodeStandards.map((ns) => ns.processNode?.displayValue).filter((v): v is string => !!v),
        });
      }
    }

    let areaSkills = 0;
    for (const { cat, controls } of [...byCat.values()].sort((a, b) => a.cat.localeCompare(b.cat))) {
      if (!controls.length) continue;
      const label = `${areaName} ${cat}`;
      const skill = skillName(label);
      const departments = [...new Set(controls.map((c) => c.department))].sort();
      const grouping: Grouping = { category: label, departments, controls };
      const files = generatedPackFiles(grouping);
      await prisma.skillFile.deleteMany({ where: { companyId: cid, skill } });
      await prisma.skillFile.createMany({ data: files.map((f) => ({ companyId: cid, skill, path: f.path, content: f.content, bytes: bytes(f.content) })) });
      totFiles += files.length; areaSkills++;
    }
    // Repoint all descendants (leaves + group containers) to their category skill.
    let areaRepointed = 0;
    for (const [skill, ids] of repointIds) {
      const r = await prisma.standard.updateMany({ where: { id: { in: ids } }, data: { agentSkill: skill } });
      areaRepointed += r.count;
    }
    totSkills += areaSkills; totRepointed += areaRepointed;
    console.log(`  ${area.name}: ${areaSkills} skills, ${areaRepointed} standards repointed`);
  }

  console.log(`\nDone: ${totSkills} skills, ${totFiles} SkillFile rows, ${totRepointed} standards repointed.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
