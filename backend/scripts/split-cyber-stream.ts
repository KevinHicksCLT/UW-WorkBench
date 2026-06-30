// User 2026-06-17 — split the bundled "Cybersecurity, Identity & Resilience"
// value stream into three, by L3 ownership (CISO threat ops vs IAM vs the
// DORA-driven operational-resilience function):
//   • Cybersecurity & Threat Management  (KEEP — source row renamed)
//       Security Design, Threat & Vulnerability Management, Threat Detection & Response
//   • Identity & Access Management        (NEW)  ← Identity Management
//   • Operational Resilience & Continuity (NEW)  ← Resilience & Recovery
//
// Mirrors split-value-streams.ts: repartitions the models the live surfaces read
// — ValueStream + SubValueStream (VS page), Node graph value_stream/sub_process/
// step (map + Home counts), and the denormalized ProcessStep/IoItem/Metric +
// RoleValueStream links. The Level tree is the legacy admin catalog (the map and
// dashboard counts read the Node graph) — only its stream-level (level-3) row is
// added, matching how separate-process-areas.ts treats it.
//
// Idempotent: a split whose source name is gone (already applied) is skipped.
//   npx tsx scripts/split-cyber-stream.ts
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE = 'Cybersecurity, Identity & Resilience';
type Target = { name: string; keep?: boolean; l3s: string[] };
const TARGETS: Target[] = [
  { name: 'Cybersecurity & Threat Management', keep: true, l3s: ['Security Design', 'Threat & Vulnerability Management', 'Threat Detection & Response'] },
  { name: 'Identity & Access Management', l3s: ['Identity Management'] },
  { name: 'Operational Resilience & Continuity', l3s: ['Resilience & Recovery'] },
];

const covers = (sub: string | null, l3: string) =>
  !!sub && (sub === l3 || sub.startsWith(l3 + ' ') || sub.startsWith(l3 + '—') || sub.startsWith(l3 + ' —'));

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  await prisma.$transaction(async (tx) => {
    const src = await tx.valueStream.findFirst({ where: { companyId, name: SOURCE }, select: { id: true, domainId: true, domain: true } });
    if (!src) { console.log(`SKIP (already applied / not found): ${SOURCE}`); return; }
    const srcNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: src.id }, select: { id: true, parentId: true } });
    const srcLevel = await tx.level.findFirst({ where: { companyId, levelNumber: 3, name: SOURCE }, select: { id: true, parentId: true } });

    for (const t of TARGETS) {
      let destVsId: string, destNodeId: string | null;
      if (t.keep) {
        destVsId = src.id; destNodeId = srcNode?.id ?? null;
        await tx.valueStream.update({ where: { id: src.id }, data: { name: t.name } });
        if (srcNode) await tx.node.update({ where: { id: srcNode.id }, data: { name: t.name } });
        if (srcLevel) await tx.level.update({ where: { id: srcLevel.id }, data: { name: t.name } });
        continue; // keep target's children already point at src
      }
      const nv = await tx.valueStream.create({ data: { tenantId, companyId, name: t.name, domainId: src.domainId, domain: src.domain } });
      destVsId = nv.id;
      const last = await tx.node.findFirst({ where: { parentId: srcNode?.parentId ?? undefined, typeKey: 'value_stream' }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      destNodeId = srcNode ? (await tx.node.create({ data: { companyId, typeKey: 'value_stream', name: t.name, code: nv.id, parentId: srcNode.parentId, provenance: 'real', sortOrder: (last?.sortOrder ?? -1) + 1 } })).id : null;
      if (srcLevel) await tx.level.create({ data: { tenantId, companyId, levelNumber: 3, name: t.name, parentId: srcLevel.parentId, sourceType: 'catalog' } });

      // Move the L3 subtree (L3 + its L4 + L5) for each named L3.
      const l3rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 3, name: { in: t.l3s } }, select: { id: true } });
      const l3ids = l3rows.map((r) => r.id);
      const l4rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 4, parentId: { in: l3ids } }, select: { id: true } });
      const l4ids = l4rows.map((r) => r.id);
      const l5rows = await tx.subValueStream.findMany({ where: { valueStreamId: src.id, level: 5, parentId: { in: l4ids } }, select: { id: true } });
      const moveIds = [...l3ids, ...l4ids, ...l5rows.map((r) => r.id)];
      if (moveIds.length) await tx.subValueStream.updateMany({ where: { id: { in: moveIds } }, data: { valueStreamId: destVsId } });

      // Denormalized rows keyed by (valueStreamId, l3 name).
      await tx.processStep.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });
      await tx.ioItem.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });
      await tx.metric.updateMany({ where: { valueStreamId: src.id, l3: { in: t.l3s } }, data: { valueStreamId: destVsId } });

      // RoleValueStream links whose subStream is one of these L3s.
      const rvs = await tx.roleValueStream.findMany({ where: { valueStreamId: src.id }, select: { id: true, subStream: true } });
      for (const r of rvs.filter((r) => t.l3s.some((l3) => covers(r.subStream, l3)))) {
        try { await tx.roleValueStream.update({ where: { id: r.id }, data: { valueStreamId: destVsId } }); }
        catch (e) { if ((e as { code?: string }).code !== 'P2002') throw e; }
      }

      // Re-parent the moved L4 sub_process nodes to the dest value_stream node
      // (their step-node children follow via parentId).
      if (destNodeId && l4ids.length) {
        await tx.node.updateMany({ where: { companyId, typeKey: 'sub_process', code: { in: l4ids } }, data: { parentId: destNodeId } });
      }
      console.log(`+ ${t.name}  (L3: ${t.l3s.join(', ')})`);
    }
    console.log(`Split "${SOURCE}" → ${TARGETS.map((t) => t.name).join(' | ')}`);
  }, { timeout: 60000, maxWait: 15000 });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
