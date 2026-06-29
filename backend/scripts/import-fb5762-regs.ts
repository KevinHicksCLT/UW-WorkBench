// import-fb5762-regs.ts — bring the FB-57-62 regulatory migration into a DB that
// forked BEFORE it (e.g. new-data-model). Because the target forked from the same
// ancestor, all pre-existing rows share ids, so this is a clean copy-by-id:
//   + EU/GDPR international Jurisdiction (was missing → International tab empty)
//   + the privacy RegulatoryRequirements FB-57-62 added (CCPA/GDPR/NYDFS)
//   + their NodeRegulation links (reg ↔ process node)
//   - the privacy Standards FB-57-62 MOVED out (so they aren't duplicated as both
//     a Standard and a Regulation). Deletes only ids present on target but not on
//     source — i.e. exactly what FB-57-62 removed. Cascades NodeStandard/etc.
//
// Source DB = env SRC_URL (fb-57-62). Target DB = backend/.env DATABASE_URL.
// Run from backend/:  SRC_URL=... npx tsx scripts/import-fb5762-regs.ts [--dry]

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const DRY = process.argv.includes('--dry');
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const TARGET_URL = env.split(/\r?\n/).find((l) => /^DATABASE_URL=/.test(l))!.replace(/^DATABASE_URL="?([^"]*)"?.*/, '$1');
const SRC_URL = process.env.SRC_URL;
if (!SRC_URL) throw new Error('set SRC_URL to the fb-57-62 connection string');

const src = new PrismaClient({ datasources: { db: { url: SRC_URL } } });
const tgt = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

async function main() {
  console.log(`\n=== import-fb5762-regs ${DRY ? '(DRY RUN)' : '(APPLY)'} ===`);
  console.log('target:', TARGET_URL.replace(/.*@([^.]*).*/, '$1'), '| source:', SRC_URL.replace(/.*@([^.]*).*/, '$1'));

  // ── helper: rows on source whose id is absent on target ──
  const missing = async <T extends { id: string }>(srcRows: T[], tgtIds: Set<string>) => srcRows.filter((r) => !tgtIds.has(r.id));
  const idsOf = async (p: PrismaClient, model: string): Promise<Set<string>> =>
    new Set((await (p as any)[model].findMany({ select: { id: true } })).map((r: any) => r.id));

  // 1. EU jurisdiction ------------------------------------------------------
  const newJuris = await missing(await src.jurisdiction.findMany(), await idsOf(tgt, 'jurisdiction'));
  console.log(`\nJurisdictions to add: ${newJuris.length}  ${newJuris.map((j) => j.code).join(', ')}`);
  if (!DRY && newJuris.length) await tgt.jurisdiction.createMany({ data: newJuris });

  // 2. RegulatoryRequirements (two-pass for the supersededById self-ref) -----
  const newReqs = await missing(await src.regulatoryRequirement.findMany(), await idsOf(tgt, 'regulatoryRequirement'));
  console.log(`RegulatoryRequirements to add: ${newReqs.length}`);
  const byCat = newReqs.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a), {});
  console.log('  by category:', JSON.stringify(byCat));
  if (!DRY && newReqs.length) {
    await tgt.regulatoryRequirement.createMany({ data: newReqs.map((r) => ({ ...r, supersededById: null })) });
    for (const r of newReqs.filter((r) => r.supersededById)) await tgt.regulatoryRequirement.update({ where: { id: r.id }, data: { supersededById: r.supersededById } });
  }

  // 3. NodeRegulation links --------------------------------------------------
  const newLinks = await missing(await src.nodeRegulation.findMany(), await idsOf(tgt, 'nodeRegulation'));
  console.log(`NodeRegulation links to add: ${newLinks.length}`);
  if (!DRY && newLinks.length) await tgt.nodeRegulation.createMany({ data: newLinks, skipDuplicates: true });

  // 4. Remove the privacy Standards FB-57-62 migrated out --------------------
  // = standards present on target but absent on source (definitionally FB's removals).
  const srcStdIds = await idsOf(src, 'standard');
  const tgtStds = await tgt.standard.findMany({ select: { id: true, name: true, isArea: true } });
  const removeStds = tgtStds.filter((s) => !srcStdIds.has(s.id));
  console.log(`\nStandards to remove (target-only, = FB-57-62 removals): ${removeStds.length}`);
  console.log('  sample:', removeStds.slice(0, 8).map((s) => s.name).join(' | '));
  if (!DRY && removeStds.length) {
    // children first (StandardTree onDelete Cascade handles links, but a leaf may
    // be a parent of others); delete by id set — cascades NodeStandard/RoleStandard/
    // StandardDeliverable. Order leaves-before-parents via repeated deleteMany.
    const ids = new Set(removeStds.map((s) => s.id));
    let left = [...ids];
    while (left.length) {
      const parentIds = new Set((await tgt.standard.findMany({ where: { id: { in: left }, parentId: { in: left } }, select: { parentId: true } })).map((r) => r.parentId!));
      const deletable = left.filter((id) => !parentIds.has(id));
      if (!deletable.length) { await tgt.standard.deleteMany({ where: { id: { in: left } } }); break; }
      await tgt.standard.deleteMany({ where: { id: { in: deletable } } });
      left = left.filter((id) => !deletable.includes(id));
    }
  }

  // ── verify parity with source ──
  const counts = async (p: PrismaClient) => ({
    juris: await p.jurisdiction.count(), regs: await p.regulatoryRequirement.count(),
    intl: await p.jurisdiction.count({ where: { regulatorType: 'INTERNATIONAL' } }),
    nodeReg: await p.nodeRegulation.count(), standards: await p.standard.count(),
  });
  console.log('\n--- target after ---', JSON.stringify(await counts(tgt)));
  console.log('--- source (fb-57-62) ---', JSON.stringify(await counts(src)));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => { src.$disconnect(); tgt.$disconnect(); });
