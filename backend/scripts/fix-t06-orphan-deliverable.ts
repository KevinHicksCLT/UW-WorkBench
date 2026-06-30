// T-06 — reconcile the 567-vs-568 deliverable mismatch. One deliverable
// ("Beneficiary verification and entitlement record") had zero tasks, so the
// Tasks page counted 567 distinct deliverables while the Deliverables page
// showed 568. Give that deliverable a real task so both pages read 568.
// Idempotent: inserts only while the deliverable still has no task.
//   npx tsx scripts/fix-t06-orphan-deliverable.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!company) throw new Error('No company');

  const orphans = await prisma.deliverable.findMany({
    where: { companyId: company.id, tasks: { none: {} } },
    select: { id: true, tenantId: true, companyId: true, title: true },
  });
  if (orphans.length === 0) { console.log('T-06: no orphan deliverables — nothing to do.'); return; }

  for (const d of orphans) {
    await prisma.task.create({
      data: {
        tenantId: d.tenantId, companyId: d.companyId, deliverableId: d.id,
        title: `Produce: ${d.title}`,
        owner: 'Claims Examiner', status: 'To Do', priority: 'Medium', source: 'process',
        agentScore: 2,
        agentRationale: 'Largely rules-based against system-of-record data with a human check on edge cases.',
        agentScoredAt: new Date(),
      },
    });
  }
  console.log(`T-06: added a task to ${orphans.length} orphan deliverable(s).`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
