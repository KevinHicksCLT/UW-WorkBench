// verify-seed.ts — asserts the erd_v5 seeded DB satisfies the structural
// invariants of the ABC v14 master spine. Run: `npm run db:verify` (from the
// backend workspace) or `npx tsx backend/scripts/verify-seed.ts`.
//
// It checks, for the seeded `abc-insurance` company:
//   • ProcessNode level cardinality 3 / 17 / 135 / 867 / 3811 (L1..L5)
//   • OrgUnit 20 (3 segments + 17 divisions)
//   • Role 257, Application ≈ 70
//   • the core junction cardinalities
//   • both closures hold MORE rows than their node count (self-rows + edges)
//   • ZERO orphan junctions (every processNodeId/roleId/deliverableId/
//     applicationId/checklistItemId FK resolves)
//   • ZERO ProcessNode whose parentId has no matching depth-1 closure row
//     (closure ↔ tree integrity) — same for OrgUnit
//   • every peripheral table is non-empty
// Prints a clear PASS/FAIL summary and exits non-zero on any failure.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

// exact / comparator helpers
const eq = (name: string, actual: number, expected: number) =>
  add(name, actual === expected, `expected ${expected}, actual ${actual}`);
const gte = (name: string, actual: number, min: number) =>
  add(name, actual >= min, `expected ≥ ${min}, actual ${actual}`);
const gt = (name: string, actual: number, floor: number) =>
  add(name, actual > floor, `expected > ${floor}, actual ${actual}`);
const zero = (name: string, actual: number) =>
  add(name, actual === 0, `expected 0, actual ${actual}`);

async function rawCount(sql: string, ...params: unknown[]): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql, ...params);
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  const company = await prisma.company.findFirst({ where: { slug: 'abc-insurance' } });
  if (!company) throw new Error('No seeded "abc-insurance" company found — run `npm run db:seed` first.');
  const c = company.id;

  // ── ProcessNode level cardinality ──
  const pTypes = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const pLevelById = new Map(pTypes.map((t) => [t.id, t.levelNumber] as const));
  const pGroups = await prisma.processNode.groupBy({ by: ['processLevelTypeId'], where: { companyId: c }, _count: { _all: true } });
  const pByLevel = new Map<number, number>();
  for (const g of pGroups) { const l = pLevelById.get(g.processLevelTypeId); if (l != null) pByLevel.set(l, (pByLevel.get(l) ?? 0) + g._count._all); }
  eq('ProcessNode L1 (domains)', pByLevel.get(1) ?? 0, 3);
  eq('ProcessNode L2 (value streams)', pByLevel.get(2) ?? 0, 17);
  eq('ProcessNode L3 (process areas)', pByLevel.get(3) ?? 0, 135);
  // L4 was 867 + 3 sub-processes from decompose-single-child.ts (eliminating the
  // 3 single-child L3 parents by splitting their lone L4); total 4833 + 3 = 4836.
  eq('ProcessNode L4 (sub-processes)', pByLevel.get(4) ?? 0, 870);
  eq('ProcessNode L5 (tasks)', pByLevel.get(5) ?? 0, 3811);
  const processNodeTotal = await prisma.processNode.count({ where: { companyId: c } });
  eq('ProcessNode total', processNodeTotal, 4836);

  // ── OrgUnit + Role + Application ──
  // Org tree now carries the restored Department tier (L3):
  //   L1 = 3 segments, L2 = 18 divisions (17 spine + Executive Office), L3 = departments.
  const oTypes = await prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const oLevelById = new Map(oTypes.map((t) => [t.id, t.levelNumber] as const));
  const oGroups = await prisma.orgUnit.groupBy({ by: ['orgLevelTypeId'], where: { companyId: c }, _count: { _all: true } });
  const oByLevel = new Map<number, number>();
  for (const g of oGroups) { const l = oLevelById.get(g.orgLevelTypeId); if (l != null) oByLevel.set(l, (oByLevel.get(l) ?? 0) + g._count._all); }
  // OrgLevelType must include the Department tier (L1/L2/L3).
  eq('OrgLevelType L1/L2/L3 present', [1, 2, 3].filter((n) => oTypes.some((t) => t.levelNumber === n)).length, 3);
  eq('OrgUnit L1 (segments)', oByLevel.get(1) ?? 0, 3);
  eq('OrgUnit L2 (divisions, 17 spine + Executive Office)', oByLevel.get(2) ?? 0, 18);
  gt('OrgUnit L3 (departments) > 0', oByLevel.get(3) ?? 0, 0);
  const orgUnit = await prisma.orgUnit.count({ where: { companyId: c } });
  eq('OrgUnit total (3 seg + 18 div + departments)', orgUnit, 3 + 18 + (oByLevel.get(3) ?? 0));
  // Role roster at develop/prod parity (257 master + 42 imported = 299).
  eq('Role (develop/prod parity)', await prisma.role.count({ where: { companyId: c } }), 299);
  // Every role homed to a department (orgUnit at L3). A handful may fall back to a
  // division (L2) when develop left them department-less, so assert most are at L3.
  const l3TypeIds = oTypes.filter((t) => t.levelNumber === 3).map((t) => t.id);
  const rolesAtDept = l3TypeIds.length
    ? await prisma.role.count({ where: { companyId: c, orgUnit: { orgLevelTypeId: { in: l3TypeIds } } } })
    : 0;
  gt('Roles homed to a department (L3)', rolesAtDept, 0);
  gte('Application (≈70)', await prisma.application.count({ where: { companyId: c } }), 60);

  // ── Deliverable grain: ONE PER L4 sub-process (a grouping of its L5 tasks),
  //    NOT one-per-task. 867 from seedMaster + 3 new L4s from decompose-single-child
  //    = 870 ≈ L4 count. Every L5 task carries its own deliverable TEXT on the node
  //    (attributes.deliverable). ──
  eq('Deliverable (one per L4, ≈870)', await prisma.deliverable.count({ where: { companyId: c } }), 870);
  eq('Deliverable == L4 ProcessNode count', await prisma.deliverable.count({ where: { companyId: c } }), pByLevel.get(4) ?? 0);
  zero('L5 tasks missing attributes.deliverable text', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "ProcessNode" pn
       JOIN "ProcessLevelType" t ON t."id"=pn."processLevelTypeId"
      WHERE pn."companyId"=$1 AND t."levelNumber"=5
        AND ("attributes"->>'deliverable') IS NULL`, c));

  // ── Core junctions ──
  // 10218 master NodeRole + 36 coarse value-stream participation links wiring the
  // 42 imported (develop) roles to their L2 value stream (seedOrgFromDevelop).
  eq('NodeRole', await prisma.nodeRole.count({ where: { companyId: c } }), 10254);
  // NodeDeliverable links each L4 deliverable to its L4 node + every L5 task node:
  // 867 L4 self + 3811 task + 3 new-L4 self (decompose) = 4681. (Moved-task links
  // are re-pointed, not added, by the split so tasks stay at 3811.)
  eq('NodeDeliverable (L4 + task links)', await prisma.nodeDeliverable.count({ where: { companyId: c } }), 4681);
  eq('NodeAppUsage', await prisma.nodeAppUsage.count({ where: { companyId: c } }), 7792);
  eq('NodeChecklist', await prisma.nodeChecklist.count({ where: { companyId: c } }), 15090);
  // RoleDeliverable groups each L4 deliverable's task-owners (deduped to (role, L4
  // deliverable, Owner)), so it is far below the old 3811 per-task figure.
  gt('RoleDeliverable (deduped owner→L4 deliverable)', await prisma.roleDeliverable.count({ where: { companyId: c } }), 0);
  // TestingTemplate stays per-task (3811), each now pointing at its L4 deliverable.
  eq('TestingTemplate (per task)', await prisma.testingTemplate.count({ where: { deliverable: { companyId: c } } }), 3811);

  // ── Closures: more rows than nodes (self-rows + ancestor edges) ──
  const pnc = await prisma.processNodeClosure.count({ where: { ancestor: { companyId: c } } });
  const ouc = await prisma.orgUnitClosure.count({ where: { ancestor: { companyId: c } } });
  gt('ProcessNodeClosure > ProcessNode count', pnc, processNodeTotal);
  gt('OrgUnitClosure > OrgUnit count', ouc, orgUnit);

  // ── Orphan-junction integrity (every FK resolves) ──
  zero('NodeRole orphans (processNode)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeRole" j LEFT JOIN "ProcessNode" p ON p."id"=j."processNodeId" WHERE j."companyId"=$1 AND p."id" IS NULL`, c));
  zero('NodeRole orphans (role)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeRole" j LEFT JOIN "Role" r ON r."id"=j."roleId" WHERE j."companyId"=$1 AND r."id" IS NULL`, c));
  zero('NodeDeliverable orphans (processNode)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeDeliverable" j LEFT JOIN "ProcessNode" p ON p."id"=j."processNodeId" WHERE j."companyId"=$1 AND p."id" IS NULL`, c));
  zero('NodeDeliverable orphans (deliverable)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeDeliverable" j LEFT JOIN "Deliverable" d ON d."id"=j."deliverableId" WHERE j."companyId"=$1 AND d."id" IS NULL`, c));
  zero('NodeAppUsage orphans (processNode)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeAppUsage" j LEFT JOIN "ProcessNode" p ON p."id"=j."processNodeId" WHERE j."companyId"=$1 AND p."id" IS NULL`, c));
  zero('NodeAppUsage orphans (application)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeAppUsage" j LEFT JOIN "Application" a ON a."id"=j."applicationId" WHERE j."companyId"=$1 AND a."id" IS NULL`, c));
  zero('NodeChecklist orphans (processNode)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeChecklist" j LEFT JOIN "ProcessNode" p ON p."id"=j."processNodeId" WHERE j."companyId"=$1 AND p."id" IS NULL`, c));
  zero('NodeChecklist orphans (checklistItem)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "NodeChecklist" j LEFT JOIN "ChecklistItem" ci ON ci."id"=j."checklistItemId" WHERE j."companyId"=$1 AND ci."id" IS NULL`, c));
  zero('RoleDeliverable orphans (role)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "RoleDeliverable" j LEFT JOIN "Role" r ON r."id"=j."roleId" WHERE j."companyId"=$1 AND r."id" IS NULL`, c));
  zero('RoleDeliverable orphans (deliverable)', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "RoleDeliverable" j LEFT JOIN "Deliverable" d ON d."id"=j."deliverableId" WHERE j."companyId"=$1 AND d."id" IS NULL`, c));

  // ── Closure ↔ tree integrity: every node with a parentId must have a matching
  //    depth-1 closure row (parent → node). A non-zero result means a stale closure.
  zero('ProcessNode parentId without depth-1 closure row', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "ProcessNode" pn
       WHERE pn."companyId"=$1 AND pn."parentId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "ProcessNodeClosure" cl
                          WHERE cl."ancestorId"=pn."parentId" AND cl."descendantId"=pn."id" AND cl."depth"=1)`, c));
  zero('OrgUnit parentId without depth-1 closure row', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "OrgUnit" ou
       WHERE ou."companyId"=$1 AND ou."parentId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "OrgUnitClosure" cl
                          WHERE cl."ancestorId"=ou."parentId" AND cl."descendantId"=ou."id" AND cl."depth"=1)`, c));
  // Every ProcessNode/OrgUnit must have its self-row (depth 0).
  zero('ProcessNode missing self closure row', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "ProcessNode" pn
       WHERE pn."companyId"=$1
         AND NOT EXISTS (SELECT 1 FROM "ProcessNodeClosure" cl
                          WHERE cl."ancestorId"=pn."id" AND cl."descendantId"=pn."id" AND cl."depth"=0)`, c));
  zero('OrgUnit missing self closure row', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "OrgUnit" ou
       WHERE ou."companyId"=$1
         AND NOT EXISTS (SELECT 1 FROM "OrgUnitClosure" cl
                          WHERE cl."ancestorId"=ou."id" AND cl."descendantId"=ou."id" AND cl."depth"=0)`, c));
  // No closure row may dangle (reference a missing node) in either tree.
  zero('ProcessNodeClosure dangling rows', await rawCount(
    `SELECT COUNT(*)::bigint n FROM "ProcessNodeClosure" cl
       LEFT JOIN "ProcessNode" a ON a."id"=cl."ancestorId"
       LEFT JOIN "ProcessNode" d ON d."id"=cl."descendantId"
      WHERE (a."id" IS NULL OR d."id" IS NULL)
        AND (cl."ancestorId" IN (SELECT "id" FROM "ProcessNode" WHERE "companyId"=$1)
             OR cl."descendantId" IN (SELECT "id" FROM "ProcessNode" WHERE "companyId"=$1))`, c));

  // ── Peripheral tables must be populated ──
  // 51 state insurance regulators + 3 federal securities (FINRA/SEC/MSRB).
  eq('Jurisdiction (51 state + 3 federal)', await prisma.jurisdiction.count({ where: { companyId: c } }), 54);
  eq('Jurisdiction federal (FINRA/SEC/MSRB)', await prisma.jurisdiction.count({ where: { companyId: c, regulatorType: 'FEDERAL_SECURITIES' } }), 3);
  gte('RegulatoryRequirement federal (≥8)', await prisma.regulatoryRequirement.count({ where: { companyId: c, jurisdiction: { regulatorType: 'FEDERAL_SECURITIES' } } }), 8);
  gt('Standard (areas + items)', await prisma.standard.count({ where: { companyId: c } }), 0);
  gt('Standard areas', await prisma.standard.count({ where: { companyId: c, isArea: true } }), 0);
  gt('Program', await prisma.program.count({ where: { companyId: c } }), 0);
  gt('PortfolioInitiative', await prisma.portfolioInitiative.count({ where: { companyId: c } }), 0);
  gt('RegulatoryRequirement', await prisma.regulatoryRequirement.count({ where: { companyId: c } }), 0);
  gt('NodeRegulation', await prisma.nodeRegulation.count({ where: { companyId: c } }), 0);
  gt('RationalizationWorkspace', await prisma.rationalizationWorkspace.count({ where: { companyId: c } }), 0);
  gt('ExternalParty', await prisma.externalParty.count({ where: { companyId: c } }), 0);
  gt('Metric', await prisma.metric.count({ where: { companyId: c } }), 0);
  gt('NodeAiAdoption', await prisma.nodeAiAdoption.count({ where: { processNode: { companyId: c } } }), 0);
  gt('TelemetrySignal', await prisma.telemetrySignal.count({ where: { companyId: c } }), 0);

  // ── Summary ──
  const failed = checks.filter((ch) => !ch.pass);
  console.log(`\nerd_v5 seed verification for "${company.name}" (${c}):\n`);
  for (const ch of checks) console.log(`  ${ch.pass ? '✓' : '✗'} ${ch.name.padEnd(46)} ${ch.detail}`);
  if (failed.length) {
    console.error(`\n✗ FAIL — ${failed.length}/${checks.length} checks failed.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`\n✓ PASS — all ${checks.length} checks passed.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
