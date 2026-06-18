// Granularity exemplar — decompose the developer build flow to the practitioner
// grain the app is meant to expose: a junior dev getting a ticket all the way to
// handing off to QA. Replaces the 6 generic steps of Technology Delivery & Change
// › Build & Integration › "Solution build and integration delivery" with the real
// 16-step journey, each tied to its lead role + the tools it actually uses.
// Keeps ProcessStep (the drill-down source of truth) and the Level tree (L5,
// dashboard) in sync. Idempotent: clears this L4's steps/levels then rebuilds.
//   npx tsx scripts/detail-dev-sdlc.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const VS = 'Technology Delivery & Change';
const L3 = 'Build & Integration';
const L4 = 'Solution build and integration delivery';
const PREFIX = 'T-22-02-S';

type Step = { name: string; lead: string; support?: string; apps: string[]; in: string; out: string };
const STEPS: Step[] = [
  { name: 'Pick up assigned ticket from sprint backlog', lead: 'Junior Developer', apps: ['Work / Issue Tracking'], in: 'Sprint backlog, assigned ticket', out: 'Ticket moved to In Progress' },
  { name: 'Review acceptance criteria and clarify with analyst', lead: 'Junior Developer', support: 'Business Analyst', apps: ['Work / Issue Tracking', 'Collaboration / Chat'], in: 'Ticket, acceptance criteria', out: 'Confirmed understanding of scope' },
  { name: 'Create feature branch from main', lead: 'Junior Developer', apps: ['GitHub'], in: 'Repository main branch', out: 'Feature branch' },
  { name: 'Implement code changes in IDE', lead: 'Junior Developer', apps: ['IntelliJ IDEA', 'Visual Studio Code'], in: 'Solution design, feature branch', out: 'Code changes' },
  { name: 'Write and run unit tests locally', lead: 'Junior Developer', apps: ['IntelliJ IDEA'], in: 'Code changes', out: 'Passing unit tests' },
  { name: 'Run static code analysis and resolve findings', lead: 'Junior Developer', apps: ['SonarQube'], in: 'Code changes', out: 'Clean quality scan' },
  { name: 'Test integration endpoints', lead: 'Junior Developer', apps: ['Postman'], in: 'API/integration changes', out: 'Verified endpoints' },
  { name: 'Build and run service container locally', lead: 'Junior Developer', apps: ['Docker'], in: 'Code, Dockerfile', out: 'Running local build' },
  { name: 'Commit and push branch to GitHub', lead: 'Junior Developer', apps: ['GitHub'], in: 'Tested changes', out: 'Pushed feature branch' },
  { name: 'Open merge request and request peer review', lead: 'Junior Developer', support: 'Senior Developer', apps: ['GitHub'], in: 'Pushed branch', out: 'Open merge request' },
  { name: 'Address code review feedback', lead: 'Junior Developer', support: 'Senior Developer', apps: ['GitHub'], in: 'Review comments', out: 'Updated merge request' },
  { name: 'Verify CI/CD pipeline succeeds', lead: 'Junior Developer', apps: ['CI/CD Pipeline'], in: 'Merge request', out: 'Green build pipeline' },
  { name: 'Merge to main after approval', lead: 'Senior Developer', support: 'Tech Lead', apps: ['GitHub'], in: 'Approved merge request', out: 'Merged to main' },
  { name: 'Update ticket status and log work', lead: 'Junior Developer', apps: ['Work / Issue Tracking'], in: 'Merged code', out: 'Updated ticket, logged time' },
  { name: 'Demo increment at sprint review', lead: 'Junior Developer', apps: ['Collaboration / Chat'], in: 'Working increment', out: 'Stakeholder acceptance' },
  { name: 'Hand off to QA for testing', lead: 'Junior Developer', support: 'QA Analyst', apps: ['Work / Issue Tracking'], in: 'Merged increment', out: 'QA-ready build, test handoff' },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const vs = await prisma.valueStream.findFirst({ where: { companyId, name: VS }, select: { id: true } });
  if (!vs) throw new Error(`stream not found: ${VS}`);
  const l4Level = await prisma.level.findFirst({ where: { companyId, levelNumber: 4, name: L4 }, select: { id: true } });
  const apps = new Map((await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } })).map((a) => [a.name, a.id]));

  // Clear existing steps + levels for this L4 (cascade removes StepAppUsage/StepDeliverable).
  await prisma.processStep.deleteMany({ where: { valueStreamId: vs.id, l4: L4 } });
  if (l4Level) await prisma.level.deleteMany({ where: { companyId, levelNumber: 5, parentId: l4Level.id } });

  let n = 0, appLinks = 0;
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    const code = `${PREFIX}${String(i + 1).padStart(2, '0')}`;
    const ps = await prisma.processStep.create({
      data: {
        tenantId, valueStreamId: vs.id, l3: L3, l4: L4, stepNumber: i + 1, name: s.name,
        leads: s.lead, supporting: s.support ?? null, inputs: s.in, outputs: s.out,
        code, illustrative: true,
      },
    });
    n++;
    if (l4Level) await prisma.level.create({ data: { tenantId, companyId, levelNumber: 5, name: s.name, parentId: l4Level.id, sourceType: 'catalog', sourceRefId: code } });
    for (let j = 0; j < s.apps.length; j++) {
      const aId = apps.get(s.apps[j]);
      if (!aId) { console.log('  missing app:', s.apps[j]); continue; }
      await prisma.stepAppUsage.create({ data: { tenantId, companyId, activityCode: code, processStepId: ps.id, applicationId: aId, usageType: 'Execution', isPrimary: j === 0 } });
      appLinks++;
    }
  }
  console.log(`Detailed "${L4}" → ${n} practitioner steps, ${appLinks} step-app links. Lead role: Junior Developer.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
