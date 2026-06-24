// homeRoles — data-completeness backfill: home each Role to its modal L2-Division.
//
// A Role has no stored org home in the workbook; it is only linked to work via
// NodeRole (task ↔ role). We infer the home by: for every L5 task the role
// owns/participates in, walk to its L2 (Division) ProcessNode ancestor; the most
// frequent Division NAME is the role's home division. That Division name is then
// matched to the OrgUnit at org-level 2 (by dbValue), and Role.orgUnitId is set +
// a primary RoleOrgAssignment created. Roles with no task links stay un-homed.
//
// Wired into the seed orchestrator AFTER seedMaster (needs NodeRole + closures).
import type { PrismaClient } from '@prisma/client';

export interface HomeRolesResult {
  total: number;
  homed: number;
  unhomed: number; // roles with no resolvable division
  noTasks: number; // subset of unhomed: roles with zero NodeRole links
  unmatchedDivision: number; // subset of unhomed: modal division name had no OrgUnit
}

export async function homeRoles(
  prisma: PrismaClient,
  { companyId }: { companyId: string },
): Promise<HomeRolesResult> {
  // ── Level-type ids for process L2 (Division) and org L2 (Division) ──
  const [pL2, oL2] = await Promise.all([
    prisma.processLevelType.findFirst({ where: { companyId, levelNumber: 2 }, select: { id: true } }),
    prisma.orgLevelType.findFirst({ where: { companyId, levelNumber: 2 }, select: { id: true } }),
  ]);
  if (!pL2 || !oL2) throw new Error('homeRoles: missing L2 process/org level type');

  // ── Every L2 Division ProcessNode (id → name) + OrgUnit L2 (name → id) ──
  const [divisionNodes, divisionOrgUnits, roles] = await Promise.all([
    prisma.processNode.findMany({ where: { companyId, processLevelTypeId: pL2.id }, select: { id: true, dbValue: true } }),
    prisma.orgUnit.findMany({ where: { companyId, orgLevelTypeId: oL2.id }, select: { id: true, dbValue: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true } }),
  ]);
  const divisionNodeIds = new Set(divisionNodes.map((d) => d.id));
  const divisionNameByNodeId = new Map(divisionNodes.map((d) => [d.id, d.dbValue] as const));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const orgUnitByDivisionName = new Map(divisionOrgUnits.map((o) => [norm(o.dbValue), o.id] as const));

  // ── descendant L5 task → ancestor L2 division (one closure query) ──
  const divEdges = await prisma.processNodeClosure.findMany({
    where: { ancestorId: { in: [...divisionNodeIds] } },
    select: { ancestorId: true, descendantId: true },
  });
  const divisionForTask = new Map<string, string>(); // taskNodeId → divisionNodeId
  for (const e of divEdges) {
    if (divisionNodeIds.has(e.ancestorId)) divisionForTask.set(e.descendantId, e.ancestorId);
  }

  // ── role → its task links (Owner + Participant) ──
  const nodeRoles = await prisma.nodeRole.findMany({
    where: { companyId },
    select: { roleId: true, processNodeId: true },
  });
  const tasksByRole = new Map<string, string[]>();
  for (const nr of nodeRoles) {
    const list = tasksByRole.get(nr.roleId);
    if (list) list.push(nr.processNodeId);
    else tasksByRole.set(nr.roleId, [nr.processNodeId]);
  }

  let homed = 0;
  let noTasks = 0;
  let unmatchedDivision = 0;

  for (const role of roles) {
    const taskNodes = tasksByRole.get(role.id);
    if (!taskNodes || !taskNodes.length) { noTasks++; continue; }

    // modal division among the role's tasks
    const tally = new Map<string, number>();
    for (const t of taskNodes) {
      const divId = divisionForTask.get(t);
      if (divId) tally.set(divId, (tally.get(divId) ?? 0) + 1);
    }
    if (!tally.size) { noTasks++; continue; }
    let modalDivId = '';
    let best = -1;
    for (const [divId, n] of tally) if (n > best) { best = n; modalDivId = divId; }

    const divName = divisionNameByNodeId.get(modalDivId);
    const orgUnitId = divName ? orgUnitByDivisionName.get(norm(divName)) : undefined;
    if (!orgUnitId) { unmatchedDivision++; continue; }

    await prisma.role.update({ where: { id: role.id }, data: { orgUnitId } });
    await prisma.roleOrgAssignment.upsert({
      where: { roleId_orgUnitId: { roleId: role.id, orgUnitId } },
      update: { isPrimary: true },
      create: { roleId: role.id, orgUnitId, isPrimary: true },
    });
    homed++;
  }

  const result: HomeRolesResult = {
    total: roles.length,
    homed,
    unhomed: roles.length - homed,
    noTasks,
    unmatchedDivision,
  };
  console.log(
    `   homeRoles: homed ${homed}/${roles.length} (un-homed ${result.unhomed}: ${noTasks} no-tasks, ${unmatchedDivision} unmatched-division)`,
  );
  return result;
}
