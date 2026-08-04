// AAA POC exemplar data fix: one Owner per task, and the Owner is the role
// that actually performs the work (the majority sub-task actor) — not a
// bystander. For the POC task "Document requirements specification"
// (Technology › SWE&D › Business Analysis & Requirements Elaboration) the
// Business Analyst authors the spec, so BA becomes the single Owner and the
// Software Engineer (previous Owner, actually the verifier) becomes a
// Participant. Idempotent; run with:
//   npx tsx --env-file=.env scripts/aaa-poc-single-owner.ts
import { prisma } from '../src/db/prisma.js';

const TASK_NAME = 'Document requirements specification';
const NEW_OWNER = 'Business Analyst';

const task = await prisma.processNode.findFirst({
  where: { displayValue: TASK_NAME, isTask: true },
  select: { id: true, displayValue: true },
});
if (!task) throw new Error(`Task not found: ${TASK_NAME}`);

const links = await prisma.nodeRole.findMany({
  where: { processNodeId: task.id },
  select: { id: true, role_: true, role: { select: { displayValue: true } } },
});
console.log('before:', links.map((l) => `${l.role.displayValue}=${l.role_}`).join(', '));

await prisma.$transaction(async (tx) => {
  for (const l of links) {
    const isNewOwner = l.role.displayValue === NEW_OWNER;
    const want = isNewOwner ? 'Owner' : 'Participant';
    if (l.role_ === want) continue;
    // (processNodeId, roleId, role_) is unique — if the target row already
    // exists (e.g. both Owner and Participant links), drop this one instead.
    const clash = links.find(
      (o) => o.role.displayValue === l.role.displayValue && o.role_ === want,
    );
    if (clash) await tx.nodeRole.delete({ where: { id: l.id } });
    else await tx.nodeRole.update({ where: { id: l.id }, data: { role_: want } });
  }
});

const after = await prisma.nodeRole.findMany({
  where: { processNodeId: task.id },
  select: { role_: true, role: { select: { displayValue: true } } },
});
console.log('after: ', after.map((l) => `${l.role.displayValue}=${l.role_}`).join(', '));
await prisma.$disconnect();
