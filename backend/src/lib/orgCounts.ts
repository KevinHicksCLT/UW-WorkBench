import { prisma } from '../db/prisma.js';

// CANONICAL structural counts (gap backlog X1/X2): every screen that shows a
// role / value-stream headline figure reads THIS function, so one
// entity has one count app-wide. Definition: structural entities are the typed
// nodes of the unified Node tree.
export async function structureCounts(tenantId: string, companyId: string) {
  const [grouped, hidden] = await Promise.all([
    prisma.node.groupBy({ by: ['typeKey'], where: { companyId }, _count: { _all: true } }),
    // Nodes hidden from the UI (Node.attributes.hidden) don't count — every
    // headline figure must match what the rendering views show.
    prisma.node.groupBy({ by: ['typeKey'], where: { companyId, typeKey: { in: ['value_stream', 'role'] }, attributes: { path: ['hidden'], equals: true } }, _count: { _all: true } }),
  ]);
  const n: Record<string, number> = Object.fromEntries(grouped.map((g) => [g.typeKey, g._count._all]));
  const h: Record<string, number> = Object.fromEntries(hidden.map((g) => [g.typeKey, g._count._all]));
  return {
    segments: n.segment ?? 0,
    divisions: n.division ?? 0,
    departments: n.department ?? 0,
    roles: (n.role ?? 0) - (h.role ?? 0),
    valueStreams: (n.value_stream ?? 0) - (h.value_stream ?? 0),
    subProcesses: n.sub_process ?? 0,
    steps: n.step ?? 0,
    ioItems: n.io_item ?? 0,
    externalParties: n.external_party ?? 0,
  };
}
