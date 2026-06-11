// seed-baseline-plan.ts — D1 Home rework: representative baseline hydration.
// Deterministic + idempotent (safe to re-run; never duplicates):
//   1. Milestone top-up — any portfolio initiative carrying fewer than two
//      milestones gets phase-gate milestones derived from its OWN start/due
//      dates ("Mobilization complete", "Go-live readiness"), keyed by name so
//      re-runs are no-ops. Keeps the Gantt's diamond track populated.
//   2. Jira stub keys (D1.7) — the first 5 deliverables and the first 3 tasks
//      of each get sequential TB-1xx keys (~20 keys) so the "JIRA" chip in the
//      Deliverables & Tasks drill-down is demonstrable. Same rows → same keys
//      on every run.
//   3. Home layout merge — companies with a SAVED dashboardConfig would never
//      see the new transformation widgets (the frontend default only applies
//      when no layout is saved), so the new widget ids are prepended to each
//      saved layout once (skipped when already present).
// Run (cwd = backend): npx tsx scripts/seed-baseline-plan.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Must mirror the ids (and order) of the new widgets in
// frontend/src/lib/dashboardWidgets.tsx DEFAULT_LAYOUT.
const NEW_WIDGETS = [
  'card:portfolioRollup', 'card:gantt', 'card:okrs',
  'card:openRisks', 'card:raidSummary', 'card:workforceSignals',
];

const day = 86400000;

async function main() {
  // ── 1. Milestone top-up ────────────────────────────────────────────────────
  const initiatives = await prisma.portfolioInitiative.findMany({
    select: { id: true, name: true, startDate: true, dueDate: true, _count: { select: { milestones: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let msCreated = 0;
  for (const init of initiatives) {
    if (init._count.milestones >= 2) continue;
    const span = Math.max(day, init.dueDate.getTime() - init.startDate.getTime());
    const phases: { name: string; dueDate: Date; isGate: boolean }[] = [
      { name: 'Mobilization complete', dueDate: new Date(init.startDate.getTime() + Math.round(span * 0.2)), isGate: false },
      { name: 'Go-live readiness', dueDate: new Date(init.startDate.getTime() + Math.round(span * 0.85)), isGate: true },
    ];
    for (const ph of phases) {
      const existing = await prisma.milestone.findFirst({ where: { initiativeId: init.id, name: ph.name }, select: { id: true } });
      if (existing) continue;
      await prisma.milestone.create({ data: { initiativeId: init.id, name: ph.name, dueDate: ph.dueDate, isGate: ph.isGate } });
      msCreated++;
    }
  }
  console.log(`1. milestones: ${initiatives.length} initiatives checked, ${msCreated} phase milestones added`);

  const companies = await prisma.company.findMany({ select: { id: true, name: true, dashboardConfig: true }, orderBy: { createdAt: 'asc' } });

  for (const company of companies) {
    // ── 2. Jira stub keys ─────────────────────────────────────────────────────
    const deliverables = await prisma.deliverable.findMany({
      where: { companyId: company.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 5,
      select: { id: true, title: true, jiraKey: true },
    });
    let key = 101;
    let stamped = 0;
    for (const d of deliverables) {
      const dKey = `TB-${key++}`;
      if (d.jiraKey !== dKey) { await prisma.deliverable.update({ where: { id: d.id }, data: { jiraKey: dKey } }); stamped++; }
      const tasks = await prisma.task.findMany({
        where: { deliverableId: d.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 3,
        select: { id: true, jiraKey: true },
      });
      for (const t of tasks) {
        const tKey = `TB-${key++}`;
        if (t.jiraKey !== tKey) { await prisma.task.update({ where: { id: t.id }, data: { jiraKey: tKey } }); stamped++; }
      }
    }
    console.log(`2. jira keys (${company.name}): TB-101..TB-${key - 1}, ${stamped} rows (re)stamped`);

    // ── 3. Home layout merge ──────────────────────────────────────────────────
    const cfg = (company.dashboardConfig ?? {}) as Record<string, unknown>;
    const widgets = Array.isArray(cfg.widgets) ? (cfg.widgets as string[]) : null;
    if (!widgets) {
      console.log(`3. layout (${company.name}): no saved layout — frontend default already includes the new widgets`);
      continue;
    }
    const missing = NEW_WIDGETS.filter((id) => !widgets.includes(id));
    if (missing.length === 0) {
      console.log(`3. layout (${company.name}): new widgets already present — no-op`);
      continue;
    }
    await prisma.company.update({
      where: { id: company.id },
      data: { dashboardConfig: { ...cfg, widgets: [...missing, ...widgets] } },
    });
    console.log(`3. layout (${company.name}): prepended ${missing.join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
