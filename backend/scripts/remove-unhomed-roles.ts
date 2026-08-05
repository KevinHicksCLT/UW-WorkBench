// remove-unhomed-roles.ts — clear the synthetic "Unassigned" segment and the
// "Direct to division" buckets out of the Organization views by fixing the DATA
// that produces them, not the rendering.
//
// Neither bucket is a real OrgUnit: /explorer/org-table appends an "Unassigned"
// segment for roles with no `orgUnitId`, and the org map/table render a
// "Direct to division" pseudo-team for roles homed on an L2 division instead of
// an L3 department. Both disappear once every Role has a proper home.
//
// This script removes the two stray rows behind them (both typo'd near-duplicates
// created by hand):
//   • "Underwriting Assiststant" — no org unit, 1 owner link. Its NodeRole is
//     re-pointed at the real "Underwriting Assistant" (Underwriting › Field
//     Underwriting) FIRST, so the task keeps an owner, then the role is deleted.
//   • "Operation Manager" — homed straight on the Finance & Investments division,
//     zero links of any kind. Deleted outright.
//
// Idempotent: a role that is already gone is skipped, and a role that has grown
// links the plan does not account for aborts instead of losing data.
//
// Run from backend/:  npx tsx --env-file=.env scripts/remove-unhomed-roles.ts --dry
//                     npx tsx --env-file=.env scripts/remove-unhomed-roles.ts

import { prisma } from '../src/db/prisma.js';

const DRY = process.argv.includes('--dry');

/** `mergeInto` = displayValue of the role that inherits the NodeRoles; null = delete links too. */
const PLAN: { name: string; mergeInto: string | null }[] = [
  { name: 'Underwriting Assiststant', mergeInto: 'Underwriting Assistant' },
  { name: 'Operation Manager', mergeInto: null },
];

// Every other relation a Role can carry. The plan only knows how to move
// NodeRole, so anything here being non-zero means the role is load-bearing and
// deleting it would drop real associations — abort rather than guess.
const GUARDED = [
  'reports',
  'orgAssignments',
  'checklistItems',
  'roleDeliverables',
  'reassignedNodeRoles',
  'roleStandards',
  'roleRegulations',
  'ownedStandards',
  'externalInteractions',
  'metrics',
  'ownedPortfolioInitiatives',
  'sponsoredPortfolioInitiatives',
  'raidItems',
  'initiativeResources',
  'users',
] as const;

const company = await prisma.company.findFirst({ select: { id: true, name: true } });
if (!company) throw new Error('no company');
console.log(`\n=== remove-unhomed-roles ${DRY ? '(DRY RUN)' : '(APPLY)'} — ${company.name} ===`);

for (const step of PLAN) {
  const role = await prisma.role.findFirst({
    where: { companyId: company.id, displayValue: step.name },
    select: {
      id: true,
      displayValue: true,
      orgUnitId: true,
      _count: { select: Object.fromEntries(GUARDED.map((k) => [k, true])) },
      nodeRoles: { select: { id: true, processNodeId: true, role_: true } },
    },
  });
  if (!role) {
    console.log(`  ${step.name} — already gone, skipping`);
    continue;
  }

  const held = GUARDED.filter((k) => (role._count as Record<string, number>)[k] > 0);
  if (held.length) {
    throw new Error(
      `${step.name} now carries ${held.map((k) => `${k}=${(role._count as Record<string, number>)[k]}`).join(', ')} — refusing to delete; re-plan the merge`,
    );
  }

  if (step.mergeInto) {
    const target = await prisma.role.findFirst({
      where: { companyId: company.id, displayValue: step.mergeInto },
      select: { id: true, displayValue: true },
    });
    if (!target) throw new Error(`merge target "${step.mergeInto}" not found`);

    for (const nr of role.nodeRoles) {
      // (processNodeId, roleId, role_) is unique — if the target already owns the
      // node, the stray link is a duplicate and is dropped rather than moved.
      const clash = await prisma.nodeRole.findUnique({
        where: {
          processNodeId_roleId_role_: {
            processNodeId: nr.processNodeId,
            roleId: target.id,
            role_: nr.role_,
          },
        },
        select: { id: true },
      });
      const node = await prisma.processNode.findUnique({
        where: { id: nr.processNodeId },
        select: { displayValue: true },
      });
      console.log(
        `  ${role.displayValue} ${nr.role_} of "${node?.displayValue}" → ${clash ? 'duplicate, dropping link' : target.displayValue}`,
      );
      if (DRY) continue;
      if (clash) await prisma.nodeRole.delete({ where: { id: nr.id } });
      else await prisma.nodeRole.update({ where: { id: nr.id }, data: { roleId: target.id } });
    }
  } else if (role.nodeRoles.length) {
    throw new Error(
      `${step.name} has ${role.nodeRoles.length} node links but no merge target — re-plan`,
    );
  }

  console.log(`  deleting role ${role.displayValue} (${role.id})`);
  if (!DRY) await prisma.role.delete({ where: { id: role.id } });
}

const stillHomeless = await prisma.role.count({
  where: { companyId: company.id, orgUnitId: null },
});
const stillOnDivision = await prisma.role.count({
  where: { companyId: company.id, orgUnit: { orgLevelType: { levelNumber: 2 } } },
});
console.log(
  `\n--- roles with no org unit: ${stillHomeless} · roles homed on a division: ${stillOnDivision} ---`,
);
await prisma.$disconnect();
