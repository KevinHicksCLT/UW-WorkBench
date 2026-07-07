// Export pilot subtree (Technology > Technology & Engineering > Software
// Engineering & Delivery) tasks with current roles/apps + catalogs, for the
// role/app cleanup classification. Writes JSON next to this script.
import { writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

async function main() {
  // Find the L3 area by walking the named path.
  const l3 = await prisma.processNode.findFirst({
    where: {
      displayValue: 'Software Engineering & Delivery',
      parent: { displayValue: 'Technology & Engineering' },
    },
    select: {
      id: true,
      displayValue: true,
      parent: { select: { displayValue: true, parent: { select: { displayValue: true } } } },
    },
  });
  if (!l3) {
    // Help debug: list candidates
    const cands = await prisma.processNode.findMany({
      where: { displayValue: { contains: 'Software Engineering', mode: 'insensitive' } },
      select: {
        id: true,
        displayValue: true,
        parent: { select: { displayValue: true } },
        processLevelType: { select: { levelNumber: true } },
      },
    });
    console.log('L3 not found. Candidates:', JSON.stringify(cands, null, 2));
    process.exit(1);
  }
  console.log(
    `Pilot node: ${l3.parent?.parent?.displayValue} > ${l3.parent?.displayValue} > ${l3.displayValue} (${l3.id})`,
  );

  // Subtree tasks via closure
  const desc = await prisma.processNodeClosure.findMany({
    where: { ancestorId: l3.id },
    select: { descendantId: true },
  });
  const ids = desc.map((d) => d.descendantId);
  const tasks = await prisma.processNode.findMany({
    where: { id: { in: ids }, isTask: true },
    select: {
      id: true,
      displayValue: true,
      description: true,
      parent: { select: { displayValue: true, parent: { select: { displayValue: true } } } },
    },
    orderBy: { displayValue: 'asc' },
  });
  console.log(`Tasks in subtree: ${tasks.length}`);

  const taskIds = tasks.map((t) => t.id);
  const [roles, apps] = await Promise.all([
    prisma.nodeRole.findMany({
      where: { processNodeId: { in: taskIds } },
      select: {
        id: true,
        processNodeId: true,
        role_: true,
        role: { select: { id: true, displayValue: true } },
      },
    }),
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: taskIds } },
      select: {
        id: true,
        processNodeId: true,
        usageType: true,
        application: { select: { id: true, name: true } },
      },
    }),
  ]);

  const rolesByTask = new Map<
    string,
    { nodeRoleId: string; roleId: string; name: string; relation: string }[]
  >();
  for (const r of roles) {
    const l = rolesByTask.get(r.processNodeId) ?? [];
    l.push({ nodeRoleId: r.id, roleId: r.role.id, name: r.role.displayValue, relation: r.role_ });
    rolesByTask.set(r.processNodeId, l);
  }
  const appsByTask = new Map<
    string,
    { usageId: string; appId: string; name: string; usageType: string }[]
  >();
  for (const a of apps) {
    const l = appsByTask.get(a.processNodeId) ?? [];
    l.push({
      usageId: a.id,
      appId: a.application.id,
      name: a.application.name,
      usageType: a.usageType,
    });
    appsByTask.set(a.processNodeId, l);
  }

  // Catalogs — classification must pick from these; new entries only if a real,
  // specific product/role genuinely missing.
  const [roleCatalog, appCatalog] = await Promise.all([
    prisma.role.findMany({
      select: { id: true, displayValue: true },
      orderBy: { displayValue: 'asc' },
    }),
    prisma.application.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const out = {
    pilot: {
      l3Id: l3.id,
      path: `${l3.parent?.parent?.displayValue} > ${l3.parent?.displayValue} > ${l3.displayValue}`,
    },
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.displayValue,
      description: t.description,
      l4: t.parent?.displayValue ?? null,
      roles: rolesByTask.get(t.id) ?? [],
      apps: appsByTask.get(t.id) ?? [],
    })),
    roleCatalog,
    appCatalog: appCatalog.map((a) => ({ id: a.id, name: a.name })),
  };
  writeFileSync(
    new URL('./pilot-role-app-export.json', import.meta.url),
    JSON.stringify(out, null, 2),
  );
  console.log(
    `Wrote pilot-role-app-export.json — ${out.tasks.length} tasks, ${roleCatalog.length} roles, ${appCatalog.length} apps in catalogs`,
  );
  console.log(`Role links: ${roles.length}, app links: ${apps.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
