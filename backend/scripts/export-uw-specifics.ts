// Export post-cleanup Underwriting tasks (current owner/participants/apps) for the
// SPECIFIC-STEPS enrichment pass. Output: scripts/uw-enrichment/spec-tasks-NN.json
// Run AFTER apply-uw-enrichment.ts (generic pass) has completed.
// Run: npx tsx --env-file=.env scripts/export-uw-specifics.ts
import { writeFileSync } from 'node:fs';
import { prisma } from '../src/db/prisma.js';

const UW_ID = '5a652c00-658f-48a6-afde-6cfc23296f15';
const CHUNK = 12;

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
        select: { displayValue: true, parent: { select: { displayValue: true } } },
      },
      nodeRoles: { select: { role_: true, role: { select: { displayValue: true } } } },
      nodeAppUsages: { select: { application: { select: { name: true } } } },
    },
    orderBy: { displayValue: 'asc' },
  });

  const out = tasks
    .map((t) => {
      const owner = t.nodeRoles.find((r) => r.role_ === 'Owner')?.role.displayValue ?? null;
      const participants = t.nodeRoles
        .filter((r) => r.role_ !== 'Owner')
        .map((r) => r.role.displayValue);
      return {
        id: t.id,
        name: t.displayValue,
        description: t.description,
        l3: t.parent?.parent?.displayValue ?? null,
        l4: t.parent?.displayValue ?? null,
        owner,
        participants,
        apps: [...new Set(t.nodeAppUsages.map((a) => a.application.name))],
      };
    })
    .sort(
      (a, b) =>
        (a.l3 ?? '').localeCompare(b.l3 ?? '') ||
        (a.l4 ?? '').localeCompare(b.l4 ?? '') ||
        a.name.localeCompare(b.name),
    );

  let chunks = 0;
  for (let i = 0; i < out.length; i += CHUNK) {
    chunks++;
    writeFileSync(
      `scripts/uw-enrichment/spec-tasks-${String(chunks).padStart(2, '0')}.json`,
      JSON.stringify(out.slice(i, i + CHUNK), null, 1),
    );
  }
  console.log(`exported ${out.length} tasks in ${chunks} spec-tasks chunks`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
