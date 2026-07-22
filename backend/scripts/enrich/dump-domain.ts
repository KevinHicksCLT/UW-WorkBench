// scratch: one-process variant of dump-catalog.ts that dumps the domain catalog
// once and EVERY L3 area's task list (resolved by parent id, so same-named areas
// in other domains can't collide). Read-only.
//
//   npx tsx --env-file=.env scripts/enrich/_dump-domain.ts "Core Business" --std-depts "a,b"
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const domainName = process.argv[2] ?? 'Core Business';
  const stdDepts = flag('std-depts')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const domain = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: domainName, processLevelType: { levelNumber: 1 } },
    select: { id: true, companyId: true },
  });
  const companyId = domain.companyId;

  const desc = await prisma.processNodeClosure.findMany({
    where: { ancestorId: domain.id },
    select: { descendantId: true },
  });
  const domainIds = desc.map((d) => d.descendantId);

  const touchingRoles = await prisma.nodeRole.findMany({
    where: { processNodeId: { in: domainIds } },
    select: { roleId: true },
    distinct: ['roleId'],
  });
  const roles = await prisma.role.findMany({
    where: { companyId, id: { in: touchingRoles.map((r) => r.roleId) } },
    select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
    orderBy: { displayValue: 'asc' },
  });
  const appRows = await prisma.nodeAppUsage.findMany({
    where: { processNodeId: { in: domainIds } },
    select: { application: { select: { id: true, name: true, kind: true } } },
    distinct: ['applicationId'],
  });
  const apps = appRows.map((a) => a.application);
  const standards = await prisma.standard.findMany({
    where: { companyId, isArea: false, ...(stdDepts ? { department: { in: stdDepts } } : {}) },
    select: { id: true, name: true, department: true, category: true },
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });
  const regRows = await prisma.nodeRegulation.findMany({
    where: { processNodeId: { in: domainIds } },
    select: { regulation: { select: { id: true, title: true, category: true } } },
    distinct: ['regId'],
  });
  const regs = regRows.map((r) => r.regulation);

  mkdirSync('scripts/output', { recursive: true });
  writeFileSync(
    'scripts/output/enrich-catalog.json',
    JSON.stringify({ companyId, roles, apps, standards, regs }, null, 2),
  );
  console.log(
    `catalog: ${roles.length} roles, ${apps.length} apps, ${standards.length} standards, ${regs.length} regs`,
  );

  const streams = await prisma.processNode.findMany({
    where: { parentId: domain.id },
    select: { id: true, displayValue: true },
    orderBy: { sortOrder: 'asc' },
  });
  // Two value streams can own an identically-named L3 area (Corporate Functions has
  // "Operational Resilience" under both Corporate Operations and Risk, Compliance &
  // Audit). Slugging by area name alone made the second dump overwrite the first and
  // silently drop a whole area, so disambiguate with the value stream on collision.
  const usedSlugs = new Set<string>();
  for (const vs of streams) {
    const areas = await prisma.processNode.findMany({
      where: { parentId: vs.id },
      select: { id: true, displayValue: true },
      orderBy: { sortOrder: 'asc' },
    });
    for (const area of areas) {
      const areaDesc = await prisma.processNodeClosure.findMany({
        where: { ancestorId: area.id },
        select: { descendantId: true },
      });
      const tasks = await prisma.processNode.findMany({
        where: { id: { in: areaDesc.map((d) => d.descendantId) }, isTask: true },
        select: {
          id: true,
          displayValue: true,
          description: true,
          parent: { select: { displayValue: true, sortOrder: true } },
          sortOrder: true,
          nodeRoles: { select: { role: { select: { displayValue: true } }, role_: true } },
          nodeAppUsages: { select: { application: { select: { name: true } } } },
          nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
      });
      const shaped = tasks
        .map((t) => ({
          id: t.id,
          subProcess: t.parent?.displayValue ?? '',
          subOrder: t.parent?.sortOrder ?? 0,
          task: t.displayValue,
          description: t.description,
          currentRoles: t.nodeRoles.map((r) => `${r.role.displayValue} [${r.role_}]`),
          currentApps: t.nodeAppUsages.map((a) => a.application.name),
          deliverable: t.nodeDeliverables[0]?.deliverable ?? null,
        }))
        .sort((a, b) => a.subOrder - b.subOrder || a.task.localeCompare(b.task));
      let s = slug(area.displayValue);
      if (usedSlugs.has(s)) s = `${s}-${slug(vs.displayValue)}`;
      usedSlugs.add(s);
      writeFileSync(
        `scripts/output/enrich-tasks-${s}.json`,
        JSON.stringify({ area: area.displayValue, areaId: area.id, tasks: shaped }, null, 2),
      );
      console.log(`${vs.displayValue}\t${area.displayValue}\t${shaped.length}\t${s}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
