// Apply single-fact profile answers (profile-decisions/facts-*.json): lint,
// un-suppress every generic key row on pilot tasks and set its value (TEXT) or
// entity FK (APPLICATION/ROLE). Dry run by default; --apply mutates.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

interface Slot {
  keyId: string;
  key: string;
  block: string;
  valueKind: string;
}
interface ExpTask {
  id: string;
  name: string;
  owner: string | null;
  participants: string[];
  apps: string[];
  keys: Slot[];
}
interface Fact {
  keyId: string;
  value: string;
}
interface FactTask {
  taskId: string;
  facts: Fact[];
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function main() {
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-profile-export.json'), 'utf8')) as {
    pilot: { l3Id: string };
    tasks: ExpTask[];
  };
  const taskById = new Map(exp.tasks.map((t) => [t.id, t]));
  const taskIds = exp.tasks.map((t) => t.id);

  const decDir = join(HERE, 'profile-decisions');
  const factTasks: FactTask[] = [];
  for (const f of readdirSync(decDir)
    .filter((f) => f.startsWith('facts-') && f.endsWith('.json'))
    .sort()) {
    factTasks.push(
      ...(JSON.parse(readFileSync(join(decDir, f), 'utf8')) as { tasks: FactTask[] }).tasks,
    );
  }

  // ---- Lint ----
  const errs: string[] = [];
  const seen = new Set<string>();
  let slots = 0;
  for (const ft of factTasks) {
    const t = taskById.get(ft.taskId);
    if (!t) {
      errs.push(`Unknown taskId ${ft.taskId}`);
      continue;
    }
    if (seen.has(ft.taskId)) {
      errs.push(`Duplicate ${t.name}`);
      continue;
    }
    seen.add(ft.taskId);
    const slotById = new Map(t.keys.map((k) => [k.keyId, k]));
    const covered = new Set<string>();
    for (const f of ft.facts) {
      const slot = slotById.get(f.keyId);
      if (!slot) {
        errs.push(`${t.name}: unknown keyId ${f.keyId}`);
        continue;
      }
      if (covered.has(f.keyId)) {
        errs.push(`${t.name}: duplicate fact for "${slot.key}"`);
        continue;
      }
      covered.add(f.keyId);
      const v = (f.value ?? '').trim();
      if (!v) {
        errs.push(`${t.name}/"${slot.key}": empty`);
        continue;
      }
      if (slot.valueKind === 'APPLICATION') {
        if (!t.apps.some((a) => norm(a) === norm(v)))
          errs.push(`${t.name}/"${slot.key}": app "${v}" not in task apps`);
      } else if (slot.valueKind === 'ROLE') {
        const roles = [t.owner, ...t.participants].filter(Boolean) as string[];
        if (!roles.some((r) => norm(r) === norm(v)))
          errs.push(`${t.name}/"${slot.key}": role "${v}" not on task`);
      } else {
        if (v.length > 145) errs.push(`${t.name}/"${slot.key}": ${v.length} chars (max 130)`);
        if (v.includes(';')) errs.push(`${t.name}/"${slot.key}": ';'`);
        if (/:\s/.test(v)) errs.push(`${t.name}/"${slot.key}": ':' list`);
        if ((v.match(/,/g) ?? []).length > 3) errs.push(`${t.name}/"${slot.key}": comma list`);
        if (/with the fields|all (four|five|six|seven)/i.test(v))
          errs.push(`${t.name}/"${slot.key}": bundled`);
      }
      slots++;
    }
    for (const k of t.keys)
      if (!covered.has(k.keyId)) errs.push(`${t.name}: no fact for "${k.key}"`);
  }
  const missing = exp.tasks.filter((t) => !seen.has(t.id));
  if (missing.length) errs.push(`${missing.length} tasks missing facts`);
  if (errs.length) {
    console.error(`LINT FAILED (${errs.length}):`);
    for (const e of errs.slice(0, 60)) console.error(' - ' + e);
    if (errs.length > 60) console.error(` … +${errs.length - 60} more`);
    process.exit(1);
  }
  console.log(`Lint OK: ${slots} facts across ${factTasks.length} tasks.`);
  if (!APPLY) {
    console.log('DRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  // ---- Backup current generic answers ----
  const bak = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: taskIds }, templateKeyId: { not: null } },
  });
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `pilot-profile-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(bakFile, JSON.stringify({ genericAnswers: bak }, null, 2));
  console.log(`Backup: ${bakFile} (${bak.length} rows)`);

  // ---- Resolve FK lookup maps ----
  const node = await prisma.processNode.findUniqueOrThrow({
    where: { id: exp.pilot.l3Id },
    select: { companyId: true },
  });
  const companyId = node.companyId;
  const [allApps, allRoles] = await Promise.all([
    prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true } }),
  ]);
  const appId = new Map(allApps.map((a) => [norm(a.name), a.id]));
  const roleId = new Map(allRoles.map((r) => [norm(r.displayValue), r.id]));

  const existing = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: taskIds }, templateKeyId: { not: null } },
    select: { id: true, processNodeId: true, templateKeyId: true },
  });
  const rowIdByPair = new Map(existing.map((a) => [`${a.processNodeId}|${a.templateKeyId}`, a.id]));

  let updated = 0,
    created = 0;
  for (const ft of factTasks) {
    const t = taskById.get(ft.taskId)!;
    const slotById = new Map(t.keys.map((k) => [k.keyId, k]));
    for (const f of ft.facts) {
      const slot = slotById.get(f.keyId)!;
      const v = f.value.trim();
      const data = {
        suppressed: false,
        value: slot.valueKind === 'TEXT' ? v : null,
        applicationId: slot.valueKind === 'APPLICATION' ? appId.get(norm(v))! : null,
        roleId: slot.valueKind === 'ROLE' ? roleId.get(norm(v))! : null,
      };
      if (slot.valueKind === 'APPLICATION' && !data.applicationId) {
        console.error(`No app id for "${v}"`);
        process.exit(1);
      }
      if (slot.valueKind === 'ROLE' && !data.roleId) {
        console.error(`No role id for "${v}"`);
        process.exit(1);
      }
      const rowId = rowIdByPair.get(`${ft.taskId}|${f.keyId}`);
      if (rowId) {
        await prisma.nodeTemplateAnswer.update({ where: { id: rowId }, data });
        updated++;
      } else {
        await prisma.nodeTemplateAnswer.create({
          data: { companyId, processNodeId: ft.taskId, templateKeyId: f.keyId, ...data },
        });
        created++;
      }
    }
  }
  console.log(`Applied: ${updated} updated, ${created} created.`);

  // ---- Post-verify ----
  const check = await prisma.$queryRaw<{ suppressed: bigint; undefinedRows: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = ANY(${taskIds}) AND a."templateKeyId" IS NOT NULL AND a.suppressed)::bigint AS suppressed,
      (SELECT COUNT(*) FROM "NodeTemplateAnswer" a WHERE a."processNodeId" = ANY(${taskIds}) AND a."templateKeyId" IS NOT NULL AND NOT a.suppressed
        AND a.value IS NULL AND a."applicationId" IS NULL AND a."roleId" IS NULL)::bigint AS "undefinedRows"
  `;
  console.log(
    `Post-verify: suppressed generic rows = ${check[0].suppressed} (expect 0), undefined visible rows = ${check[0].undefinedRows} (expect 0).`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
