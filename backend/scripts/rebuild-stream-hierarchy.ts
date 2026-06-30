// Rebuild a value stream's full L3/L4/L5 hierarchy from a researched taxonomy
// JSON, matching the structure of the gold-standard reinsurance streams:
//   SubValueStream L3 (process area) -> L4 (sub-process) ; ProcessStep L5 steps
//   keyed by (l3,l4) text ; a Node sub_process per L4 (map) ; one Deliverable +
//   Task + StepDeliverable per L4 ; a StepAppUsage per step app.
// Wipes the stream's existing SubValueStream/ProcessStep/Deliverable/Task/
// sub_process-Node and any stale Level L4/L5, then rebuilds. The value_stream
// Node and the Level-3 row are preserved. Idempotent.
//   npx tsx scripts/rebuild-stream-hierarchy.ts <path-to-json>
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();

type Step = { name: string; lead: string; support?: string; apps: string[]; input: string; output: string };
type L4 = { name: string; deliverable: string; steps: Step[] };
type L3 = { name: string; l4s: L4[] };
type Tax = { stream: string; l3s: L3[] };

const abbr = (s: string) => s.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: rebuild-stream-hierarchy.ts <json>');
  const tax: Tax = JSON.parse(readFileSync(file, 'utf8'));

  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const vs = await prisma.valueStream.findFirst({ where: { companyId, name: tax.stream }, select: { id: true } });
  if (!vs) throw new Error(`stream not found: ${tax.stream}`);
  const vsNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: vs.id }, select: { id: true } });
  const apps = new Map((await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } })).map((a) => [a.name, a.id]));
  const roleNames = new Set((await prisma.role.findMany({ where: { companyId }, select: { name: true } })).map((r) => r.name));

  // ── Wipe existing structure ────────────────────────────────────────────────
  const oldL4 = await prisma.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 4 }, select: { id: true } });
  await prisma.node.deleteMany({ where: { companyId, typeKey: 'sub_process', code: { in: oldL4.map((x) => x.id) } } });
  await prisma.processStep.deleteMany({ where: { valueStreamId: vs.id } }); // cascades StepAppUsage + StepDeliverable
  await prisma.subValueStream.deleteMany({ where: { valueStreamId: vs.id } });
  const oldDels = await prisma.deliverable.findMany({ where: { companyId, valueStreamId: vs.id }, select: { id: true } });
  await prisma.task.deleteMany({ where: { deliverableId: { in: oldDels.map((d) => d.id) } } });
  await prisma.deliverable.deleteMany({ where: { companyId, valueStreamId: vs.id } });
  // stale Level L4/L5 under this stream's Level-3 row
  const vsLevel = await prisma.level.findFirst({ where: { companyId, levelNumber: 3, name: tax.stream }, select: { id: true } });
  if (vsLevel) {
    const l4Levels = await prisma.level.findMany({ where: { companyId, levelNumber: 4, parentId: vsLevel.id }, select: { id: true } });
    await prisma.level.deleteMany({ where: { companyId, levelNumber: 5, parentId: { in: l4Levels.map((l) => l.id) } } });
    await prisma.level.deleteMany({ where: { companyId, levelNumber: 4, parentId: vsLevel.id } });
  }

  // ── Rebuild ────────────────────────────────────────────────────────────────
  let nL3 = 0, nL4 = 0, nStep = 0, nApp = 0, nDel = 0, badRole = new Set<string>(), badApp = new Set<string>();
  for (let i = 0; i < tax.l3s.length; i++) {
    const l3 = tax.l3s[i];
    const l3row = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: vs.id, level: 3, name: l3.name } });
    nL3++;
    for (let j = 0; j < l3.l4s.length; j++) {
      const l4 = l3.l4s[j];
      const l4row = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: vs.id, level: 4, name: l4.name, parentId: l3row.id } });
      nL4++;
      if (vsNode) {
        const last = await prisma.node.findFirst({ where: { parentId: vsNode.id, typeKey: 'sub_process' }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
        await prisma.node.create({ data: { companyId, typeKey: 'sub_process', name: l4.name, code: l4row.id, parentId: vsNode.id, provenance: 'real', sortOrder: (last?.sortOrder ?? -1) + 1, attributes: { processArea: l3.name } } });
      }
      // Deliverable + Task for this L4
      const ownerRole = l4.steps.find((s) => roleNames.has(s.lead))?.lead ?? l4.steps[0]?.lead ?? null;
      const del = await prisma.deliverable.create({ data: { tenantId, companyId, valueStreamId: vs.id, title: l4.deliverable, type: 'Deliverable', status: 'In Progress', owner: ownerRole } });
      nDel++;
      await prisma.task.create({ data: { tenantId, companyId, deliverableId: del.id, title: `Produce: ${l4.deliverable}`, owner: ownerRole, status: 'To Do', priority: 'Medium', source: 'process' } });
      // Steps
      let lastStepId: string | null = null, lastCode = '';
      for (let k = 0; k < l4.steps.length; k++) {
        const s = l4.steps[k];
        if (!roleNames.has(s.lead)) badRole.add(s.lead);
        const code = `${abbr(tax.stream)}-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(2, '0')}-S${String(k + 1).padStart(2, '0')}`;
        const ps = await prisma.processStep.create({
          data: { tenantId, valueStreamId: vs.id, l3: l3.name, l4: l4.name, stepNumber: k + 1, name: s.name, leads: s.lead, supporting: s.support || null, inputs: s.input, outputs: s.output, code, illustrative: true },
        });
        nStep++; lastStepId = ps.id; lastCode = code;
        for (let a = 0; a < (s.apps ?? []).length; a++) {
          const aId = apps.get(s.apps[a]);
          if (!aId) { badApp.add(s.apps[a]); continue; }
          await prisma.stepAppUsage.create({ data: { tenantId, companyId, activityCode: code, processStepId: ps.id, applicationId: aId, usageType: 'Execution', isPrimary: a === 0 } });
          nApp++;
        }
      }
      // StepDeliverable on the L4's final step
      if (lastStepId) await prisma.stepDeliverable.create({ data: { tenantId, companyId, activityCode: lastCode, processStepId: lastStepId, name: l4.deliverable, illustrative: true } });
    }
  }
  console.log(`Rebuilt "${tax.stream}": ${nL3} L3, ${nL4} L4, ${nStep} L5 steps, ${nDel} deliverables/tasks, ${nApp} step-app links.`);
  if (badRole.size) console.log('  roles not in DB (free-text lead):', [...badRole].join(', '));
  if (badApp.size) console.log('  apps not in DB (skipped):', [...badApp].join(', '));
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
