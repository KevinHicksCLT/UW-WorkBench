// Apply the Underwriting enrichment decisions (scripts/uw-enrichment/dec-*.json,
// produced by research subagents). Per task:
//   roles/apps → pilot-style cleanup (owner keep/replace, prune participant +
//                app links by name, add participants/apps; creates missing
//                Role/Application rows exactly like the UI "add new").
//   answers    → NodeTemplateAnswer values (generic keys by templateKeyId
//                upsert, custom keys by answerId update). Entity-typed values
//                resolve to Application/Role FKs; newApplication/newRole create
//                the catalog row.
//   standards/regulations → NodeStandard/NodeRegulation ties on the task +
//                NodeStandardEvidence/NodeRegulationEvidence steps WITH values.
// Idempotent: answer upserts overwrite; ties skipDuplicates; evidence deduped
// by (node, entity, kind, step). Backs up affected junction rows first.
// Dry run by default; pass --apply to mutate.
// Run: npx tsx --env-file=.env scripts/apply-uw-enrichment.ts [--apply]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'uw-enrichment');
const APPLY = process.argv.includes('--apply');

type Step = { step: string; value?: string | null };
type Tie = { standardId?: string; regId?: string; checklist?: Step[]; testing?: Step[] };
type AnswerDec = {
  templateKeyId?: string;
  answerId?: string;
  value?: string | null;
  applicationId?: string | null;
  roleId?: string | null;
  newApplication?: string;
  newRole?: string;
};
type TaskDec = {
  id: string;
  owner?: { action: 'keep' } | { action: 'replace'; name: string };
  removeRoleNames?: string[];
  addParticipants?: string[];
  removeAppNames?: string[];
  addApps?: { name: string; usageType: string }[];
  answers?: AnswerDec[];
  standards?: Tie[];
  regulations?: Tie[];
};
type ExportTask = {
  id: string;
  name: string;
  roles: { nodeRoleId: string; id: string; name: string; relation: string }[];
  apps: { usageId: string; id: string; name: string; usageType: string }[];
};

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const companyId = company.id;

  const exp = JSON.parse(readFileSync(join(DIR, 'export.json'), 'utf8')) as {
    tasks: ExportTask[];
  };
  const taskById = new Map(exp.tasks.map((t) => [t.id, t]));

  const files = readdirSync(DIR)
    .filter((f) => /^dec-\d+\.json$/.test(f))
    .sort();
  console.log(`decision files (${files.length}):`, files.join(', '));
  const decisions: TaskDec[] = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { tasks: TaskDec[] };
    decisions.push(...d.tasks);
  }

  const [keys, roles, apps, stds, regs] = await Promise.all([
    prisma.workTemplateKey.findMany({ select: { id: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true } }),
    prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.standard.findMany({ where: { companyId }, select: { id: true } }),
    prisma.regulatoryRequirement.findMany({ where: { companyId }, select: { id: true } }),
  ]);
  const keyIds = new Set(keys.map((x) => x.id));
  const roleIds = new Set(roles.map((x) => x.id));
  const roleByName = new Map(roles.map((r) => [norm(r.displayValue), r.id]));
  const appIds = new Set(apps.map((x) => x.id));
  const appByName = new Map(apps.map((a) => [norm(a.name), a.id]));
  const stdIds = new Set(stds.map((x) => x.id));
  const regIds = new Set(regs.map((x) => x.id));

  // ---- Validate ----
  const errs: string[] = [];
  const seen = new Set<string>();
  const newRoleNames = new Set<string>();
  const newAppNames = new Set<string>();
  for (const d of decisions) {
    const t = taskById.get(d.id);
    if (!t) {
      errs.push(`Unknown taskId ${d.id}`);
      continue;
    }
    if (seen.has(d.id)) {
      errs.push(`Duplicate decision for ${t.name}`);
      continue;
    }
    seen.add(d.id);
    const removes = new Set((d.removeRoleNames ?? []).map(norm));
    const roleRefs = [
      ...(d.addParticipants ?? []),
      ...(d.owner?.action === 'replace' ? [d.owner.name] : []),
      ...(d.answers ?? []).flatMap((a) => (a.newRole ? [a.newRole] : [])),
    ];
    for (const n of roleRefs) if (!roleByName.has(norm(n))) newRoleNames.add(n.trim());
    for (const a of d.addApps ?? [])
      if (!appByName.has(norm(a.name))) newAppNames.add(a.name.trim());
    for (const a of d.answers ?? [])
      if (a.newApplication && !appByName.has(norm(a.newApplication)))
        newAppNames.add(a.newApplication.trim());
    for (const a of d.addApps ?? [])
      if (!['performed', 'memorialized'].includes(a.usageType))
        errs.push(`${t.name}: bad usageType "${a.usageType}"`);

    const keptParticipants = t.roles.filter(
      (r) => r.relation === 'Participant' && !removes.has(norm(r.name)),
    );
    const currentOwner = t.roles.find((r) => r.relation === 'Owner');
    const ownerAfter = d.owner?.action === 'replace' ? 1 : currentOwner ? 1 : 0;
    if (ownerAfter === 0) errs.push(`${t.name}: would end with no Owner`);
    if (ownerAfter + keptParticipants.length + (d.addParticipants ?? []).length < 1)
      errs.push(`${t.name}: would end with zero roles`);
    const removedApps = new Set((d.removeAppNames ?? []).map(norm));
    const keptApps = new Set(
      t.apps.filter((a) => !removedApps.has(norm(a.name))).map((a) => norm(a.name)),
    );
    for (const a of d.addApps ?? []) keptApps.add(norm(a.name));
    if (keptApps.size < 1) errs.push(`${t.name}: would end with zero apps`);
  }
  const missing = exp.tasks.filter((t) => !seen.has(t.id));
  if (missing.length)
    console.log(
      `WARNING: ${missing.length} tasks have no decision (left untouched): ${missing
        .slice(0, 5)
        .map((t) => t.name)
        .join('; ')}${missing.length > 5 ? ' …' : ''}`,
    );
  if (errs.length) {
    console.error(`VALIDATION FAILED (${errs.length}):`);
    for (const e of errs) console.error(' - ' + e);
    process.exit(1);
  }
  console.log(`Validation OK. New roles: ${newRoleNames.size}, new apps: ${newAppNames.size}`);
  if (newRoleNames.size) console.log('  roles:', [...newRoleNames].join(' | '));
  if (newAppNames.size) console.log('  apps:', [...newAppNames].join(' | '));

  const stats = {
    tasks: 0,
    delRoles: 0,
    addRoles: 0,
    delApps: 0,
    addApps: 0,
    generic: 0,
    custom: 0,
    stdTies: 0,
    regTies: 0,
    stdSteps: 0,
    regSteps: 0,
    skipped: 0,
  };

  // Dry-run tallies answers/ties without mutating.
  if (!APPLY) {
    for (const d of decisions) {
      const t = taskById.get(d.id)!;
      stats.tasks++;
      const removes = new Set((d.removeRoleNames ?? []).map(norm));
      stats.delRoles += t.roles.filter(
        (r) => r.relation === 'Participant' && removes.has(norm(r.name)),
      ).length;
      if (d.owner?.action === 'replace') {
        stats.delRoles += t.roles.filter((r) => r.relation === 'Owner').length;
        stats.addRoles++;
      }
      stats.addRoles += (d.addParticipants ?? []).length;
      const removedApps = new Set((d.removeAppNames ?? []).map(norm));
      stats.delApps += t.apps.filter((a) => removedApps.has(norm(a.name))).length;
      stats.addApps += (d.addApps ?? []).length;
      for (const a of d.answers ?? []) {
        if (a.templateKeyId && keyIds.has(a.templateKeyId)) stats.generic++;
        else if (a.answerId) stats.custom++;
        else stats.skipped++;
      }
      stats.stdTies += (d.standards ?? []).filter(
        (x) => x.standardId && stdIds.has(x.standardId),
      ).length;
      stats.regTies += (d.regulations ?? []).filter((x) => x.regId && regIds.has(x.regId)).length;
      stats.stdSteps += (d.standards ?? []).reduce(
        (s, x) => s + (x.checklist?.length ?? 0) + (x.testing?.length ?? 0),
        0,
      );
      stats.regSteps += (d.regulations ?? []).reduce(
        (s, x) => s + (x.checklist?.length ?? 0) + (x.testing?.length ?? 0),
        0,
      );
    }
    console.log('DRY RUN (pass --apply to execute):', stats);
    await prisma.$disconnect();
    return;
  }

  // ---- Backup ----
  const taskIdList = decisions.map((d) => d.id);
  const [bakRoles, bakApps, bakAnswers] = await Promise.all([
    prisma.nodeRole.findMany({ where: { processNodeId: { in: taskIdList } } }),
    prisma.nodeAppUsage.findMany({ where: { processNodeId: { in: taskIdList } } }),
    prisma.nodeTemplateAnswer.findMany({ where: { processNodeId: { in: taskIdList } } }),
  ]);
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `uw-enrichment-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    bakFile,
    JSON.stringify({ nodeRoles: bakRoles, nodeAppUsages: bakApps, answers: bakAnswers }, null, 2),
  );
  console.log(
    `Backup: ${bakFile} (${bakRoles.length} role rows, ${bakApps.length} app rows, ${bakAnswers.length} answers)`,
  );

  // ---- Create missing roles/apps ----
  for (const name of newRoleNames) {
    const existing = await prisma.role.findFirst({
      where: { companyId, displayValue: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await prisma.role.create({
          data: {
            companyId,
            dbValue: name,
            displayValue: name,
            roleFamily: 'Underwriting',
            roleLevel: 'Individual Contributor',
          },
          select: { id: true },
        })
      ).id;
    roleByName.set(norm(name), id);
    roleIds.add(id);
    console.log(`${existing ? 'Found' : 'Created'} role: ${name}`);
  }
  for (const name of newAppNames) {
    const existing = await prisma.application.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await prisma.application.create({
          data: { companyId, name, kind: 'SystemOfRecord', illustrative: false },
          select: { id: true },
        })
      ).id;
    appByName.set(norm(name), id);
    appIds.add(id);
    console.log(`${existing ? 'Found' : 'Created'} app: ${name}`);
  }

  // ---- Mutate ----
  for (const d of decisions) {
    const t = taskById.get(d.id)!;
    stats.tasks++;

    // Roles
    const removes = new Set((d.removeRoleNames ?? []).map(norm));
    const delRoleIds = t.roles
      .filter((r) => r.relation === 'Participant' && removes.has(norm(r.name)))
      .map((r) => r.nodeRoleId);
    if (d.owner?.action === 'replace')
      delRoleIds.push(...t.roles.filter((r) => r.relation === 'Owner').map((r) => r.nodeRoleId));
    if (delRoleIds.length) {
      const del = await prisma.nodeRole.deleteMany({ where: { id: { in: delRoleIds } } });
      stats.delRoles += del.count;
    }
    const addRoleRows: { roleId: string; role_: string }[] = [];
    if (d.owner?.action === 'replace') {
      const rid = roleByName.get(norm(d.owner.name));
      if (rid) addRoleRows.push({ roleId: rid, role_: 'Owner' });
      else console.warn(`WARN ${t.name}: owner role "${d.owner.name}" unresolved — skipped`);
    }
    const existingPart = new Set(
      t.roles
        .filter((r) => r.relation === 'Participant' && !removes.has(norm(r.name)))
        .map((r) => norm(r.name)),
    );
    for (const p of d.addParticipants ?? [])
      if (!existingPart.has(norm(p))) {
        const rid = roleByName.get(norm(p));
        if (rid) addRoleRows.push({ roleId: rid, role_: 'Participant' });
        else console.warn(`WARN ${t.name}: participant role "${p}" unresolved — skipped`);
      }
    if (addRoleRows.length) {
      const add = await prisma.nodeRole.createMany({
        data: addRoleRows.map((r) => ({ companyId, processNodeId: t.id, ...r })),
        skipDuplicates: true,
      });
      stats.addRoles += add.count;
    }

    // Apps
    const removedApps = new Set((d.removeAppNames ?? []).map(norm));
    const delUsageIds = t.apps.filter((a) => removedApps.has(norm(a.name))).map((a) => a.usageId);
    if (delUsageIds.length) {
      const del = await prisma.nodeAppUsage.deleteMany({ where: { id: { in: delUsageIds } } });
      stats.delApps += del.count;
    }
    const existingApps = new Set(
      t.apps.filter((a) => !removedApps.has(norm(a.name))).map((a) => norm(a.name)),
    );
    const addAppRows = (d.addApps ?? []).filter((a) => !existingApps.has(norm(a.name)));
    if (addAppRows.length) {
      const add = await prisma.nodeAppUsage.createMany({
        data: addAppRows.map((a) => ({
          companyId,
          processNodeId: t.id,
          applicationId: appByName.get(norm(a.name))!,
          usageType: a.usageType,
        })),
        skipDuplicates: true,
      });
      stats.addApps += add.count;
    }

    // Answers
    for (const a of d.answers ?? []) {
      let applicationId = a.applicationId && appIds.has(a.applicationId) ? a.applicationId : null;
      if (!applicationId && a.newApplication)
        applicationId = appByName.get(norm(a.newApplication)) ?? null;
      let roleId = a.roleId && roleIds.has(a.roleId) ? a.roleId : null;
      if (!roleId && a.newRole) roleId = roleByName.get(norm(a.newRole)) ?? null;
      const data = { value: a.value ?? null, applicationId, roleId };
      if (a.templateKeyId && keyIds.has(a.templateKeyId)) {
        await prisma.nodeTemplateAnswer.upsert({
          where: {
            processNodeId_templateKeyId: { processNodeId: t.id, templateKeyId: a.templateKeyId },
          },
          update: data,
          create: { companyId, processNodeId: t.id, templateKeyId: a.templateKeyId, ...data },
        });
        stats.generic++;
      } else if (a.answerId) {
        const upd = await prisma.nodeTemplateAnswer.updateMany({
          where: { id: a.answerId, processNodeId: t.id },
          data,
        });
        if (upd.count) stats.custom++;
        else stats.skipped++;
      } else {
        stats.skipped++;
      }
    }

    // Standards / regulations ties + evidence
    for (const tie of d.standards ?? []) {
      if (!tie.standardId || !stdIds.has(tie.standardId)) {
        stats.skipped++;
        continue;
      }
      await prisma.nodeStandard.upsert({
        where: {
          processNodeId_standardId: { processNodeId: t.id, standardId: tie.standardId },
        },
        update: { excluded: false },
        create: { companyId, processNodeId: t.id, standardId: tie.standardId },
      });
      stats.stdTies++;
      const existing = await prisma.nodeStandardEvidence.findMany({
        where: { processNodeId: t.id, standardId: tie.standardId },
        select: { kind: true, step: true },
      });
      const seenSteps = new Set(existing.map((e) => `${e.kind}|${e.step}`));
      const rows = [
        ...(tie.checklist ?? []).map((s, i) => ({
          kind: 'CHECKLIST',
          step: s.step,
          value: s.value ?? null,
          sortOrder: i,
        })),
        ...(tie.testing ?? []).map((s, i) => ({
          kind: 'TEST',
          step: s.step,
          value: s.value ?? null,
          sortOrder: i,
        })),
      ].filter((r) => r.step && !seenSteps.has(`${r.kind}|${r.step}`));
      if (rows.length) {
        await prisma.nodeStandardEvidence.createMany({
          data: rows.map((r) => ({
            companyId,
            processNodeId: t.id,
            standardId: tie.standardId!,
            ...r,
          })),
        });
        stats.stdSteps += rows.length;
      }
    }
    for (const tie of d.regulations ?? []) {
      if (!tie.regId || !regIds.has(tie.regId)) {
        stats.skipped++;
        continue;
      }
      await prisma.nodeRegulation.upsert({
        where: { processNodeId_regId: { processNodeId: t.id, regId: tie.regId } },
        update: { excluded: false },
        create: { companyId, processNodeId: t.id, regId: tie.regId },
      });
      stats.regTies++;
      const existing = await prisma.nodeRegulationEvidence.findMany({
        where: { processNodeId: t.id, regId: tie.regId },
        select: { kind: true, step: true },
      });
      const seenSteps = new Set(existing.map((e) => `${e.kind}|${e.step}`));
      const rows = [
        ...(tie.checklist ?? []).map((s, i) => ({
          kind: 'CHECKLIST',
          step: s.step,
          value: s.value ?? null,
          sortOrder: i,
        })),
        ...(tie.testing ?? []).map((s, i) => ({
          kind: 'TEST',
          step: s.step,
          value: s.value ?? null,
          sortOrder: i,
        })),
      ].filter((r) => r.step && !seenSteps.has(`${r.kind}|${r.step}`));
      if (rows.length) {
        await prisma.nodeRegulationEvidence.createMany({
          data: rows.map((r) => ({ companyId, processNodeId: t.id, regId: tie.regId!, ...r })),
        });
        stats.regSteps += rows.length;
      }
    }
  }
  console.log('applied:', stats);

  // ---- Post-verify invariants ----
  const bad = await prisma.$queryRaw<{ id: string; name: string; owners: bigint; apps: bigint }[]>`
    SELECT pn.id, pn."displayValue" AS name,
      (SELECT COUNT(*) FROM "NodeRole" nr WHERE nr."processNodeId" = pn.id AND nr.role_ = 'Owner')::bigint AS owners,
      (SELECT COUNT(*) FROM "NodeAppUsage" na WHERE na."processNodeId" = pn.id)::bigint AS apps
    FROM "ProcessNode" pn WHERE pn.id = ANY(${taskIdList})
      AND ((SELECT COUNT(*) FROM "NodeRole" nr WHERE nr."processNodeId" = pn.id AND nr.role_ = 'Owner') <> 1
        OR (SELECT COUNT(*) FROM "NodeAppUsage" na WHERE na."processNodeId" = pn.id) < 1)
  `;
  if (bad.length) {
    console.error(`INVARIANT VIOLATIONS (${bad.length}):`);
    for (const b of bad.slice(0, 20))
      console.error(` - ${b.name}: owners=${b.owners} apps=${b.apps}`);
  } else console.log('Post-verify OK: every task has exactly 1 Owner and >=1 app.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
