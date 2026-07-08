// Apply v3 broken-down plans (plan-decisions-v3/plan-*.json) to the SW Eng &
// Delivery pilot (SCRUM-103 follow-up). Per task:
//   - replaces the custom step rows with multi-line procedures:
//       CHECKLIST value = "By the <actor>:\n1) <action>\n…\nDone when <condition>"
//       TEST      value = "By the <verifier>:\n1) <check>\n…\nPass when <condition>"
//     (the verifier is the approver named in a sign-off step, else the owner —
//      never the word "Checker")
//   - prunes Participant NodeRoles that perform no step (removeParticipants)
//   - points the TEST pattern's "Named process owner" answer at the verifier role
//   - instantiates NodeStandardEvidence TEST rows from each tied standard's own
//     testProcedure (and a CHECKLIST evidence row from its evidence text) where
//     the tie has none yet, so standards are testable at the same level of detail
// Hard content linter first (titles must match v2 byte-for-byte so checklist
// coverage and app links stay intact). Dry run by default; --apply mutates.
// Run: npx tsx --env-file=.env scripts/apply-pilot-plan-rework-v3.ts [--apply]
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

interface StepV3 {
  n: number;
  title: string;
  actor: string;
  sop: string[];
  verify: string[];
}
interface PlanTaskV3 {
  taskId: string;
  taskName: string;
  verifier: string;
  removeParticipants: string[];
  steps: StepV3[];
}

// ── Load inputs ─────────────────────────────────────────────────────────────
const exp = JSON.parse(readFileSync(join(HERE, 'pilot-plan-export.json'), 'utf8')) as {
  pilot: { l3Id: string; path: string };
  tasks: { id: string; name: string }[];
};
const taskIds = exp.tasks.map((t) => t.id);
const taskSet = new Set(taskIds);

const profile = JSON.parse(readFileSync(join(HERE, 'pilot-profile-export.json'), 'utf8')) as {
  tasks: { id: string; owner: string; participants: string[] }[];
};
const rolesByTask = new Map(profile.tasks.map((t) => [t.id, t]));

// v2 titles are the contract — v3 must keep them byte-identical.
const v2Titles = new Map<string, string[]>();
const v2Dir = join(HERE, 'plan-decisions-v2');
for (const f of readdirSync(v2Dir).filter((f) => f.startsWith('plan-') && f.endsWith('.json'))) {
  const batch = JSON.parse(readFileSync(join(v2Dir, f), 'utf8')) as {
    tasks: { taskId: string; steps: { title: string }[] }[];
  };
  for (const t of batch.tasks)
    v2Titles.set(
      t.taskId,
      t.steps.map((s) => s.title),
    );
}

const decDir = join(HERE, 'plan-decisions-v3');
const planned: PlanTaskV3[] = [];
for (const f of readdirSync(decDir)
  .filter((f) => f.startsWith('plan-') && f.endsWith('.json'))
  .sort()) {
  planned.push(
    ...(JSON.parse(readFileSync(join(decDir, f), 'utf8')) as { tasks: PlanTaskV3[] }).tasks,
  );
}
console.log(`Loaded ${planned.length} v3 plans for ${taskIds.length} pilot tasks`);

// ── Lint ────────────────────────────────────────────────────────────────────
function lint(p: PlanTaskV3): string[] {
  const errs: string[] = [];
  const t = (m: string) => errs.push(`${p.taskName}: ${m}`);
  const prof = rolesByTask.get(p.taskId);
  if (!prof) {
    t('no owner/participants in pilot-profile-export.json');
    return errs;
  }
  const removed = new Set(p.removeParticipants ?? []);
  for (const r of removed)
    if (!prof.participants.includes(r)) t(`removeParticipants "${r}" is not a participant`);
  const kept = prof.participants.filter((x) => !removed.has(x));
  const allowed = new Set([prof.owner, ...kept]);

  if (!p.verifier?.trim() || /checker/i.test(p.verifier)) t(`bad verifier "${p.verifier}"`);
  else if (!allowed.has(p.verifier)) t(`verifier "${p.verifier}" is not owner/kept participant`);

  const titles = v2Titles.get(p.taskId);
  if (!titles) t('task not in plan-decisions-v2');
  else if (titles.length !== p.steps?.length)
    t(`${p.steps?.length ?? 0} steps, v2 has ${titles.length}`);

  const actorsUsed = new Set<string>();
  p.steps?.forEach((s, i) => {
    if (s.n !== i + 1) t(`numbering broken at index ${i}`);
    if (titles && titles[i] !== undefined && s.title !== titles[i])
      t(`step ${s.n}: title differs from v2 ("${s.title?.slice(0, 60)}…")`);
    if (!allowed.has(s.actor)) t(`step ${s.n}: actor "${s.actor}" not owner/kept participant`);
    actorsUsed.add(s.actor);
    for (const [name, lines, lo, hi, last] of [
      ['sop', s.sop, 3, 6, 'Done when'],
      ['verify', s.verify, 2, 4, 'Pass when'],
    ] as const) {
      if (!Array.isArray(lines) || lines.length < lo || lines.length > hi) {
        t(
          `step ${s.n} ${name}: ${Array.isArray(lines) ? lines.length : 'no'} lines (want ${lo}-${hi})`,
        );
        continue;
      }
      lines.forEach((ln, j) => {
        const isLast = j === lines.length - 1;
        if (!ln?.trim()) t(`step ${s.n} ${name} line ${j + 1}: empty`);
        else {
          if (ln.length > 130) t(`step ${s.n} ${name} line ${j + 1}: ${ln.length} chars`);
          if (ln.includes(';')) t(`step ${s.n} ${name} line ${j + 1}: semicolon`);
          if (/checker/i.test(ln)) t(`step ${s.n} ${name} line ${j + 1}: says Checker`);
          if (isLast && !ln.startsWith(last))
            t(`step ${s.n} ${name}: last line must start "${last}"`);
          if (!isLast && ln.startsWith(last))
            t(`step ${s.n} ${name} line ${j + 1}: "${last}" before last`);
        }
      });
    }
  });
  for (const k of kept)
    if (!actorsUsed.has(k)) t(`kept participant "${k}" never acts — remove or assign a step`);
  return errs;
}

const errs: string[] = [];
const seen = new Set<string>();
for (const p of planned) {
  if (!taskSet.has(p.taskId)) {
    errs.push(`Unknown taskId ${p.taskId}`);
    continue;
  }
  if (seen.has(p.taskId)) {
    errs.push(`Duplicate plan ${p.taskName}`);
    continue;
  }
  seen.add(p.taskId);
  errs.push(...lint(p));
}
const missing = exp.tasks.filter((t) => !seen.has(t.id));
if (missing.length)
  errs.push(
    `${missing.length} tasks missing v3 plans: ${missing
      .slice(0, 5)
      .map((t) => t.name)
      .join('; ')}`,
  );
if (errs.length) {
  console.error(`LINT FAILED (${errs.length}):`);
  for (const e of errs.slice(0, 60)) console.error(' - ' + e);
  if (errs.length > 60) console.error(` … +${errs.length - 60} more`);
  process.exit(1);
}
const totalSteps = planned.reduce((a, p) => a + p.steps.length, 0);
const totalRemovals = planned.reduce((a, p) => a + (p.removeParticipants?.length ?? 0), 0);
console.log(
  `Lint OK: ${totalSteps} steps (${(totalSteps / planned.length).toFixed(1)}/task), ` +
    `${totalRemovals} participant removals, ` +
    `${planned.filter((p) => p.verifier !== rolesByTask.get(p.taskId)?.owner).length} tasks verified by a non-owner approver.`,
);

// Compose the stored multi-line values.
const numbered = (lines: string[]) =>
  lines.map((ln, i) => (i === lines.length - 1 ? ln : `${i + 1}) ${ln}`)).join('\n');
const sopValue = (s: StepV3) => `By the ${s.actor}:\n${numbered(s.sop)}`;
const verifyValue = (p: PlanTaskV3, s: StepV3) => `By the ${p.verifier}:\n${numbered(s.verify)}`;

async function main() {
  if (!APPLY) {
    const ex = planned[0];
    console.log('\nSample CHECKLIST value:\n' + sopValue(ex.steps[0]));
    console.log('\nSample TEST value:\n' + verifyValue(ex, ex.steps[0]));
    console.log('\nDRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  const node = await prisma.processNode.findUniqueOrThrow({
    where: { id: exp.pilot.l3Id },
    select: { companyId: true },
  });
  const companyId = node.companyId;

  // Resolve every referenced role name once.
  const roleNames = new Set<string>();
  for (const p of planned) {
    roleNames.add(p.verifier);
    for (const r of p.removeParticipants ?? []) roleNames.add(r);
  }
  const roles = await prisma.role.findMany({
    where: { companyId, displayValue: { in: [...roleNames] } },
    select: { id: true, displayValue: true },
  });
  const roleIdByName = new Map(roles.map((r) => [r.displayValue, r.id]));
  const unknownRoles = [...roleNames].filter((n) => !roleIdByName.has(n));
  if (unknownRoles.length) {
    console.error('Unknown role names (no Role row):', unknownRoles.join(', '));
    process.exit(1);
  }

  // ── Backup everything we mutate ───────────────────────────────────────────
  const [bakAnswers, bakRoles, bakEvidence] = await Promise.all([
    prisma.nodeTemplateAnswer.findMany({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeRole.findMany({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeStandardEvidence.findMany({ where: { processNodeId: { in: taskIds } } }),
  ]);
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `pilot-plan-v3-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    bakFile,
    JSON.stringify(
      { answers: bakAnswers, nodeRoles: bakRoles, standardEvidence: bakEvidence },
      null,
      2,
    ),
  );
  console.log(
    `Backup: ${bakFile} (${bakAnswers.length} answers, ${bakRoles.length} roles, ${bakEvidence.length} evidence rows)`,
  );

  // ── 1. Replace custom step rows ───────────────────────────────────────────
  const delCustom = await prisma.nodeTemplateAnswer.deleteMany({
    where: { processNodeId: { in: taskIds }, templateKeyId: null },
  });
  const rows: {
    companyId: string;
    processNodeId: string;
    customKey: string;
    kind: string;
    value: string;
    sortOrder: number;
  }[] = [];
  for (const p of planned)
    for (const s of p.steps) {
      rows.push({
        companyId,
        processNodeId: p.taskId,
        customKey: `${s.n}. ${s.title.trim()}`,
        kind: 'CHECKLIST',
        value: sopValue(s),
        sortOrder: s.n,
      });
      rows.push({
        companyId,
        processNodeId: p.taskId,
        customKey: `${s.n}. Verify: ${s.title.trim()}`,
        kind: 'TEST',
        value: verifyValue(p, s),
        sortOrder: s.n,
      });
    }
  const ins = await prisma.nodeTemplateAnswer.createMany({ data: rows });
  console.log(`Custom rows: -${delCustom.count} +${ins.count}`);

  // ── 2. Prune Participant roles that act in no step ────────────────────────
  let prunedRoles = 0;
  for (const p of planned) {
    if (!p.removeParticipants?.length) continue;
    const ids = p.removeParticipants.map((n) => roleIdByName.get(n)!);
    const del = await prisma.nodeRole.deleteMany({
      where: { companyId, processNodeId: p.taskId, role_: 'Participant', roleId: { in: ids } },
    });
    prunedRoles += del.count;
  }
  console.log(`Pruned ${prunedRoles} non-acting Participant links`);

  // ── 3. Point "Named process owner" (TEST pattern) at the verifier ─────────
  const npoLinks = await prisma.nodeWorkTemplate.findMany({
    where: { processNodeId: { in: taskIds }, template: { kind: 'TEST' } },
    select: {
      processNodeId: true,
      template: {
        select: { keys: { where: { key: 'Named process owner' }, select: { id: true } } },
      },
    },
  });
  let npoSet = 0;
  for (const l of npoLinks) {
    const keyId = l.template.keys[0]?.id;
    const plan = planned.find((p) => p.taskId === l.processNodeId);
    if (!keyId || !plan) continue;
    const roleId = roleIdByName.get(plan.verifier)!;
    await prisma.nodeTemplateAnswer.upsert({
      where: {
        processNodeId_templateKeyId: { processNodeId: l.processNodeId, templateKeyId: keyId },
      },
      create: { companyId, processNodeId: l.processNodeId, templateKeyId: keyId, roleId },
      update: { roleId, value: null, suppressed: false },
    });
    npoSet++;
  }
  console.log(`Named process owner → verifier on ${npoSet} tasks`);

  // ── 4. Standards tied to pilot tasks become testable ──────────────────────
  const ties = await prisma.nodeStandard.findMany({
    where: { processNodeId: { in: taskIds }, excluded: false },
    select: {
      processNodeId: true,
      standard: { select: { id: true, name: true, testProcedure: true, evidence: true } },
    },
  });
  const existing = await prisma.nodeStandardEvidence.findMany({
    where: { processNodeId: { in: taskIds } },
    select: { processNodeId: true, standardId: true, kind: true },
  });
  const has = new Set(existing.map((e) => `${e.processNodeId}|${e.standardId}|${e.kind}`));
  const evRows: {
    companyId: string;
    processNodeId: string;
    standardId: string;
    kind: string;
    step: string;
    value: string;
    sortOrder: number;
  }[] = [];
  let noProcedure = 0;
  for (const tie of ties) {
    const plan = planned.find((p) => p.taskId === tie.processNodeId);
    if (!plan) continue;
    const s = tie.standard;
    if (!has.has(`${tie.processNodeId}|${s.id}|TEST`)) {
      const procLines = (s.testProcedure ?? '')
        .split(/\n+|(?=\d+[.)]\s)/)
        .map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(Boolean);
      if (procLines.length) {
        const body = procLines.map((ln, i) => `${i + 1}) ${ln}`).join('\n');
        evRows.push({
          companyId,
          processNodeId: tie.processNodeId,
          standardId: s.id,
          kind: 'TEST',
          step: `Verify ${s.name}`,
          value: `By the ${plan.verifier}:\n${body}\nPass when every check above holds for this task's output`,
          sortOrder: 1,
        });
      } else noProcedure++;
    }
    if (s.evidence?.trim() && !has.has(`${tie.processNodeId}|${s.id}|CHECKLIST`)) {
      evRows.push({
        companyId,
        processNodeId: tie.processNodeId,
        standardId: s.id,
        kind: 'CHECKLIST',
        step: `Evidence for ${s.name}`,
        value: s.evidence.trim(),
        sortOrder: 2,
      });
    }
  }
  const insEv = evRows.length
    ? await prisma.nodeStandardEvidence.createMany({ data: evRows })
    : { count: 0 };
  console.log(
    `Standards: ${ties.length} ties on pilot tasks, +${insEv.count} evidence rows` +
      (noProcedure
        ? `, ${noProcedure} ties skipped (standard has no testProcedure — fill it in the Standards area)`
        : ''),
  );

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
