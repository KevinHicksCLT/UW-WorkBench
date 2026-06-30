// merge-corp-ops.ts — merge the duplicate L2 divisions "Corporate Operations" +
// "Corporate Functions Operations" (both under Corporate Functions, identical L3/L4
// structure) into one. Keep the larger node, fold the smaller's L5 tasks into the
// matching L4 (skip exact-text dups), delete the smaller subtree, rename keeper to
// "Corporate Operations". Then rebuild closure. Run reorder-tree.ts afterwards.
// Run (cwd=backend): npx tsx scripts/merge-corp-ops.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { processClosure } from '../src/lib/closure.js';

const norm = (s: any) => String(s ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const plt = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const PL = Object.fromEntries(plt.map((x) => [x.id, x.levelNumber]));
  const all = await prisma.processNode.findMany({ where: { companyId: c }, select: { id: true, displayValue: true, parentId: true, processLevelTypeId: true } });
  const lvl = (id: string) => PL[byId.get(id)!.processLevelTypeId];
  const byId = new Map(all.map((n) => [n.id, n]));
  const kids = (pid: string) => all.filter((n) => n.parentId === pid);

  const l2s = all.filter((n) => PL[n.processLevelTypeId] === 2 && ['Corporate Operations', 'Corporate Functions Operations'].includes(n.displayValue));
  if (l2s.length < 2) { console.log('Fewer than 2 duplicate divisions found — nothing to merge.'); await prisma.$disconnect(); return; }
  const subtreeSize = (pid: string) => all.filter((n) => { let x: typeof n | undefined = n; while (x) { if (x.id === pid) return true; x = x.parentId ? byId.get(x.parentId) : undefined; } return false; }).length;
  l2s.sort((a, b) => subtreeSize(b.id) - subtreeSize(a.id));
  const keep = l2s[0], drop = l2s[1];
  console.log(`keep="${keep.displayValue}" (${keep.id.slice(0,8)}), drop="${drop.displayValue}" (${drop.id.slice(0,8)})`);

  // keep L4 index by "l3name|l4name"; keep L5 text set per keep-L4
  const keepL3 = kids(keep.id);
  const keepL4ByKey = new Map<string, string>();
  const keepTextByL4 = new Map<string, Set<string>>();
  for (const l3 of keepL3) for (const l4 of kids(l3.id)) {
    keepL4ByKey.set(`${norm(l3.displayValue)}|${norm(l4.displayValue)}`, l4.id);
    keepTextByL4.set(l4.id, new Set(kids(l4.id).map((l5) => norm(l5.displayValue))));
  }

  // walk drop: move its L5s into matching keep-L4 (skip exact dups)
  const moves: [string, string][] = []; // [l5Id, targetL4Id]
  const dupL5: string[] = [];
  let unmatched = 0;
  for (const l3 of kids(drop.id)) for (const l4 of kids(l3.id)) {
    const key = `${norm(l3.displayValue)}|${norm(l4.displayValue)}`;
    const target = keepL4ByKey.get(key);
    if (!target) { unmatched += kids(l4.id).length; continue; }
    const seen = keepTextByL4.get(target)!;
    for (const l5 of kids(l4.id)) {
      const t = norm(l5.displayValue);
      if (seen.has(t)) dupL5.push(l5.id);
      else { moves.push([l5.id, target]); seen.add(t); }
    }
  }
  console.log(`drop L5: move ${moves.length}, drop-as-dup ${dupL5.length}, unmatched ${unmatched}`);

  // reparent moved L5s
  for (let i = 0; i < moves.length; i += 500) {
    const batch = moves.slice(i, i + 500);
    const values = batch.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(',');
    await prisma.$executeRawUnsafe(
      `UPDATE "ProcessNode" AS t SET "parentId" = v.pid FROM (VALUES ${values}) AS v(id, pid) WHERE t.id = v.id`,
      ...batch.flatMap(([id, pid]) => [id, pid]),
    );
  }
  // delete dup L5s + the entire drop subtree (its now-empty L3/L4 + the L2 itself)
  const dropSubtreeIds = all.filter((n) => { let x: typeof n | undefined = n; while (x) { if (x.id === drop.id) return true; x = x.parentId ? byId.get(x.parentId) : undefined; } return false; }).map((n) => n.id);
  const toDelete = [...new Set([...dupL5, ...dropSubtreeIds])];
  // delete closure rows first then nodes (avoid dangling), in chunks
  for (let i = 0; i < toDelete.length; i += 1000) {
    const b = toDelete.slice(i, i + 1000);
    await prisma.$executeRawUnsafe(`DELETE FROM "ProcessNodeClosure" WHERE "ancestorId" = ANY($1::text[]) OR "descendantId" = ANY($1::text[])`, b);
  }
  await prisma.processNode.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`deleted ${toDelete.length} nodes (dup L5 + drop subtree)`);

  // rename keeper + rebuild closure
  await prisma.processNode.update({ where: { id: keep.id }, data: { displayValue: 'Corporate Operations', dbValue: 'Corporate Operations', code: 'corporate operations' } });
  const cl = await processClosure.rebuildClosure({ companyId: c });
  console.log('renamed keeper → "Corporate Operations"; closure rows', cl);

  const cfId = keep.parentId!;
  const remaining = all.filter((n) => PL[n.processLevelTypeId] === 2 && n.parentId === cfId && !toDelete.includes(n.id)).map((n) => n.displayValue);
  console.log('Corporate Functions L2 now:', remaining.join(', '));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
