// Apply pilot role/app cleanup decisions (pilot-decisions/dec-*.json) produced
// from pilot-role-app-export.json. Backs up affected junction rows first.
// Dry run by default; pass --apply to mutate.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

interface ExportTask {
  id: string;
  name: string;
  roles: { nodeRoleId: string; roleId: string; name: string; relation: string }[];
  apps: { usageId: string; appId: string; name: string; usageType: string }[];
}
interface Decision {
  taskId: string;
  taskName: string;
  owner: { action: 'keep' } | { action: 'replace'; name: string };
  removeRoleNames: string[];
  addParticipants: string[];
  removeAppNames: string[];
  addApps: { name: string; usageType: string }[];
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function main() {
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-role-app-export.json'), 'utf8')) as {
    pilot: { l3Id: string; path: string };
    tasks: ExportTask[];
    roleCatalog: { id: string; displayValue: string }[];
    appCatalog: { id: string; name: string }[];
  };
  const taskById = new Map(exp.tasks.map((t) => [t.id, t]));

  const decDir = join(HERE, 'pilot-decisions');
  const decisions: Decision[] = [];
  for (const f of readdirSync(decDir)
    .filter((f) => f.startsWith('dec-') && f.endsWith('.json'))
    .sort()) {
    const b = JSON.parse(readFileSync(join(decDir, f), 'utf8')) as { decisions: Decision[] };
    decisions.push(...b.decisions);
  }
  console.log(
    `Loaded ${decisions.length} decisions for ${exp.tasks.length} pilot tasks (${exp.pilot.path})`,
  );

  // ---- Validate ----
  const errs: string[] = [];
  const seen = new Set<string>();
  const roleByName = new Map(exp.roleCatalog.map((r) => [norm(r.displayValue), r]));
  const appByName = new Map(exp.appCatalog.map((a) => [norm(a.name), a]));
  const newRoleNames = new Set<string>();
  const newAppNames = new Set<string>();

  for (const d of decisions) {
    const t = taskById.get(d.taskId);
    if (!t) {
      errs.push(`Unknown taskId ${d.taskId} (${d.taskName})`);
      continue;
    }
    if (seen.has(d.taskId)) {
      errs.push(`Duplicate decision for ${d.taskName}`);
      continue;
    }
    seen.add(d.taskId);

    const currentOwner = t.roles.find((r) => r.relation === 'Owner');
    const removes = new Set(d.removeRoleNames.map(norm));
    // removeRoleNames only ever deletes Participant rows; naming the kept Owner
    // is legitimate when the same role is duplicated as a Participant (dedupe).

    // Track brand-new roles/apps referenced.
    const roleRefs = [
      ...d.addParticipants,
      ...(d.owner.action === 'replace' ? [d.owner.name] : []),
    ];
    for (const n of roleRefs) if (!roleByName.has(norm(n))) newRoleNames.add(n.trim());
    for (const a of d.addApps) if (!appByName.has(norm(a.name))) newAppNames.add(a.name.trim());
    for (const a of d.addApps)
      if (!['performed', 'memorialized'].includes(a.usageType))
        errs.push(`${d.taskName}: bad usageType "${a.usageType}"`);

    // Post-state invariants.
    const keptParticipants = t.roles.filter(
      (r) => r.relation === 'Participant' && !removes.has(norm(r.name)),
    );
    const ownerAfter = d.owner.action === 'replace' ? 1 : currentOwner ? 1 : 0;
    if (ownerAfter + keptParticipants.length + d.addParticipants.length < 1)
      errs.push(`${d.taskName}: would end with zero roles`);
    if (ownerAfter === 0) errs.push(`${d.taskName}: would end with no Owner`);
    const removedApps = new Set(d.removeAppNames.map(norm));
    const keptApps = new Set(
      t.apps.filter((a) => !removedApps.has(norm(a.name))).map((a) => norm(a.name)),
    );
    for (const a of d.addApps) keptApps.add(norm(a.name));
    if (keptApps.size < 1) errs.push(`${d.taskName}: would end with zero apps`);
  }
  const missing = exp.tasks.filter((t) => !seen.has(t.id));
  if (missing.length)
    console.log(
      `WARNING: ${missing.length} pilot tasks have no decision (left untouched): ${missing
        .slice(0, 5)
        .map((t) => t.name)
        .join('; ')}${missing.length > 5 ? ' …' : ''}`,
    );
  if (errs.length) {
    console.error(`VALIDATION FAILED (${errs.length}):`);
    for (const e of errs) console.error(' - ' + e);
    process.exit(1);
  }
  console.log(
    `Validation OK. New roles to create: ${newRoleNames.size} ${[...newRoleNames].map((n) => `"${n}"`).join(', ')}`,
  );
  console.log(
    `New apps to create: ${newAppNames.size} ${[...newAppNames].map((n) => `"${n}"`).join(', ')}`,
  );

  // ---- Plan mutations ----
  let delRoleIds: string[] = [];
  let delUsageIds: string[] = [];
  const addRoleLinks: { taskId: string; roleName: string; relation: string }[] = [];
  const addAppLinks: { taskId: string; appName: string; usageType: string }[] = [];

  for (const d of decisions) {
    const t = taskById.get(d.taskId)!;
    const removes = new Set(d.removeRoleNames.map(norm));
    // participants pruned by name (Owner rows only removed via replace)
    delRoleIds.push(
      ...t.roles
        .filter((r) => r.relation === 'Participant' && removes.has(norm(r.name)))
        .map((r) => r.nodeRoleId),
    );
    if (d.owner.action === 'replace') {
      const cur = t.roles.filter((r) => r.relation === 'Owner');
      delRoleIds.push(...cur.map((r) => r.nodeRoleId));
      addRoleLinks.push({ taskId: t.id, roleName: d.owner.name, relation: 'Owner' });
    }
    const existingPart = new Set(
      t.roles.filter((r) => r.relation === 'Participant').map((r) => norm(r.name)),
    );
    for (const p of d.addParticipants)
      if (!existingPart.has(norm(p)))
        addRoleLinks.push({ taskId: t.id, roleName: p, relation: 'Participant' });
    const removedApps = new Set(d.removeAppNames.map(norm));
    delUsageIds.push(...t.apps.filter((a) => removedApps.has(norm(a.name))).map((a) => a.usageId));
    const existingApps = new Set(t.apps.map((a) => `${norm(a.name)}|${a.usageType}`));
    for (const a of d.addApps)
      if (!existingApps.has(`${norm(a.name)}|${a.usageType}`))
        addAppLinks.push({ taskId: t.id, appName: a.name, usageType: a.usageType });
  }
  delRoleIds = [...new Set(delRoleIds)];
  delUsageIds = [...new Set(delUsageIds)];
  console.log(
    `\nPlan: -${delRoleIds.length} role links, -${delUsageIds.length} app links, +${addRoleLinks.length} role links, +${addAppLinks.length} app links`,
  );
  if (!APPLY) {
    console.log('\nDRY RUN (pass --apply to execute).');
    await prisma.$disconnect();
    return;
  }

  // ---- Backup ----
  const taskIds = exp.tasks.map((t) => t.id);
  const [bakRoles, bakApps] = await Promise.all([
    prisma.nodeRole.findMany({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeAppUsage.findMany({ where: { processNodeId: { in: taskIds } } }),
  ]);
  const bakDir = join(HERE, 'backups');
  if (!existsSync(bakDir)) mkdirSync(bakDir);
  const bakFile = join(
    bakDir,
    `pilot-role-app-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(bakFile, JSON.stringify({ nodeRoles: bakRoles, nodeAppUsages: bakApps }, null, 2));
  console.log(`Backup: ${bakFile} (${bakRoles.length} role rows, ${bakApps.length} app rows)`);

  // ---- Create missing roles/apps ----
  const node = await prisma.processNode.findUniqueOrThrow({
    where: { id: exp.pilot.l3Id },
    select: { companyId: true },
  });
  const companyId = node.companyId;
  const roleIdByName = new Map(exp.roleCatalog.map((r) => [norm(r.displayValue), r.id]));
  const appIdByName = new Map(exp.appCatalog.map((a) => [norm(a.name), a.id]));
  for (const name of newRoleNames) {
    // re-check live DB (catalog snapshot may be stale / case-variant)
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
            roleFamily: 'Engineering',
            roleLevel: 'Individual Contributor',
          },
          select: { id: true },
        })
      ).id;
    roleIdByName.set(norm(name), id);
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
          data: { companyId, name, kind: 'Tool', category: 'Infra', illustrative: false },
          select: { id: true },
        })
      ).id;
    appIdByName.set(norm(name), id);
    console.log(`${existing ? 'Found' : 'Created'} app: ${name}`);
  }

  // ---- Mutate ----
  const delR = await prisma.nodeRole.deleteMany({ where: { id: { in: delRoleIds } } });
  const delA = await prisma.nodeAppUsage.deleteMany({ where: { id: { in: delUsageIds } } });
  const addR = await prisma.nodeRole.createMany({
    data: addRoleLinks.map((l) => ({
      companyId,
      processNodeId: l.taskId,
      roleId: roleIdByName.get(norm(l.roleName))!,
      role_: l.relation,
    })),
    skipDuplicates: true,
  });
  const addA = await prisma.nodeAppUsage.createMany({
    data: addAppLinks.map((l) => ({
      companyId,
      processNodeId: l.taskId,
      applicationId: appIdByName.get(norm(l.appName))!,
      usageType: l.usageType,
    })),
    skipDuplicates: true,
  });
  console.log(
    `\nApplied: -${delR.count} role links, -${delA.count} app links, +${addR.count} role links, +${addA.count} app links`,
  );

  // ---- Post-verify invariants ----
  const bad = await prisma.$queryRaw<{ id: string; name: string; owners: bigint; apps: bigint }[]>`
    SELECT pn.id, pn."displayValue" AS name,
      (SELECT COUNT(*) FROM "NodeRole" nr WHERE nr."processNodeId" = pn.id AND nr.role_ = 'Owner')::bigint AS owners,
      (SELECT COUNT(*) FROM "NodeAppUsage" na WHERE na."processNodeId" = pn.id)::bigint AS apps
    FROM "ProcessNode" pn WHERE pn.id = ANY(${taskIds})
      AND ((SELECT COUNT(*) FROM "NodeRole" nr WHERE nr."processNodeId" = pn.id AND nr.role_ = 'Owner') <> 1
        OR (SELECT COUNT(*) FROM "NodeAppUsage" na WHERE na."processNodeId" = pn.id) < 1)
  `;
  if (bad.length) {
    console.error('INVARIANT VIOLATIONS:');
    for (const b of bad) console.error(` - ${b.name}: owners=${b.owners} apps=${b.apps}`);
  } else console.log('Post-verify OK: every pilot task has exactly 1 Owner and >=1 app.');

  const hist = await prisma.$queryRaw<{ kind: string; avg: number; max: bigint }[]>`
    SELECT 'roles' AS kind, ROUND(AVG(c), 2)::float AS avg, MAX(c)::bigint AS max FROM (
      SELECT COUNT(*) c FROM "NodeRole" WHERE "processNodeId" = ANY(${taskIds}) GROUP BY "processNodeId") t
    UNION ALL
    SELECT 'apps', ROUND(AVG(c), 2)::float, MAX(c)::bigint FROM (
      SELECT COUNT(*) c FROM "NodeAppUsage" WHERE "processNodeId" = ANY(${taskIds}) GROUP BY "processNodeId") t
  `;
  for (const h of hist) console.log(`${h.kind}: avg ${h.avg}/task, max ${h.max}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
