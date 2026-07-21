// Build a per-area authoring seed for Work Library plans: joins the task list
// (name/description) with the already-authored enrichment (owner, participants,
// apps, task-specific checklist, testing) resolved to NAMES, so the plan author
// works purely from names.
//   npx tsx --env-file=.env scripts/enrich/dump-workplan-seed.ts <slug>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error('usage: dump-workplan-seed.ts <slug>');
  const tasksFile = JSON.parse(
    readFileSync(`scripts/output/enrich-tasks-${slug}.json`, 'utf8'),
  ) as {
    area: string;
    tasks: { id: string; subProcess: string; task: string; description: string | null }[];
  };
  type PartRow = {
    taskId: string;
    roles: { roleId: string; rel: string }[];
    apps: { appId: string }[];
    checklistSpecific: string[];
    testing: { expected: string }[];
  };
  const partPath = `scripts/output/enrichment-part-${slug}.json`;
  const mergedPath = `scripts/output/enrichment-${slug}.json`;
  const raw = JSON.parse(readFileSync(existsSync(partPath) ? partPath : mergedPath, 'utf8'));
  const part = (Array.isArray(raw) ? raw : raw.tasks) as PartRow[];
  const partById = new Map(part.map((p) => [p.taskId, p]));

  const roleIds = [...new Set(part.flatMap((p) => p.roles.map((r) => r.roleId)))];
  const appIds = [...new Set(part.flatMap((p) => p.apps.map((a) => a.appId)))];
  const [roles, apps] = await Promise.all([
    prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, displayValue: true },
    }),
    prisma.application.findMany({
      where: { id: { in: appIds } },
      select: { id: true, name: true },
    }),
  ]);
  const roleName = new Map(roles.map((r) => [r.id, r.displayValue]));
  const appName = new Map(apps.map((a) => [a.id, a.name]));

  const out = tasksFile.tasks.map((t) => {
    const p = partById.get(t.id);
    const owner = p?.roles.find((r) => r.rel === 'Owner');
    return {
      id: t.id,
      subProcess: t.subProcess,
      name: t.task,
      description: t.description,
      owner: owner ? (roleName.get(owner.roleId) ?? null) : null,
      participants: (p?.roles.filter((r) => r.rel === 'Participant') ?? [])
        .map((r) => roleName.get(r.roleId))
        .filter(Boolean),
      apps: (p?.apps ?? []).map((a) => appName.get(a.appId)).filter(Boolean),
      specificChecklist: p?.checklistSpecific ?? [],
      testing: (p?.testing ?? []).map((x) => x.expected),
    };
  });
  writeFileSync(
    `scripts/output/wp-seed-${slug}.json`,
    JSON.stringify({ area: tasksFile.area, tasks: out }, null, 2),
  );
  console.log(`wp-seed-${slug}: ${out.length} tasks`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
