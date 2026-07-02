// Phase 3 — erd_v5 master loader. Reads the prebuilt backend/data/seed/master_v5.json
// (produced by build_v5.py from the ABC v14 workbook) and loads the clean
// generic-graph operating-model spine into Postgres for one company:
//   level types → orgUnits → processNodes (5 passes) → closures (recursive CTE)
//   → roles/apps → per-task deliverables/checklists/testing → junctions.
//
// Follows the existing createMany → findMany → Map<key,id> → FK idiom (seed.ts),
// chunked for the 3811-node passes and the ~10k+ junction inserts (PG param limit).
//
// Runnable standalone (own main() → upserts Tenant + admin User + Company, then
// calls seedMaster, then disconnects) AND importable: seedMaster(prisma, {tenantId, companyId}).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const MASTER = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/master_v5.json');

// ── JSON shape (master_v5.json) ──
type LevelType = { levelNumber: number; dbValue: string; displayValue: string };
type NodeRec = {
  key: string; levelNumber: number; parentKey: string | null; dbValue: string;
  isTask: boolean; automatability: string | null; sortOrder: number | null; attributes: unknown;
};
type OrgRec = { key: string; levelNumber: number; parentKey: string | null; dbValue: string; sortOrder?: number | null };
type Master = {
  company: { dbValue: string; displayValue: string };
  processLevelTypes: LevelType[];
  orgLevelTypes: LevelType[];
  processNodes: NodeRec[];
  orgUnits: OrgRec[];
  roles: { dbValue: string }[];
  applications: { dbValue: string; kind: string | null }[];
  // Deliverables are now ONE-PER-L4 sub-process (keyed by the L4 path key);
  // title = the L4 sub-process name. The per-task workbook deliverable text lives
  // on the L5 task node (attributes.deliverable).
  deliverables: { l4Key: string; title: string; automatability: string | null }[];
  checklists: { taskKey: string; name: string; items: { text: string; sortOrder: number }[] }[];
  testing: { taskKey: string; l4Key: string | null; deliverableTitle: string | null; system: string | null; expected: string | null }[];
  nodeRole: { taskKey: string; roleDbValue: string; role: string; ownerLevel: string | null }[];
  nodeAppUsage: { taskKey: string; appDbValue: string; usageType: string }[];
  // Links each L4 deliverable to its L4 node AND every L5 task node under it.
  nodeDeliverable: { nodeKey: string; l4Key: string }[];
};

async function chunked<T>(rows: T[], fn: (c: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export async function seedMaster(
  prisma: PrismaClient,
  { companyId }: { tenantId: string; companyId: string }, // tenantId accepted for signature parity; unused
) {
  const m: Master = JSON.parse(readFileSync(MASTER, 'utf8'));
  const c = companyId;
  console.log('[seedMaster] loading', MASTER);

  // ── 1. Level types → Map by levelNumber ──
  await prisma.processLevelType.createMany({
    data: m.processLevelTypes.map((t) => ({ companyId: c, levelNumber: t.levelNumber, dbValue: t.dbValue, displayValue: t.displayValue })),
  });
  await prisma.orgLevelType.createMany({
    data: m.orgLevelTypes.map((t) => ({ companyId: c, levelNumber: t.levelNumber, dbValue: t.dbValue, displayValue: t.displayValue })),
  });
  const procLevelId = new Map(
    (await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } }))
      .map((t) => [t.levelNumber, t.id] as const),
  );
  const orgLevelId = new Map(
    (await prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } }))
      .map((t) => [t.levelNumber, t.id] as const),
  );

  // ── 2. OrgUnits (ascending by level, parent resolved per layer) ──
  const orgIdByKey = new Map<string, string>();
  const orgLevels = [...new Set(m.orgUnits.map((o) => o.levelNumber))].sort((a, b) => a - b);
  for (const lvl of orgLevels) {
    const layer = m.orgUnits.filter((o) => o.levelNumber === lvl);
    await prisma.orgUnit.createMany({
      data: layer.map((o, i) => ({
        companyId: c,
        orgLevelTypeId: orgLevelId.get(o.levelNumber)!,
        parentId: o.parentKey ? orgIdByKey.get(o.parentKey) ?? null : null,
        dbValue: o.dbValue,
        displayValue: o.dbValue,
        sortOrder: o.sortOrder ?? i,
      })),
    });
    // re-read this layer to capture ids by key (dbValue is unique within a layer here,
    // but key is the full path so we match on the (parent,dbValue) the createMany used)
    const rows = await prisma.orgUnit.findMany({
      where: { companyId: c, orgLevelTypeId: orgLevelId.get(lvl)! },
      select: { id: true, dbValue: true, parentId: true },
    });
    // build (parentId|dbValue) -> id, then map each json key
    const byPair = new Map(rows.map((r) => [`${r.parentId ?? ''}␟${r.dbValue}`, r.id] as const));
    for (const o of layer) {
      const pid = o.parentKey ? orgIdByKey.get(o.parentKey) ?? '' : '';
      orgIdByKey.set(o.key, byPair.get(`${pid}␟${o.dbValue}`)!);
    }
  }

  // ── 3. ProcessNodes (5 passes L1→L5, parent resolved per layer) ──
  const nodeIdByKey = new Map<string, string>();
  const procLevels = [...new Set(m.processNodes.map((n) => n.levelNumber))].sort((a, b) => a - b);
  for (const lvl of procLevels) {
    const layer = m.processNodes.filter((n) => n.levelNumber === lvl);
    await chunked(layer, (batch) =>
      prisma.processNode.createMany({
        data: batch.map((n) => ({
          companyId: c,
          processLevelTypeId: procLevelId.get(n.levelNumber)!,
          parentId: n.parentKey ? nodeIdByKey.get(n.parentKey) ?? null : null,
          dbValue: n.dbValue,
          displayValue: n.dbValue,
          isTask: !!n.isTask,
          automatability: n.automatability,
          sortOrder: Math.round(n.sortOrder ?? 0),
          code: n.key,
          attributes: (n.attributes ?? undefined) as object | undefined,
        })),
      }),
    );
    // code = json key (unique per company) → safe to map ids back by code
    const rows = await prisma.processNode.findMany({
      where: { companyId: c, processLevelTypeId: procLevelId.get(lvl)! },
      select: { id: true, code: true },
    });
    for (const r of rows) if (r.code) nodeIdByKey.set(r.code, r.id);
  }

  // ── 4. Build BOTH closures via one recursive CTE each (scoped to company) ──
  // self-rows (N,N,0) + every ancestor→descendant pair with its depth.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ProcessNodeClosure" ("ancestorId", "descendantId", "depth")
    WITH RECURSIVE cte AS (
      SELECT "id" AS "ancestorId", "id" AS "descendantId", 0 AS "depth"
        FROM "ProcessNode" WHERE "companyId" = $1
      UNION ALL
      SELECT cte."ancestorId", n."id", cte."depth" + 1
        FROM "ProcessNode" n
        JOIN cte ON n."parentId" = cte."descendantId"
       WHERE n."companyId" = $1
    )
    SELECT "ancestorId", "descendantId", "depth" FROM cte
  `, c);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "OrgUnitClosure" ("ancestorId", "descendantId", "depth")
    WITH RECURSIVE cte AS (
      SELECT "id" AS "ancestorId", "id" AS "descendantId", 0 AS "depth"
        FROM "OrgUnit" WHERE "companyId" = $1
      UNION ALL
      SELECT cte."ancestorId", u."id", cte."depth" + 1
        FROM "OrgUnit" u
        JOIN cte ON u."parentId" = cte."descendantId"
       WHERE u."companyId" = $1
    )
    SELECT "ancestorId", "descendantId", "depth" FROM cte
  `, c);

  // ── 5. Roles (257) → Map by dbValue ──
  await chunked(m.roles, (batch) =>
    prisma.role.createMany({ data: batch.map((r) => ({ companyId: c, dbValue: r.dbValue, displayValue: r.dbValue })) }),
  );
  const roleIdByDb = new Map(
    (await prisma.role.findMany({ where: { companyId: c }, select: { id: true, dbValue: true } }))
      .map((r) => [r.dbValue, r.id] as const),
  );

  // ── 6. Applications (65) → Map by dbValue (name = dbValue, kind from json or "Tool") ──
  await prisma.application.createMany({
    data: m.applications.map((a) => ({ companyId: c, name: a.dbValue, kind: a.kind ?? 'Tool' })),
  });
  const appIdByName = new Map(
    (await prisma.application.findMany({ where: { companyId: c }, select: { id: true, name: true } }))
      .map((a) => [a.name, a.id] as const),
  );

  // ── 7a. Deliverables (1 per L4 sub-process) → Map by l4Key ──
  // Deliverable.title (the L4 name) is not globally unique, so we can't map back
  // by title alone. Re-read all rows and distribute ids by (title) bucket in
  // m.deliverables iteration order: every deliverable id is consumed by exactly
  // one L4, and rows sharing a title are interchangeable, so the assignment is
  // well-defined.
  await chunked(m.deliverables, (batch) =>
    prisma.deliverable.createMany({ data: batch.map((d) => ({ companyId: c, title: d.title, automatability: d.automatability })) }),
  );
  const delivRows = await prisma.deliverable.findMany({ where: { companyId: c }, select: { id: true, title: true } });
  const delivByTitleBucket = new Map<string, string[]>();
  for (const r of delivRows) {
    if (!delivByTitleBucket.has(r.title)) delivByTitleBucket.set(r.title, []);
    delivByTitleBucket.get(r.title)!.push(r.id);
  }
  const delivIdByL4 = new Map<string, string>();
  for (const d of m.deliverables) {
    const bucket = delivByTitleBucket.get(d.title)!;
    // pop one id per occurrence (deterministic by L4 iteration order)
    const id = bucket.shift()!;
    delivIdByL4.set(d.l4Key, id);
  }
  // Resolve a task/node key → its owning L4 deliverable id (task keys are
  // `l1/l2/l3/l4/l5`; an L4 node key is its own l4Key). Used by testing + RoleDeliverable.
  const l4KeyOf = (nodeKey: string) => nodeKey.split('/').slice(0, 4).join('/');
  const delivIdForNode = (nodeKey: string) => delivIdByL4.get(l4KeyOf(nodeKey));

  // ── 7b. Checklists (1 per task) + their items ──
  await chunked(m.checklists, (batch) =>
    prisma.checklist.createMany({ data: batch.map((cl) => ({ companyId: c, name: cl.name })) }),
  );
  // Checklist.name == deliverable title (not unique). Pair back by name bucket in task order.
  const checklistRows = await prisma.checklist.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const clByNameBucket = new Map<string, string[]>();
  for (const r of checklistRows) {
    if (!clByNameBucket.has(r.name)) clByNameBucket.set(r.name, []);
    clByNameBucket.get(r.name)!.push(r.id);
  }
  const clIdByTask = new Map<string, string>();
  const checklistItemRows: { checklistId: string; text: string }[] = [];
  for (const cl of m.checklists) {
    const id = clByNameBucket.get(cl.name)!.shift()!;
    clIdByTask.set(cl.taskKey, id);
    for (const it of cl.items) checklistItemRows.push({ checklistId: id, text: it.text });
  }
  await chunked(checklistItemRows, (batch) => prisma.checklistItem.createMany({ data: batch }), 2000);

  // ── 7c. TestingTemplate (per task; deliverableId = the task's L4 deliverable, taskNodeId = node) ──
  const testingRows = m.testing.map((t) => ({
    deliverableId: (t.l4Key ? delivIdByL4.get(t.l4Key) : undefined) ?? delivIdForNode(t.taskKey)!,
    taskNodeId: nodeIdByKey.get(t.taskKey) ?? null,
    system: t.system,
    expected: t.expected,
  }));
  await chunked(testingRows, (batch) => prisma.testingTemplate.createMany({ data: batch }), 2000);

  // ── 8. Junctions (createMany skipDuplicates, chunked) ──
  // 8a. NodeDeliverable — links each L4 deliverable to its L4 node + every L5 task node.
  const nodeDelivRows = m.nodeDeliverable
    .map((nd) => ({
      companyId: c,
      processNodeId: nodeIdByKey.get(nd.nodeKey)!,
      deliverableId: delivIdByL4.get(nd.l4Key)!,
    }))
    .filter((r) => r.processNodeId && r.deliverableId);
  await chunked(nodeDelivRows, (batch) => prisma.nodeDeliverable.createMany({ data: batch, skipDuplicates: true }), 5000);

  // 8b. NodeRole (role_ = json.role, ownerLevel)
  const nodeRoleRows = m.nodeRole.map((nr) => ({
    companyId: c,
    processNodeId: nodeIdByKey.get(nr.taskKey)!,
    roleId: roleIdByDb.get(nr.roleDbValue)!,
    role_: nr.role,
    ownerLevel: nr.ownerLevel,
  }));
  await chunked(nodeRoleRows, (batch) => prisma.nodeRole.createMany({ data: batch, skipDuplicates: true }), 5000);

  // 8c. NodeAppUsage
  const nodeAppRows = m.nodeAppUsage.map((na) => ({
    companyId: c,
    processNodeId: nodeIdByKey.get(na.taskKey)!,
    applicationId: appIdByName.get(na.appDbValue)!,
    usageType: na.usageType,
  }));
  await chunked(nodeAppRows, (batch) => prisma.nodeAppUsage.createMany({ data: batch, skipDuplicates: true }), 5000);

  // 8d. NodeChecklist (link each checklist item to its task's node)
  const nodeChecklistRows: { companyId: string; processNodeId: string; checklistItemId: string }[] = [];
  {
    // re-read checklist items grouped by checklistId
    const items = await prisma.checklistItem.findMany({ where: { checklist: { companyId: c } }, select: { id: true, checklistId: true } });
    const itemsByChecklist = new Map<string, string[]>();
    for (const it of items) {
      if (!itemsByChecklist.has(it.checklistId)) itemsByChecklist.set(it.checklistId, []);
      itemsByChecklist.get(it.checklistId)!.push(it.id);
    }
    for (const [taskKey, clId] of clIdByTask) {
      const nodeId = nodeIdByKey.get(taskKey)!;
      for (const itemId of itemsByChecklist.get(clId) ?? []) {
        nodeChecklistRows.push({ companyId: c, processNodeId: nodeId, checklistItemId: itemId });
      }
    }
  }
  await chunked(nodeChecklistRows, (batch) => prisma.nodeChecklist.createMany({ data: batch, skipDuplicates: true }), 5000);

  // 8e. RoleDeliverable(Owner) — each task's Owner role → that task's L4 deliverable,
  // deduped to (roleId, L4 deliverable): a deliverable groups all the task-owners of
  // its L4 sub-process. (createMany skipDuplicates + the @@unique on
  // [roleId, deliverableId, role_] collapse the per-task duplicates.)
  const roleDelivSeen = new Set<string>(); // `${roleId}␟${delivId}` already queued
  const roleDelivRows: { companyId: string; roleId: string; deliverableId: string; role_: string }[] = [];
  for (const nr of m.nodeRole) {
    if (nr.role !== 'Owner') continue;
    const roleId = roleIdByDb.get(nr.roleDbValue);
    const delivId = delivIdForNode(nr.taskKey);
    if (!roleId || !delivId) continue;
    const k = `${roleId}␟${delivId}`;
    if (roleDelivSeen.has(k)) continue;
    roleDelivSeen.add(k);
    roleDelivRows.push({ companyId: c, roleId, deliverableId: delivId, role_: 'Owner' });
  }
  await chunked(roleDelivRows, (batch) => prisma.roleDeliverable.createMany({ data: batch, skipDuplicates: true }), 5000);

  console.log('[seedMaster] done');
}

// ── Standalone runner ──
async function main() {
  const prisma = new PrismaClient();
  try {
    const m: Master = JSON.parse(readFileSync(MASTER, 'utf8'));

    const tenant = await prisma.tenant.upsert({
      where: { slug: 'strata' }, update: {}, create: { name: 'Strata Demo', slug: 'strata' },
    });
    await prisma.user.upsert({
      where: { email: 'kevin.hicks@capgemini.com' }, update: {},
      create: {
        tenantId: tenant.id, email: 'kevin.hicks@capgemini.com', name: 'Kevin Hicks',
        password: await bcrypt.hash('demo1234', 10), role: 'ADMIN',
      },
    });

    // Greenfield single-company rebuild: drop the company's graph (FK-cascades) and rebuild.
    await prisma.company.deleteMany({ where: { tenantId: tenant.id } });
    const company = await prisma.company.create({
      // Slug is seed-time configuration (charter Task 1): override per company
      // via SEED_COMPANY_SLUG; default preserves the demo company.
      data: { tenantId: tenant.id, name: m.company.displayValue, slug: process.env.SEED_COMPANY_SLUG ?? 'abc-insurance', dbValue: m.company.dbValue, displayValue: m.company.displayValue },
    });

    await seedMaster(prisma, { tenantId: tenant.id, companyId: company.id });

    // ── Verify counts ──
    const c = company.id;
    const byLevel = await prisma.processNode.groupBy({ by: ['processLevelTypeId'], where: { companyId: c }, _count: true });
    const lvlName = new Map(
      (await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } }))
        .map((t) => [t.id, t.levelNumber] as const),
    );
    const levelCounts: Record<number, number> = {};
    for (const g of byLevel) levelCounts[lvlName.get(g.processLevelTypeId)!] = g._count;

    const counts = {
      processNodeL1: levelCounts[1] ?? 0,
      processNodeL2: levelCounts[2] ?? 0,
      processNodeL3: levelCounts[3] ?? 0,
      processNodeL4: levelCounts[4] ?? 0,
      processNodeL5: levelCounts[5] ?? 0,
      processNodeTotal: await prisma.processNode.count({ where: { companyId: c } }),
      orgUnit: await prisma.orgUnit.count({ where: { companyId: c } }),
      role: await prisma.role.count({ where: { companyId: c } }),
      application: await prisma.application.count({ where: { companyId: c } }),
      deliverable: await prisma.deliverable.count({ where: { companyId: c } }),
      checklistItem: await prisma.checklistItem.count({ where: { checklist: { companyId: c } } }),
      testingTemplate: await prisma.testingTemplate.count({ where: { deliverable: { companyId: c } } }),
      nodeRole: await prisma.nodeRole.count({ where: { companyId: c } }),
      nodeAppUsage: await prisma.nodeAppUsage.count({ where: { companyId: c } }),
      nodeDeliverable: await prisma.nodeDeliverable.count({ where: { companyId: c } }),
      roleDeliverable: await prisma.roleDeliverable.count({ where: { companyId: c } }),
      nodeChecklist: await prisma.nodeChecklist.count({ where: { companyId: c } }),
      processNodeClosure: await prisma.processNodeClosure.count({ where: { ancestor: { companyId: c } } }),
      orgUnitClosure: await prisma.orgUnitClosure.count({ where: { ancestor: { companyId: c } } }),
    };

    // Deliverable is now ONE-PER-L4 (867 here; ~870 after decompose-single-child
    // in the full orchestrator). nodeDeliverable = deliverables + tasks (L4 self
    // + per-task links). TestingTemplate stays per-task (3811). RoleDeliverable is
    // deduped to (owner role, L4 deliverable) so it's left as a soft (no-expected) count.
    const expected: Record<string, number> = {
      processNodeL1: 3, processNodeL2: 17, processNodeL3: 135, processNodeL4: 867, processNodeL5: 3811,
      processNodeTotal: 4833, orgUnit: 20, role: 257, application: 65, deliverable: 867,
      checklistItem: 15090, testingTemplate: 3811, nodeRole: 10218, nodeAppUsage: 7792, nodeDeliverable: 4678,
    };
    console.log('\n── Seed verification ──');
    let ok = true;
    for (const [k, v] of Object.entries(counts)) {
      const exp = expected[k];
      const mark = exp === undefined ? '  ' : v === exp ? 'OK' : 'XX';
      if (exp !== undefined && v !== exp) ok = false;
      console.log(`${mark}  ${k.padEnd(20)} ${String(v).padStart(7)}${exp !== undefined ? `  (expected ${exp})` : ''}`);
    }
    const closuresOk = counts.processNodeClosure > counts.processNodeTotal && counts.orgUnitClosure > counts.orgUnit;
    console.log(`${closuresOk ? 'OK' : 'XX'}  closures > nodes        PNC=${counts.processNodeClosure} > ${counts.processNodeTotal}, OUC=${counts.orgUnitClosure} > ${counts.orgUnit}`);
    console.log(ok && closuresOk ? '\nALL COUNTS MATCH' : '\nCOUNT MISMATCH — see XX above');
  } finally {
    await prisma.$disconnect();
  }
}

// Run when invoked directly (tsx src/seed/seedMaster.ts).
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
