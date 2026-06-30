// fill-associations.ts — close association gaps WITHOUT inventing entities:
//   roles  : each L5 with no NodeRole inherits the role set of its L4 siblings
//            (the same sub-process); whole-L4 gaps fall back to the L3's roles.
//   deliv  : each L5 with no NodeDeliverable inherits its L4 siblings' deliverable(s).
//   autom. : recover automatability from the parent new-data-model branch by exact
//            (normalized) task-text match (no scoring, no new data).
// Run (cwd=backend): npx tsx scripts/fill-associations.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';

const norm = (s: any) => String(s ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const id = () => randomUUID();
const chunk = <T>(a: T[], n = 500) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const PARENT = 'postgresql://neondb_owner:npg_Gz8o3larLJDg@ep-wandering-water-aqxgzeo4.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const plt = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const PL = Object.fromEntries(plt.map((x) => [x.id, x.levelNumber]));
  const nodes = await prisma.processNode.findMany({ where: { companyId: c }, select: { id: true, parentId: true, processLevelTypeId: true, displayValue: true } });
  const lvl = (id: string) => PL[byId.get(id)!.processLevelTypeId];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const l5 = nodes.filter((n) => PL[n.processLevelTypeId] === 5);

  // ── ROLES ──────────────────────────────────────────────────────────────────
  const nr = await prisma.nodeRole.findMany({ where: { companyId: c }, select: { processNodeId: true, roleId: true, role_: true } });
  const rolesByNode = new Map<string, { roleId: string; role_: string }[]>();
  for (const r of nr) { (rolesByNode.get(r.processNodeId) ?? rolesByNode.set(r.processNodeId, []).get(r.processNodeId)!).push({ roleId: r.roleId, role_: r.role_ }); }
  // aggregate role set per L4 and per L3 (from their L5 descendants)
  const aggBy = (level: number) => {
    const m = new Map<string, Map<string, string>>(); // ancestorId -> key(roleId|role_) -> role_
    for (const n of l5) {
      const rs = rolesByNode.get(n.id); if (!rs) continue;
      let a: typeof n | undefined = n; while (a && lvl(a.id) !== level) a = a.parentId ? byId.get(a.parentId) : undefined;
      if (!a) continue; const key = a.id; const set = m.get(key) ?? new Map(); for (const r of rs) set.set(`${r.roleId}|${r.role_}`, r.role_); m.set(key, set);
    }
    return m;
  };
  const roleByL4 = aggBy(4), roleByL3 = aggBy(3);
  const newNodeRoles: any[] = [];
  const l4Of = (n: typeof l5[number]) => n.parentId;
  const l3Of = (n: typeof l5[number]) => { const l4 = n.parentId ? byId.get(n.parentId) : undefined; return l4?.parentId ?? null; };
  let rInherit = 0;
  for (const n of l5) {
    if (rolesByNode.has(n.id)) continue;
    const src = (l4Of(n) && roleByL4.get(l4Of(n)!)) || (l3Of(n) && roleByL3.get(l3Of(n)!)) || null;
    if (!src || !src.size) continue;
    // ensure exactly one Owner: keep first Owner, rest Participant
    let ownerSeen = false;
    for (const k of src.keys()) {
      const [roleId, role_] = k.split('|');
      let rel = role_;
      if (rel === 'Owner') { if (ownerSeen) rel = 'Participant'; else ownerSeen = true; }
      newNodeRoles.push({ id: id(), companyId: c, processNodeId: n.id, roleId, role_: rel });
    }
    // if no Owner in the inherited set, promote the first to Owner
    if (!ownerSeen) { const first = newNodeRoles.findLast((x) => x.processNodeId === n.id); if (first) first.role_ = 'Owner'; }
    rInherit++;
  }
  for (const b of chunk(newNodeRoles)) await prisma.nodeRole.createMany({ data: b, skipDuplicates: true });
  console.log(`Roles: inherited onto ${rInherit} L5 (+${newNodeRoles.length} NodeRole rows)`);

  // ── DELIVERABLES ─────────────────────────────────────────────────────────────
  const nd = await prisma.nodeDeliverable.findMany({ where: { companyId: c }, select: { processNodeId: true, deliverableId: true } });
  const delivByNode = new Map<string, string[]>();
  for (const d of nd) (delivByNode.get(d.processNodeId) ?? delivByNode.set(d.processNodeId, []).get(d.processNodeId)!).push(d.deliverableId);
  const delivAgg = (level: number) => {
    const m = new Map<string, Set<string>>();
    for (const n of l5) { const ds = delivByNode.get(n.id); if (!ds) continue; let a: typeof n | undefined = n; while (a && lvl(a.id) !== level) a = a.parentId ? byId.get(a.parentId) : undefined; if (!a) continue; const set = m.get(a.id) ?? new Set(); ds.forEach((x) => set.add(x)); m.set(a.id, set); }
    return m;
  };
  const delivByL4 = delivAgg(4), delivByL3 = delivAgg(3);
  const newND: any[] = []; let dInherit = 0;
  for (const n of l5) {
    if (delivByNode.has(n.id)) continue;
    const src = (l4Of(n) && delivByL4.get(l4Of(n)!)) || (l3Of(n) && delivByL3.get(l3Of(n)!)) || null;
    if (!src || !src.size) continue;
    for (const did of src) newND.push({ id: id(), companyId: c, processNodeId: n.id, deliverableId: did });
    dInherit++;
  }
  for (const b of chunk(newND)) await prisma.nodeDeliverable.createMany({ data: b, skipDuplicates: true });
  console.log(`Deliverables: inherited onto ${dInherit} L5 (+${newND.length} NodeDeliverable rows)`);

  // ── AUTOMATABILITY (recover from parent branch by text) ───────────────────────
  const par = new PrismaClient({ datasources: { db: { url: PARENT } } });
  const pco = await par.company.findFirst({ select: { id: true } });
  const pplt = await par.processLevelType.findMany({ where: { companyId: pco!.id }, select: { id: true, levelNumber: true } });
  const pL5 = pplt.find((x) => x.levelNumber === 5)!.id;
  const pscored = await par.processNode.findMany({ where: { companyId: pco!.id, processLevelTypeId: pL5, automatability: { not: null } }, select: { displayValue: true, automatability: true } });
  await par.$disconnect();
  const pmap = new Map(pscored.map((n) => [norm(n.displayValue), n.automatability!]));
  const byAuto = new Map<string, string[]>(); // automatability -> [nodeId]
  for (const n of l5) { const a = pmap.get(norm(n.displayValue)); if (a) (byAuto.get(a) ?? byAuto.set(a, []).get(a)!).push(n.id); }
  let recovered = 0;
  for (const [auto, ids] of byAuto) for (const b of chunk(ids, 1000)) { await prisma.processNode.updateMany({ where: { id: { in: b } }, data: { automatability: auto } }); recovered += b.length; }
  console.log(`Automatability: recovered ${recovered} from parent branch`);

  // ── report remaining gaps ─────────────────────────────────────────────────────
  const noRole = (await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint n FROM "ProcessNode" pn WHERE pn."companyId"=$1 AND pn."processLevelTypeId"=$2 AND NOT EXISTS (SELECT 1 FROM "NodeRole" r WHERE r."processNodeId"=pn.id)`, c, plt.find((x) => x.levelNumber === 5)!.id))[0].n;
  const noDeliv = (await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint n FROM "ProcessNode" pn WHERE pn."companyId"=$1 AND pn."processLevelTypeId"=$2 AND NOT EXISTS (SELECT 1 FROM "NodeDeliverable" d WHERE d."processNodeId"=pn.id)`, c, plt.find((x) => x.levelNumber === 5)!.id))[0].n;
  const noAuto = await prisma.processNode.count({ where: { companyId: c, processLevelTypeId: plt.find((x) => x.levelNumber === 5)!.id, automatability: null } });
  console.log(`REMAINING — no role: ${noRole}, no deliverable: ${noDeliv}, no automatability: ${noAuto}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
