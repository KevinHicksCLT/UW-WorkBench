// associate-empty-roles.ts — give roles with no task associations a grounded set
// of links so they're not empty in the UI. Each empty role becomes a Participant
// on a representative sample (≤ CAP, spread across the peer's work) of the tasks
// of its strongest same-DEPARTMENT peer (fallback: same-DIVISION peer). This puts
// the role under the right value stream with the right deliverables without
// over-associating. Roles whose division has no workbook tasks (e.g. Executive
// Office C-suite) legitimately stay empty.
// Run (cwd=backend): npx tsx scripts/associate-empty-roles.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';

const CAP = 80;
const sample = <T>(arr: T[], n: number): T[] => {
  if (arr.length <= n) return arr;
  const step = arr.length / n; const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
};

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const olt = await prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const OL = Object.fromEntries(olt.map((o) => [o.id, o.levelNumber]));
  const ou = await prisma.orgUnit.findMany({ where: { companyId: c }, select: { id: true, parentId: true, orgLevelTypeId: true } });
  const byId = new Map(ou.map((o) => [o.id, o]));
  const anc = (id: string | null, lvl: number): string | null => { let x = id ? byId.get(id) : undefined; while (x) { if (OL[x.orgLevelTypeId] === lvl) return x.id; x = x.parentId ? byId.get(x.parentId) : undefined; } return null; };

  const roles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, orgUnitId: true } });
  const nr = await prisma.nodeRole.findMany({ where: { companyId: c }, select: { roleId: true, processNodeId: true } });
  const taskSet = new Map<string, Set<string>>();
  for (const x of nr) { (taskSet.get(x.roleId) ?? taskSet.set(x.roleId, new Set()).get(x.roleId)!).add(x.processNodeId); }
  const cnt = (id: string) => taskSet.get(id)?.size ?? 0;
  const working = roles.filter((r) => cnt(r.id) > 0);
  const empty = roles.filter((r) => cnt(r.id) === 0);

  // strongest peer per department / division
  const deptPeer = new Map<string, string>(), divPeer = new Map<string, string>();
  for (const r of working) {
    const d = anc(r.orgUnitId, 3), v = anc(r.orgUnitId, 2);
    if (d && (!deptPeer.has(d) || cnt(r.id) > cnt(deptPeer.get(d)!))) deptPeer.set(d, r.id);
    if (v && (!divPeer.has(v) || cnt(r.id) > cnt(divPeer.get(v)!))) divPeer.set(v, r.id);
  }

  const rows: any[] = []; let viaDept = 0, viaDiv = 0, none = 0;
  for (const r of empty) {
    const d = anc(r.orgUnitId, 3), v = anc(r.orgUnitId, 2);
    const peer = (d && deptPeer.get(d)) || (v && divPeer.get(v)) || null;
    if (!peer) { none++; continue; }
    (d && deptPeer.get(d)) ? viaDept++ : viaDiv++;
    const tasks = sample([...taskSet.get(peer)!].sort(), CAP);
    for (const pn of tasks) rows.push({ id: randomUUID(), companyId: c, processNodeId: pn, roleId: r.id, role_: 'Participant' });
  }
  for (let i = 0; i < rows.length; i += 1000) await prisma.nodeRole.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  console.log(`associated ${viaDept + viaDiv} empty roles (dept ${viaDept}, div ${viaDiv}); no-peer left empty: ${none}; +${rows.length} NodeRole`);

  const after = await prisma.nodeRole.groupBy({ by: ['roleId'], where: { companyId: c }, _count: true });
  const linked = new Set(after.map((x) => x.roleId));
  const stillEmpty = roles.filter((r) => !linked.has(r.id)).length;
  console.log('roles still with 0 task links:', stillEmpty, '/', roles.length);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
