// PHASE 1 (structural spine) — REFINED-v2 rework.
// Rebuilds the L1–L5 operating-model spine for "ABC Insurance Group" to EXACTLY
// match documents/value-streams/abc-refined-v2.json:
//   3 segments · 14 divisions · 132 L3 value streams · 868 L4 sub-processes · 8355 L5 steps
// across the models the Value-Streams list + Map view + counts read:
//   - Division.higherCategory          (reconciled by name; Executive Office left as-is)
//   - ValueStream (=L3)  + SubValueStream level=4 (=L4)  + ProcessStep (=L5)   [legacy source-of-truth]
//   - Node tree: value_stream → sub_process → step                            [derived; map/list/counts]
//
// Associations (deliverables / roles / tasks / checklist / apps / third-parties)
// are DEFERRED to phase 2. Every vs-scoped link this wipe cascades away is
// snapshotted first to documents/value-streams/_pre-rebuild-snapshot.json so a
// phase-2 pass can re-wire by stream name.
//
// Idempotent: re-running fully replaces the spine. Run from backend/:
//   npx tsx scripts/rebuild-spine-refined-v2.ts
import { prisma } from '../src/db/prisma.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const TREE_PATH = resolve(ROOT, 'documents/value-streams/abc-refined-v2.json');
const SNAP_PATH = resolve(ROOT, 'documents/value-streams/_pre-rebuild-snapshot.json');

const SEG_ORDER = ['Core Business', 'IT', 'Corporate Function'];

type Tree = {
  segments: { name: string; divisions: { name: string; valueStreams: { name: string; subProcesses: { name: string; steps: string[] }[] }[] }[] }[];
};

const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name} (${companyId})`);

  const tree: Tree = JSON.parse(readFileSync(TREE_PATH, 'utf8'));

  // ── 0. Snapshot vs-scoped collateral (phase-2 re-wire source) ───────────────
  console.log('Snapshotting vs-scoped links before wipe…');
  const [metrics, reqLinks, appLinks, initLinks, ioItems, roleLinks, stepDelivs, stepApps, aiAdoption] = await Promise.all([
    prisma.metric.findMany({ where: { companyId }, include: { valueStream: { select: { name: true } } } }),
    prisma.requirementValueStream.findMany({ where: { valueStream: { companyId } }, include: { valueStream: { select: { name: true } } } }),
    prisma.applicationValueStream.findMany({ where: { valueStream: { companyId } }, include: { valueStream: { select: { name: true } }, application: { select: { name: true } } } }),
    prisma.initiativeValueStream.findMany({ where: { valueStream: { companyId } }, include: { valueStream: { select: { name: true } } } }),
    prisma.ioItem.findMany({ where: { valueStream: { companyId } }, include: { valueStream: { select: { name: true } } } }),
    prisma.roleValueStream.findMany({ where: { valueStream: { companyId } }, include: { valueStream: { select: { name: true } }, role: { select: { name: true } } } }),
    prisma.stepDeliverable.findMany({ where: { companyId } }),
    prisma.stepAppUsage.findMany({ where: { companyId } }),
    prisma.nodeAiAdoption.findMany({ where: { node: { companyId, typeKey: 'value_stream' } }, include: { node: { select: { name: true } } } }),
  ]);
  writeFileSync(SNAP_PATH, JSON.stringify({
    takenAt: new Date().toISOString(), companyId,
    metrics, requirementValueStream: reqLinks, applicationValueStream: appLinks, initiativeValueStream: initLinks,
    ioItems, roleValueStream: roleLinks, stepDeliverable: stepDelivs, stepAppUsage: stepApps, nodeAiAdoption: aiAdoption,
  }, null, 0));
  console.log(`  snapshot → ${SNAP_PATH}`);
  console.log(`  metrics=${metrics.length} reqVS=${reqLinks.length} appVS=${appLinks.length} initVS=${initLinks.length} io=${ioItems.length} roleVS=${roleLinks.length} stepDeliv=${stepDelivs.length} stepApp=${stepApps.length} aiAdopt=${aiAdoption.length}`);

  // ── 1. Reconcile divisions (by name; set higherCategory = segment) ──────────
  const divByName = new Map<string, string>();
  for (const seg of tree.segments) {
    for (const div of seg.divisions) {
      const row = await prisma.division.upsert({
        where: { tenantId_companyId_name: { tenantId, companyId, name: div.name } },
        create: { tenantId, companyId, name: div.name, code: div.name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24), higherCategory: seg.name, sourceSheet: 'REFINED-v2' },
        update: { higherCategory: seg.name },
        select: { id: true, name: true },
      });
      divByName.set(div.name, row.id);
    }
  }
  console.log(`Divisions reconciled: ${divByName.size}`);

  // ── 2. Wipe spine (cascades SubValueStream, ProcessStep, IoItem, RoleVS,
  //       ApplicationVS, Metric, InitiativeVS, RequirementVS) + step bridges ───
  await prisma.stepDeliverable.deleteMany({ where: { companyId } });
  await prisma.stepAppUsage.deleteMany({ where: { companyId } });
  const del = await prisma.valueStream.deleteMany({ where: { companyId } });
  console.log(`Wiped ${del.count} ValueStreams (+ cascaded children).`);

  // ── 3. Rebuild ValueStream (=L3). domain = division name (node parent + detail
  //       grouping). Flatten to a sheet-ordered list first. ────────────────────
  type VsFlat = { name: string; division: string; segment: string; order: number; subProcesses: { name: string; steps: string[] }[] };
  const vsFlat: VsFlat[] = [];
  let vsOrd = 0;
  for (const seg of tree.segments) for (const div of seg.divisions) for (const vs of div.valueStreams)
    vsFlat.push({ name: vs.name, division: div.name, segment: seg.name, order: vsOrd++, subProcesses: vs.subProcesses });

  await prisma.valueStream.createMany({
    data: vsFlat.map((v) => ({ tenantId, companyId, name: v.name, domain: v.division, sourceSheet: 'REFINED-v2', sourceRow: v.order })),
  });
  const vsRows = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
  const vsIdByName = new Map(vsRows.map((r) => [r.name, r.id]));
  console.log(`Created ${vsRows.length} ValueStreams.`);

  // ── 4. Rebuild SubValueStream level=4 (=L4). parentId null (no L3-area tier). ─
  type L4Flat = { vsId: string; name: string; order: number };
  const l4Flat: L4Flat[] = [];
  let l4Ord = 0;
  for (const v of vsFlat) {
    const vsId = vsIdByName.get(v.name)!;
    for (const sp of v.subProcesses) l4Flat.push({ vsId, name: sp.name, order: l4Ord++ });
  }
  for (const c of chunk(l4Flat, 1000))
    await prisma.subValueStream.createMany({ data: c.map((s) => ({ tenantId, valueStreamId: s.vsId, level: 4, name: s.name, sourceSheet: 'REFINED-v2', sourceRow: s.order })) });
  const svsRows = await prisma.subValueStream.findMany({ where: { valueStream: { companyId }, level: 4 }, select: { id: true, name: true, valueStreamId: true } });
  const svsIdByKey = new Map(svsRows.map((r) => [`${r.valueStreamId}|${r.name}`, r.id]));
  console.log(`Created ${svsRows.length} SubValueStreams (L4).`);

  // ── 5. Rebuild ProcessStep (=L5). l3 = VS name, l4 = sub-process name. ───────
  type PsFlat = { vsId: string; l3: string; l4: string; name: string; stepNumber: number; order: number };
  const psFlat: PsFlat[] = [];
  let psOrd = 0;
  for (const v of vsFlat) {
    const vsId = vsIdByName.get(v.name)!;
    for (const sp of v.subProcesses) sp.steps.forEach((step, i) => psFlat.push({ vsId, l3: v.name, l4: sp.name, name: step, stepNumber: i + 1, order: psOrd++ }));
  }
  for (const c of chunk(psFlat, 1000))
    await prisma.processStep.createMany({ data: c.map((s) => ({ tenantId, valueStreamId: s.vsId, l3: s.l3, l4: s.l4, name: s.name, stepNumber: s.stepNumber })) });
  console.log(`Created ${psFlat.length} ProcessSteps (L5).`);

  // ── 6. Derive Node tree: value_stream → sub_process → step ──────────────────
  // Keep org/role/io/external nodes; replace only the work-structural types.
  await prisma.node.deleteMany({ where: { companyId, typeKey: { in: ['value_stream', 'sub_process', 'step'] } } });
  const divNodes = await prisma.node.findMany({ where: { companyId, typeKey: 'division' }, select: { id: true, name: true } });
  const divNodeByName = new Map(divNodes.map((d) => [d.name, d.id]));

  // value_stream nodes (parent = division node), code = ValueStream.id
  for (const c of chunk(vsFlat, 500))
    await prisma.node.createMany({ data: c.map((v) => ({ companyId, typeKey: 'value_stream', name: v.name, code: vsIdByName.get(v.name)!, parentId: divNodeByName.get(v.division) ?? null, provenance: 'real', sortOrder: v.order, attributes: { domain: v.division } })) });
  const vsNodes = await prisma.node.findMany({ where: { companyId, typeKey: 'value_stream' }, select: { id: true, code: true } });
  const vsNodeByVsId = new Map(vsNodes.map((n) => [n.code!, n.id]));

  // sub_process nodes (parent = value_stream node), code = SubValueStream.id;
  // sheet order preserved via l4Flat order.
  const subOrderByKey = new Map(l4Flat.map((s) => [`${s.vsId}|${s.name}`, s.order]));
  for (const c of chunk(svsRows, 500))
    await prisma.node.createMany({ data: c.map((s) => ({ companyId, typeKey: 'sub_process', name: s.name, code: s.id, parentId: vsNodeByVsId.get(s.valueStreamId) ?? null, provenance: 'real', sortOrder: subOrderByKey.get(`${s.valueStreamId}|${s.name}`) ?? 0, attributes: { processArea: null } })) });
  const subNodes = await prisma.node.findMany({ where: { companyId, typeKey: 'sub_process' }, select: { id: true, code: true } });
  // map (vsId|l4name) → sub_process node id, via SubValueStream rows
  const svsById = new Map(svsRows.map((s) => [s.id, s]));
  const subNodeByKey = new Map<string, string>();
  for (const n of subNodes) { const svs = svsById.get(n.code!); if (svs) subNodeByKey.set(`${svs.valueStreamId}|${svs.name}`, n.id); }

  // step nodes (parent = sub_process node by vsId|l4), code = ProcessStep.id
  const psRows = await prisma.processStep.findMany({ where: { valueStream: { companyId } }, select: { id: true, name: true, valueStreamId: true, l3: true, l4: true, stepNumber: true } });
  const stepData = psRows.map((p) => ({
    companyId, typeKey: 'step', name: p.name, code: p.id,
    parentId: subNodeByKey.get(`${p.valueStreamId}|${p.l4}`) ?? vsNodeByVsId.get(p.valueStreamId) ?? null,
    provenance: 'real', sortOrder: p.stepNumber ?? 0,
    attributes: { stepNumber: p.stepNumber, l3: p.l3, l4: p.l4 },
  }));
  let stepFallback = 0;
  for (const p of psRows) if (!subNodeByKey.has(`${p.valueStreamId}|${p.l4}`)) stepFallback++;
  for (const c of chunk(stepData, 1000)) await prisma.node.createMany({ data: c });
  console.log(`Derived nodes: value_stream=${vsNodes.length} sub_process=${subNodes.length} step=${psRows.length} (${stepFallback} steps fell back to VS node)`);

  // restore NodeAiAdoption by stream name (only exact name carries forward)
  let aiRestored = 0;
  for (const snap of aiAdoption) {
    const vsId = vsIdByName.get(snap.node.name);
    const nodeId = vsId ? vsNodeByVsId.get(vsId) : undefined;
    if (!nodeId) continue;
    await prisma.nodeAiAdoption.upsert({
      where: { nodeId },
      create: { nodeId, aiAssist: snap.aiAssist, aiAugment: snap.aiAugment, aiWorkflow: snap.aiWorkflow, aiAutonomous: snap.aiAutonomous, useCases: snap.useCases ?? undefined },
      update: { aiAssist: snap.aiAssist, aiAugment: snap.aiAugment, aiWorkflow: snap.aiWorkflow, aiAutonomous: snap.aiAutonomous },
    });
    aiRestored++;
  }
  console.log(`AI-adoption profiles carried: ${aiRestored}/${aiAdoption.length}`);

  // ── 7. Reconcile report ─────────────────────────────────────────────────────
  const nodeCounts = await prisma.node.groupBy({ by: ['typeKey'], where: { companyId, typeKey: { in: ['segment', 'division', 'value_stream', 'sub_process', 'step'] } }, _count: { _all: true } });
  const got = Object.fromEntries(nodeCounts.map((c) => [c.typeKey, c._count._all]));
  const expect: Record<string, number> = { segment: 3, division: 15, value_stream: 132, sub_process: 868, step: 8355 };
  console.log('\n=== Node spine reconcile (division=15 includes Executive Office) ===');
  for (const [k, v] of Object.entries(expect)) {
    const g = got[k] ?? 0;
    console.log(`  ${k.padEnd(13)} expect ${String(v).padStart(5)}  got ${String(g).padStart(5)}  ${g === v ? 'OK' : 'CHECK'}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
