// apply-task-decisions.mjs — NO API. Atomize L5 tasks from subagent decisions:
// split grouped tasks into individual ProcessNodes (cloning ALL associations +
// rebuilding closure, then deleting the original), reword bundled titles, enrich
// all with description + presence test. NEW-DELIVERABLE rule: a task flagged as
// producing a different-but-related deliverable is linked to a (pre-created) new
// Deliverable instead of the original.
//
// Resume-safe: tasks that already have a description were done on a prior run and
// are skipped. Parallelised (per-task transactions) for throughput against Neon.
//
// Decision schema (one per task):
//   { id, decision:'split'|'reword'|'keep',
//     atomic:[ { title, description, test, newDeliverable?:{ name, description, test } } ] }
//
// Run (cwd = backend): node scripts/apply-task-decisions.mjs <decisionsDir> [--dry-run] [--top 5] [--conc 12]
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';

const p = new PrismaClient();
const args = process.argv.slice(2);
const DIR = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry-run');
const TOP_N = Number((args[args.indexOf('--top') + 1]) || 5) || 5;
const CONC = Number((args[args.indexOf('--conc') + 1]) || 12) || 12;
const EXEC = /\b(chief|officer|c-?suite|cxo|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio|president|vice[- ]president|vp|head of|head,|director|board)\b/i;
if (!DIR) { console.error('usage: apply-task-decisions.mjs <decisionsDir>'); process.exit(1); }

async function pool(items, n, fn) {
  let c = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (c < items.length) { const i = c++; await fn(items[i], i); }
  }));
}

// load decisions (dedupe by id — a task under 2 deliverables appears twice)
const decs = [];
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort())
  for (const d of JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))) decs.push(d);
const byId = new Map(decs.map((d) => [d.id, d]));
console.log(`Loaded ${decs.length} decisions (${byId.size} unique ids) from ${DIR}`);

const company = await p.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

// ── pre-create new deliverables (serial, deduped) so parallel tasks just link ──
const newDelivByName = new Map();
if (!DRY) {
  const seen = new Map();
  for (const d of byId.values()) for (const a of (d.atomic || [])) {
    const nd = a.newDeliverable; if (nd && nd.name) seen.set(nd.name.trim(), nd);
  }
  for (const [name, nd] of seen) {
    const existing = await p.deliverable.findFirst({ where: { companyId: company.id, title: name }, select: { id: true } });
    const id = existing ? existing.id
      : (await p.deliverable.create({ data: { companyId: company.id, title: name, description: nd.description || null } })).id;
    if (nd.test) await p.testingTemplate.create({ data: { deliverableId: id, checkType: 'presence', expected: nd.test } });
    newDelivByName.set(name, id);
  }
  if (seen.size) console.log(`pre-created/linked ${seen.size} new deliverables`);
}

const counts = { split: 0, reword: 0, keep: 0, missing: 0 };
let newNodes = 0, failed = 0, done = 0, newDelivLinks = 0;

async function processTask(node) {
  const dec = byId.get(node.id);
  if (!dec || !Array.isArray(dec.atomic) || dec.atomic.length === 0) { counts.missing++; return; }
  const atomic = dec.atomic.filter((a) => a && a.title);
  if (atomic.length === 0) { counts.missing++; return; }
  let decision = ['split', 'reword', 'keep'].includes(dec.decision) ? dec.decision : 'keep';
  if (atomic.length > 1) decision = 'split'; else if (decision === 'split') decision = 'reword';

  const origDelivIds = node.nodeDeliverables.map((n) => n.deliverableId);
  const closureAsDesc = node.ancestorClosure;
  const delivIdFor = (a, fallback) => (a.newDeliverable && a.newDeliverable.name && newDelivByName.get(a.newDeliverable.name.trim())) || fallback;

  if (DRY) { counts[decision]++; if (decision === 'split') newNodes += atomic.length; return; }

  await p.$transaction(async (tx) => {
    if (decision !== 'split') {
      const a = atomic[0];
      await tx.processNode.update({ where: { id: node.id }, data: { displayValue: a.title, description: a.description || null } });
      let delivForTest = origDelivIds[0] ?? null;
      const nd = delivIdFor(a, null);
      if (nd) {
        await tx.nodeDeliverable.deleteMany({ where: { processNodeId: node.id } });
        await tx.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: node.id, deliverableId: nd } });
        delivForTest = nd; newDelivLinks++;
      }
      if (a.test && delivForTest) await tx.testingTemplate.create({ data: { deliverableId: delivForTest, taskNodeId: node.id, checkType: 'presence', expected: a.test } });
    } else {
      for (const a of atomic) {
        const created = await tx.processNode.create({ data: {
          companyId: company.id, processLevelTypeId: node.processLevelTypeId, parentId: node.parentId,
          dbValue: node.dbValue, displayValue: a.title, description: a.description || null, isTask: true,
          automatability: node.automatability, sortOrder: node.sortOrder, code: node.code, attributes: node.attributes ?? undefined } });
        const nid = created.id;
        await tx.processNodeClosure.createMany({ data: closureAsDesc.map((c) => ({ ancestorId: c.ancestorId === node.id ? nid : c.ancestorId, descendantId: nid, depth: c.depth })) });
        if (node.nodeRoles.length) await tx.nodeRole.createMany({ data: node.nodeRoles.map((r) => ({ companyId: company.id, processNodeId: nid, roleId: r.roleId, role_: r.role_, ownerLevel: r.ownerLevel })), skipDuplicates: true });
        if (node.nodeAppUsages.length) await tx.nodeAppUsage.createMany({ data: node.nodeAppUsages.map((x) => ({ companyId: company.id, processNodeId: nid, applicationId: x.applicationId, usageType: x.usageType })), skipDuplicates: true });
        if (node.nodeChecklists.length) await tx.nodeChecklist.createMany({ data: node.nodeChecklists.map((x) => ({ companyId: company.id, processNodeId: nid, checklistItemId: x.checklistItemId })), skipDuplicates: true });
        if (node.nodeStandards.length) await tx.nodeStandard.createMany({ data: node.nodeStandards.map((x) => ({ companyId: company.id, processNodeId: nid, standardId: x.standardId })), skipDuplicates: true });
        if (node.nodeRegulations.length) await tx.nodeRegulation.createMany({ data: node.nodeRegulations.map((x) => ({ companyId: company.id, processNodeId: nid, regId: x.regId, relationship: x.relationship, notes: x.notes })), skipDuplicates: true });
        const nd = delivIdFor(a, null);
        let delivForTest = origDelivIds[0] ?? null;
        if (nd) { await tx.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: nid, deliverableId: nd } }); delivForTest = nd; newDelivLinks++; }
        else for (const did of origDelivIds) await tx.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: nid, deliverableId: did } });
        if (a.test && delivForTest) await tx.testingTemplate.create({ data: { deliverableId: delivForTest, taskNodeId: nid, checkType: 'presence', expected: a.test } });
        newNodes++;
      }
      await tx.processNode.delete({ where: { id: node.id } });
    }
  }, { timeout: 60000 });
  counts[decision]++;
}

const targetIds = [...byId.keys()];
const nodes = await p.processNode.findMany({
  where: { id: { in: targetIds }, companyId: company.id, isTask: true },
  include: { nodeRoles: true, nodeAppUsages: true, nodeChecklists: true, nodeStandards: true, nodeRegulations: true, nodeDeliverables: true },
});
const closRows = await p.processNodeClosure.findMany({ where: { descendantId: { in: targetIds } }, select: { ancestorId: true, descendantId: true, depth: true } });
const closByDesc = new Map();
for (const c of closRows) { const a = closByDesc.get(c.descendantId) ?? []; a.push({ ancestorId: c.ancestorId, depth: c.depth }); closByDesc.set(c.descendantId, a); }
for (const n of nodes) n.ancestorClosure = closByDesc.get(n.id) ?? [{ ancestorId: n.id, depth: 0 }];

// resume-safe: skip tasks already carrying a description (processed on a prior run)
const pending = DRY ? nodes : nodes.filter((n) => !n.description);
console.log(`nodes: ${nodes.length} · ${nodes.length - pending.length} already done · ${pending.length} to process · conc=${CONC}`);

let ticks = 0;
await pool(pending, CONC, async (n) => {
  try { await processTask(n); done++; } catch (e) { failed++; console.error(`task failed "${n.displayValue}": ${e.message}`); }
  if (++ticks % 400 === 0) console.log(`  …${ticks}/${pending.length} split=${counts.split} reword=${counts.reword} keep=${counts.keep} newNodes=${newNodes}`);
});

console.log(`\nDone. processed=${done} split=${counts.split} reword=${counts.reword} keep=${counts.keep} missing=${counts.missing} newTaskNodes=${newNodes} newDelivLinks=${newDelivLinks} failed=${failed}`);
await p.$disconnect();
