// Verify pilot cleanup: rollup-derived role/app sets at the pilot L3 and its
// L2 value stream, plus global orphan (zero-link) role/app counts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function rollup(nodeId: string, label: string) {
  const desc = await prisma.processNodeClosure.findMany({
    where: { ancestorId: nodeId },
    select: { descendantId: true },
  });
  const ids = desc.map((d) => d.descendantId);
  const [roles, apps] = await Promise.all([
    prisma.nodeRole.findMany({
      where: { processNodeId: { in: ids } },
      select: { roleId: true, role: { select: { displayValue: true } } },
    }),
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: ids } },
      select: { applicationId: true, application: { select: { name: true } } },
    }),
  ]);
  const rset = new Map(roles.map((r) => [r.roleId, r.role.displayValue]));
  const aset = new Map(apps.map((a) => [a.applicationId, a.application.name]));
  console.log(`\n=== ${label} rollup ===`);
  console.log(`Distinct roles: ${rset.size}`);
  console.log(`Distinct apps: ${aset.size}`);
  console.log('Apps: ' + [...aset.values()].sort().join(' | '));
  return { rset, aset };
}

async function main() {
  const exp = JSON.parse(readFileSync(join(HERE, 'pilot-role-app-export.json'), 'utf8')) as {
    pilot: { l3Id: string };
  };
  const l3 = await prisma.processNode.findUniqueOrThrow({
    where: { id: exp.pilot.l3Id },
    select: { id: true, displayValue: true, parentId: true },
  });
  await rollup(l3.id, `L3 ${l3.displayValue}`);
  if (l3.parentId) {
    const l2 = await prisma.processNode.findUniqueOrThrow({
      where: { id: l3.parentId },
      select: { id: true, displayValue: true },
    });
    await rollup(l2.id, `L2 ${l2.displayValue}`);
  }

  // Global orphans — candidates for the post-rollout cleanup (NOT deleted now).
  const orphanRoles = await prisma.role.count({
    where: {
      nodeRoles: { none: {} },
      roleStandards: { none: {} },
      roleRegulations: { none: {} },
      roleDeliverables: { none: {} },
    },
  });
  const orphanApps = await prisma.application.count({ where: { nodeAppUsages: { none: {} } } });
  console.log(`\n=== Global orphan candidates (deferred cleanup) ===`);
  console.log(`Roles with zero task/standard/regulation/deliverable links: ${orphanRoles}`);
  console.log(`Applications with zero NodeAppUsage links: ${orphanApps}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
