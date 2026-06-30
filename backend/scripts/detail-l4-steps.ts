// Granularity rollout — replace the generic templated steps in ~41 L4s with the
// researched practitioner-level steps (backend/data/granular-l4-steps.json,
// produced by domain research agents). For each L4: delete its existing
// ProcessSteps + Level-tree L5 rows, then insert the new practitioner steps with
// their lead/support roles, inputs/outputs, app usage, and a synced Level L5.
// The step code prefix is derived from the L4's existing step codes so codes stay
// consistent. Idempotent: clears + rebuilds each named L4.
//   npx tsx scripts/detail-l4-steps.ts
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../data/granular-l4-steps.json');

type Step = { name: string; lead: string; support?: string; apps: string[]; input: string; output: string };
type L4 = { stream: string; l3: string; l4: string; steps: Step[] };

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const data: L4[] = JSON.parse(readFileSync(DATA, 'utf8'));

  const apps = new Map((await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } })).map((a) => [a.name, a.id]));
  const roleNames = new Set((await prisma.role.findMany({ where: { companyId }, select: { name: true } })).map((r) => r.name));

  let l4done = 0, steps = 0, appLinks = 0, badRole = new Set<string>(), badApp = new Set<string>();
  for (const entry of data) {
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name: entry.stream }, select: { id: true } });
    if (!vs) { console.log('SKIP stream not found:', entry.stream); continue; }
    const existing = await prisma.processStep.findFirst({ where: { valueStreamId: vs.id, l4: entry.l4 }, select: { code: true } });
    const prefix = (existing?.code ?? `${entry.l4.slice(0, 6).toUpperCase().replace(/\s/g, '')}-S`).replace(/\d+$/, '');
    const l4Level = await prisma.level.findFirst({ where: { companyId, levelNumber: 4, name: entry.l4 }, select: { id: true } });

    await prisma.processStep.deleteMany({ where: { valueStreamId: vs.id, l4: entry.l4 } });
    if (l4Level) await prisma.level.deleteMany({ where: { companyId, levelNumber: 5, parentId: l4Level.id } });

    for (let i = 0; i < entry.steps.length; i++) {
      const s = entry.steps[i];
      const code = `${prefix}${String(i + 1).padStart(2, '0')}`;
      if (!roleNames.has(s.lead)) badRole.add(s.lead);
      const ps = await prisma.processStep.create({
        data: {
          tenantId, valueStreamId: vs.id, l3: entry.l3, l4: entry.l4, stepNumber: i + 1, name: s.name,
          leads: s.lead, supporting: s.support || null, inputs: s.input, outputs: s.output, code, illustrative: true,
        },
      });
      steps++;
      if (l4Level) await prisma.level.create({ data: { tenantId, companyId, levelNumber: 5, name: s.name, parentId: l4Level.id, sourceType: 'catalog', sourceRefId: code } });
      for (let j = 0; j < (s.apps ?? []).length; j++) {
        const aId = apps.get(s.apps[j]);
        if (!aId) { badApp.add(s.apps[j]); continue; }
        await prisma.stepAppUsage.create({ data: { tenantId, companyId, activityCode: code, processStepId: ps.id, applicationId: aId, usageType: 'Execution', isPrimary: j === 0 } });
        appLinks++;
      }
    }
    l4done++;
  }
  console.log(`Detailed ${l4done} L4s → ${steps} practitioner steps, ${appLinks} step-app links.`);
  if (badRole.size) console.log('Roles not in DB (kept as free-text lead):', [...badRole].join(', '));
  if (badApp.size) console.log('Apps not in DB (skipped):', [...badApp].join(', '));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
