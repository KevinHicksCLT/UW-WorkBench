// Default OrgUnit for a newly-created Role. A role must NEVER be created
// homeless: the org spine (OrgUnit L1 segment › L2 division › L3 department)
// and the process spine (ProcessNode L1–L5) are edited separately, and a Role
// is the one entity bridging them — it performs process work but HOMES on an
// OrgUnit. A role with no home falls into the org views' synthetic
// "Unassigned" bucket, which is not a real OrgUnit and has no UI to fix or
// remove. Every role-creation endpoint must run its choice through here.
//
// Preference order:
//   1. the Owner role's unit on the originating process node (the same
//      convention ancestorNames uses to derive division/department),
//   2. any homed role already on that node,
//   3. the company's first L2 division (sortOrder, then name).
import { prisma } from '../db/prisma.js';

export async function defaultRoleHome(
  companyId: string,
  processNodeId?: string,
): Promise<string | null> {
  if (processNodeId) {
    const homedLinks = await prisma.nodeRole.findMany({
      where: { processNodeId, role: { orgUnitId: { not: null } } },
      select: { role_: true, role: { select: { orgUnitId: true } } },
    });
    const fromNode =
      homedLinks.find((l) => l.role_ === 'Owner')?.role.orgUnitId ??
      homedLinks[0]?.role.orgUnitId ??
      null;
    if (fromNode) return fromNode;
  }
  const l2 = await prisma.orgLevelType.findFirst({
    where: { companyId, levelNumber: 2 },
    select: { id: true },
  });
  if (!l2) return null;
  return (
    (
      await prisma.orgUnit.findFirst({
        where: { companyId, orgLevelTypeId: l2.id },
        orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
        select: { id: true },
      })
    )?.id ?? null
  );
}
