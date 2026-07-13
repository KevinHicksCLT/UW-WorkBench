// Apply the SPECIFIC-STEPS decisions (scripts/uw-enrichment/spec-dec-*.json).
// For each step of each task, inserts TWO item-specific NodeTemplateAnswer rows
// (templateKeyId=null) mirroring the gold-standard "Initiate project or sprint":
//   CHECKLIST customKey "N. <title>"          value "By the <performer>: … Done when …"
//   TEST      customKey "N. Verify: <title>"  value "By the <verifier>:  … Pass when …"
// Idempotent: deduped by (processNodeId, customKey, kind). Dry run by default; --apply mutates.
// Run: npx tsx --env-file=.env scripts/apply-uw-specifics.ts [--apply]
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'uw-enrichment');
const APPLY = process.argv.includes('--apply');

type Step = {
  title: string;
  performer?: string;
  verifier?: string;
  checklist: string;
  testing: string;
};
type TaskDec = { id: string; steps: Step[] };

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const companyId = company.id;

  const files = readdirSync(DIR)
    .filter((f) => /^spec-dec-\d+\.json$/.test(f))
    .sort();
  console.log(`spec-dec files (${files.length}):`, files.join(', '));

  const decisions: TaskDec[] = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { tasks: TaskDec[] };
    decisions.push(...d.tasks);
  }

  // validate
  const errs: string[] = [];
  let nSteps = 0;
  const seen = new Set<string>();
  for (const t of decisions) {
    if (seen.has(t.id)) errs.push(`dup task ${t.id}`);
    seen.add(t.id);
    if (!Array.isArray(t.steps) || t.steps.length < 4)
      errs.push(`${t.id}: ${t.steps?.length ?? 0} steps (<4)`);
    for (const s of t.steps ?? []) {
      nSteps++;
      if (!s.title) errs.push(`${t.id}: step missing title`);
      if (!s.checklist || !/(^|\n)Done when /.test(s.checklist))
        errs.push(`${t.id}/${s.title}: checklist missing "Done when"`);
      if (!s.testing || !/(^|\n)Pass when /.test(s.testing))
        errs.push(`${t.id}/${s.title}: testing missing "Pass when"`);
    }
  }
  if (errs.length) {
    console.error(`VALIDATION FAILED (${errs.length}):`);
    errs.slice(0, 40).forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log(`Validation OK. tasks=${decisions.length} steps=${nSteps} rows=${nSteps * 2}`);

  if (!APPLY) {
    console.log('DRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  const stats = { tasks: 0, inserted: 0, skipped: 0 };
  for (const t of decisions) {
    const node = await prisma.processNode.findFirst({
      where: { id: t.id, companyId, isTask: true },
      select: { id: true },
    });
    if (!node) {
      stats.skipped++;
      continue;
    }
    stats.tasks++;
    const existing = await prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: t.id, templateKeyId: null },
      select: { customKey: true, kind: true },
    });
    const have = new Set(existing.map((e) => `${e.kind}|${e.customKey}`));

    const rows: {
      companyId: string;
      processNodeId: string;
      customKey: string;
      kind: string;
      value: string;
      sortOrder: number;
    }[] = [];
    t.steps.forEach((s, i) => {
      const n = i + 1;
      const ck = `${n}. ${s.title}`;
      const tk = `${n}. Verify: ${s.title}`;
      if (!have.has(`CHECKLIST|${ck}`))
        rows.push({
          companyId,
          processNodeId: t.id,
          customKey: ck,
          kind: 'CHECKLIST',
          value: s.checklist,
          sortOrder: 100 + n,
        });
      if (!have.has(`TEST|${tk}`))
        rows.push({
          companyId,
          processNodeId: t.id,
          customKey: tk,
          kind: 'TEST',
          value: s.testing,
          sortOrder: 100 + n,
        });
    });
    if (rows.length) {
      await prisma.nodeTemplateAnswer.createMany({ data: rows });
      stats.inserted += rows.length;
    }
  }
  console.log('applied:', stats);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
