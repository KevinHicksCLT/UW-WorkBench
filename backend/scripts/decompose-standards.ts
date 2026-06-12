// decompose-standards.ts — break every department standard into its real
// standards. The workbook rows (e.g. "CAT Model Validation") become GROUPS:
// their description is replaced by an authored higher-level summary, and each
// semicolon fragment of the old description becomes its own child StandardItem
// ("Annual Model Comparison", …) with an authored description about that
// practice only. Single-fragment rows stay leaf-only (summary replaces the
// terse text; no children). Content lives in standards/decomposition/output/*.json
// (one file per authoring slice — see slice-inputs.cjs).
//
// Also adds the StandardItem."parentId" column (additive raw SQL — safe on the
// live DB) and recomputes Standard.count as the LEAF count, which is what every
// list/total now means by "standards".
//
// Idempotent: matches groups by (area, category, name) with parentId IS NULL,
// deletes their existing children, and recreates them. Run (cwd = backend):
//   npx tsx scripts/decompose-standards.ts
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards/decomposition/output');

type Sub = { title: string; description: string };
type ContentItem = { category: string; name: string; summary: string; subs: Sub[] };
type ContentFile = { department: string; items: ContentItem[] };

async function ensureColumn() {
  await prisma.$executeRawUnsafe('ALTER TABLE public."StandardItem" ADD COLUMN IF NOT EXISTS "parentId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StandardItem_parentId_idx" ON public."StandardItem"("parentId")');
  // FK with cascade so deleting a group removes its children (matches schema.prisma).
  await prisma.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StandardItem_parentId_fkey') THEN
      ALTER TABLE public."StandardItem" ADD CONSTRAINT "StandardItem_parentId_fkey"
        FOREIGN KEY ("parentId") REFERENCES public."StandardItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`);
}

async function main() {
  await ensureColumn();

  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) throw new Error(`No content files in ${OUT_DIR}`);

  // Merge slices by department (Information Security / ESA are split across files).
  const byDept = new Map<string, ContentItem[]>();
  for (const f of files) {
    const pack = JSON.parse(readFileSync(resolve(OUT_DIR, f), 'utf8')) as ContentFile;
    if (!byDept.has(pack.department)) byDept.set(pack.department, []);
    byDept.get(pack.department)!.push(...pack.items);
  }

  let groups = 0, children = 0, leafOnly = 0, missing = 0;
  for (const [department, items] of byDept) {
    const area = await prisma.standard.findFirst({ where: { department }, select: { id: true } });
    if (!area) { console.log(`⚠ no Standards area named "${department}" — skipped ${items.length} items`); continue; }

    for (const it of items) {
      const parent = await prisma.standardItem.findFirst({
        where: { standardId: area.id, category: it.category, name: it.name, parentId: null },
      });
      if (!parent) { console.log(`  ⚠ not found: ${department} / ${it.category} / ${it.name}`); missing++; continue; }

      await prisma.standardItem.deleteMany({ where: { parentId: parent.id } });
      await prisma.standardItem.update({ where: { id: parent.id }, data: { description: it.summary } });

      if (!it.subs.length) { leafOnly++; continue; }
      groups++;
      // sourceRow on children = fragment order within the group (display order).
      await prisma.standardItem.createMany({
        data: it.subs.map((s, i) => ({
          tenantId: parent.tenantId, companyId: parent.companyId, standardId: parent.standardId,
          parentId: parent.id, category: parent.category,
          name: s.title, description: s.description,
          buildRun: parent.buildRun, ownerRole: parent.ownerRole, ownerRoleId: parent.ownerRoleId,
          relatedRole: parent.relatedRole, relatedCategory: parent.relatedCategory,
          agentSkill: parent.agentSkill, sdlcGates: parent.sdlcGates, regCitation: parent.regCitation,
          appliesToValueStreams: parent.appliesToValueStreams,
          sourceRow: i + 1,
        })),
      });
      children += it.subs.length;
    }
  }

  // Standard.count = leaves (groups don't count; they're containers).
  const areas = await prisma.standard.findMany({ select: { id: true } });
  for (const a of areas) {
    const leaves = await prisma.standardItem.count({ where: { standardId: a.id, children: { none: {} } } });
    await prisma.standard.update({ where: { id: a.id }, data: { count: leaves } });
  }

  const totalLeaves = await prisma.standardItem.count({ where: { children: { none: {} } } });
  console.log(`decomposed ${groups} groups → ${children} child standards · ${leafOnly} single-practice standards rewritten · ${missing} unmatched`);
  console.log(`total leaf standards: ${totalLeaves}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
