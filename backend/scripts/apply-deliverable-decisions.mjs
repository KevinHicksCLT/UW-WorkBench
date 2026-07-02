// apply-deliverable-decisions.mjs — NO API. Read subagent decision files and write
// the atomic deliverable model to the DB: split/reword/keep + description + owner
// + top-N exec-filtered contributors + presence TestingTemplate; delete originals
// that were split. Owner/contributor derived from each task's NodeRole rows.
//
// Run (cwd = backend):
//   node scripts/apply-deliverable-decisions.mjs <decisionsDir> [--dry-run] [--top 5]
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';

const p = new PrismaClient();
const args = process.argv.slice(2);
const DIR = args.find((a) => !a.startsWith('--')) || 'C:/Users/xando/AppData/Local/Temp/claude/C--Users-xando-Code-transform-platform/29c5241a-e8ab-4239-94cc-c34c64dea829/scratchpad/deliv-decisions';
const DRY = args.includes('--dry-run');
const TOP_N = Number((args[args.indexOf('--top') + 1]) || 5) || 5;
const SUFFIX = ' output/record (validated & control sign-off)';

const EXEC = /\b(chief|officer|c-?suite|cxo|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio|president|vice[- ]president|vp|head of|head,|director|board)\b/i;
const deconj = (s) => s.replace(/\s*&\s*/g, ' ').replace(/\s+and\s+/gi, ' ').replace(/\s{2,}/g, ' ').trim();
const modal = (xs) => { const c = new Map(); for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1); let b = null, n = -1; for (const [k, v] of c) if (v > n) { b = k; n = v; } return b; };

// load all decisions
const decs = [];
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const arr = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  for (const d of arr) decs.push(d);
}
const byId = new Map(decs.map((d) => [d.id, d]));
console.log(`Loaded ${decs.length} decisions from ${DIR}`);

const company = await p.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

// pull each deliverable with its tasks' roles
const dels = await p.deliverable.findMany({
  where: { companyId: company.id },
  include: { nodeDeliverables: { include: { processNode: { include: { nodeRoles: { include: { role: { select: { displayValue: true } } } } } } } } },
});

const counts = { split: 0, reword: 0, keep: 0, missing: 0 };
let newRows = 0, failed = 0, suffixLeft = 0, ampLeft = 0, done = 0;

for (const d of dels) {
  const dec = byId.get(d.id);
  if (!dec || !Array.isArray(dec.splits) || dec.splits.length === 0) { counts.missing++; continue; }

  // task info indexed by position (matches export order == nodeDeliverables order)
  const tasks = d.nodeDeliverables.map((nd, i) => {
    const n = nd.processNode;
    const owner = n.nodeRoles.find((r) => r.role_ === 'Owner');
    const parts = n.nodeRoles.filter((r) => r.role_ === 'Participant');
    return { i, id: n.id, automatability: n.automatability, ownerRoleId: owner?.roleId ?? null, participants: parts.map((x) => ({ roleId: x.roleId, label: x.role.displayValue })) };
  });
  const N = tasks.length;

  // reconcile splits: valid indexes, unique coverage, leftovers to biggest
  let splits = dec.splits.filter((s) => s && s.name).map((s) => ({ ...s, taskIndexes: [...new Set((s.taskIndexes || []).filter((i) => Number.isInteger(i) && i >= 0 && i < N))] }));
  if (splits.length === 0) splits = [{ name: d.title.replace(SUFFIX, '').trim(), description: '', test: '', taskIndexes: [] }];
  const seen = new Set();
  for (const s of splits) s.taskIndexes = s.taskIndexes.filter((i) => (seen.has(i) ? false : (seen.add(i), true)));
  const missing = tasks.map((_, i) => i).filter((i) => !seen.has(i));
  if (missing.length) { const big = splits.reduce((a, b) => (b.taskIndexes.length >= a.taskIndexes.length ? b : a), splits[0]); big.taskIndexes.push(...missing); }
  splits = splits.filter((s) => s.taskIndexes.length > 0);

  // guard: no separator in base => cannot split
  const base = d.title.replace(SUFFIX, '').trim();
  const hasSep = /\s&\s|\sand\s|,|\//i.test(base);
  let decision = dec.decision === 'split' || dec.decision === 'reword' || dec.decision === 'keep' ? dec.decision : 'keep';
  if (!hasSep && splits.length > 1) { splits = [{ name: base, description: splits[0].description, test: splits[0].test, taskIndexes: tasks.map((_, i) => i) }]; decision = 'keep'; }
  if (splits.length > 1) decision = 'split'; else if (decision === 'split') decision = 'reword';
  counts[decision]++;

  const built = splits.map((s) => {
    const st = s.taskIndexes.map((i) => tasks[i]);
    const ownerRoleId = modal(st.map((t) => t.ownerRoleId));
    const freq = new Map();
    for (const t of st) for (const q of t.participants) { if (q.roleId === ownerRoleId) continue; if (EXEC.test(q.label)) continue; freq.set(q.roleId, (freq.get(q.roleId) ?? 0) + 1); }
    const contribIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map((e) => e[0]);
    const auto = modal(st.map((t) => t.automatability));
    const raw = String(s.name).replace(SUFFIX, '').trim();
    const name = decision === 'keep' ? raw : deconj(raw);
    return { st, ownerRoleId, contribIds, auto, name, description: s.description || null, test: s.test || null };
  });

  for (const b of built) { if (/output\/record/i.test(b.name)) suffixLeft++; if (decision !== 'keep' && /\s&\s|\sand\s/i.test(b.name)) ampLeft++; }
  if (DRY) { done++; continue; }

  try {
    await p.$transaction(async (tx) => {
      const multi = built.length > 1;
      for (const b of built) {
        let delId;
        if (!multi) { delId = d.id; await tx.deliverable.update({ where: { id: d.id }, data: { title: b.name, automatability: b.auto ?? d.automatability } }); }
        else { const cr = await tx.deliverable.create({ data: { companyId: company.id, title: b.name, automatability: b.auto } }); delId = cr.id; for (const t of b.st) await tx.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: t.id, deliverableId: delId } }); }
        await tx.$executeRawUnsafe('UPDATE "Deliverable" SET "description" = $1 WHERE "id" = $2', b.description, delId);
        if (b.ownerRoleId) await tx.roleDeliverable.upsert({ where: { roleId_deliverableId_role_: { roleId: b.ownerRoleId, deliverableId: delId, role_: 'Owner' } }, create: { companyId: company.id, roleId: b.ownerRoleId, deliverableId: delId, role_: 'Owner' }, update: {} });
        for (const rid of b.contribIds) await tx.roleDeliverable.upsert({ where: { roleId_deliverableId_role_: { roleId: rid, deliverableId: delId, role_: 'Contributor' } }, create: { companyId: company.id, roleId: rid, deliverableId: delId, role_: 'Contributor' }, update: {} });
        if (b.test) await tx.testingTemplate.create({ data: { deliverableId: delId, taskNodeId: b.st[0]?.id ?? null, checkType: 'presence', expected: b.test } });
        if (multi) newRows++;
      }
      if (multi) await tx.deliverable.delete({ where: { id: d.id } });
    }, { timeout: 30000 });
    done++;
  } catch (e) { failed++; console.error(`apply failed "${d.title}": ${e.message}`); }
}

console.log(`\nDone. processed=${done} split=${counts.split} reword=${counts.reword} keep=${counts.keep} missing=${counts.missing} newSplitRows=${newRows} failed=${failed}`);
console.log(`integrity: names still with suffix=${suffixLeft} · non-keep names still with &/and=${ampLeft}`);
await p.$disconnect();
