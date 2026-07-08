// Apply broken-down standard test procedures to the SW Eng & Delivery pilot
// (follow-up to apply-pilot-plan-rework-v3.ts — same level of step detail for
// standards). Inputs: standard-test-decisions/std-steps-*.json, each
// {"standards":[{id, name, test: ["line…", …, "Pass when …"]}]}.
// For every non-excluded NodeStandard tie on a pilot task, the tie's TEST
// NodeStandardEvidence row is rewritten to
//   "By the <verifier>:\n1) <line>\n…\nPass when <condition>"
// where the verifier is the task's v3 plan verifier (approver, else owner).
// Rows are updated in place (created when a tie has none). Hard linter first;
// dry run by default; --apply mutates. Backup under scripts/backups/.
// Run: npx tsx --env-file=.env scripts/apply-pilot-standard-tests.ts [--apply]
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

interface StdSteps {
  id: string;
  name: string;
  test: string[];
}

const exp = JSON.parse(readFileSync(join(HERE, 'pilot-plan-export.json'), 'utf8')) as {
  pilot: { l3Id: string };
  tasks: { id: string }[];
};
const taskIds = exp.tasks.map((t) => t.id);

// Task → verifier comes from the applied v3 plans.
const verifierByTask = new Map<string, string>();
const v3Dir = join(HERE, 'plan-decisions-v3');
for (const f of readdirSync(v3Dir).filter((f) => f.startsWith('plan-') && f.endsWith('.json'))) {
  const batch = JSON.parse(readFileSync(join(v3Dir, f), 'utf8')) as {
    tasks: { taskId: string; verifier: string }[];
  };
  for (const t of batch.tasks) verifierByTask.set(t.taskId, t.verifier);
}

const decDir = join(HERE, 'standard-test-decisions');
const decided: StdSteps[] = [];
for (const f of readdirSync(decDir)
  .filter((f) => f.startsWith('std-steps-') && f.endsWith('.json'))
  .sort()) {
  decided.push(
    ...(JSON.parse(readFileSync(join(decDir, f), 'utf8')) as { standards: StdSteps[] }).standards,
  );
}
const stepsByStandard = new Map(decided.map((s) => [s.id, s]));
console.log(`Loaded stepped tests for ${decided.length} standards`);

// ── Lint ────────────────────────────────────────────────────────────────────
const errs: string[] = [];
const seen = new Set<string>();
for (const s of decided) {
  const t = (m: string) => errs.push(`${s.name}: ${m}`);
  if (seen.has(s.id)) t('duplicate id');
  seen.add(s.id);
  if (!Array.isArray(s.test) || s.test.length < 3 || s.test.length > 7)
    t(`${s.test?.length ?? 0} lines (want 3-7)`);
  s.test?.forEach((ln, i) => {
    const isLast = i === s.test.length - 1;
    if (!ln?.trim()) t(`line ${i + 1}: empty`);
    else {
      if (ln.length > 130) t(`line ${i + 1}: ${ln.length} chars`);
      if (ln.includes(';')) t(`line ${i + 1}: semicolon`);
      if (/checker/i.test(ln)) t(`line ${i + 1}: says Checker`);
      if (isLast && !ln.startsWith('Pass when')) t('last line must start "Pass when"');
      if (!isLast && ln.startsWith('Pass when')) t(`line ${i + 1}: "Pass when" before last`);
    }
  });
}

async function main() {
  const ties = await prisma.nodeStandard.findMany({
    where: { processNodeId: { in: taskIds }, excluded: false },
    select: { processNodeId: true, standardId: true, standard: { select: { name: true } } },
  });
  const tieStandardIds = new Set(ties.map((x) => x.standardId));
  for (const id of tieStandardIds)
    if (!stepsByStandard.has(id)) {
      const name = ties.find((x) => x.standardId === id)?.standard.name;
      errs.push(`standard "${name}" tied on pilot but has no stepped test`);
    }
  for (const tie of ties)
    if (!verifierByTask.has(tie.processNodeId))
      errs.push(`task ${tie.processNodeId} has no v3 verifier`);

  if (errs.length) {
    console.error(`LINT FAILED (${errs.length}):`);
    for (const e of errs.slice(0, 40)) console.error(' - ' + e);
    if (errs.length > 40) console.error(` … +${errs.length - 40} more`);
    process.exit(1);
  }
  const avg = decided.reduce((a, s) => a + s.test.length, 0) / decided.length;
  console.log(`Lint OK: ${ties.length} ties, ${avg.toFixed(1)} lines/standard.`);

  const composed = (taskId: string, s: StdSteps) => {
    const body = s.test
      .map((ln, i) => (i === s.test.length - 1 ? ln : `${i + 1}) ${ln}`))
      .join('\n');
    return `By the ${verifierByTask.get(taskId)}:\n${body}`;
  };

  if (!APPLY) {
    const tie = ties[0];
    console.log(
      `\nSample TEST value ("${tie.standard.name}"):\n` +
        composed(tie.processNodeId, stepsByStandard.get(tie.standardId)!),
    );
    console.log('\nDRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  const node = await prisma.processNode.findUniqueOrThrow({
    where: { id: exp.pilot.l3Id },
    select: { companyId: true },
  });

  const bak = await prisma.nodeStandardEvidence.findMany({
    where: { processNodeId: { in: taskIds } },
  });
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `pilot-standard-tests-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(bakFile, JSON.stringify({ standardEvidence: bak }, null, 2));
  console.log(`Backup: ${bakFile} (${bak.length} evidence rows)`);

  let updated = 0;
  let created = 0;
  for (const tie of ties) {
    const s = stepsByStandard.get(tie.standardId)!;
    const value = composed(tie.processNodeId, s);
    const res = await prisma.nodeStandardEvidence.updateMany({
      where: { processNodeId: tie.processNodeId, standardId: tie.standardId, kind: 'TEST' },
      data: { value },
    });
    if (res.count > 0) updated += res.count;
    else {
      await prisma.nodeStandardEvidence.create({
        data: {
          companyId: node.companyId,
          processNodeId: tie.processNodeId,
          standardId: tie.standardId,
          kind: 'TEST',
          step: `Verify ${s.name}`,
          value,
          sortOrder: 1,
        },
      });
      created++;
    }
  }
  console.log(`TEST evidence rows: ${updated} updated, ${created} created. Done.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
