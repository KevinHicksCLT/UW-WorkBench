// assign-unassigned-roles.ts — home the 93 org-less roles (created during the
// reseed) into the correct Segment→Division→Department, grounded in where each
// role actually owns work, and dedupe any that duplicate an existing role.
//
//  1. Dedupe: an unassigned role whose normalized name equals an already-assigned
//     role → merge (repoint NodeRole / RoleDeliverable / RoleStandard / RoleOrg /
//     owned standards to the keeper, delete the dup).
//  2. Division: the L2 process division where the role most owns work (Owner=3,
//     Participant=1), mapped to the OrgUnit division of the same name
//     (alias: process "Corporate Operations" → org "Corporate Functions Operations").
//  3. Department: best token-overlap match among that division's departments;
//     fallback to an Operations/Analysis/Analytics dept, else first non-Leadership.
//     role.orgUnitId set to that department; RoleOrgAssignment mirrored if that
//     table is in use. Downstream value-stream/deliverable links already exist via
//     NodeRole (role↔task) and are derived read-time, so no extra wiring needed.
// Run (cwd=backend): npx tsx scripts/assign-unassigned-roles.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const DIV_ALIAS: Record<string, string> = { 'Corporate Operations': 'Corporate Functions Operations' };
const STOP = new Set(['and', 'of', 'the', 'amp', 'analyst', 'specialist', 'engineer', 'manager', 'analysis', 'operations', 'leadership', 'officer', 'lead']);
const toks = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const olt = await prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const OL = Object.fromEntries(olt.map((o) => [o.id, o.levelNumber]));
  const ou = await prisma.orgUnit.findMany({ where: { companyId: c }, select: { id: true, displayValue: true, parentId: true, orgLevelTypeId: true } });
  const ouById = new Map(ou.map((o) => [o.id, o]));
  const divisions = ou.filter((o) => OL[o.orgLevelTypeId] === 2);
  const divByName = new Map(divisions.map((d) => [d.displayValue, d]));
  const deptsOf = (divId: string) => ou.filter((o) => o.parentId === divId && OL[o.orgLevelTypeId] === 3);

  const plt = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const L2p = plt.find((x) => x.levelNumber === 2)!.id;
  const pnodes = await prisma.processNode.findMany({ where: { companyId: c }, select: { id: true, parentId: true, processLevelTypeId: true, displayValue: true } });
  const pById = new Map(pnodes.map((n) => [n.id, n]));
  const procDiv = (id: string): string | null => { let x = pById.get(id); while (x) { if (x.processLevelTypeId === L2p) return x.displayValue; x = x.parentId ? pById.get(x.parentId) : undefined; } return null; };

  const roles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, displayValue: true, orgUnitId: true } });
  const assigned = roles.filter((r) => r.orgUnitId);
  const unassigned = roles.filter((r) => !r.orgUnitId);
  const assignedByNorm = new Map(assigned.map((r) => [norm(r.displayValue), r]));

  // ── 1. dedupe-merge exact normalized duplicates ────────────────────────────
  let merged = 0;
  const stillUnassigned: typeof unassigned = [];
  for (const r of unassigned) {
    const keeper = assignedByNorm.get(norm(r.displayValue));
    if (keeper && keeper.id !== r.id) {
      // repoint NodeRole rows to the keeper, dropping any that would clash on the
      // (processNode, role, role_) unique key.
      for (const nr of await prisma.nodeRole.findMany({ where: { roleId: r.id }, select: { id: true, processNodeId: true, role_: true } })) {
        const clash = await prisma.nodeRole.findFirst({ where: { roleId: keeper.id, processNodeId: nr.processNodeId, role_: nr.role_ } });
        if (clash) await prisma.nodeRole.delete({ where: { id: nr.id } });
        else await prisma.nodeRole.update({ where: { id: nr.id }, data: { roleId: keeper.id } });
      }
      await prisma.roleDeliverable.deleteMany({ where: { roleId: r.id } });
      await prisma.roleStandard.deleteMany({ where: { roleId: r.id } });
      await prisma.role.delete({ where: { id: r.id } }).catch(() => {});
      merged++;
    } else stillUnassigned.push(r);
  }
  console.log('dedupe merges:', merged);

  // owner-weighted division tally
  const ids = stillUnassigned.map((r) => r.id);
  const nr = await prisma.nodeRole.findMany({ where: { companyId: c, roleId: { in: ids } }, select: { roleId: true, role_: true, processNodeId: true } });
  const divCount = new Map<string, Map<string, number>>();
  for (const x of nr) { const d = procDiv(x.processNodeId); if (!d) continue; const m = divCount.get(x.roleId) ?? new Map(); m.set(d, (m.get(d) ?? 0) + (x.role_ === 'Owner' ? 3 : 1)); divCount.set(x.roleId, m); }

  // dept picker
  const pickDept = (divId: string, roleName: string) => {
    const depts = deptsOf(divId); if (!depts.length) return null;
    const rt = toks(roleName);
    let best = depts[0], bestScore = -1;
    for (const d of depts) {
      const dt = toks(d.displayValue);
      const score = rt.filter((t) => dt.includes(t)).length;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    if (bestScore > 0) return best;
    // fallback: prefer Operations/Analytics/Analysis, else first non-Leadership
    const pref = depts.find((d) => /operations|analytics|analysis|delivery|governance/i.test(d.displayValue))
      ?? depts.find((d) => !/leadership|office|executive/i.test(d.displayValue)) ?? depts[0];
    return pref;
  };

  // RoleOrgAssignment in use?
  const roaCount = await prisma.roleOrgAssignment.count({ where: { role: { companyId: c } } }).catch(() => 0);

  // ── 2-3. assign ─────────────────────────────────────────────────────────────
  let assignedN = 0; const unresolved: string[] = [];
  for (const r of stillUnassigned) {
    const m = divCount.get(r.id); if (!m) { unresolved.push(r.displayValue + ' (no tasks)'); continue; }
    const procName = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const orgDivName = DIV_ALIAS[procName] ?? procName;
    const div = divByName.get(orgDivName); if (!div) { unresolved.push(`${r.displayValue} (no org div "${orgDivName}")`); continue; }
    const dept = pickDept(div.id, r.displayValue) ?? div;
    await prisma.role.update({ where: { id: r.id }, data: { orgUnitId: dept.id } });
    if (roaCount > 0) await prisma.roleOrgAssignment.create({ data: { id: randomUUID(), roleId: r.id, orgUnitId: dept.id } }).catch(() => {});
    assignedN++;
  }
  console.log('assigned to department:', assignedN, '| unresolved:', unresolved.length);
  if (unresolved.length) console.log(unresolved.join('\n'));

  const left = await prisma.role.count({ where: { companyId: c, orgUnitId: null } });
  console.log('roles still without orgUnit:', left, '| total roles:', await prisma.role.count({ where: { companyId: c } }));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
