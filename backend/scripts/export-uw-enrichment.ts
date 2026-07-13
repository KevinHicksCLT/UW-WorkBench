// Export the Underwriting (L2 value stream) task set + catalogs for the
// plan-value enrichment + role/app cleanup run (SED-exemplar detail level).
// Output: scripts/uw-enrichment/{export.json,catalogs.json,tasks-NN.json}
// Run: npx tsx --env-file=.env scripts/export-uw-enrichment.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

const UW_ID = '5a652c00-658f-48a6-afde-6cfc23296f15';
const CHUNK = 12;
const STD_AREAS = [
  'Underwriting',
  'Actuarial',
  'Compliance & Risk Management',
  'Data & Analytics',
  'Operations & Customer Service',
  'Legal & Governance',
];
// Regimes genuinely relevant to underwriting work (container ties + curated).
const REG_REGIMES = [
  'FCRA',
  'FCRA (Regulation V)',
  'GINA',
  'EU AI Act',
  'NAIC AI Model Bulletin',
  'Colorado SB 21-169 / Bulletin B-10.004',
  'Colorado SB 21-169 / Regulation 10-1-1 (ECDIS governance)',
  'Colorado SB 21-169 / Reg 10-1-1',
  'NJ Underwriting Guidelines / Adverse-Action Rules (N.J.A.C. 11:1-40)',
  'NAIC Unfair Trade Practices Act (Model #880)',
  'OFAC Sanctions',
  'BSA/AML for Insurance Companies',
  'Medicare Supplement',
  'ACA / PHSA',
  'HIPAA Privacy',
  'GLBA Privacy',
  'NAIC Model 668 (Insurance Data Security Law)',
  'NYDFS 500',
  'PMIERs',
  'NFIP (Write-Your-Own)',
  'TRIA/TRIPRA',
  'Federal Crop Insurance (SRA/FCIC)',
  'IDD',
  'FCA Consumer Duty',
  'Fair Treatment of Customers',
  'Insurance Code of Conduct',
  'NAIC Insurance Information and Privacy Protection Model Act (Model #670)',
  'NAIC Privacy of Consumer Financial and Health Information Regulation (Model #672)',
];
const APP_HINTS = [
  'underwrit',
  'policy',
  'rating',
  'rate',
  'quote',
  'submission',
  'mib',
  'lexisnexis',
  'milliman',
  'reinsur',
  'workbench',
  'guidewire',
  'duck creek',
  'document',
  'workflow',
  'analytics',
  'warehouse',
  'model',
  'crm',
  'salesforce',
  'sharepoint',
  'grc',
  'audit',
  'learning',
  'training',
  'bi ',
  'tableau',
  'power bi',
];
const ROLE_HINTS = [
  'underwrit',
  'actuar',
  'medical',
  'reinsur',
  'risk',
  'compliance',
  'audit',
  'pricing',
  'product',
  'portfolio',
  'quality',
  'data',
  'analyst',
  'trainer',
  'training',
  'legal',
  'chief',
  'claims',
];

async function main() {
  const taskIds = (
    await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT t.id FROM "ProcessNodeClosure" c JOIN "ProcessNode" t ON t.id=c."descendantId" AND t."isTask" WHERE c."ancestorId"='${UW_ID}'`,
    )
  ).map((r) => r.id);

  const tasks = await prisma.processNode.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      displayValue: true,
      description: true,
      parent: {
        select: {
          displayValue: true,
          parent: { select: { displayValue: true } },
        },
      },
      nodeRoles: {
        select: {
          id: true,
          role_: true,
          role: { select: { id: true, displayValue: true } },
        },
      },
      nodeAppUsages: {
        select: {
          id: true,
          usageType: true,
          application: { select: { id: true, name: true } },
        },
      },
      nodeWorkTemplates: {
        select: {
          template: {
            select: {
              id: true,
              kind: true,
              name: true,
              sortOrder: true,
              keys: {
                orderBy: { sortOrder: 'asc' },
                select: { id: true, key: true, guidance: true, valueKind: true },
              },
            },
          },
        },
      },
      nodeTemplateAnswers: {
        where: { templateKeyId: null },
        select: { id: true, customKey: true, kind: true },
      },
    },
    orderBy: { displayValue: 'asc' },
  });

  const [standards, regs, apps] = await Promise.all([
    prisma.standard.findMany({
      where: { isArea: false, children: { none: {} }, department: { in: STD_AREAS } },
      select: { id: true, name: true, department: true, category: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    }),
    prisma.regulatoryRequirement.findMany({
      where: { status: 'ACTIVE', regime: { in: REG_REGIMES } },
      select: { id: true, title: true, regime: true, category: true },
      orderBy: [{ regime: 'asc' }, { title: 'asc' }],
    }),
    prisma.application.findMany({
      where: {
        OR: [
          { nodeAppUsages: { some: { processNodeId: { in: taskIds } } } },
          ...APP_HINTS.map((h) => ({ name: { mode: 'insensitive' as const, contains: h } })),
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
        ...ROLE_HINTS.map((h) => ({
          displayValue: { mode: 'insensitive' as const, contains: h },
        })),
      ],
    },
    select: { id: true, displayValue: true },
    orderBy: { displayValue: 'asc' },
  });

  // Sort tasks by L3 > L4 > name so each chunk is a coherent area.
  const taskOut = tasks
    .map((t) => ({
      id: t.id,
      name: t.displayValue,
      description: t.description,
      l3: t.parent?.parent?.displayValue ?? null,
      l4: t.parent?.displayValue ?? null,
      roles: t.nodeRoles.map((r) => ({
        nodeRoleId: r.id,
        id: r.role.id,
        name: r.role.displayValue,
        relation: r.role_,
      })),
      apps: t.nodeAppUsages.map((a) => ({
        usageId: a.id,
        id: a.application.id,
        name: a.application.name,
        usageType: a.usageType,
      })),
      templates: t.nodeWorkTemplates
        .map((l) => l.template)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tp) => ({ kind: tp.kind, name: tp.name, keys: tp.keys })),
      customKeys: t.nodeTemplateAnswers.map((a) => ({
        answerId: a.id,
        key: a.customKey,
        kind: a.kind,
      })),
    }))
    .sort(
      (a, b) =>
        (a.l3 ?? '').localeCompare(b.l3 ?? '') ||
        (a.l4 ?? '').localeCompare(b.l4 ?? '') ||
        a.name.localeCompare(b.name),
    );

  mkdirSync('scripts/uw-enrichment', { recursive: true });
  const catalogs = { roles, applications: apps, standards, regulations: regs };
  writeFileSync('scripts/uw-enrichment/catalogs.json', JSON.stringify(catalogs, null, 1));
  writeFileSync(
    'scripts/uw-enrichment/export.json',
    JSON.stringify({ subtree: 'Underwriting (L2 value stream)', tasks: taskOut }, null, 1),
  );
  let chunks = 0;
  for (let i = 0; i < taskOut.length; i += CHUNK) {
    chunks++;
    writeFileSync(
      `scripts/uw-enrichment/tasks-${String(chunks).padStart(2, '0')}.json`,
      JSON.stringify(taskOut.slice(i, i + CHUNK), null, 1),
    );
  }
  console.log(
    `exported ${taskOut.length} tasks in ${chunks} chunks | roles ${roles.length} | apps ${apps.length} | standards ${standards.length} | regs ${regs.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
