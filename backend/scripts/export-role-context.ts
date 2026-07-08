// Export every role with its task-level graph context (org home, value
// streams, top deliverables, top applications, sample tasks) so description
// authoring can be grounded in what the role actually does. Output:
// scripts/output/role-context.json. Run:
//   npx tsx --env-file=.env scripts/export-role-context.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      displayValue: true,
      description: true,
      roleFamily: true,
      roleLevel: true,
      orgUnit: {
        select: {
          displayValue: true,
          orgLevelType: { select: { levelNumber: true } },
          parent: { select: { displayValue: true } },
        },
      },
    },
    orderBy: { displayValue: 'asc' },
  });

  const nodeRoles = await prisma.nodeRole.findMany({
    select: { roleId: true, processNodeId: true, processNode: { select: { displayValue: true } } },
  });
  const nodeIds = [...new Set(nodeRoles.map((nr) => nr.processNodeId))];

  const [nodeDelivs, nodeApps] = await Promise.all([
    prisma.nodeDeliverable.findMany({
      where: { processNodeId: { in: nodeIds } },
      select: { processNodeId: true, deliverable: { select: { title: true } } },
    }),
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: nodeIds }, usageType: 'performed' },
      select: { processNodeId: true, application: { select: { name: true } } },
    }),
  ]);

  // Value-stream names per node via the closure (level 2 ancestors).
  const closure = await prisma.processNodeClosure.findMany({
    where: { descendantId: { in: nodeIds } },
    select: {
      descendantId: true,
      ancestor: {
        select: { displayValue: true, processLevelType: { select: { levelNumber: true } } },
      },
    },
  });
  const vsByNode = new Map<string, string>();
  for (const c of closure) {
    if (c.ancestor.processLevelType?.levelNumber === 2) {
      vsByNode.set(c.descendantId, c.ancestor.displayValue);
    }
  }
  const delivsByNode = new Map<string, string[]>();
  for (const nd of nodeDelivs) {
    (
      delivsByNode.get(nd.processNodeId) ??
      delivsByNode.set(nd.processNodeId, []).get(nd.processNodeId)!
    ).push(nd.deliverable.title);
  }
  const appsByNode = new Map<string, string[]>();
  for (const na of nodeApps) {
    (
      appsByNode.get(na.processNodeId) ??
      appsByNode.set(na.processNodeId, []).get(na.processNodeId)!
    ).push(na.application.name);
  }

  const byRole = new Map<string, { nodeId: string; task: string }[]>();
  for (const nr of nodeRoles) {
    (byRole.get(nr.roleId) ?? byRole.set(nr.roleId, []).get(nr.roleId)!).push({
      nodeId: nr.processNodeId,
      task: nr.processNode.displayValue,
    });
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  const out = roles.map((r) => {
    const tasks = byRole.get(r.id) ?? [];
    const vsCounts = new Map<string, number>();
    const delivCounts = new Map<string, number>();
    const appCounts = new Map<string, number>();
    for (const t of tasks) {
      const vs = vsByNode.get(t.nodeId);
      if (vs) vsCounts.set(vs, (vsCounts.get(vs) ?? 0) + 1);
      for (const d of delivsByNode.get(t.nodeId) ?? []) {
        delivCounts.set(d, (delivCounts.get(d) ?? 0) + 1);
      }
      for (const a of appsByNode.get(t.nodeId) ?? []) {
        appCounts.set(a, (appCounts.get(a) ?? 0) + 1);
      }
    }
    const lvl = r.orgUnit?.orgLevelType?.levelNumber;
    return {
      id: r.id,
      name: r.displayValue,
      hasDescription: !!r.description,
      roleFamily: r.roleFamily,
      roleLevel: r.roleLevel,
      division:
        lvl === 3 ? (r.orgUnit?.parent?.displayValue ?? null) : (r.orgUnit?.displayValue ?? null),
      department: lvl === 3 ? (r.orgUnit?.displayValue ?? null) : null,
      taskCount: tasks.length,
      valueStreams: top(vsCounts, 4).map(([name, n]) => ({ name, tasks: n })),
      topDeliverables: top(delivCounts, 8).map(([name]) => name),
      topApplications: top(appCounts, 5).map(([name]) => name),
      sampleTasks: tasks.slice(0, 10).map((t) => t.task),
    };
  });

  mkdirSync('scripts/output', { recursive: true });
  writeFileSync('scripts/output/role-context.json', JSON.stringify(out, null, 1));
  console.log(
    `exported ${out.length} roles (${out.filter((r) => r.hasDescription).length} already described)`,
  );
}

main().finally(() => prisma.$disconnect());
