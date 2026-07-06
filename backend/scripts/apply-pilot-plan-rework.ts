// Apply the pilot atomic-plan rework (plan-decisions/plan-*.json):
//  1. suppress every generic template key row on pilot tasks (values preserved),
//  2. replace custom steps with numbered atomic checklist/testing pairs.
// Dry run by default; pass --apply to mutate. Backs up prior state first.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

interface Step {
  n: number;
  title: string;
  sop: string;
  verify: string;
}
interface PlanTask {
  taskId: string;
  taskName: string;
  steps: Step[];
}

async function main() {
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-plan-export.json'), 'utf8')) as {
    pilot: { l3Id: string; path: string };
    tasks: { id: string; name: string }[];
  };
  const taskIds = exp.tasks.map((t) => t.id);
  const taskSet = new Set(taskIds);

  const decDir = join(HERE, 'plan-decisions');
  const planned: PlanTask[] = [];
  for (const f of readdirSync(decDir)
    .filter((f) => f.startsWith('plan-') && f.endsWith('.json'))
    .sort()) {
    planned.push(
      ...(JSON.parse(readFileSync(join(decDir, f), 'utf8')) as { tasks: PlanTask[] }).tasks,
    );
  }
  console.log(
    `Loaded ${planned.length} task plans for ${taskIds.length} pilot tasks (${exp.pilot.path})`,
  );

  // ---- Validate ----
  const errs: string[] = [];
  const seen = new Set<string>();
  let totalSteps = 0;
  for (const p of planned) {
    if (!taskSet.has(p.taskId)) {
      errs.push(`Unknown taskId ${p.taskId} (${p.taskName})`);
      continue;
    }
    if (seen.has(p.taskId)) {
      errs.push(`Duplicate plan for ${p.taskName}`);
      continue;
    }
    seen.add(p.taskId);
    if (!p.steps?.length) {
      errs.push(`${p.taskName}: no steps`);
      continue;
    }
    if (p.steps.length < 4 || p.steps.length > 10)
      errs.push(`${p.taskName}: ${p.steps.length} steps (want 5-9)`);
    const titles = new Set<string>();
    p.steps.forEach((s, i) => {
      if (s.n !== i + 1) errs.push(`${p.taskName}: step numbering broken at index ${i} (n=${s.n})`);
      if (!s.title?.trim() || !s.sop?.trim() || !s.verify?.trim())
        errs.push(`${p.taskName}: step ${s.n} has empty title/sop/verify`);
      const t = s.title?.trim().toLowerCase() ?? '';
      if (titles.has(t)) errs.push(`${p.taskName}: duplicate step title "${s.title}"`);
      titles.add(t);
    });
    totalSteps += p.steps.length;
  }
  const missing = exp.tasks.filter((t) => !seen.has(t.id));
  if (missing.length)
    errs.push(
      `${missing.length} pilot tasks missing a plan: ${missing
        .slice(0, 5)
        .map((t) => t.name)
        .join('; ')}${missing.length > 5 ? ' …' : ''}`,
    );
  if (errs.length) {
    console.error(`VALIDATION FAILED (${errs.length}):`);
    for (const e of errs.slice(0, 40)) console.error(' - ' + e);
    process.exit(1);
  }
  console.log(
    `Validation OK: ${totalSteps} steps (${(totalSteps / planned.length).toFixed(1)}/task) → ${totalSteps * 2} custom rows (checklist+test).`,
  );

  // Generic keys to suppress: every key of every template assigned to each pilot task.
  const links = await prisma.nodeWorkTemplate.findMany({
    where: { processNodeId: { in: taskIds } },
    select: {
      processNodeId: true,
      companyId: true,
      template: { select: { keys: { select: { id: true } } } },
    },
  });
  const pairs: { processNodeId: string; templateKeyId: string; companyId: string }[] = [];
  for (const l of links)
    for (const k of l.template.keys)
      pairs.push({ processNodeId: l.processNodeId, templateKeyId: k.id, companyId: l.companyId });
  const existing = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: taskIds }, templateKeyId: { not: null } },
    select: { id: true, processNodeId: true, templateKeyId: true, suppressed: true },
  });
  const existingByPair = new Map(existing.map((a) => [`${a.processNodeId}|${a.templateKeyId}`, a]));
  const toCreateSuppressed = pairs.filter(
    (p) => !existingByPair.has(`${p.processNodeId}|${p.templateKeyId}`),
  );
  const toUpdateSuppressed = existing.filter((a) => !a.suppressed).map((a) => a.id);
  const customOld = await prisma.nodeTemplateAnswer.count({
    where: { processNodeId: { in: taskIds }, templateKeyId: null },
  });
  console.log(
    `Plan: suppress ${toUpdateSuppressed.length} existing generic answers + create ${toCreateSuppressed.length} suppressed placeholders; replace ${customOld} old custom rows with ${totalSteps * 2} new.`,
  );
  if (!APPLY) {
    console.log('\nDRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  // ---- Backup ----
  const [bakLinks, bakAnswers] = await Promise.all([
    prisma.nodeWorkTemplate.findMany({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeTemplateAnswer.findMany({ where: { processNodeId: { in: taskIds } } }),
  ]);
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `pilot-plan-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    bakFile,
    JSON.stringify({ nodeWorkTemplates: bakLinks, nodeTemplateAnswers: bakAnswers }, null, 2),
  );
  console.log(
    `Backup: ${bakFile} (${bakLinks.length} template links, ${bakAnswers.length} answers)`,
  );

  const companyIdByTask = new Map(links.map((l) => [l.processNodeId, l.companyId]));
  const fallbackCompanyId = links[0]?.companyId;

  // ---- Mutate ----
  const upd = await prisma.nodeTemplateAnswer.updateMany({
    where: { id: { in: toUpdateSuppressed } },
    data: { suppressed: true },
  });
  const crt = await prisma.nodeTemplateAnswer.createMany({
    data: toCreateSuppressed.map((p) => ({
      companyId: p.companyId,
      processNodeId: p.processNodeId,
      templateKeyId: p.templateKeyId,
      suppressed: true,
    })),
    skipDuplicates: true,
  });
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
  for (const p of planned) {
    const companyId = companyIdByTask.get(p.taskId) ?? fallbackCompanyId!;
    for (const s of p.steps) {
      rows.push({
        companyId,
        processNodeId: p.taskId,
        customKey: `${s.n}. ${s.title.trim()}`,
        kind: 'CHECKLIST',
        value: s.sop.trim(),
        sortOrder: s.n,
      });
      rows.push({
        companyId,
        processNodeId: p.taskId,
        customKey: `${s.n}. Verify: ${s.title.trim()}`,
        kind: 'TEST',
        value: s.verify.trim(),
        sortOrder: s.n,
      });
    }
  }
  const ins = await prisma.nodeTemplateAnswer.createMany({ data: rows });
  console.log(
    `Applied: suppressed ${upd.count}+${crt.count} generic rows, deleted ${delCustom.count} old custom rows, inserted ${ins.count} atomic rows.`,
  );

  // ---- Post-verify ----
  const bad = await prisma.$queryRaw<{ id: string; name: string; ck: bigint; ts: bigint }[]>`
    SELECT pn.id, pn."displayValue" AS name,
      (SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = pn.id AND a."templateKeyId" IS NULL AND a.kind = 'CHECKLIST')::bigint ck,
      (SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = pn.id AND a."templateKeyId" IS NULL AND a.kind = 'TEST')::bigint ts
    FROM "ProcessNode" pn WHERE pn.id = ANY(${taskIds})
      AND ((SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = pn.id AND a."templateKeyId" IS NULL AND a.kind = 'CHECKLIST')
        <> (SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = pn.id AND a."templateKeyId" IS NULL AND a.kind = 'TEST'))
  `;
  if (bad.length) {
    console.error('MISALIGNED checklist/test counts:');
    for (const b of bad) console.error(` - ${b.name}: ${b.ck} vs ${b.ts}`);
  } else
    console.log('Post-verify OK: every pilot task has equal checklist/testing step counts (1:1).');

  const visible = await prisma.$queryRaw<{ suppressed_visible: bigint }[]>`
    SELECT COUNT(*)::bigint AS suppressed_visible FROM "NodeTemplateAnswer" a
    WHERE a."processNodeId" = ANY(${taskIds}) AND a."templateKeyId" IS NOT NULL AND NOT a.suppressed
  `;
  console.log(`Generic rows still visible (expect 0): ${visible[0].suppressed_visible}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
