// Restore pilot NodeRole/NodeAppUsage rows from a backup file, and remove the
// apps created by the pilot apply if they end up unreferenced. Targets whatever
// DATABASE_URL is set — run with an explicit override:
//   DATABASE_URL=<url> npx tsx scripts/restore-pilot-role-app-backup.ts <backup-file> --apply
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const bakArg = process.argv[2];
const CREATED_APP_NAMES = [
  'Event streaming platform (Kafka/Confluent)',
  'Data pipeline orchestrator (Airflow/Dagster/Prefect)',
  'API gateway (Apigee/Kong/Azure API Management)',
];

async function main() {
  if (!bakArg || bakArg.startsWith('--')) {
    console.error('Usage: <backup-file> [--apply]');
    process.exit(1);
  }
  const bak = JSON.parse(readFileSync(bakArg, 'utf8')) as {
    nodeRoles: Record<string, unknown>[];
    nodeAppUsages: Record<string, unknown>[];
  };
  const taskIds = [
    ...new Set([
      ...bak.nodeRoles.map((r) => r.processNodeId as string),
      ...bak.nodeAppUsages.map((a) => a.processNodeId as string),
    ]),
  ];
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-role-app-export.json'), 'utf8')) as {
    tasks: { id: string }[];
  };
  for (const t of exp.tasks) if (!taskIds.includes(t.id)) taskIds.push(t.id);
  console.log(
    `Backup: ${bak.nodeRoles.length} role rows, ${bak.nodeAppUsages.length} app rows across ${taskIds.length} tasks`,
  );

  const [curR, curA] = await Promise.all([
    prisma.nodeRole.count({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeAppUsage.count({ where: { processNodeId: { in: taskIds } } }),
  ]);
  console.log(`Target DB currently has ${curR} role rows, ${curA} app rows in scope.`);
  if (!APPLY) {
    console.log('DRY RUN — pass --apply to restore.');
    await prisma.$disconnect();
    return;
  }

  await prisma.nodeRole.deleteMany({ where: { processNodeId: { in: taskIds } } });
  await prisma.nodeAppUsage.deleteMany({ where: { processNodeId: { in: taskIds } } });
  // Backup rows are full table rows (ids included) — reinsert verbatim.
  const r = await prisma.nodeRole.createMany({
    data: bak.nodeRoles as never[],
    skipDuplicates: true,
  });
  const a = await prisma.nodeAppUsage.createMany({
    data: bak.nodeAppUsages as never[],
    skipDuplicates: true,
  });
  console.log(`Restored ${r.count} role rows, ${a.count} app rows.`);

  for (const name of CREATED_APP_NAMES) {
    const app = await prisma.application.findFirst({
      where: { name },
      select: { id: true, _count: { select: { nodeAppUsages: true } } },
    });
    if (!app) {
      console.log(`App not present (ok): ${name}`);
      continue;
    }
    if (app._count.nodeAppUsages > 0) {
      console.log(`App still referenced, kept: ${name}`);
      continue;
    }
    await prisma.application.delete({ where: { id: app.id } });
    console.log(`Deleted unreferenced app: ${name}`);
  }

  const [finR, finA] = await Promise.all([
    prisma.nodeRole.count({ where: { processNodeId: { in: taskIds } } }),
    prisma.nodeAppUsage.count({ where: { processNodeId: { in: taskIds } } }),
  ]);
  console.log(
    `Final in-scope counts: ${finR} role rows (expect ${bak.nodeRoles.length}), ${finA} app rows (expect ${bak.nodeAppUsages.length})`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
