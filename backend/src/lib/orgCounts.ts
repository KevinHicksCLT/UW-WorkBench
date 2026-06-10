import { prisma } from '../db/prisma.js';

// CANONICAL structural counts (gap backlog X1/X2): every screen that shows a
// role / people / value-stream headline figure reads THIS function, so one
// entity has one count app-wide. Definition: structural entities are the typed
// nodes of the unified Node tree; people is the whole Person table for the
// company (assigned or not — the org table renders any unassigned remainder in
// an explicit bucket rather than dropping it).
export async function structureCounts(tenantId: string, companyId: string) {
  const [grouped, people] = await Promise.all([
    prisma.node.groupBy({ by: ['typeKey'], where: { companyId }, _count: { _all: true } }),
    prisma.person.count({ where: { tenantId, companyId } }),
  ]);
  const n: Record<string, number> = Object.fromEntries(grouped.map((g) => [g.typeKey, g._count._all]));
  return {
    segments: n.segment ?? 0,
    divisions: n.division ?? 0,
    departments: n.department ?? 0,
    roles: n.role ?? 0,
    valueStreams: n.value_stream ?? 0,
    subProcesses: n.sub_process ?? 0,
    steps: n.step ?? 0,
    ioItems: n.io_item ?? 0,
    externalParties: n.external_party ?? 0,
    people,
  };
}
