// AAA POC step 4 (Kevin round-4 feedback):
//  1. NFR definition is architecture work — the NFR task moves to a (created
//     if missing) Software Architect role, gets a stable name, and its
//     sub-task text speaks as the architect.
//  2. The BA's documentation task DEPENDS on the NFR and security tasks — the
//     dependency is recorded on ProcessNode.attributes.dependsOn (ids) and
//     surfaced by the chain API / Work tab.
// Idempotent. Run with:
//   npx tsx --env-file=.env scripts/aaa-poc-refine.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const PARENT_L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237';
const DOC_TASK = 'Document requirements specification';
const SEC_TASK = 'Specify the security requirements in Confluence';
const VERIFY_TASK = 'Verify the requirements specification';
const NFR_TASK_NAME = 'Define and quantify the non-functional requirements';

const siblings = await prisma.processNode.findMany({
  where: { parentId: PARENT_L4, isTask: true },
  select: {
    id: true,
    displayValue: true,
    companyId: true,
    attributes: true,
    nodeRoles: { where: { role_: 'Owner' }, select: { id: true, role: { select: { displayValue: true, orgUnitId: true } } } },
  },
});
const companyId = siblings[0].companyId;
const doc = siblings.find((s) => s.displayValue === DOC_TASK);
const sec = siblings.find((s) => s.displayValue === SEC_TASK);
// The NFR task's Haiku-generated name drifts between replays — locate it as
// the SE-owned sibling that is neither the doc, security, nor verify task.
const nfr = siblings.find(
  (s) =>
    s.displayValue === NFR_TASK_NAME ||
    (![DOC_TASK, SEC_TASK, VERIFY_TASK].includes(s.displayValue) &&
      s.nodeRoles[0]?.role.displayValue === 'Software Engineer'),
);
if (!doc || !sec || !nfr) throw new Error('POC tasks not found');

// ── 1. Software Architect owns NFR definition ────────────────────────────────
const seOrgUnit = nfr.nodeRoles[0]?.role.orgUnitId ?? null;
let architect = await prisma.role.findFirst({
  where: { companyId, displayValue: 'Software Architect' },
  select: { id: true },
});
architect ??= await prisma.role.create({
  data: {
    companyId,
    dbValue: 'Software Architect',
    displayValue: 'Software Architect',
    description:
      'Owns the technical shape of a solution: non-functional requirements, architecture decisions, cross-system dependencies, and review of designs against enterprise standards.',
    orgUnitId: seOrgUnit,
  },
  select: { id: true },
});

await prisma.processNode.update({
  where: { id: nfr.id },
  data: { dbValue: NFR_TASK_NAME, displayValue: NFR_TASK_NAME },
});
await prisma.nodeRole.deleteMany({ where: { processNodeId: nfr.id } });
await prisma.nodeRole.create({
  data: { companyId, processNodeId: nfr.id, roleId: architect.id, role_: 'Owner' },
});
const nfrAnswers = await prisma.nodeTemplateAnswer.findMany({
  where: { processNodeId: nfr.id, templateKeyId: null, value: { contains: 'Software Engineer' } },
  select: { id: true, value: true },
});
for (const a of nfrAnswers) {
  await prisma.nodeTemplateAnswer.update({
    where: { id: a.id },
    data: { value: a.value!.replaceAll('Software Engineer', 'Software Architect') },
  });
}
console.log(`NFR task → "${NFR_TASK_NAME}", owner Software Architect, ${nfrAnswers.length} rows re-voiced`);

// ── 2. The doc task depends on the NFR and security tasks ────────────────────
const attrs = (doc.attributes ?? {}) as Prisma.JsonObject;
await prisma.processNode.update({
  where: { id: doc.id },
  data: { attributes: { ...attrs, dependsOn: [nfr.id, sec.id] } },
});
console.log(`"${DOC_TASK}" dependsOn → [${NFR_TASK_NAME}; ${SEC_TASK}]`);
await prisma.$disconnect();
