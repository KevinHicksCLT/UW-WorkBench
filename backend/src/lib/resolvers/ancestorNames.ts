// ancestorNames — THE single source for the denormalized location strings every
// route used to store on dozens of tables (valueStreamName, domain, l3, l4,
// division, department). Given a batch of ProcessNode ids it resolves each node's
// ancestry once (via ProcessNodeClosure → ProcessNode) and returns the level-keyed
// names. Editing a ProcessNode.displayValue now propagates everywhere by join.
//
// Fixed semantics: process L1 = domain, L2 = valueStream, L3 = l3, L4 = l4.
// division/department are ORG-derived: a process node has no org FK, so they are
// resolved from the Owner role homed on the node → role.orgUnit (L2 = division,
// L3 = department; both populate now that the Department tier is restored).
import { prisma } from '../../db/prisma.js';

export interface AncestorNames {
  valueStreamId: string | null;
  valueStreamName: string | null;
  domain: string | null;
  l3: string | null;
  l4: string | null;
  division: string | null;
  department: string | null;
}

const EMPTY: AncestorNames = {
  valueStreamId: null, valueStreamName: null, domain: null, l3: null, l4: null, division: null, department: null,
};

export interface StreamAncestry {
  valueStreamId: string | null;
  valueStreamName: string | null;
  domain: string | null;
}

/**
 * Lean variant of ancestorNames for callers that only need a node's value stream
 * (process L2) + domain (process L1) — e.g. the Org table's role-participation
 * column. Skips the l3/l4 resolution and the entire org-derived
 * division/department block (an extra NodeRole query + an OrgUnitClosure+OrgUnit
 * join), which the full resolver computes and those callers discard. Two queries.
 */
export async function streamAncestry(nodeIds: string[]): Promise<Map<string, StreamAncestry>> {
  const out = new Map<string, StreamAncestry>();
  const ids = [...new Set(nodeIds.filter(Boolean))];
  if (!ids.length) return out;
  for (const id of ids) out.set(id, { valueStreamId: null, valueStreamName: null, domain: null });

  const edges = await prisma.processNodeClosure.findMany({
    where: { descendantId: { in: ids } },
    select: { ancestorId: true, descendantId: true },
  });
  const ancestorIds = [...new Set(edges.map((e) => e.ancestorId))];
  const ancestors = await prisma.processNode.findMany({
    where: { id: { in: ancestorIds }, processLevelType: { levelNumber: { in: [1, 2] } } },
    select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } } },
  });
  const ancById = new Map(
    ancestors.map((a) => [a.id, { name: a.displayValue, level: a.processLevelType.levelNumber }] as const),
  );
  for (const e of edges) {
    const anc = ancById.get(e.ancestorId);
    if (!anc) continue;
    const rec = out.get(e.descendantId)!;
    if (anc.level === 1) rec.domain = anc.name;
    else if (anc.level === 2) { rec.valueStreamId = e.ancestorId; rec.valueStreamName = anc.name; }
  }
  return out;
}

export async function ancestorNames(nodeIds: string[]): Promise<Map<string, AncestorNames>> {
  const out = new Map<string, AncestorNames>();
  const ids = [...new Set(nodeIds.filter(Boolean))];
  if (!ids.length) return out;

  // 1. Every ancestor edge for the batch (depth >= 0 so the node itself is in).
  const edges = await prisma.processNodeClosure.findMany({
    where: { descendantId: { in: ids } },
    select: { ancestorId: true, descendantId: true, depth: true },
  });

  // 2. Resolve each distinct ancestor's level + display name in one query.
  const ancestorIds = [...new Set(edges.map((e) => e.ancestorId))];
  const ancestors = await prisma.processNode.findMany({
    where: { id: { in: ancestorIds } },
    select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } } },
  });
  const ancById = new Map(
    ancestors.map((a) => [a.id, { name: a.displayValue, level: a.processLevelType.levelNumber }] as const),
  );

  // 3. For each target node, pick the ancestor at L1/L2/L3/L4 (closest one wins).
  for (const id of ids) out.set(id, { ...EMPTY });
  for (const e of edges) {
    const anc = ancById.get(e.ancestorId);
    if (!anc) continue;
    const rec = out.get(e.descendantId)!;
    switch (anc.level) {
      case 1: rec.domain = anc.name; break;
      case 2: rec.valueStreamId = e.ancestorId; rec.valueStreamName = anc.name; break;
      case 3: rec.l3 = anc.name; break;
      case 4: rec.l4 = anc.name; break;
    }
  }

  // 4. ORG-derived division/department: Owner role homed on the node → role.orgUnit
  //    ancestors. One NodeRole query (Owner only), one OrgUnitClosure+OrgUnit join.
  const owners = await prisma.nodeRole.findMany({
    where: { processNodeId: { in: ids }, role_: 'Owner', role: { orgUnitId: { not: null } } },
    select: { processNodeId: true, role: { select: { orgUnitId: true } } },
  });
  const orgUnitByNode = new Map<string, string>();
  for (const o of owners) {
    if (o.role.orgUnitId && !orgUnitByNode.has(o.processNodeId)) orgUnitByNode.set(o.processNodeId, o.role.orgUnitId);
  }
  const orgUnitIds = [...new Set(orgUnitByNode.values())];
  if (orgUnitIds.length) {
    const orgEdges = await prisma.orgUnitClosure.findMany({
      where: { descendantId: { in: orgUnitIds } },
      select: { ancestorId: true, descendantId: true },
    });
    const orgAncIds = [...new Set(orgEdges.map((e) => e.ancestorId))];
    const orgAncestors = await prisma.orgUnit.findMany({
      where: { id: { in: orgAncIds } },
      select: { id: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } },
    });
    const orgAncById = new Map(
      orgAncestors.map((a) => [a.id, { name: a.displayValue, level: a.orgLevelType.levelNumber }] as const),
    );
    // orgUnitId → { division (L2), department (L3) }
    const orgStringsByUnit = new Map<string, { division: string | null; department: string | null }>();
    for (const id of orgUnitIds) orgStringsByUnit.set(id, { division: null, department: null });
    for (const e of orgEdges) {
      const anc = orgAncById.get(e.ancestorId);
      const rec = orgStringsByUnit.get(e.descendantId);
      if (!anc || !rec) continue;
      if (anc.level === 2) rec.division = anc.name;
      else if (anc.level === 3) rec.department = anc.name;
    }
    for (const [nodeId, unitId] of orgUnitByNode) {
      const s = orgStringsByUnit.get(unitId);
      const rec = out.get(nodeId);
      if (s && rec) { rec.division = s.division; rec.department = s.department; }
    }
  }

  return out;
}
