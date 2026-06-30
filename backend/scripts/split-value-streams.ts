// VS-01..VS-07 — hard-split the seven bundled value streams (LARGE-insurer
// decision). Each split repartitions THREE parallel models so they stay
// consistent (dashboard reads the Level tree; the map reads the Node graph; the
// VS page reads ValueStream/SubValueStream):
//   1. ValueStream + SubValueStream (L3/L4/L5, valueStreamId FK)
//   2. Node graph: value_stream nodes (code=VS.id) + sub_process nodes (L4, code=SVS.id)
//   3. Level tree: levelNumber 3 = value stream (by name), 4 = sub-process (sourceRefId=code)
//
// Per split: the FIRST target is the "keep" target — the source row is renamed to
// it (so id-keyed links: requirements/apps/role links follow). Other targets are
// NEW streams; one target may FOLD into an existing stream (`into`). L3s move by
// SubValueStream name; Level-L4 nodes move by code.
//
// Idempotent: a split whose source name no longer exists (already applied) is
// skipped. Transaction per split. Run from backend/:
//   npx tsx scripts/split-value-streams.ts
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Target = { name: string; keep?: boolean; into?: string; l3s: string[]; l4codes: string[] };
type Split = { source: string; targets: Target[] };

const SPLITS: Split[] = [
  {
    source: 'Actuarial Pricing, Reserving & Capital Modeling',
    targets: [
      { name: 'Actuarial Pricing', keep: true, l3s: ['Pricing Analytics', 'Performance Monitoring'], l4codes: ['RF-21-01', 'RF-21-04'] },
      { name: 'Actuarial Reserving', l3s: ['Reserving', 'Life & Annuity Valuation'], l4codes: ['RF-21-02'] },
      { name: 'Actuarial Capital Modeling', l3s: ['Capital Modeling'], l4codes: ['RF-21-03'] },
    ],
  },
  {
    source: 'Finance, Treasury & Capital Management',
    targets: [
      { name: 'Finance & Accounting', keep: true, l3s: ['Record to Report', 'Planning & Forecasting'], l4codes: ['F-11-01', 'F-11-02'] },
      { name: 'Treasury & Liquidity', l3s: ['Treasury & Liquidity'], l4codes: ['F-11-03'] },
      { name: 'Capital Management', l3s: ['Capital, Tax & Regulatory'], l4codes: ['F-11-04'] },
    ],
  },
  {
    source: 'Legal, Governance & Privacy Management',
    targets: [
      { name: 'Legal & Governance', keep: true, l3s: ['Governance Administration', 'Commercial Legal Support', 'Dispute & Regulatory Response'], l4codes: ['CS-08-01', 'CS-08-02', 'CS-08-04'] },
      { name: 'Privacy & Data Protection', l3s: ['Privacy & Data Advice'], l4codes: ['CS-08-03'] },
    ],
  },
  {
    source: 'Risk, Compliance & Regulatory Management',
    targets: [
      { name: 'Compliance & Regulatory', keep: true, l3s: ['Incident & Regulatory Response', 'Remediation & Reporting'], l4codes: ['RC-20-02', 'RC-20-03', 'RC-20-04'] },
      { name: 'Risk Management', l3s: ['Risk Identification', 'Control Monitoring'], l4codes: ['RC-20-01'] },
    ],
  },
  {
    source: 'Data, Analytics & AI Management',
    targets: [
      { name: 'Data Management & Governance', keep: true, l3s: ['Data Product Intake', 'Governance & Quality', 'Privacy & Access'], l4codes: ['TD-24-01', 'TD-24-02', 'TD-24-04'] },
      { name: 'Analytics & AI', l3s: ['Analytics & AI Delivery'], l4codes: ['TD-24-03'] },
    ],
  },
  {
    source: 'Technology Strategy, Architecture & Delivery',
    targets: [
      { name: 'Technology Strategy & Architecture', keep: true, l3s: ['Technology Roadmapping', 'Architecture Design', 'Platform Governance'], l4codes: ['T-23-01', 'T-23-02', 'T-23-03'] },
      { name: 'Technology Delivery & Change', into: 'Technology Delivery & Change', l3s: ['Delivery Assurance'], l4codes: ['T-23-04'] },
    ],
  },
  {
    source: 'Customer Service, Complaints & Experience',
    targets: [
      { name: 'Customer Service & Experience', keep: true, l3s: ['Interaction Intake', 'Case Resolution', 'Voice of Customer'], l4codes: ['OC-14-01', 'OC-14-02', 'OC-14-04'] },
      { name: 'Complaints Management', l3s: ['Complaint Escalation'], l4codes: ['OC-14-03'] },
    ],
  },
];

const covers = (sub: string | null, l3: string) =>
  !!sub && (sub === l3 || sub.startsWith(l3 + ' ') || sub.startsWith(l3 + '—'));

async function applySplit(tx: Prisma.TransactionClient, companyId: string, tenantId: string, split: Split) {
  const src = await tx.valueStream.findFirst({ where: { companyId, name: split.source }, select: { id: true, domainId: true, domain: true } });
  if (!src) { console.log(`SKIP (already applied / not found): ${split.source}`); return 0; }
  const srcNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: src.id }, select: { id: true, parentId: true } });
  const srcLevel = await tx.level.findFirst({ where: { companyId, levelNumber: 3, name: split.source }, select: { id: true, parentId: true } });

  let newStreams = 0;
  for (const t of split.targets) {
    // Resolve destination VS / node / level.
    let destVsId: string, destNodeId: string | null, destLevelId: string | null;
    if (t.keep) {
      destVsId = src.id; destNodeId = srcNode?.id ?? null; destLevelId = srcLevel?.id ?? null;
      await tx.valueStream.update({ where: { id: src.id }, data: { name: t.name } });
      if (srcNode) await tx.node.update({ where: { id: srcNode.id }, data: { name: t.name } });
      if (srcLevel) await tx.level.update({ where: { id: srcLevel.id }, data: { name: t.name } });
    } else if (t.into) {
      const ex = await tx.valueStream.findFirst({ where: { companyId, name: t.into }, select: { id: true } });
      if (!ex) throw new Error(`fold target not found: ${t.into}`);
      destVsId = ex.id;
      destNodeId = (await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: ex.id }, select: { id: true } }))?.id ?? null;
      destLevelId = (await tx.level.findFirst({ where: { companyId, levelNumber: 3, name: t.into }, select: { id: true } }))?.id ?? null;
    } else {
      const nv = await tx.valueStream.create({ data: { tenantId, companyId, name: t.name, domainId: src.domainId, domain: src.domain } });
      destVsId = nv.id;
      const last = await tx.node.findFirst({ where: { parentId: srcNode?.parentId ?? undefined, typeKey: 'value_stream' }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      destNodeId = srcNode ? (await tx.node.create({ data: { companyId, typeKey: 'value_stream', name: t.name, code: nv.id, parentId: srcNode.parentId, provenance: 'real', sortOrder: (last?.sortOrder ?? -1) + 1 } })).id : null;
      destLevelId = srcLevel ? (await tx.level.create({ data: { tenantId, companyId, levelNumber: 3, name: t.name, parentId: srcLevel.parentId, sourceType: 'catalog' } })).id : null;
      newStreams++;
    }
    if (t.keep) continue; // keep target's children already point at src — nothing to move

    // ── Move SubValueStream subtree (L3 + L4 + L5) for this target's L3s ──────
    const l3rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 3, name: { in: t.l3s } }, select: { id: true } });
    const l3ids = l3rows.map((r) => r.id);
    const l4rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 4, parentId: { in: l3ids } }, select: { id: true } });
    const l4ids = l4rows.map((r) => r.id);
    const l5rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 5, parentId: { in: l4ids } }, select: { id: true } });
    const moveSvsIds = [...l3ids, ...l4ids, ...l5rows.map((r) => r.id)];
    if (moveSvsIds.length) await tx.subValueStream.updateMany({ where: { id: { in: moveSvsIds } }, data: { valueStreamId: destVsId } });

    // ── Move denormalized rows keyed by (valueStreamId, l3 name) ─────────────
    await tx.processStep.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });
    await tx.ioItem.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });
    await tx.metric.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });

    // ── Move RoleValueStream links whose subStream is one of these L3s ───────
    const rvs = await tx.roleValueStream.findMany({ where: { valueStreamId: src.id }, select: { id: true, subStream: true } });
    const moveRvs = rvs.filter((r) => t.l3s.some((l3) => covers(r.subStream, l3))).map((r) => r.id);
    // updateMany can't move into a row that would violate the unique
    // (roleId,valueStreamId,subStream) — but destVsId is new/different, so safe.
    for (const id of moveRvs) {
      try { await tx.roleValueStream.update({ where: { id }, data: { valueStreamId: destVsId } }); }
      catch (e) { if ((e as { code?: string }).code !== 'P2002') throw e; }
    }

    // ── Re-parent the moved L4 sub_process nodes to the dest value_stream node ─
    if (destNodeId && l4ids.length) {
      await tx.node.updateMany({ where: { companyId, typeKey: 'sub_process', code: { in: l4ids } }, data: { parentId: destNodeId } });
    }
    // ── Re-parent the Level-tree L4 rows (by code) to the dest Level-L3 ───────
    if (destLevelId && t.l4codes.length) {
      await tx.level.updateMany({ where: { companyId, levelNumber: 4, sourceRefId: { in: t.l4codes } }, data: { parentId: destLevelId } });
    }
  }
  console.log(`Split "${split.source}" → ${split.targets.map((t) => t.name).join(' | ')} (${newStreams} new streams)`);
  return newStreams;
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  let total = 0;
  for (const split of SPLITS) {
    total += await prisma.$transaction((tx) => applySplit(tx, company.id, company.tenantId, split), { timeout: 60000, maxWait: 15000 });
  }
  console.log(`Done. Created ${total} new value streams.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
