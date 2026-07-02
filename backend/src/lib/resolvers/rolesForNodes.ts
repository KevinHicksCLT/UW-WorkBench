/**
 * rolesForNodes — replaces roleMatch.ts read-time text matching. Given a batch
 * of ProcessNode ids it returns the roles linked to each node via the NodeRole
 * junction (an indexed FK seek, not a company-wide name scan).
 *
 * Opt-in `withOrgUnit`: also resolves each role's home OrgUnit (id, name and
 * parent name) in ONE extra batched query over the distinct role ids — callers
 * that need a role's division/category grouping (e.g. the explorer
 * value-stream list) no longer re-hydrate roles with a second findMany. It is
 * fetched per distinct role, not joined per NodeRole row, so the 50k-row
 * fan-out never carries duplicated org strings.
 */
import { prisma } from '../../db/prisma.js';

/** A role's home org unit (division or department) + its parent's name. */
export interface RoleOrgUnitRef {
  id: string;
  displayValue: string;
  parent: { displayValue: string } | null;
}

export interface NodeRoleEntry {
  id: string;
  name: string; // displayValue
  role_: string; // "Owner" | "Participant"
  ownerLevel: string | null;
  /** Present (possibly null) only when requested via `withOrgUnit`. */
  orgUnit?: RoleOrgUnitRef | null;
}

async function fetchNodeRoles(nodeIds: string[]) {
  const ids = [...new Set(nodeIds.filter(Boolean))];
  if (!ids.length) return [];
  return prisma.nodeRole.findMany({
    where: { processNodeId: { in: ids } },
    select: {
      processNodeId: true, role_: true, ownerLevel: true,
      role: { select: { id: true, displayValue: true } },
    },
  });
}

/** One batched read of the distinct roles' home org units. */
async function orgUnitsByRole(roleIds: string[]): Promise<Map<string, RoleOrgUnitRef | null>> {
  if (!roleIds.length) return new Map();
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, orgUnit: { select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } } },
  });
  return new Map(roles.map((r) => [r.id, r.orgUnit]));
}

/**
 * Map<nodeId, NodeRoleEntry[]> — all roles (Owner + Participant) per node.
 * Pass `{ withOrgUnit: true }` to also attach each role's home OrgUnit.
 */
export async function rolesForNodes(
  nodeIds: string[],
  opts: { withOrgUnit?: boolean } = {},
): Promise<Map<string, NodeRoleEntry[]>> {
  const rows = await fetchNodeRoles(nodeIds);
  const homes = opts.withOrgUnit
    ? await orgUnitsByRole([...new Set(rows.map((r) => r.role.id))])
    : null;
  const out = new Map<string, NodeRoleEntry[]>();
  for (const r of rows) {
    const entry: NodeRoleEntry = { id: r.role.id, name: r.role.displayValue, role_: r.role_, ownerLevel: r.ownerLevel };
    if (homes) entry.orgUnit = homes.get(r.role.id) ?? null;
    const list = out.get(r.processNodeId);
    if (list) list.push(entry);
    else out.set(r.processNodeId, [entry]);
  }
  return out;
}

/** Same data split into { owners, participants } per node. */
export async function rolesForNodesByRelation(
  nodeIds: string[],
): Promise<Map<string, { owners: NodeRoleEntry[]; participants: NodeRoleEntry[] }>> {
  const rows = await fetchNodeRoles(nodeIds);
  const out = new Map<string, { owners: NodeRoleEntry[]; participants: NodeRoleEntry[] }>();
  for (const r of rows) {
    const entry: NodeRoleEntry = { id: r.role.id, name: r.role.displayValue, role_: r.role_, ownerLevel: r.ownerLevel };
    let bucket = out.get(r.processNodeId);
    if (!bucket) { bucket = { owners: [], participants: [] }; out.set(r.processNodeId, bucket); }
    (r.role_ === 'Owner' ? bucket.owners : bucket.participants).push(entry);
  }
  return out;
}
