// apply-life-streams.ts — builds the 7 previously-empty Life/Annuity/Retirement/
// Disability value streams from the verified designs in life-streams-content.json
// (repo root: { streamDesigns, execOffice }), removes the life-specific L4s that
// were wrongly homed inside non-life streams (their content is re-homed by the
// designs), and populates the Executive Office division.
//
// Wiring per L5 step (same as apply-vs-research.ts): ProcessStep + SVS L3/L4/L5
// + Node(sub_process/step/io_item) + StepDeliverable/StepAppUsage + IoItem +
// work Deliverable/Task. Provenance: notes marker + sourceSheet='research' +
// illustrative flags. Idempotent at the L4 / role level.
// Run from backend/:  npx tsx scripts/apply-life-streams.ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const NOTES = 'Added from external industry research (deep-research, 2026-06-11)';

const STREAM_PREFIX: Record<string, string> = {
  'Life New Business & Underwriting': 'LF-30',
  'Life Policy Administration & Inforce Servicing': 'LF-31',
  'Life & Annuity Claims': 'LF-32',
  'Life, Annuity & Retirement Billing': 'LF-33',
  'Annuity New Business & Servicing': 'AN-34',
  'Retirement Plan Administration': 'RT-35',
  'Disability & Absence Management': 'DI-36',
};

// Life L4s previously homed inside non-life streams — re-homed by the designs.
const RELOCATED_L4_CODES = ['CI-04-05', 'CI-06-05'];
const RELOCATED_STEP_CODES = ['CI-02-01-S07'];

type Step = { name: string; description: string; leads: string; supporting: string; inputs: string; outputs: string; deliverable: string | null; sorApplication?: string | null };
type Design = { stream: string; l3s: { name: string; l4s: { name: string; steps: Step[] }[] }[]; notes: string[] };
type ExecRole = { name: string; roleLevel: string; reportsTo: string; tasks: { text: string; category: string }[]; checklist: { text: string; category: string }[]; inputs: string; outputs: string };

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
const classifyType = (n: string) => /report|summary|notice|statement|confirmation|disclosure/i.test(n) ? 'Report' : /record|file|register/i.test(n) ? 'Document' : 'Document';

async function main() {
  const data = JSON.parse(readFileSync(new URL('../../documents/life-streams-content.json', import.meta.url), 'utf8'));
  const designs: Design[] = data.streamDesigns;
  const exec = data.execOffice as { departments: { name: string; roles: ExecRole[] }[] } | null;
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  const today = new Date();

  const [roles, apps, cats] = await Promise.all([
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r.id] as const));
  const appByName = new Map(apps.map((a) => [a.name.toLowerCase(), a.id] as const));
  const catByName = new Map(cats.map((c) => [c.name, c.id] as const));

  // ── 1. Build the seven streams ────────────────────────────────────────────
  let stepsAdded = 0, l4sAdded = 0;
  for (const d of designs) {
    const prefix = STREAM_PREFIX[d.stream];
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name: d.stream }, select: { id: true } });
    const vsNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'value_stream', name: d.stream }, select: { id: true } });
    if (!prefix || !vs || !vsNode) { console.warn(`   ! stream not wired: ${d.stream} (prefix=${prefix}, vs=${!!vs}, node=${!!vsNode})`); continue; }

    let l4Ordinal = 0;
    for (const l3 of d.l3s) {
      let svs3 = await prisma.subValueStream.findFirst({ where: { valueStreamId: vs.id, level: 3, name: l3.name }, select: { id: true } });
      if (!svs3) svs3 = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: vs.id, level: 3, name: l3.name, sourceSheet: 'research', notes: NOTES }, select: { id: true } });

      for (const l4 of l3.l4s) {
        l4Ordinal++;
        const activityCode = `${prefix.split('-')[0]}-${prefix.split('-')[1]}-${String(l4Ordinal).padStart(2, '0')}`;
        // Idempotency: skip an L4 that already carries steps.
        if (await prisma.processStep.findFirst({ where: { valueStreamId: vs.id, l4: l4.name }, select: { id: true } })) continue;

        let svs4 = await prisma.subValueStream.findFirst({ where: { valueStreamId: vs.id, level: 4, name: l4.name }, select: { id: true } });
        if (!svs4) svs4 = await prisma.subValueStream.create({ data: { tenantId, valueStreamId: vs.id, parentId: svs3.id, level: 4, name: l4.name, sourceSheet: 'research', notes: NOTES }, select: { id: true } });
        const maxSort = await prisma.node.count({ where: { parentId: vsNode.id } });
        const subNode = await prisma.node.create({
          data: { companyId, typeKey: 'sub_process', parentId: vsNode.id, name: l4.name, code: svs4.id, sortOrder: maxSort + 1, provenance: 'real', attributes: { l3: l3.name, notes: NOTES } },
          select: { id: true },
        });
        l4sAdded++;

        for (let i = 0; i < l4.steps.length; i++) {
          const st = l4.steps[i];
          const code = `${activityCode}-S${String(i + 1).padStart(2, '0')}`;
          const ps = await prisma.processStep.create({
            data: {
              tenantId, valueStreamId: vs.id, l3: l3.name, l4: l4.name, stepNumber: i + 1,
              name: st.name, description: st.description, leads: st.leads, supporting: st.supporting,
              inputs: st.inputs, outputs: st.outputs, notes: NOTES, code, parentProcessId: activityCode,
            },
            select: { id: true },
          });
          await prisma.subValueStream.create({ data: { tenantId, valueStreamId: vs.id, parentId: svs4.id, name: st.name, level: 5, inputs: st.inputs, outputs: st.outputs, sourceSheet: 'research', notes: NOTES } });
          await prisma.node.create({
            data: {
              companyId, typeKey: 'step', parentId: subNode.id, name: st.name, code: ps.id, sortOrder: i + 1, provenance: 'real', description: st.description,
              attributes: { l3: l3.name, l4: l4.name, leads: st.leads, supporting: st.supporting, inputs: st.inputs, outputs: st.outputs, stepNumber: i + 1, notes: NOTES },
            },
          });
          const appId = st.sorApplication ? appByName.get(st.sorApplication.toLowerCase()) ?? null : null;
          if (st.deliverable) {
            await prisma.stepDeliverable.create({
              data: {
                tenantId, companyId, activityCode: code, processStepId: ps.id, name: st.deliverable,
                sorApplicationId: appId, approverRoleId: roleByName.get(firstRole(st.leads)?.toLowerCase() ?? '') ?? null,
                approvalApplicationId: appId, approvalType: 'Manual Sign-off', notes: NOTES, illustrative: true,
              },
            });
            const io = await prisma.ioItem.create({ data: { tenantId, valueStreamId: vs.id, type: 'Deliverable', name: st.deliverable, l3: l3.name, l4: l4.name, keyRoles: st.leads, illustrative: true }, select: { id: true } });
            await prisma.node.create({ data: { companyId, typeKey: 'io_item', parentId: subNode.id, name: st.deliverable, code: io.id, provenance: 'real', attributes: { l3: l3.name, l4: l4.name, type: 'Deliverable', keyRoles: st.leads } } });
            const h = hash(`${vs.id}␟${l4.name}␟${st.deliverable.toLowerCase()}`);
            const existing = await prisma.deliverable.findFirst({ where: { companyId, valueStreamId: vs.id, title: st.deliverable }, select: { id: true } });
            const delivId = existing?.id ?? (await prisma.deliverable.create({
              data: {
                tenantId, companyId, title: st.deliverable, description: [l3.name, l4.name].join(' · '),
                owner: firstRole(st.leads), type: classifyType(st.deliverable), status: pick(h, DELIVERABLE_STATUS),
                valueStreamId: vs.id, dueDate: addDays(today, (h % 110) - 18),
              }, select: { id: true },
            })).id;
            const th = hash(`${vs.id}␟${l4.name}␟${i + 1}␟${st.name}`);
            await prisma.task.create({
              data: { tenantId, companyId, deliverableId: delivId, title: st.name, owner: firstRole(st.leads), status: pick(th, TASK_STATUS), priority: pick(th >> 3, PRIORITY), source: 'process', dueDate: addDays(today, (th % 120) - 20) },
            });
          } else {
            const th = hash(`${vs.id}␟${l4.name}␟${i + 1}␟${st.name}`);
            const anyDeliv = await prisma.deliverable.findFirst({ where: { companyId, valueStreamId: vs.id }, select: { id: true } });
            await prisma.task.create({
              data: { tenantId, companyId, deliverableId: anyDeliv?.id ?? null, title: st.name, owner: firstRole(st.leads), status: pick(th, TASK_STATUS), priority: pick(th >> 3, PRIORITY), source: 'process', dueDate: addDays(today, (th % 120) - 20) },
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
          stepsAdded++;
        }
      }
    }
    console.log(`   + ${d.stream}: built`);
  }

  // ── 2. Remove the wrongly-homed life L4s/steps (content re-homed above) ──
  let removed = 0;
  const unwireStep = async (s: { id: string; name: string; valueStreamId: string }) => {
    await prisma.stepDeliverable.deleteMany({ where: { processStepId: s.id } });
    await prisma.stepAppUsage.deleteMany({ where: { processStepId: s.id } });
    await prisma.node.deleteMany({ where: { companyId, typeKey: 'step', code: s.id } });
    await prisma.subValueStream.deleteMany({ where: { valueStreamId: s.valueStreamId, level: 5, name: s.name } });
    await prisma.task.deleteMany({ where: { companyId, title: s.name, source: 'process', deliverable: { valueStreamId: s.valueStreamId } } });
    await prisma.processStep.delete({ where: { id: s.id } });
    removed++;
  };
  for (const l4code of RELOCATED_L4_CODES) {
    const steps = await prisma.processStep.findMany({ where: { parentProcessId: l4code }, select: { id: true, name: true, valueStreamId: true, l4: true } });
    if (!steps.length) continue;
    const { valueStreamId, l4 } = steps[0];
    for (const s of steps) await unwireStep(s);
    const svs4 = await prisma.subValueStream.findFirst({ where: { valueStreamId, level: 4, name: l4 ?? '_' }, select: { id: true } });
    if (svs4) {
      await prisma.node.deleteMany({ where: { companyId, typeKey: 'sub_process', code: svs4.id } }); // cascades child io_item nodes
      await prisma.subValueStream.delete({ where: { id: svs4.id } });
    }
    await prisma.ioItem.deleteMany({ where: { valueStreamId, l4: l4 ?? '_', illustrative: true } });
    const dels = await prisma.deliverable.findMany({ where: { companyId, valueStreamId, description: { contains: l4 ?? '_' } }, select: { id: true } });
    for (const del of dels) { await prisma.task.deleteMany({ where: { deliverableId: del.id } }); await prisma.deliverable.delete({ where: { id: del.id } }); }
    console.log(`   - removed mis-homed L4 ${l4code} "${l4}" (${steps.length} steps)`);
  }
  for (const code of RELOCATED_STEP_CODES) {
    const s = await prisma.processStep.findFirst({ where: { code }, select: { id: true, name: true, valueStreamId: true, parentProcessId: true } });
    if (!s) continue;
    await unwireStep(s as any);
    // close the stepNumber gap in the L4 it left
    const sibs = await prisma.processStep.findMany({ where: { parentProcessId: s.parentProcessId }, orderBy: { stepNumber: 'asc' }, select: { id: true, stepNumber: true } });
    for (let i = 0; i < sibs.length; i++) {
      if (sibs[i].stepNumber !== i + 1) {
        await prisma.processStep.update({ where: { id: sibs[i].id }, data: { stepNumber: i + 1 } });
        const n = await prisma.node.findFirst({ where: { companyId, typeKey: 'step', code: sibs[i].id }, select: { id: true, attributes: true } });
        if (n) await prisma.node.update({ where: { id: n.id }, data: { sortOrder: i + 1, attributes: { ...(n.attributes as object ?? {}), stepNumber: i + 1 } } });
      }
    }
    console.log(`   - removed mis-homed step ${code} "${s.name}"`);
  }

  // ── 3. Executive Office contents ──────────────────────────────────────────
  let rolesAdded = 0;
  if (exec) {
    const division = await prisma.division.findFirst({ where: { companyId, name: 'Executive Office' }, select: { id: true } });
    const divNode = await prisma.node.findFirst({ where: { companyId, typeKey: 'division', name: 'Executive Office' }, select: { id: true } });
    if (!division || !divNode) throw new Error('Executive Office division not found');
    for (const dept of exec.departments) {
      let dRow = await prisma.department.findFirst({ where: { divisionId: division.id, name: dept.name }, select: { id: true } });
      let dNode = dRow ? await prisma.node.findFirst({ where: { companyId, typeKey: 'department', code: dRow.id }, select: { id: true } }) : null;
      if (!dRow) {
        dRow = await prisma.department.create({ data: { tenantId, companyId, divisionId: division.id, name: dept.name }, select: { id: true } });
        dNode = await prisma.node.create({ data: { companyId, typeKey: 'department', parentId: divNode.id, name: dept.name, code: dRow.id, provenance: 'real' }, select: { id: true } });
      }
      for (const r of dept.roles) {
        if (roleByName.has(r.name.toLowerCase())) { console.warn(`   ! role exists, skipped: ${r.name}`); continue; }
        const managerId = roleByName.get(r.reportsTo.toLowerCase()) ?? null;
        const role = await prisma.role.create({
          data: { tenantId, companyId, name: r.name, roleLevel: r.roleLevel, roleFamily: 'Executive Office', divisionId: division.id, departmentId: dRow.id, managerRoleId: managerId },
          select: { id: true },
        });
        await prisma.node.create({ data: { companyId, typeKey: 'role', parentId: dNode!.id, name: r.name, code: role.id, provenance: 'real', attributes: { roleLevel: r.roleLevel, roleFamily: 'Executive Office', status: 'New' } } });
        const catId = (n: string) => catByName.get(n) ?? catByName.get('Other') ?? null;
        await prisma.roleTask.createMany({ data: r.tasks.map((t) => ({ tenantId, roleId: role.id, categoryId: catId(t.category), text: t.text, sourceSheet: 'backfill' })) });
        await prisma.checklistItem.createMany({ data: r.checklist.map((c) => ({ tenantId, roleId: role.id, categoryId: catId(c.category), text: c.text, sourceSheet: 'backfill' })) });
        const esVs = await prisma.valueStream.findFirst({ where: { companyId, name: 'Enterprise Strategy & Portfolio Management' }, select: { id: true } });
        if (esVs) await prisma.roleValueStream.create({ data: { tenantId, roleId: role.id, valueStreamId: esVs.id, participationType: r.roleLevel === 'Executive' ? 'Oversight' : 'Core', inputs: r.inputs, outputs: r.outputs, sourceSheet: 'backfill' } });
        roleByName.set(r.name.toLowerCase(), role.id);
        rolesAdded++;
        console.log(`   + Executive Office role: ${r.name} (${r.roleLevel}, reports to ${r.reportsTo})`);
      }
    }
  }

  console.log(`Done: ${stepsAdded} steps in ${l4sAdded} L4s across ${designs.length} streams; ${removed} mis-homed steps removed; ${rolesAdded} Executive Office roles added.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
