// merge-roles.ts — merge semantically-duplicate roles per role-clusters.json.
// For each cluster the canonical role absorbs every member's associations
// (NodeRole, RoleDeliverable, RoleStandard, RoleOrgAssignment, owned standards,
// checklist items, dotted-lines, manager links, portfolio/raid/metric refs), then
// the member roles are deleted. Canonical inherits an org home if it lacks one and
// is renamed to the canonical title.
// Run (cwd=backend): npx tsx scripts/merge-roles.ts
import 'dotenv/config';
import fs from 'node:fs';
import { prisma } from '../src/db/prisma.js';

const CLUSTERS = 'C:/Users/xando/AppData/Local/Temp/claude/C--Users-xando-Code-transform-platform/af846a15-b100-4a71-bef2-36c56f98f942/scratchpad/role-clusters.json';

// junctions with a uniqueness key — delete member rows that would clash, repoint the rest
async function mergeUniqueJunction(model: any, roleField: string, keyFields: string[], fromId: string, toId: string) {
  const rows = await model.findMany({ where: { [roleField]: fromId } });
  for (const r of rows) {
    const where: any = { [roleField]: toId };
    for (const k of keyFields) if (k !== roleField) where[k] = r[k];
    const clash = await model.findFirst({ where });
    if (clash) await model.delete({ where: { id: r.id } });
    else await model.update({ where: { id: r.id }, data: { [roleField]: toId } });
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(CLUSTERS, 'utf8'));
  const clusters: { canonicalId: string; canonicalName: string; memberIds: string[] }[] = data.clusters ?? [];
  console.log('clusters:', clusters.length);

  let mergedRoles = 0;
  for (const cl of clusters) {
    const keep = cl.canonicalId;
    const members = cl.memberIds.filter((m) => m !== keep);
    if (!members.length) continue;
    const keepRole = await prisma.role.findUnique({ where: { id: keep }, select: { id: true, orgUnitId: true } });
    if (!keepRole) { console.warn('canonical missing', cl.canonicalName); continue; }

    for (const m of members) {
      const mRole = await prisma.role.findUnique({ where: { id: m }, select: { id: true, orgUnitId: true } });
      if (!mRole) continue;
      // unique-keyed junctions
      await mergeUniqueJunction(prisma.nodeRole, 'roleId', ['processNodeId', 'roleId', 'role_'], m, keep);
      await mergeUniqueJunction(prisma.roleDeliverable, 'roleId', ['roleId', 'deliverableId', 'role_'], m, keep);
      await mergeUniqueJunction(prisma.roleStandard, 'roleId', ['roleId', 'standardId'], m, keep);
      await mergeUniqueJunction(prisma.roleOrgAssignment, 'roleId', ['roleId', 'orgUnitId'], m, keep);
      // dotted-line (two role columns), dedupe each side
      await mergeUniqueJunction(prisma.roleDottedLine, 'roleId', ['roleId', 'managerRoleId'], m, keep);
      await mergeUniqueJunction(prisma.roleDottedLine, 'managerRoleId', ['roleId', 'managerRoleId'], m, keep);
      // simple FK repoints (no-ops where empty)
      const simple: [any, string][] = [
        [prisma.standard, 'ownerRoleId'], [prisma.checklistItem, 'roleId'],
        [prisma.metric, 'roleId'], [prisma.externalInteraction, 'roleId'],
        [prisma.userPreference, 'roleId'], [prisma.raidItem, 'roleId'],
        [prisma.initiativeResource, 'roleId'],
      ];
      for (const [model, field] of simple) { try { await model.updateMany({ where: { [field]: m }, data: { [field]: keep } }); } catch {} }
      // portfolio + rationalization owner/sponsor
      try { await prisma.portfolioInitiative.updateMany({ where: { ownerRoleId: m }, data: { ownerRoleId: keep } }); } catch {}
      try { await prisma.portfolioInitiative.updateMany({ where: { sponsorRoleId: m }, data: { sponsorRoleId: keep } }); } catch {}
      try { await prisma.rationalizationMicroservice.updateMany({ where: { ownerRoleId: m }, data: { ownerRoleId: keep } }); } catch {}
      try { await prisma.rationalizationPlanStep.updateMany({ where: { ownerRoleId: m }, data: { ownerRoleId: keep } }); } catch {}
      // role self-relation: roles reporting to the member now report to keep
      try { await prisma.role.updateMany({ where: { managerRoleId: m }, data: { managerRoleId: keep } }); } catch {}
      // inherit org home if canonical lacks one
      if (!keepRole.orgUnitId && mRole.orgUnitId) { await prisma.role.update({ where: { id: keep }, data: { orgUnitId: mRole.orgUnitId } }); keepRole.orgUnitId = mRole.orgUnitId; }
      await prisma.role.delete({ where: { id: m } });
      mergedRoles++;
    }
    // rename canonical (members deleted, so dbValue is free)
    await prisma.role.update({ where: { id: keep }, data: { displayValue: cl.canonicalName, dbValue: cl.canonicalName } }).catch((e) => console.warn('rename skip', cl.canonicalName, e.message));
  }
  console.log('merged away', mergedRoles, 'roles');
  const co = await prisma.company.findFirst({ select: { id: true } });
  console.log('roles now:', await prisma.role.count({ where: { companyId: co!.id } }));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
