// Seed for gap backlog I3/I4/I6/I9/I11 (2026-06): strategic objectives +
// alignment links (with recomputed value scores), charter complexity scores,
// per-initiative resources (illustrative names), and workplan activities for the
// Meridian Insurance Group portfolio. Idempotent: skips entirely when any
// StrategicObjective already exists. Run: npx tsx scripts/seed-portfolio-extensions.ts
import { prisma } from '../src/db/prisma.js';

const TODAY = new Date('2026-06-10');

const OBJECTIVES: { name: string; description: string; weight: number }[] = [
  { name: 'Reduce claims cycle time 30%', description: 'Cut average first-notice-to-settlement time by nearly a third through automation and triage.', weight: 2 },
  { name: 'AI-augmented underwriting at scale', description: 'Embed AI decision support across submission intake, rating, and risk selection.', weight: 2 },
  { name: 'Modern data platform & governance', description: 'A unified, governed data foundation feeding analytics and AI use cases.', weight: 1.5 },
  { name: 'Digital customer self-service', description: 'Shift routine policyholder interactions to digital channels.', weight: 1.5 },
  { name: 'Operational cost efficiency', description: 'Reduce unit cost per policy and per claim through process automation.', weight: 1 },
  { name: 'Regulatory resilience & trust', description: 'Keep AI and data practices auditable, explainable, and compliant.', weight: 1 },
];

// Per-initiative seed plan, keyed by initiative name. objectives: [objective
// index, impact 1–5]; complexity spread 3–8.
const PLAN: Record<string, { complexity: number; objectives: [number, number][] }> = {
  'Straight-Through Submission Intake': { complexity: 6, objectives: [[1, 5], [4, 4], [3, 2]] },
  'Real-Time Rating Engine': { complexity: 8, objectives: [[1, 5], [2, 3]] },
  'Automated FNOL Triage': { complexity: 5, objectives: [[0, 5], [3, 4], [4, 3]] },
  'Enterprise AI Assistant Rollout': { complexity: 3, objectives: [[4, 4], [5, 2], [1, 2]] },
  'Unified Claims Data Platform': { complexity: 7, objectives: [[2, 5], [0, 3], [5, 4]] },
};

const PHASES = ['Discovery', 'Design', 'Build', 'Test', 'Rollout'];

function statusFor(start: Date, end: Date): string {
  if (end < TODAY) return 'DONE';
  if (start <= TODAY) return 'IN_PROGRESS';
  return 'PLANNED';
}

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function main() {
  const existing = await prisma.strategicObjective.count();
  if (existing > 0) {
    console.log(`Skipping: ${existing} strategic objective(s) already exist.`);
    return;
  }

  const program = await prisma.program.findFirst({ select: { tenantId: true, companyId: true } });
  if (!program) throw new Error('No Program rows found — seed the portfolio first.');
  const { tenantId, companyId } = program;

  // 1. Objectives
  const objectives = [];
  for (const o of OBJECTIVES) {
    objectives.push(await prisma.strategicObjective.create({ data: { tenantId, companyId, ...o } }));
  }
  console.log(`Created ${objectives.length} strategic objectives.`);

  // Illustrative resource roster (name + role text on InitiativeResource).
  const ROSTER: { name: string; title: string }[] = [
    { name: 'Ana Delgado', title: 'Program Manager' },
    { name: 'Marcus Webb', title: 'Solution Architect' },
    { name: 'Priya Raman', title: 'Data Engineer' },
    { name: 'Tom Okafor', title: 'Business Analyst' },
    { name: 'Lena Fischer', title: 'Change Lead' },
    { name: 'Diego Santos', title: 'Platform Engineer' },
    { name: 'Sofia Lindqvist', title: 'UX Designer' },
    { name: 'Ravi Mehta', title: 'QA Lead' },
    { name: 'Claire Dubois', title: 'Product Owner' },
    { name: 'Jonah Kim', title: 'ML Engineer' },
  ];

  const initiatives = await prisma.portfolioInitiative.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
  let rosterCursor = 0;

  for (const init of initiatives) {
    const plan = PLAN[init.name] ?? { complexity: 5, objectives: [[0, 3], [4, 3]] as [number, number][] };

    // 2. Alignment links + recomputed value score (same formula as the route).
    let valueScore = 0;
    for (const [objIdx, impact] of plan.objectives) {
      const obj = objectives[objIdx];
      await prisma.initiativeObjective.create({ data: { initiativeId: init.id, objectiveId: obj.id, impact } });
      valueScore += impact * obj.weight;
    }
    valueScore = Math.round(valueScore * 10) / 10;

    // 3. Charter scores
    await prisma.portfolioInitiative.update({
      where: { id: init.id },
      data: { complexityScore: plan.complexity, valueScore },
    });

    // 4. Resources — 3–4 roster entries, 25–75% allocations, ranges inside start→due.
    const span = daysBetween(init.startDate, init.dueDate);
    const resourceCount = 3 + (plan.complexity % 2); // 3 or 4
    for (let r = 0; r < resourceCount; r++) {
      const member = ROSTER[rosterCursor % ROSTER.length];
      rosterCursor++;
      await prisma.initiativeResource.create({
        data: {
          initiativeId: init.id,
          name: member.name,
          roleName: member.title,
          allocationPct: 25 + ((r * 17 + plan.complexity * 3) % 51), // 25–75
          startDate: addDays(init.startDate, Math.round(span * 0.05 * r)),
          endDate: addDays(init.dueDate, -Math.round(span * 0.05 * r)),
        },
      });
    }

    // 5. Activities — sequential phases spanning start→due, each (after the
    // first) depending on the previous; statuses derived from date vs today.
    const phaseLen = Math.floor(span / PHASES.length);
    const phaseIds: string[] = [];
    for (let p = 0; p < PHASES.length; p++) {
      const start = addDays(init.startDate, p * phaseLen);
      const end = p === PHASES.length - 1 ? init.dueDate : addDays(init.startDate, (p + 1) * phaseLen);
      const activity = await prisma.workplanActivity.create({
        data: {
          initiativeId: init.id,
          name: PHASES[p],
          startDate: start,
          endDate: end,
          status: statusFor(start, end),
          dependsOnId: phaseIds[p - 1] ?? null,
          sortOrder: p + 1,
        },
      });
      phaseIds.push(activity.id);
    }
    // A sixth, cross-cutting activity for the bigger builds (4–6 per initiative).
    if (plan.complexity >= 6) {
      await prisma.workplanActivity.create({
        data: {
          initiativeId: init.id,
          name: 'Change management & training',
          startDate: addDays(init.startDate, phaseLen * 2),
          endDate: init.dueDate,
          status: statusFor(addDays(init.startDate, phaseLen * 2), init.dueDate),
          dependsOnId: phaseIds[1], // kicks off once Design is done
          sortOrder: PHASES.length + 1,
        },
      });
    }

    console.log(`${init.name}: value=${valueScore} complexity=${plan.complexity} resources=${resourceCount} activities=${plan.complexity >= 6 ? 6 : 5}`);
  }

  console.log('Done.');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
