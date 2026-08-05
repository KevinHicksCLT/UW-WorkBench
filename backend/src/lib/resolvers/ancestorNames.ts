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
import { inChunks } from '../inChunks.js';

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
  valueStreamId: null,
  valueStreamName: null,
  domain: null,
  l3: null,
  l4: null,
  division: null,
  department: null,
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
 * join), which the full resolver computes and those callers discard.
 *
 * ONE query. The callers batch big — the Org table resolves every role-linked node
 * of the company (~42k on ABC Insurance) — so this cannot be a pair of Prisma
 * `{ in: ids }` reads: the id list is bound one variable per element and Postgres
 * caps a prepared statement at 32,767 (see lib/inChunks.ts). Raw SQL binds the ids
 * as a single `text[]` and pivots the L1/L2 ancestors DB-side, which also drops the
 * ~130k intermediate closure rows that the two-query form pulled into memory.
 */
export async function streamAncestry(nodeIds: string[]): Promise<Map<string, StreamAncestry>> {
  const out = new Map<string, StreamAncestry>();
  const ids = [...new Set(nodeIds.filter(Boolean))];
  if (!ids.length) return out;
  for (const id of ids) out.set(id, { valueStreamId: null, valueStreamName: null, domain: null });

  const rows = await prisma.$queryRaw<
    {
      id: string;
      valueStreamId: string | null;
      valueStreamName: string | null;
      domain: string | null;
    }[]
  >`
    SELECT c."descendantId" AS id,
      (array_agg(anc.id           ) FILTER (WHERE plt."levelNumber" = 2))[1] AS "valueStreamId",
      (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 2))[1] AS "valueStreamName",
      (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 1))[1] AS "domain"
    FROM public."ProcessNodeClosure" c
    JOIN public."ProcessNode" anc ON anc.id = c."ancestorId"
    JOIN public."ProcessLevelType" plt ON plt.id = anc."processLevelTypeId"
    WHERE c."descendantId" = ANY(${ids}::text[]) AND plt."levelNumber" IN (1, 2)
    GROUP BY 1`;

  for (const r of rows) {
    const rec = out.get(r.id);
    if (!rec) continue;
    rec.valueStreamId = r.valueStreamId;
    rec.valueStreamName = r.valueStreamName;
    rec.domain = r.domain;
  }
  return out;
}

export async function ancestorNames(nodeIds: string[]): Promise<Map<string, AncestorNames>> {
  const ids = [...new Set(nodeIds.filter(Boolean))];
  if (!ids.length) return new Map();

  // Round 1: kick off both chains' first query together (see resolveFromRound1).
  const [edges, owners] = await Promise.all([
    inChunks(ids, (chunk) =>
      prisma.processNodeClosure.findMany({
        where: { descendantId: { in: chunk } },
        select: { ancestorId: true, descendantId: true },
      }),
    ),
    inChunks(ids, (chunk) =>
      prisma.nodeRole.findMany({
        where: { processNodeId: { in: chunk }, role_: 'Owner', role: { orgUnitId: { not: null } } },
        select: { processNodeId: true, role: { select: { orgUnitId: true } } },
      }),
    ),
  ]);
  return resolveFromRound1(ids, edges, owners);
}

/**
 * ancestorNames for EVERY task node of a company, scoped by relation filter
 * instead of an id list. Functionally identical to
 * `ancestorNames(<all task ids of the company>)`, but a company with ~11k tasks
 * would ship an 11k-id `IN` list to Postgres and pull ~55k closure rows back —
 * instead, both ancestry chains aggregate DB-side (one row per task) and run
 * as two parallel one-shot queries. Raw SQL because Prisma cannot express the
 * per-level `array_agg FILTER` pivot. Used by the /work Tasks grain.
 */
export async function companyTaskAncestorNames(
  companyId: string,
): Promise<Map<string, AncestorNames>> {
  const [procRows, orgRows] = await Promise.all([
    // Chain A: process closure → ancestor per level (L1 domain … L4). Every node
    // self-links at depth 0, so each task gets a row even with no ancestors.
    prisma.$queryRaw<
      {
        id: string;
        valueStreamId: string | null;
        valueStreamName: string | null;
        domain: string | null;
        l3: string | null;
        l4: string | null;
      }[]
    >`
      SELECT c."descendantId" AS id,
        (array_agg(anc.id           ) FILTER (WHERE plt."levelNumber" = 2))[1] AS "valueStreamId",
        (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 2))[1] AS "valueStreamName",
        (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 1))[1] AS "domain",
        (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 3))[1] AS "l3",
        (array_agg(anc."displayValue") FILTER (WHERE plt."levelNumber" = 4))[1] AS "l4"
      FROM public."ProcessNodeClosure" c
      JOIN public."ProcessNode" pn  ON pn.id  = c."descendantId"
      JOIN public."ProcessNode" anc ON anc.id = c."ancestorId"
      JOIN public."ProcessLevelType" plt ON plt.id = anc."processLevelTypeId"
      WHERE pn."companyId" = ${companyId} AND pn."isTask"
      GROUP BY 1`,
    // Chain B: Owner role → org-unit closure → org L2/L3 names.
    prisma.$queryRaw<{ id: string; division: string | null; department: string | null }[]>`
      SELECT nr."processNodeId" AS id,
        (array_agg(ou."displayValue") FILTER (WHERE olt."levelNumber" = 2))[1] AS "division",
        (array_agg(ou."displayValue") FILTER (WHERE olt."levelNumber" = 3))[1] AS "department"
      FROM public."NodeRole" nr
      JOIN public."ProcessNode" pn ON pn.id = nr."processNodeId"
      JOIN public."Role" r ON r.id = nr."roleId"
      JOIN public."OrgUnitClosure" oc ON oc."descendantId" = r."orgUnitId"
      JOIN public."OrgUnit" ou ON ou.id = oc."ancestorId"
      JOIN public."OrgLevelType" olt ON olt.id = ou."orgLevelTypeId"
      WHERE pn."companyId" = ${companyId} AND pn."isTask" AND nr."role_" = 'Owner'
      GROUP BY 1`,
  ]);

  const out = new Map<string, AncestorNames>();
  for (const p of procRows) {
    out.set(p.id, {
      valueStreamId: p.valueStreamId,
      valueStreamName: p.valueStreamName,
      domain: p.domain,
      l3: p.l3,
      l4: p.l4,
      division: null,
      department: null,
    });
  }
  for (const o of orgRows) {
    const rec = out.get(o.id);
    if (rec) {
      rec.division = o.division;
      rec.department = o.department;
    }
  }
  return out;
}

// Two independent ancestry chains, each internally sequential (every step needs
// the prior step's ids) but with no dependency on each other, so they run
// concurrently — 3 query rounds total instead of 5 serial:
//   A) process closure → process nodes        (domain / value stream / l3 / l4)
//   B) Owner role → org-unit closure → org units (division / department)
// Round 1 (both chains' first query) happens in the callers above; this shared
// core runs rounds 2–3 and assembles the map.
async function resolveFromRound1(
  ids: string[],
  edges: { ancestorId: string; descendantId: string }[],
  owners: { processNodeId: string; role: { orgUnitId: string | null } }[],
): Promise<Map<string, AncestorNames>> {
  const out = new Map<string, AncestorNames>();
  for (const id of ids) out.set(id, { ...EMPTY });

  const ancestorIds = [...new Set(edges.map((e) => e.ancestorId))];
  const orgUnitByNode = new Map<string, string>();
  for (const o of owners) {
    if (o.role.orgUnitId && !orgUnitByNode.has(o.processNodeId))
      orgUnitByNode.set(o.processNodeId, o.role.orgUnitId);
  }
  const orgUnitIds = [...new Set(orgUnitByNode.values())];

  // Round 2: each chain's second query, again in parallel.
  type OrgEdge = { ancestorId: string; descendantId: string };
  const [ancestors, orgEdges] = await Promise.all([
    inChunks(ancestorIds, (chunk) =>
      prisma.processNode.findMany({
        where: { id: { in: chunk } },
        select: {
          id: true,
          displayValue: true,
          processLevelType: { select: { levelNumber: true } },
        },
      }),
    ),
    orgUnitIds.length
      ? inChunks(orgUnitIds, (chunk) =>
          prisma.orgUnitClosure.findMany({
            where: { descendantId: { in: chunk } },
            select: { ancestorId: true, descendantId: true },
          }),
        )
      : Promise.resolve([] as OrgEdge[]),
  ]);

  // Process-side names: pick each node's ancestor at L1/L2/L3/L4 (closest wins).
  const ancById = new Map(
    ancestors.map(
      (a) => [a.id, { name: a.displayValue, level: a.processLevelType.levelNumber }] as const,
    ),
  );
  for (const e of edges) {
    const anc = ancById.get(e.ancestorId);
    if (!anc) continue;
    const rec = out.get(e.descendantId)!;
    switch (anc.level) {
      case 1:
        rec.domain = anc.name;
        break;
      case 2:
        rec.valueStreamId = e.ancestorId;
        rec.valueStreamName = anc.name;
        break;
      case 3:
        rec.l3 = anc.name;
        break;
      case 4:
        rec.l4 = anc.name;
        break;
    }
  }

  // Org-side division/department (Round 3: the org ancestors' names).
  if (orgEdges.length) {
    const orgAncIds = [...new Set(orgEdges.map((e) => e.ancestorId))];
    const orgAncestors = await inChunks(orgAncIds, (chunk) =>
      prisma.orgUnit.findMany({
        where: { id: { in: chunk } },
        select: { id: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } },
      }),
    );
    const orgAncById = new Map(
      orgAncestors.map(
        (a) => [a.id, { name: a.displayValue, level: a.orgLevelType.levelNumber }] as const,
      ),
    );
    // orgUnitId → { division (L2), department (L3) }
    const orgStringsByUnit = new Map<
      string,
      { division: string | null; department: string | null }
    >();
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
      if (s && rec) {
        rec.division = s.division;
        rec.department = s.department;
      }
    }
  }

  return out;
}
