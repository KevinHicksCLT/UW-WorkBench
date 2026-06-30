// rolesForNodes — replaces roleMatch.ts read-time text matching. Given a batch of
// ProcessNode ids it returns the roles linked to each node via the NodeRole
// junction (an indexed FK seek, not a company-wide name scan).
import { prisma } from '../../db/prisma.js';

export interface NodeRoleEntry {
  id: string;
  name: string; // displayValue
  role_: string; // "Owner" | "Participant"
  ownerLevel: string | null;
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

/** Map<nodeId, NodeRoleEntry[]> — all roles (Owner + Participant) per node. */
export async function rolesForNodes(nodeIds: string[]): Promise<Map<string, NodeRoleEntry[]>> {
  const rows = await fetchNodeRoles(nodeIds);
  const out = new Map<string, NodeRoleEntry[]>();
  for (const r of rows) {
    const entry: NodeRoleEntry = { id: r.role.id, name: r.role.displayValue, role_: r.role_, ownerLevel: r.ownerLevel };
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
