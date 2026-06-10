import { prisma } from '../db/prisma.js';

// ─── Derived-node sync ──────────────────────────────────────────────────
// The unified Node graph carries a DERIVED copy of each level-4 SubValueStream
// row (typeKey 'sub_process', Node.code = SubValueStream.id, detail columns
// mirrored into Node.attributes) — built by scripts/backfill-nodes.ts. The
// SubValueStream table is the source of truth the L4 sidebar/drawer read, so an
// admin edit must also refresh the node copy or the map/builder go stale until
// the next full backfill. Failures are logged, never thrown — a stale derived
// node must not fail the admin write (same posture as logAudit).

type SvsRow = {
  id: string; name: string; level: number; parentId: string | null; valueStreamId: string;
  inputs: string | null; outputs: string | null; upstream: string | null;
  downstream: string | null; notes: string | null;
};

// Same attribute shape backfill-nodes.ts writes for sub_process nodes.
async function subProcessAttributes(row: SvsRow) {
  const l3 = row.parentId
    ? await prisma.subValueStream.findUnique({ where: { id: row.parentId }, select: { name: true, level: true } })
    : null;
  return {
    processArea: l3 && l3.level === 3 ? l3.name : null,
    inputs: row.inputs, outputs: row.outputs, upstream: row.upstream, downstream: row.downstream, notes: row.notes,
  };
}

export async function syncSubProcessNode(action: 'CREATE' | 'UPDATE' | 'DELETE', row: SvsRow) {
  try {
    const existing = await prisma.node.findFirst({ where: { typeKey: 'sub_process', code: row.id }, select: { id: true } });

    // Deleted, or no longer a level-4 sub-process → the derived node goes too.
    if (action === 'DELETE' || row.level !== 4) {
      if (existing) await prisma.node.delete({ where: { id: existing.id } });
      return;
    }

    const attributes = await subProcessAttributes(row);
    if (existing) {
      await prisma.node.update({ where: { id: existing.id }, data: { name: row.name, attributes } });
      return;
    }

    // New level-4 row → create its node under the stream's value_stream node.
    const vsNode = await prisma.node.findFirst({
      where: { typeKey: 'value_stream', code: row.valueStreamId },
      select: { id: true, companyId: true },
    });
    if (!vsNode) return; // stream not in the node graph (no backfill yet) — nothing to sync
    const last = await prisma.node.findFirst({
      where: { parentId: vsNode.id, typeKey: 'sub_process' },
      orderBy: { sortOrder: 'desc' }, select: { sortOrder: true },
    });
    await prisma.node.create({
      data: {
        companyId: vsNode.companyId, typeKey: 'sub_process', name: row.name, code: row.id,
        parentId: vsNode.id, provenance: 'real', sortOrder: (last?.sortOrder ?? -1) + 1, attributes,
      },
    });
  } catch (e) {
    console.error('syncSubProcessNode failed', e);
  }
}
