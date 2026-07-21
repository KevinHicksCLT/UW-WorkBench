// Dump the controlled-vocabulary catalog + a target area's task list for the
// task-enrichment pipeline (SWE&D gold standard rollout). Read-only.
//
// Writes scripts/output/enrich-catalog.json (roles/apps/standards/regs the
// author may reference by id) and scripts/output/enrich-tasks-<slug>.json
// (the L5 tasks under one L3 area, with their current associations).
//
//   npx tsx --env-file=.env scripts/enrich/dump-catalog.ts "Data Engineering & Pipelines"
//   npx tsx --env-file=.env scripts/enrich/dump-catalog.ts "Claims Adjudication" --domain "Core Business"
//   ... --std-depts "Actuarial,Claims Operations,Data & Analytics"   (default: ALL departments)
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
  // Positional arg is the L3 area; --domain / --std-depts are optional flags.
  const flagVals = new Set([flag('domain'), flag('std-depts')]);
  const areaName = process.argv.slice(2).find((a) => !a.startsWith('--') && !flagVals.has(a));
  const domainName = flag('domain') ?? 'Technology';
  const stdDepts = flag('std-depts')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!areaName)
    throw new Error(
      'usage: dump-catalog.ts "<L3 area displayValue>" [--domain "<Domain>"] [--std-depts "a,b"]',
    );

  const domain = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: domainName, processLevelType: { levelNumber: 1 } },
    select: { id: true, companyId: true },
  });
  const companyId = domain.companyId;

  // descendant task ids of the domain (for role/app/reg scoping)
  const techDesc = await prisma.processNodeClosure.findMany({
    where: { ancestorId: domain.id },
    select: { descendantId: true },
  });
  const techIds = techDesc.map((d) => d.descendantId);

  // Roles the author may pick from: every role that currently touches a task in
  // this domain (the realistic day-to-day palette; the author drops cross-domain
  // noise per task).
  const touchingRoles = await prisma.nodeRole.findMany({
    where: { processNodeId: { in: techIds } },
    select: { roleId: true },
    distinct: ['roleId'],
  });
  const roles = await prisma.role.findMany({
    where: { companyId, id: { in: touchingRoles.map((r) => r.roleId) } },
    select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
    orderBy: { displayValue: 'asc' },
  });

  const appRows = await prisma.nodeAppUsage.findMany({
    where: { processNodeId: { in: techIds } },
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
    where: { processNodeId: { in: techIds } },
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

  // ── target area tasks ──
  const area = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: areaName, processLevelType: { levelNumber: 3 } },
    select: { id: true },
  });
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

  const out = `scripts/output/enrich-tasks-${slug(areaName)}.json`;
  writeFileSync(out, JSON.stringify({ area: areaName, areaId: area.id, tasks: shaped }, null, 2));
  console.log(`tasks: ${shaped.length} → ${out}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
