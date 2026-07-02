// apply-vs-research.ts — inserts externally-researched, adversarially-verified
// L5 process steps (and any new L4 sub-processes) from vs-research-final.json
// at the repo root, wiring each addition into EVERY surface that renders steps:
//   ProcessStep (canonical row, code + stepNumber; later steps renumbered)
//   SubValueStream level 4/5 mirrors (sourceSheet='research')
//   Node tree (sub_process / step nodes with attribute mirrors → the map)
//   StepDeliverable + StepAppUsage (sidebar deliverable chain; illustrative)
//   IoItem + io_item node (Work-tab role enrichment, downstream flows)
//   Deliverable + Task (Work tab rows, same deterministic conventions as seed/work.ts)
//
// Idempotent: an addition whose step name already exists under its L4 is skipped.
// Run from backend/:  npx tsx scripts/apply-vs-research.ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Addition = {
  stream: string; l3: string; l4: string; l4Code: string | null;
  name: string; insertAfterStepNumber: number; description: string;
  leads: string; supporting: string; inputs: string; outputs: string;
  deliverable: string | null; sorApplication?: string | null; rationale: string; sources: string[];
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pick = <T,>(seed: number, arr: T[]): T => arr[seed % arr.length];
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const firstRole = (cell: string | null) => cell?.split(/[,;]+/)[0]?.trim() || null;
const TASK_STATUS = ['To Do', 'To Do', 'In Progress', 'In Progress', 'In Progress', 'Done', 'Blocked'];
const PRIORITY = ['High', 'Medium', 'Medium', 'Medium', 'Low'];
const DELIVERABLE_STATUS = ['Not Started', 'In Progress', 'In Progress', 'In Progress', 'Done', 'At Risk'];
const classifyType = (n: string) => /report|opinion|assessment|summary|analysis|filing/i.test(n) ? 'Report' : /model|valuation/i.test(n) ? 'Model' : 'Document';
const NOTES = 'Added from external industry research (deep-research, 2026-06-11)';

async function main() {
  const data = JSON.parse(readFileSync(new URL('../../documents/audit/vs-research-final.json', import.meta.url), 'utf8'));
  const additions: Addition[] = data.additions;
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const today = new Date();

  const [streams, roles, apps] = await Promise.all([
    prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const vsByName = new Map(streams.map((s) => [s.name, s.id] as const));
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r.id] as const));
  const appByName = new Map(apps.map((a) => [a.name.toLowerCase(), a.id] as const));

  let added = 0, skipped = 0, l4Created = 0;
  for (const a of additions) {
    const vsId = vsByName.get(a.stream);
    if (!vsId) { console.warn(`   ! stream not found: ${a.stream} — skipped "${a.name}"`); skipped++; continue; }

    // ── Resolve (or create) the L4 sub-process: activity code, SVS4 row, node ──
    let activityCode = a.l4Code;
    let l3 = a.l3, l4 = a.l4;
    let svs4Id: string, subNodeId: string;
    if (activityCode) {
      const sib = await prisma.processStep.findFirst({ where: { parentProcessId: activityCode }, select: { id: true, l3: true, l4: true } });
      if (!sib) { console.warn(`   ! L4 code ${activityCode} has no steps — skipped "${a.name}"`); skipped++; continue; }
      l3 = sib.l3 ?? a.l3; l4 = sib.l4 ?? a.l4;
      const sibNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'step', code: sib.id }, select: { parentId: true } });
      const subNode = sibNode?.parentId ? await prisma.node.findFirst({ where: { id: sibNode.parentId }, select: { id: true, code: true } }) : null;
      if (!subNode?.code) { console.warn(`   ! no sub_process node for ${activityCode} — skipped "${a.name}"`); skipped++; continue; }
      subNodeId = subNode.id; svs4Id = subNode.code;
    } else {
      // New L4: derive the next activity code from the stream's existing ones.
      const sibSteps = await prisma.processStep.findMany({ where: { valueStreamId: vsId }, select: { id: true, parentProcessId: true } });
      const prefixes = sibSteps.map((s) => s.parentProcessId).filter((c): c is string => !!c);
      if (!prefixes.length) { console.warn(`   ! no existing codes in ${a.stream} — skipped "${a.name}"`); skipped++; continue; }
      const prefix = prefixes[0].split('-').slice(0, 2).join('-');
      const maxIdx = Math.max(...prefixes.filter((c) => c.startsWith(prefix)).map((c) => parseInt(c.split('-')[2] ?? '0', 10)));
      // Reuse if this script already created the L4 (idempotent re-run).
      const existing = await prisma.subValueStream.findFirst({ where: { valueStreamId: vsId, level: 4, name: a.l4 }, select: { id: true } });
      if (existing) {
        svs4Id = existing.id;
        const node = await prisma.node.findFirst({ where: { companyId, typeKey: 'sub_process', code: existing.id }, select: { id: true } });
        subNodeId = node!.id;
        const ex = await prisma.processStep.findFirst({ where: { valueStreamId: vsId, l4: a.l4 }, select: { parentProcessId: true } });
        activityCode = ex?.parentProcessId ?? `${prefix}-${String(maxIdx + 1).padStart(2, '0')}`;
      } else {
        activityCode = `${prefix}-${String(maxIdx + 1).padStart(2, '0')}`;
        const svs3 = await prisma.subValueStream.findFirst({ where: { valueStreamId: vsId, level: 3, name: a.l3 }, select: { id: true } });
        const svs4 = await prisma.subValueStream.create({
          data: { tenantId, valueStreamId: vsId, parentId: svs3?.id ?? null, name: a.l4, level: 4, sourceSheet: 'research', notes: NOTES },
          select: { id: true },
        });
        svs4Id = svs4.id;
        // Hang the sub_process node off the same value_stream node its siblings use.
        const sibStep = sibSteps[0];
        const sibStepNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'step', code: sibStep.id }, select: { parentId: true } });
        const sibSub = sibStepNode?.parentId ? await prisma.node.findFirst({ where: { id: sibStepNode.parentId }, select: { parentId: true } }) : null;
        const vsNodeId = sibSub?.parentId;
        if (!vsNodeId) { console.warn(`   ! no value_stream node for ${a.stream} — skipped "${a.name}"`); skipped++; continue; }
        const maxSort = await prisma.node.count({ where: { parentId: vsNodeId } });
        const subNode = await prisma.node.create({
          data: {
            companyId, typeKey: 'sub_process', parentId: vsNodeId, name: a.l4, code: svs4Id,
            sortOrder: maxSort + 1, provenance: 'real',
            attributes: { l3: a.l3, notes: NOTES },
          },
          select: { id: true },
        });
        subNodeId = subNode.id;
        l4Created++;
      }
    }

    // ── Idempotency: skip if the step already exists under this L4 ──
    const dup = await prisma.processStep.findFirst({ where: { parentProcessId: activityCode, name: a.name }, select: { id: true } });
    if (dup) { skipped++; continue; }

    // ── Renumber later steps (stepNumber + node sortOrder/attributes) ──
    const l4Steps = await prisma.processStep.findMany({ where: { parentProcessId: activityCode }, select: { id: true, stepNumber: true, code: true } });
    const newNumber = a.insertAfterStepNumber + 1;
    const toShift = l4Steps.filter((s) => s.stepNumber >= newNumber);
    for (const s of toShift) {
      await prisma.processStep.update({ where: { id: s.id }, data: { stepNumber: s.stepNumber + 1 } });
      const n = await prisma.node.findFirst({ where: { companyId, typeKey: 'step', code: s.id }, select: { id: true, attributes: true } });
      if (n) await prisma.node.update({ where: { id: n.id }, data: { sortOrder: s.stepNumber + 1, attributes: { ...(n.attributes as object ?? {}), stepNumber: s.stepNumber + 1 } } });
    }

    // ── ProcessStep (codes are identity — new step takes the next free suffix) ──
    const maxS = Math.max(0, ...l4Steps.map((s) => parseInt(s.code?.match(/S(\d+)$/)?.[1] ?? '0', 10)));
    const code = `${activityCode}-S${String(maxS + 1).padStart(2, '0')}`;
    const ps = await prisma.processStep.create({
      data: {
        tenantId, valueStreamId: vsId, l3, l4, stepNumber: newNumber,
        name: a.name, description: a.description, leads: a.leads, supporting: a.supporting,
        inputs: a.inputs, outputs: a.outputs, notes: NOTES, code, parentProcessId: activityCode,
      },
      select: { id: true },
    });

    // ── SubValueStream L5 mirror ──
    await prisma.subValueStream.create({
      data: { tenantId, valueStreamId: vsId, parentId: svs4Id, name: a.name, level: 5, inputs: a.inputs, outputs: a.outputs, sourceSheet: 'research', notes: NOTES },
    });

    // ── Step node (the map) ──
    await prisma.node.create({
      data: {
        companyId, typeKey: 'step', parentId: subNodeId, name: a.name, code: ps.id,
        sortOrder: newNumber, provenance: 'real', description: a.description,
        attributes: { l3, l4, leads: a.leads, supporting: a.supporting, inputs: a.inputs, outputs: a.outputs, stepNumber: newNumber, notes: NOTES },
      },
    });

    // ── Sidebar chain: deliverable + app usage ──
    const appId = a.sorApplication ? appByName.get(a.sorApplication.toLowerCase()) ?? null : null;
    if (a.deliverable) {
      await prisma.stepDeliverable.create({
        data: {
          tenantId, companyId, activityCode: code, processStepId: ps.id, name: a.deliverable,
          sorApplicationId: appId, approverRoleId: roleByName.get(firstRole(a.leads)?.toLowerCase() ?? '') ?? null,
          approvalApplicationId: appId, approvalType: 'Manual Sign-off', notes: NOTES, illustrative: true,
        },
      });
    }
    if (appId) {
      await prisma.stepAppUsage.createMany({
        data: [
          { tenantId, companyId, activityCode: code, processStepId: ps.id, applicationId: appId, usageType: 'Execution', isPrimary: true, illustrative: true },
          { tenantId, companyId, activityCode: code, processStepId: ps.id, applicationId: appId, usageType: 'System of Record', isPrimary: false, illustrative: true },
        ],
      });
    }

    // ── Work-tab enrichment: IoItem (+ io_item node), Deliverable, Task ──
    let workDelivId: string | null = null;
    if (a.deliverable) {
      const io = await prisma.ioItem.create({
        data: { tenantId, valueStreamId: vsId, type: 'Deliverable', name: a.deliverable, l3, l4, keyRoles: a.leads, illustrative: true },
        select: { id: true },
      });
      await prisma.node.create({
        data: {
          companyId, typeKey: 'io_item', parentId: subNodeId, name: a.deliverable, code: io.id,
          provenance: 'real', attributes: { l3, l4, type: 'Deliverable', keyRoles: a.leads },
        },
      });
      const h = hash(`${vsId}␟${l4}␟${a.deliverable.toLowerCase()}`);
      const existing = await prisma.deliverable.findFirst({ where: { companyId, valueStreamId: vsId, title: a.deliverable }, select: { id: true } });
      workDelivId = existing?.id ?? (await prisma.deliverable.create({
        data: {
          tenantId, companyId, title: a.deliverable, description: [l3, l4].filter(Boolean).join(' · ') || null,
          owner: firstRole(a.leads), type: classifyType(a.deliverable), status: pick(h, DELIVERABLE_STATUS),
          valueStreamId: vsId, dueDate: addDays(today, (h % 110) - 18),
        },
        select: { id: true },
      })).id;
    }
    const th = hash(`${vsId}␟${l4}␟${newNumber}␟${a.name}`);
    await prisma.task.create({
      data: {
        tenantId, companyId, deliverableId: workDelivId, title: a.name, owner: firstRole(a.leads),
        status: pick(th, TASK_STATUS), priority: pick(th >> 3, PRIORITY), source: 'process',
        dueDate: addDays(today, (th % 120) - 20),
      },
    });

    added++;
    console.log(`   + [${a.stream.slice(0, 28)}] ${code} "${a.name}"${a.l4Code ? '' : ' (new L4: ' + a.l4 + ')'}`);
  }
  console.log(`Done: ${added} steps added (${l4Created} new L4 sub-processes), ${skipped} skipped.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
