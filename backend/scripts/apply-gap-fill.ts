// apply-gap-fill.ts — inserts researched tasks / checklist items / value-stream
// I/O for roles that have none, from a generated+verified content file
// (gap-fill-content.json at the repo root: [{ roleId, name, tasks:[{text,category}],
// checklist:[{text,category}], inputs?, outputs? }]).
//
// Provenance: injected rows are stamped sourceSheet='backfill' (same convention
// as backfill-roles.ts — synthesized, not from the workbook). Idempotent: a role
// that already has tasks / checklist items / outputs is skipped per-section.
//
// Run from backend/:  npx tsx scripts/apply-gap-fill.ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type GenRole = { roleId: string; name: string; tasks: { text: string; category: string }[]; checklist: { text: string; category: string }[]; inputs?: string; outputs?: string };

// Seniority → participation type (mirrors backfill-roles.ts).
function nameRank(name: string): number {
  const n = name.toLowerCase();
  if (/\bchief\b|\bceo\b|^president\b/.test(n)) return 0;
  if (/\bhead\b|\bofficer\b|general counsel|\bcontroller\b|\bdirector\b|\bvp\b/.test(n)) return 1;
  if (/\bmanager\b|\blead\b|\bprincipal\b|\bsupervisor\b/.test(n)) return 2;
  return 3;
}
const PART_BY_RANK = ['Oversight', 'Oversight', 'Lead', 'Core'];

async function main() {
  const generated: GenRole[] = JSON.parse(readFileSync(new URL('../../documents/gap-fill-content.json', import.meta.url), 'utf8'));
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found.');
  const { id: companyId, tenantId } = company;
  console.log(`Applying gap-fill content for ${company.name}: ${generated.length} roles`);

  const categories = await prisma.category.findMany({ where: { companyId }, select: { id: true, name: true } });
  const catId = new Map(categories.map((c) => [c.name, c.id] as const));

  // Division-ranked value streams (for roles with no VS link at all) — same
  // ranking as backfill-roles.ts: streams most-linked by sibling roles first.
  const links = await prisma.roleValueStream.findMany({
    where: { role: { companyId } },
    select: { valueStreamId: true, role: { select: { divisionId: true } }, valueStream: { select: { name: true } } },
  });
  const vsByDivision = new Map<string, Map<string, { name: string; count: number }>>();
  const globalCounts = new Map<string, { name: string; count: number }>();
  for (const l of links) {
    const g = globalCounts.get(l.valueStreamId) ?? { name: l.valueStream.name, count: 0 };
    g.count++; globalCounts.set(l.valueStreamId, g);
    const div = l.role.divisionId;
    if (!div) continue;
    if (!vsByDivision.has(div)) vsByDivision.set(div, new Map());
    const m = vsByDivision.get(div)!;
    const e = m.get(l.valueStreamId) ?? { name: l.valueStream.name, count: 0 };
    e.count++; m.set(l.valueStreamId, e);
  }
  const topVs = (divId: string | null) => {
    const ranked = divId ? [...(vsByDivision.get(divId)?.entries() ?? [])].sort((a, b) => b[1].count - a[1].count) : [];
    const hit = ranked[0] ?? [...globalCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    return hit ? { id: hit[0], name: hit[1].name } : null;
  };

  let tasksIns = 0, checksIns = 0, rvsCreated = 0, rvsUpdated = 0, skipped = 0, unknownCat = 0;
  for (const g of generated) {
    const role = await prisma.role.findFirst({
      where: { id: g.roleId, companyId },
      select: { id: true, name: true, divisionId: true, _count: { select: { roleTasks: true, checklistItems: true } }, valueStreamLinks: { select: { id: true, inputs: true, outputs: true } } },
    });
    if (!role) { console.warn(`   ! role ${g.roleId} (${g.name}) not found — skipped`); skipped++; continue; }

    const resolveCat = (name: string) => {
      const id = catId.get(name);
      if (!id) unknownCat++;
      return id ?? catId.get('Other') ?? null;
    };

    if (role._count.roleTasks === 0 && g.tasks?.length) {
      await prisma.roleTask.createMany({
        data: g.tasks.map((t) => ({ tenantId, roleId: role.id, categoryId: resolveCat(t.category), text: t.text, sourceSheet: 'backfill' })),
      });
      tasksIns += g.tasks.length;
    }
    if (role._count.checklistItems === 0 && g.checklist?.length) {
      await prisma.checklistItem.createMany({
        data: g.checklist.map((c) => ({ tenantId, roleId: role.id, categoryId: resolveCat(c.category), text: c.text, sourceSheet: 'backfill' })),
      });
      checksIns += g.checklist.length;
    }

    // Deliverables on the role page come from RoleValueStream.outputs.
    if (g.outputs && !role.valueStreamLinks.some((l) => l.outputs)) {
      const existing = role.valueStreamLinks[0];
      if (existing) {
        await prisma.roleValueStream.update({
          where: { id: existing.id },
          data: { inputs: existing.inputs ?? g.inputs ?? null, outputs: g.outputs },
        });
        rvsUpdated++;
      } else {
        const vs = topVs(role.divisionId);
        if (vs) {
          await prisma.roleValueStream.create({
            data: {
              tenantId, roleId: role.id, valueStreamId: vs.id,
              participationType: PART_BY_RANK[nameRank(role.name)], subStream: null,
              inputs: g.inputs ?? null, outputs: g.outputs, sourceSheet: 'backfill',
            },
          });
          rvsCreated++;
        }
      }
    }
  }
  if (unknownCat) console.warn(`   ! ${unknownCat} unknown category names mapped to 'Other'`);
  console.log(`   + ${tasksIns} tasks, ${checksIns} checklist items, ${rvsCreated} VS links created, ${rvsUpdated} VS links given I/O; ${skipped} roles skipped`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
