// Export the Software Engineering & Delivery (L3, under Technology &
// Engineering) task set + catalogs for the plan-value enrichment run.
// Output: scripts/sed-enrichment/export.json
// Run: npx tsx --env-file=.env scripts/export-sed-enrichment.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

const SED_ID = '0ba33779-8a28-4c1a-8800-4c9ff89e95c0';
const STD_AREAS = ['Engineering & Development', 'Enterprise & Solution Architecture', 'Information Security', 'PMO & Agile Delivery', 'Data & Analytics'];
const REG_REGIMES = ['NYDFS 500', 'GDPR', 'CCPA-CPRA', 'CPRA'];

async function main() {
  const taskIds = (
    await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT t.id FROM "ProcessNodeClosure" c JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask" WHERE c."ancestorId"='${SED_ID}'`
    )
  ).map((r) => r.id);

  const tasks = await prisma.processNode.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true, displayValue: true, description: true,
      parent: { select: { displayValue: true } },
      nodeRoles: { select: { role_: true, role: { select: { id: true, displayValue: true } } } },
      nodeAppUsages: { select: { application: { select: { id: true, name: true } } } },
      nodeWorkTemplates: { select: { template: { select: { id: true, kind: true, name: true, sortOrder: true, keys: { orderBy: { sortOrder: 'asc' }, select: { id: true, key: true, valueKind: true } } } } } },
      nodeTemplateAnswers: { where: { templateKeyId: null }, select: { id: true, customKey: true, kind: true } },
    },
  });

  const [standards, regs, apps] = await Promise.all([
    prisma.standard.findMany({
      where: { isArea: false, children: { none: {} }, department: { in: STD_AREAS } },
      select: { id: true, name: true, department: true, category: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    }),
    prisma.regulatoryRequirement.findMany({
      where: { status: 'ACTIVE', OR: [{ regime: { in: REG_REGIMES } }, { category: 'CYBERSECURITY' }] },
      select: { id: true, title: true, regime: true, category: true },
      orderBy: { title: 'asc' },
    }),
    prisma.application.findMany({
      where: {
        OR: [
          { nodeAppUsages: { some: { processNodeId: { in: taskIds } } } },
          { name: { mode: 'insensitive', contains: 'git' } }, { name: { mode: 'insensitive', contains: 'jira' } },
          { name: { mode: 'insensitive', contains: 'azure' } }, { name: { mode: 'insensitive', contains: 'jenkins' } },
          { name: { mode: 'insensitive', contains: 'sonar' } }, { name: { mode: 'insensitive', contains: 'confluence' } },
          { name: { mode: 'insensitive', contains: 'servicenow' } }, { name: { mode: 'insensitive', contains: 'dev' } },
          { name: { mode: 'insensitive', contains: 'cloud' } }, { name: { mode: 'insensitive', contains: 'test' } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const roleIds = new Set(tasks.flatMap((t) => t.nodeRoles.map((r) => r.role.id)));
  const roles = await prisma.role.findMany({
    where: {
      OR: [
        { id: { in: [...roleIds] } },
        { displayValue: { mode: 'insensitive', contains: 'engineer' } }, { displayValue: { mode: 'insensitive', contains: 'developer' } },
        { displayValue: { mode: 'insensitive', contains: 'architect' } }, { displayValue: { mode: 'insensitive', contains: 'qa' } },
        { displayValue: { mode: 'insensitive', contains: 'devops' } }, { displayValue: { mode: 'insensitive', contains: 'scrum' } },
        { displayValue: { mode: 'insensitive', contains: 'product owner' } }, { displayValue: { mode: 'insensitive', contains: 'release' } },
        { displayValue: { mode: 'insensitive', contains: 'security' } }, { displayValue: { mode: 'insensitive', contains: 'data' } },
      ],
    },
    select: { id: true, displayValue: true },
    orderBy: { displayValue: 'asc' },
  });

  const out = {
    subtree: 'Software Engineering & Delivery (L3 under Technology & Engineering VS)',
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.displayValue,
      description: t.description,
      l4: t.parent?.displayValue ?? null,
      roles: t.nodeRoles.map((r) => ({ id: r.role.id, name: r.role.displayValue, relation: r.role_ })),
      apps: [...new Map(t.nodeAppUsages.map((a) => [a.application.id, a.application])).values()],
      templates: t.nodeWorkTemplates
        .map((l) => l.template)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tp) => ({ kind: tp.kind, name: tp.name, keys: tp.keys })),
      customTestKeys: t.nodeTemplateAnswers.map((a) => ({ answerId: a.id, key: a.customKey, kind: a.kind })),
    })),
    catalogs: {
      roles,
      applications: apps,
      standards,
      regulations: regs,
    },
  };
  mkdirSync('scripts/sed-enrichment', { recursive: true });
  writeFileSync('scripts/sed-enrichment/export.json', JSON.stringify(out, null, 1));
  console.log(`exported ${out.tasks.length} tasks | roles ${roles.length} | apps ${apps.length} | standards ${standards.length} | regs ${regs.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
