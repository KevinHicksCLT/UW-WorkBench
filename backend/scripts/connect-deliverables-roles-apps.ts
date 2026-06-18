// Connectivity + logical-fit pass. Three idempotent fixes so every process node
// is tied to deliverables, tasks, roles and applications — and the ties make
// sense (no executives leading granular L5 steps).
//   1. Demote executive/management roles from L5 step `leads` to `supporting`
//      when a practitioner co-lead exists (core users lead execution).
//   2. Give every value stream that has no Deliverable a set of deliverables
//      (from its IoItem outputs / step outputs / L4 names) + one task each.
//   3. Tie an application to every process step that has none (the stream's
//      system-of-record app, then a supporting app).
//   npx tsx scripts/connect-deliverables-roles-apps.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const splitOut = (s: string | null) =>
  (s ? s.split(/[;\n]+/).map((x) => x.trim()).filter((x) => x.length > 3) : []);

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  // ── 1. Executive leads → supporting ───────────────────────────────────────
  const execNames = (await prisma.role.findMany({
    where: { companyId, roleLevel: { in: ['Executive', 'Management'] } }, select: { name: true },
  })).map((r) => r.name);
  const steps = await prisma.processStep.findMany({ where: { valueStream: { companyId } }, select: { id: true, leads: true, supporting: true } });
  let demoted = 0;
  for (const s of steps) {
    const leads = (s.leads ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (leads.length < 2) continue; // keep a sole lead even if senior — don't strand the step
    const execLeads = leads.filter((l) => execNames.includes(l));
    const keep = leads.filter((l) => !execNames.includes(l));
    if (!execLeads.length || !keep.length) continue;
    const sup = (s.supporting ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    for (const e of execLeads) if (!sup.includes(e)) sup.push(e);
    await prisma.processStep.update({ where: { id: s.id }, data: { leads: keep.join(', '), supporting: sup.join(', ') } });
    demoted++;
  }
  console.log(`1. Demoted execs to supporting on ${demoted} steps.`);

  // ── 2. Deliverables + tasks for streams with none ─────────────────────────
  // Deliverable has only a scalar valueStreamId (no Prisma relation), so find
  // the streams with deliverables via groupBy and take the complement.
  const withDel = new Set(
    (await prisma.deliverable.groupBy({ by: ['valueStreamId'], where: { companyId } }))
      .map((g) => g.valueStreamId).filter(Boolean) as string[],
  );
  const allStreams = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
  const streamsNoDel = allStreams.filter((s) => !withDel.has(s.id));
  let delCreated = 0, taskCreated = 0;
  for (const vs of streamsNoDel) {
    // lead role for ownership
    const lead = await prisma.roleValueStream.findFirst({
      where: { valueStreamId: vs.id, participationType: 'Lead' }, select: { role: { select: { name: true } } },
    }) ?? await prisma.roleValueStream.findFirst({ where: { valueStreamId: vs.id }, select: { role: { select: { name: true } } } });
    const owner = lead?.role?.name ?? null;

    const names = new Set<string>();
    const ios = await prisma.ioItem.findMany({ where: { valueStreamId: vs.id, type: { in: ['Output', 'Deliverable'] } }, select: { name: true } });
    ios.forEach((i) => names.add(i.name.trim()));
    if (names.size < 4) {
      const ps = await prisma.processStep.findMany({ where: { valueStreamId: vs.id }, select: { outputs: true } });
      ps.forEach((p) => splitOut(p.outputs).forEach((o) => names.add(o)));
    }
    if (names.size === 0) {
      const l4 = await prisma.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 4 }, select: { name: true } });
      l4.forEach((x) => names.add(x.name.trim()));
    }
    const list = [...names].slice(0, 14);
    for (const title of list) {
      const d = await prisma.deliverable.create({
        data: { tenantId, companyId, valueStreamId: vs.id, title, type: 'Deliverable', status: 'In Progress', owner },
      });
      delCreated++;
      await prisma.task.create({
        data: { tenantId, companyId, deliverableId: d.id, title: `Produce: ${title}`, owner, status: 'To Do', priority: 'Medium', source: 'process' },
      });
      taskCreated++;
    }
  }
  console.log(`2. Created ${delCreated} deliverables + ${taskCreated} tasks across ${streamsNoDel.length} streams.`);

  // ── 3. Apps for steps with none ───────────────────────────────────────────
  const appless = await prisma.processStep.findMany({
    where: { valueStream: { companyId }, appUsages: { none: {} } },
    select: { id: true, code: true, valueStreamId: true },
  });
  // cache stream -> [ {appId, sor} ]
  const cache = new Map<string, { applicationId: string; sor: boolean }[]>();
  let stepApps = 0;
  for (const s of appless) {
    let apps = cache.get(s.valueStreamId);
    if (!apps) {
      const links = await prisma.applicationValueStream.findMany({ where: { valueStreamId: s.valueStreamId }, select: { applicationId: true, systemRole: true } });
      apps = links.map((l) => ({ applicationId: l.applicationId, sor: l.systemRole === 'System of Record' }))
        .sort((a, b) => Number(b.sor) - Number(a.sor));
      cache.set(s.valueStreamId, apps);
    }
    for (const a of apps.slice(0, 2)) {
      try {
        await prisma.stepAppUsage.create({
          data: { tenantId, companyId, activityCode: s.code ?? '', processStepId: s.id, applicationId: a.applicationId, usageType: a.sor ? 'System of Record' : 'Execution', isPrimary: a.sor },
        });
        stepApps++;
      } catch (e) { if ((e as { code?: string }).code !== 'P2002') throw e; }
    }
  }
  console.log(`3. Linked apps to ${appless.length} app-less steps (${stepApps} StepAppUsage rows).`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
