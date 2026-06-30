// reseed-from-deduped.ts — FULL REBUILD of the process tree + work entities from
// ABC-Insurance-Operating-Model-DEDUPED.xlsx (sheet "L5 Process List").
//
// Scope (per user decision "Full rebuild"): wipes ProcessNode (cascades all Node*
// junctions + closure + node links to Standards/Regs/Initiatives/Metrics), Deliverable
// (cascades Role/Standard/Regulation deliverable links + TestingTemplate), and Checklist
// (cascades ChecklistItem). Role + Application are UPSERTED by name (not wiped — they are
// referenced by org/standards/metrics outside the workbook). Then rebuilds:
//   ProcessNode L1..L5 tree, NodeRole (Owner/Participant), Deliverable+NodeDeliverable,
//   Application(upsert)+NodeAppUsage, Checklist+ChecklistItem+NodeChecklist.
// How / Test by Pattern / Checklist Pattern / Checklist Differences / L4-L5 mapping /
// disposition are stored on ProcessNode.attributes (lossless; TestingTemplate's structured
// shape doesn't fit the prose).
// Run (cwd=backend): npx tsx scripts/reseed-from-deduped.ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { prisma } from '../src/db/prisma.js';
import { processClosure } from '../src/lib/closure.js';

const WB = resolve(dirname(fileURLToPath(import.meta.url)), '../../documents/value-streams/ABC-Insurance-Operating-Model-DEDUPED.xlsx');
const NFKC = (s: any) => (s == null ? '' : String(s).normalize('NFKC').trim());
const id = () => randomUUID();
const chunk = <T>(a: T[], n = 1000) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

function parseRoleList(cell: any): string[] {
  const out: string[] = [];
  for (const line of NFKC(cell).split('\n')) {
    const m = line.match(/^\s*\d+\)\s*(.+?)\s*[—–-]\s*(Approver|Creator|Reviewer)\s*$/);
    if (m) out.push(m[1].trim());
    else { const m2 = line.match(/^\s*\d+\)\s*(.+)$/); if (m2) out.push(m2[1].replace(/\s*[—–-]\s*(Approver|Creator|Reviewer)\s*$/, '').trim()); }
  }
  return out.filter(Boolean);
}
function parseDeliverables(cell: any): string[] {
  const out: string[] = [];
  for (const line of NFKC(cell).split('\n')) { const m = line.match(/^\((\d+)\)\s*(.+)$/); if (m) out.push(m[2].trim()); }
  return out.filter(Boolean);
}
function parseApps(cell: any): string[] {
  const out: string[] = [];
  for (let line of NFKC(cell).split('\n')) {
    line = line.replace(/^[••▪●\-\*�]\s*/, '').trim();
    if (!line) continue;
    if (/^Application\/SOR type examples:?$/i.test(line)) continue;
    if (/^Confirm exact application/i.test(line)) continue;
    out.push(line);
  }
  return out;
}
function parseChecklist(cell: any): string[] {
  const out: string[] = [];
  for (const line of NFKC(cell).split('\n')) {
    if (/^Checklist:?$/i.test(line.trim())) continue;
    const m = line.match(/^\s*\d+[\.\)]?\s*(.+)$/);
    if (m) out.push(m[1].trim());
  }
  return out.filter(Boolean);
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const c = company.id, t = company.tenantId;
  console.log('Company:', company.name, c);

  const lts = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const LT = new Map(lts.map((l) => [l.levelNumber, l.id]));
  for (const n of [1, 2, 3, 4, 5]) if (!LT.get(n)) throw new Error(`Missing ProcessLevelType L${n}`);

  // ── read workbook ───────────────────────────────────────────────────────
  const wb = XLSX.read(readFileSync(WB), { cellDates: false });
  const ws = wb.Sheets['L5 Process List'];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });
  console.log('Workbook rows:', rows.length);
  const col = (r: Record<string, any>, name: string) => r[name];

  // ── WIPE ─────────────────────────────────────────────────────────────────
  console.log('Wiping ProcessNode / Deliverable / Checklist (cascades)…');
  await prisma.processNode.deleteMany({ where: { companyId: c } });
  await prisma.deliverable.deleteMany({ where: { companyId: c } });
  await prisma.checklist.deleteMany({ where: { companyId: c } });

  // ── role + application upsert maps ────────────────────────────────────────
  const roleMap = new Map((await prisma.role.findMany({ where: { companyId: c }, select: { id: true, dbValue: true } })).map((r) => [r.dbValue, r.id]));
  const appMap = new Map((await prisma.application.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((a) => [a.name, a.id]));

  // ── pass 1: collect tree + entities ───────────────────────────────────────
  type N = { id: string; companyId: string; processLevelTypeId: string; parentId: string | null; dbValue: string; displayValue: string; isTask: boolean; sortOrder: number; code: string | null; attributes: any };
  const nodes: N[] = [];
  const byKey = new Map<string, string>();        // path key -> node id
  const counters = new Map<string, number>();     // parent key -> sortOrder counter
  const ensure = (key: string, name: string, level: number, parentKey: string | null, ordinal?: string | null): string => {
    if (byKey.has(key)) return byKey.get(key)!;
    const nid = id();
    const so = (counters.get(parentKey ?? '') ?? 0); counters.set(parentKey ?? '', so + 1);
    const attrs: any = {};
    if (level === 3 && ordinal) attrs.l3num = ordinal;
    if (level === 4 && ordinal) attrs.l4num = ordinal;
    nodes.push({ id: nid, companyId: c, processLevelTypeId: LT.get(level)!, parentId: parentKey ? byKey.get(parentKey)! : null,
      dbValue: name, displayValue: name, isTask: level === 5, sortOrder: so, code: ordinal ?? name.toLowerCase(), attributes: attrs });
    byKey.set(key, nid);
    return nid;
  };

  const newRoles = new Set<string>(); const newApps = new Set<string>();
  const delivTitles = new Set<string>();
  type Link = { node: string; key: string };
  const nodeRoleRows: { id: string; companyId: string; processNodeId: string; roleName: string; role_: string }[] = [];
  const nodeDelivRows: { node: string; title: string }[] = [];
  const nodeAppRows: { node: string; app: string }[] = [];
  const checklistByNode: { node: string; items: string[] }[] = [];

  for (const r of rows) {
    const l1 = NFKC(col(r, 'L1 Segment')) || '(Unspecified Segment)';
    const l2 = NFKC(col(r, 'L2 Division')) || '(Unspecified Division)';
    const l3 = NFKC(col(r, 'L3 Process')) || '(Unspecified Process)';
    const l4 = NFKC(col(r, 'L4 Sub-Process')) || '(Unspecified Sub-Process)';
    const l5 = NFKC(col(r, 'L5 Step'));
    if (!l5) continue;
    const k1 = l1, k2 = `${l1}|${l2}`, k3 = `${l1}|${l2}|${l3}`, k4 = `${l1}|${l2}|${l3}|${l4}`;
    const l3num = NFKC(col(r, 'L3#')) || null, l4num = NFKC(col(r, 'L4#')) || null, l5num = NFKC(col(r, 'L5#')) || null;
    ensure(k1, l1, 1, null); ensure(k2, l2, 2, k1); ensure(k3, l3, 3, k2, l3num); ensure(k4, l4, 4, k3, l4num);
    const k5 = id(); // unique per row
    const nid = id();
    const so = (counters.get(k4) ?? 0); counters.set(k4, so + 1);
    nodes.push({ id: nid, companyId: c, processLevelTypeId: LT.get(5)!, parentId: byKey.get(k4)!, dbValue: l5, displayValue: l5,
      isTask: true, sortOrder: so, code: l5num,
      attributes: {
        l5num,
        testByPattern: NFKC(col(r, 'Test by Pattern')) || null,
        how: NFKC(col(r, 'How')) || null,
        checklistPattern: NFKC(col(r, 'Checklist Pattern')) || null,
        checklistDifferences: NFKC(col(r, 'Checklist Differences by Pattern')) || null,
        l4l5Mapping: NFKC(col(r, 'L4/L5 Pair Mapping Review')) || null,
        disposition: NFKC(col(r, 'Column K Review / Disposition')) || null,
      } });

    for (const rn of parseRoleList(col(r, 'Owner Role(s)'))) { newRoles.add(rn); nodeRoleRows.push({ id: id(), companyId: c, processNodeId: nid, roleName: rn, role_: 'Owner' }); }
    for (const rn of parseRoleList(col(r, 'Contributing Role(s)'))) { newRoles.add(rn); nodeRoleRows.push({ id: id(), companyId: c, processNodeId: nid, roleName: rn, role_: 'Participant' }); }
    for (const dt of parseDeliverables(col(r, 'Deliverables'))) { delivTitles.add(dt); nodeDelivRows.push({ node: nid, title: dt }); }
    for (const ap of parseApps(col(r, 'Application / SOR Type Examples'))) { newApps.add(ap); nodeAppRows.push({ node: nid, app: ap }); }
    const items = parseChecklist(col(r, 'Checklist'));
    if (items.length) checklistByNode.push({ node: nid, items });
  }
  console.log(`Parsed: nodes ${nodes.length} (L5 ${nodes.filter((n) => n.isTask).length}), roleLinks ${nodeRoleRows.length}, delivLinks ${nodeDelivRows.length}, appLinks ${nodeAppRows.length}, checklists ${checklistByNode.length}`);

  // ── insert nodes ───────────────────────────────────────────────────────────
  for (const b of chunk(nodes)) await prisma.processNode.createMany({ data: b });
  console.log('Nodes inserted. Rebuilding closure…');
  const cl = await processClosure.rebuildClosure({ companyId: c });
  console.log('Closure rows:', cl);

  // ── roles (create missing) ─────────────────────────────────────────────────
  const missingRoles = [...newRoles].filter((n) => !roleMap.has(n));
  for (const b of chunk(missingRoles.map((n) => ({ id: id(), companyId: c, dbValue: n, displayValue: n })))) await prisma.role.createMany({ data: b, skipDuplicates: true });
  for (const r of await prisma.role.findMany({ where: { companyId: c }, select: { id: true, dbValue: true } })) roleMap.set(r.dbValue, r.id);

  // ── applications (create missing) ───────────────────────────────────────────
  const missingApps = [...newApps].filter((n) => !appMap.has(n));
  for (const b of chunk(missingApps.map((n) => ({ id: id(), companyId: c, name: n })))) await prisma.application.createMany({ data: b, skipDuplicates: true });
  for (const a of await prisma.application.findMany({ where: { companyId: c }, select: { id: true, name: true } })) appMap.set(a.name, a.id);

  // ── deliverables (table wiped → create all) ────────────────────────────────
  const delivMap = new Map<string, string>();
  const delivRows = [...delivTitles].map((title) => { const i = id(); delivMap.set(title, i); return { id: i, companyId: c, title }; });
  for (const b of chunk(delivRows)) await prisma.deliverable.createMany({ data: b });

  // ── NodeRole (dedupe processNodeId+roleId+role_) ───────────────────────────
  const nrSeen = new Set<string>(); const nrData: any[] = [];
  for (const x of nodeRoleRows) { const rid = roleMap.get(x.roleName); if (!rid) continue; const k = `${x.processNodeId}|${rid}|${x.role_}`; if (nrSeen.has(k)) continue; nrSeen.add(k); nrData.push({ id: x.id, companyId: c, processNodeId: x.processNodeId, roleId: rid, role_: x.role_ }); }
  for (const b of chunk(nrData)) await prisma.nodeRole.createMany({ data: b, skipDuplicates: true });

  // ── NodeDeliverable (dedupe) ────────────────────────────────────────────────
  const ndSeen = new Set<string>(); const ndData: any[] = [];
  for (const x of nodeDelivRows) { const did = delivMap.get(x.title); if (!did) continue; const k = `${x.node}|${did}`; if (ndSeen.has(k)) continue; ndSeen.add(k); ndData.push({ id: id(), companyId: c, processNodeId: x.node, deliverableId: did }); }
  for (const b of chunk(ndData)) await prisma.nodeDeliverable.createMany({ data: b, skipDuplicates: true });

  // ── NodeAppUsage (dedupe processNodeId+applicationId+usageType) ─────────────
  const naSeen = new Set<string>(); const naData: any[] = [];
  for (const x of nodeAppRows) { const aid = appMap.get(x.app); if (!aid) continue; const k = `${x.node}|${aid}|performed`; if (naSeen.has(k)) continue; naSeen.add(k); naData.push({ id: id(), companyId: c, processNodeId: x.node, applicationId: aid, usageType: 'performed' }); }
  for (const b of chunk(naData)) await prisma.nodeAppUsage.createMany({ data: b, skipDuplicates: true });

  // ── Checklist + ChecklistItem + NodeChecklist (one checklist per L5) ────────
  const clRows: any[] = []; const ciRows: any[] = []; const ncRows: any[] = [];
  for (const x of checklistByNode) {
    const clId = id();
    clRows.push({ id: clId, companyId: c, name: 'Checklist' });
    for (const text of x.items) { const ciId = id(); ciRows.push({ id: ciId, checklistId: clId, text }); ncRows.push({ id: id(), companyId: c, processNodeId: x.node, checklistItemId: ciId }); }
  }
  for (const b of chunk(clRows)) await prisma.checklist.createMany({ data: b });
  for (const b of chunk(ciRows)) await prisma.checklistItem.createMany({ data: b });
  for (const b of chunk(ncRows)) await prisma.nodeChecklist.createMany({ data: b, skipDuplicates: true });

  // ── verify ──────────────────────────────────────────────────────────────────
  const counts = {
    nodes: await prisma.processNode.count({ where: { companyId: c } }),
    l5: await prisma.processNode.count({ where: { companyId: c, processLevelTypeId: LT.get(5)! } }),
    roles: await prisma.role.count({ where: { companyId: c } }),
    deliverables: await prisma.deliverable.count({ where: { companyId: c } }),
    applications: await prisma.application.count({ where: { companyId: c } }),
    nodeRole: await prisma.nodeRole.count({ where: { companyId: c } }),
    nodeDeliv: await prisma.nodeDeliverable.count({ where: { companyId: c } }),
    nodeApp: await prisma.nodeAppUsage.count({ where: { companyId: c } }),
    checklistItems: await prisma.checklistItem.count(),
    nodeChecklist: await prisma.nodeChecklist.count({ where: { companyId: c } }),
  };
  console.log('FINAL COUNTS', counts);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
