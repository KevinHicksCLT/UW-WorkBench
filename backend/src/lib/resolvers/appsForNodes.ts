// appsForNodes — applications used at a batch of ProcessNodes via the NodeAppUsage
// junction (usageType = performed | memorialized). Replaces the legacy app-name
// matching + full-table loads.
import { prisma } from '../../db/prisma.js';
import { inChunks } from '../inChunks.js';

export interface NodeAppEntry {
  id: string;
  name: string;
  usageType: string; // "performed" | "memorialized"
}

/** Map<nodeId, NodeAppEntry[]> — applications used at each node. */
export async function appsForNodes(nodeIds: string[]): Promise<Map<string, NodeAppEntry[]>> {
  const ids = [...new Set(nodeIds.filter(Boolean))];
  const out = new Map<string, NodeAppEntry[]>();
  if (!ids.length) return out;
  const rows = await inChunks(ids, (chunk) =>
    prisma.nodeAppUsage.findMany({
      where: { processNodeId: { in: chunk } },
      select: {
        processNodeId: true,
        usageType: true,
        application: { select: { id: true, name: true } },
      },
    }),
  );
  for (const r of rows) {
    const entry: NodeAppEntry = {
      id: r.application.id,
      name: r.application.name,
      usageType: r.usageType,
    };
    const list = out.get(r.processNodeId);
    if (list) list.push(entry);
    else out.set(r.processNodeId, [entry]);
  }
  return out;
}
