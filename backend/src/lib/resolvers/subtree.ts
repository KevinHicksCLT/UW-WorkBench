// subtree — fast subtree expansion off the closure tables, replacing recursive
// CTEs and the in-memory parent→child tree-walks. Given a root node id it returns
// the descendant nodes (optionally bounded by depth), ordered by (depth, sortOrder),
// plus a Map<nodeId, depth>. Depth 0 = the root itself.
import { prisma } from '../../db/prisma.js';
import { inChunks } from '../inChunks.js';

export interface SubtreeOptions {
  /** Minimum closure depth (inclusive). Default 0 (includes the root). */
  minDepth?: number;
  /** Maximum closure depth (inclusive). Default unbounded. */
  maxDepth?: number;
  /** Exclude the root row (depth 0). Shorthand for minDepth>=1. Default false. */
  excludeSelf?: boolean;
}

export interface ProcessSubtreeNode {
  id: string;
  parentId: string | null;
  dbValue: string;
  displayValue: string;
  processLevelTypeId: string;
  isTask: boolean;
  sortOrder: number;
  automatability: string | null;
  depth: number;
}

export interface OrgSubtreeNode {
  id: string;
  parentId: string | null;
  dbValue: string;
  displayValue: string;
  orgLevelTypeId: string;
  sortOrder: number;
  depth: number;
}

interface ClosureRow {
  descendantId: string;
  depth: number;
}

function depthRange(opts: SubtreeOptions): { min: number; max: number | null } {
  let min = opts.minDepth ?? 0;
  if (opts.excludeSelf && min < 1) min = 1;
  const max = opts.maxDepth ?? null;
  return { min, max };
}

/** Descendant ProcessNodes of `rootId` (via ProcessNodeClosure), depth-ordered. */
export async function processSubtree(
  rootId: string,
  opts: SubtreeOptions = {},
): Promise<{ nodes: ProcessSubtreeNode[]; depthById: Map<string, number> }> {
  const { min, max } = depthRange(opts);
  const edges = await prisma.processNodeClosure.findMany({
    where: { ancestorId: rootId, depth: { gte: min, ...(max != null ? { lte: max } : {}) } },
    select: { descendantId: true, depth: true },
  });
  return assembleProcess(edges);
}

/**
 * Batched processSubtree: descendant ProcessNodes for MANY roots in a fixed two
 * queries (one closure read across all roots, one node read for all descendants),
 * instead of two queries per root. Returns Map<rootId, {nodes, depthById}> with
 * each root's nodes depth-ordered exactly as processSubtree() would. A node belongs
 * to exactly one root (tree), so descendants never collide across buckets.
 */
export async function processSubtrees(
  rootIds: string[],
  opts: SubtreeOptions = {},
): Promise<Map<string, { nodes: ProcessSubtreeNode[]; depthById: Map<string, number> }>> {
  const out = new Map<string, { nodes: ProcessSubtreeNode[]; depthById: Map<string, number> }>();
  const ids = [...new Set(rootIds.filter(Boolean))];
  for (const id of ids) out.set(id, { nodes: [], depthById: new Map() });
  if (!ids.length) return out;

  const { min, max } = depthRange(opts);
  const edges = await prisma.processNodeClosure.findMany({
    where: { ancestorId: { in: ids }, depth: { gte: min, ...(max != null ? { lte: max } : {}) } },
    select: { ancestorId: true, descendantId: true, depth: true },
  });
  if (!edges.length) return out;

  const allDesc = [...new Set(edges.map((e) => e.descendantId))];
  const rows = await inChunks(allDesc, (chunk) =>
    prisma.processNode.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        parentId: true,
        dbValue: true,
        displayValue: true,
        processLevelTypeId: true,
        isTask: true,
        sortOrder: true,
        automatability: true,
      },
    }),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const e of edges) {
    const node = byId.get(e.descendantId);
    const bucket = out.get(e.ancestorId);
    if (!node || !bucket) continue;
    bucket.depthById.set(e.descendantId, e.depth);
    bucket.nodes.push({ ...node, depth: e.depth });
  }
  for (const bucket of out.values()) {
    bucket.nodes.sort(
      (a, b) =>
        a.depth - b.depth || a.sortOrder - b.sortOrder || a.dbValue.localeCompare(b.dbValue),
    );
  }
  return out;
}

async function assembleProcess(
  edges: ClosureRow[],
): Promise<{ nodes: ProcessSubtreeNode[]; depthById: Map<string, number> }> {
  const depthById = new Map(edges.map((e) => [e.descendantId, e.depth] as const));
  if (!depthById.size) return { nodes: [], depthById };
  const rows = await inChunks([...depthById.keys()], (chunk) =>
    prisma.processNode.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        parentId: true,
        dbValue: true,
        displayValue: true,
        processLevelTypeId: true,
        isTask: true,
        sortOrder: true,
        automatability: true,
      },
    }),
  );
  const nodes: ProcessSubtreeNode[] = rows.map((r) => ({ ...r, depth: depthById.get(r.id)! }));
  nodes.sort(
    (a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.dbValue.localeCompare(b.dbValue),
  );
  return { nodes, depthById };
}

/** Descendant OrgUnits of `rootId` (via OrgUnitClosure), depth-ordered. */
export async function orgSubtree(
  rootId: string,
  opts: SubtreeOptions = {},
): Promise<{ nodes: OrgSubtreeNode[]; depthById: Map<string, number> }> {
  const { min, max } = depthRange(opts);
  const edges = await prisma.orgUnitClosure.findMany({
    where: { ancestorId: rootId, depth: { gte: min, ...(max != null ? { lte: max } : {}) } },
    select: { descendantId: true, depth: true },
  });
  const depthById = new Map(edges.map((e) => [e.descendantId, e.depth] as const));
  if (!depthById.size) return { nodes: [], depthById };
  const rows = await inChunks([...depthById.keys()], (chunk) =>
    prisma.orgUnit.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        parentId: true,
        dbValue: true,
        displayValue: true,
        orgLevelTypeId: true,
        sortOrder: true,
      },
    }),
  );
  const nodes: OrgSubtreeNode[] = rows.map((r) => ({ ...r, depth: depthById.get(r.id)! }));
  nodes.sort(
    (a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.dbValue.localeCompare(b.dbValue),
  );
  return { nodes, depthById };
}
