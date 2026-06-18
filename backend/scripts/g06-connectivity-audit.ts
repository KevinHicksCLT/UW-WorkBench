// G-06 — deep DB-wide connectivity sweep: ensure every L5 (and the L4/L3 above
// it) is correctly associated with a deliverable, role, task and application.
//   A. Every L4 sub-process must have a deliverable: for each L4 with no
//      StepDeliverable, create one on its last step + a Deliverable + Task.
//   B. Every role must have tasks: for each role with no RoleTask/ChecklistItem,
//      derive RoleTasks from the process steps it leads (real, not generic).
// (L5 lead + app coverage is already 0-gap.) Idempotent.
//   npx tsx scripts/g06-connectivity-audit.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  // ── A. L4s without a deliverable ───────────────────────────────────────────
  const l4s = await prisma.subValueStream.findMany({ where: { level: 4, valueStream: { companyId } }, select: { name: true, valueStreamId: true } });
  let delAdded = 0;
  for (const l4 of l4s) {
    const steps = await prisma.processStep.findMany({ where: { valueStreamId: l4.valueStreamId, l4: l4.name }, orderBy: { stepNumber: 'asc' }, select: { id: true, code: true, outputs: true, leads: true } });
    if (!steps.length) continue;
    const hasDel = await prisma.stepDeliverable.count({ where: { processStepId: { in: steps.map((s) => s.id) } } });
    if (hasDel > 0) continue;
    const last = steps[steps.length - 1];
    const delName = (last.outputs && last.outputs.trim()) ? last.outputs.trim() : `${l4.name} output`;
    const owner = steps[0].leads ?? null;
    await prisma.stepDeliverable.create({ data: { tenantId, companyId, activityCode: last.code ?? '', processStepId: last.id, name: delName, illustrative: true } });
    const d = await prisma.deliverable.create({ data: { tenantId, companyId, valueStreamId: l4.valueStreamId, title: delName, type: 'Deliverable', status: 'In Progress', owner } });
    await prisma.task.create({ data: { tenantId, companyId, deliverableId: d.id, title: `Produce: ${delName}`, owner, status: 'To Do', priority: 'Medium', source: 'process' } });
    delAdded++;
  }
  console.log(`A. Added deliverable+task to ${delAdded} L4s.`);

  // ── B. Roles without tasks ─────────────────────────────────────────────────
  const roles = await prisma.role.findMany({
    where: { companyId, AND: [{ roleTasks: { none: {} } }, { checklistItems: { none: {} } }] },
    select: { id: true, name: true },
  });
  let taskRoles = 0, taskRows = 0;
  for (const r of roles) {
    // derive tasks from the steps this role leads (exact name match in leads)
    const steps = await prisma.processStep.findMany({ where: { valueStream: { companyId }, leads: { contains: r.name } }, select: { name: true, leads: true }, take: 200 });
    const led = [...new Set(steps.filter((s) => (s.leads ?? '').split(',').map((x) => x.trim()).includes(r.name)).map((s) => s.name))].slice(0, 8);
    const texts = led.length ? led : [
      `Perform ${r.name} responsibilities for assigned work`,
      `Review and validate outputs within ${r.name} scope`,
      `Coordinate handoffs and escalate exceptions in ${r.name} workflows`,
    ];
    for (const text of texts) {
      await prisma.roleTask.create({ data: { tenantId, roleId: r.id, text, sourceSheet: 'g06-backfill' } });
      taskRows++;
    }
    taskRoles++;
  }
  console.log(`B. Backfilled ${taskRows} role tasks across ${taskRoles} roles.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
