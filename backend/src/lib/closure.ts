// closure.ts — transactional closure-table maintenance for the two level-typed
// trees (ProcessNode + OrgUnit). The closure tables store, for every node, one
// row per (ancestor, descendant, depth) pair — including the self-row (N,N,0).
// Subtree reads (resolvers/subtree.ts) depend on these rows being correct, so any
// runtime tree edit MUST update the closure inside the same transaction as the
// parentId change. All mutations here run in a single `prisma.$transaction`, so a
// thrown error rolls the whole edit back; the node table and the closure can never
// drift apart on a half-applied write.
//
// All SQL uses the quoted Prisma table names ("ProcessNode" / "ProcessNodeClosure"
// etc.) via $executeRawUnsafe with the table identifiers interpolated from a fixed
// allow-list (never user input) and all *values* passed as bound parameters.
import { prisma } from '../db/prisma.js';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface Tables {
  /** Quoted node table, e.g. "ProcessNode". */
  node: '"ProcessNode"' | '"OrgUnit"';
  /** Quoted closure table, e.g. "ProcessNodeClosure". */
  closure: '"ProcessNodeClosure"' | '"OrgUnitClosure"';
  /** Quoted level-type FK column, e.g. "processLevelTypeId". */
  levelFk: '"processLevelTypeId"' | '"orgLevelTypeId"';
}

const PROCESS: Tables = { node: '"ProcessNode"', closure: '"ProcessNodeClosure"', levelFk: '"processLevelTypeId"' };
const ORG: Tables = { node: '"OrgUnit"', closure: '"OrgUnitClosure"', levelFk: '"orgLevelTypeId"' };
const TABLES_FOR = (spine: 'processNode' | 'orgUnit'): Tables => (spine === 'processNode' ? PROCESS : ORG);

// ── Primitive closure operations (run on a given tx + table pair) ────────────

/**
 * Insert closure rows for a brand-new leaf `nodeId` whose parent is `parentId`.
 * - self-row (nodeId, nodeId, 0)
 * - for every ancestor A of the parent (including the parent itself), a row
 *   (A, nodeId, depth(A→parent)+1).
 * If parentId is null the node is a root → only the self-row is written.
 * The node's own parentId column is assumed already set by the caller (create()).
 */
async function insertNodeTx(tx: Tx, t: Tables, nodeId: string, parentId: string | null): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${t.closure} ("ancestorId", "descendantId", "depth") VALUES ($1, $1, 0)`,
    nodeId,
  );
  if (parentId) {
    await tx.$executeRawUnsafe(
      `INSERT INTO ${t.closure} ("ancestorId", "descendantId", "depth")
         SELECT c."ancestorId", $1, c."depth" + 1
           FROM ${t.closure} c
          WHERE c."descendantId" = $2`,
      nodeId,
      parentId,
    );
  }
}

/**
 * Move the subtree rooted at `nodeId` under `newParentId` (null → make it a root),
 * keeping the closure consistent. Internal subtree edges (ancestor & descendant
 * both inside the subtree) are invariant and untouched.
 *  (a) delete the cross-edges that link any *external* ancestor to any subtree node;
 *  (b) re-create them against the new parent's ancestor chain;
 *  (c) update the node's own parentId.
 */
async function moveSubtreeTx(tx: Tx, t: Tables, nodeId: string, newParentId: string | null): Promise<void> {
  // (a) Drop every edge whose descendant is inside the subtree but whose ancestor
  //     is NOT — i.e. the old links into the subtree from above.
  await tx.$executeRawUnsafe(
    `DELETE FROM ${t.closure}
       WHERE "descendantId" IN (SELECT "descendantId" FROM ${t.closure} WHERE "ancestorId" = $1)
         AND "ancestorId" NOT IN (SELECT "descendantId" FROM ${t.closure} WHERE "ancestorId" = $1)`,
    nodeId,
  );
  // (b) Re-link: for each ancestor A of the new parent (a.descendantId = newParentId)
  //     and each descendant D inside the subtree (d.ancestorId = nodeId), insert
  //     (A, D, depth(A→newParent) + depth(nodeId→D) + 1).
  if (newParentId) {
    await tx.$executeRawUnsafe(
      `INSERT INTO ${t.closure} ("ancestorId", "descendantId", "depth")
         SELECT a."ancestorId", d."descendantId", a."depth" + d."depth" + 1
           FROM ${t.closure} a
           CROSS JOIN ${t.closure} d
          WHERE a."descendantId" = $1
            AND d."ancestorId" = $2`,
      newParentId,
      nodeId,
    );
  }
  // (c) Persist the node's new parent.
  await tx.$executeRawUnsafe(
    `UPDATE ${t.node} SET "parentId" = $1 WHERE "id" = $2`,
    newParentId,
    nodeId,
  );
}

/**
 * Re-level the moved ProcessNode subtree: rewrite `processLevelTypeId` for every
 * node in the subtree by its depth below `nodeId`. `levelByDepth` maps the relative
 * depth (0 = the moved node itself) → the target `ProcessLevelType.id`. The ids are
 * allow-listed by the caller (resolved from the company's level types) and bound as
 * parameters — never interpolated. One UPDATE per distinct depth (≤ tree height).
 */
async function relevelSubtreeTx(tx: Tx, t: Tables, nodeId: string, levelByDepth: Map<number, string>): Promise<void> {
  for (const [depth, ltId] of levelByDepth) {
    await tx.$executeRawUnsafe(
      `UPDATE ${t.node} SET ${t.levelFk} = $1
         WHERE "id" IN (
           SELECT "descendantId" FROM ${t.closure} WHERE "ancestorId" = $2 AND "depth" = $3
         )`,
      ltId, nodeId, depth,
    );
  }
}

/**
 * Move a subtree and (optionally) re-level it, on a caller-supplied tx — so several
 * edits can share one transaction (the canvas's batched Save). Works on either spine
 * (ProcessNode / OrgUnit). When `levelByDepth` is empty the level is unchanged.
 */
export async function moveSubtreeWithRelevelTx(
  tx: Tx, spine: 'processNode' | 'orgUnit', nodeId: string, newParentId: string | null, levelByDepth?: Map<number, string>,
): Promise<void> {
  const t = TABLES_FOR(spine);
  await moveSubtreeTx(tx, t, nodeId, newParentId);
  if (levelByDepth && levelByDepth.size) await relevelSubtreeTx(tx, t, nodeId, levelByDepth);
}

/** Back-compat process-only alias (kept for existing callers). */
export const moveProcessSubtreeTx = (tx: Tx, nodeId: string, newParentId: string | null, levelByDepth?: Map<number, string>) =>
  moveSubtreeWithRelevelTx(tx, 'processNode', nodeId, newParentId, levelByDepth);

/** Move + re-level a single subtree in its own transaction (either spine). */
export function moveSubtreeWithRelevel(
  args: { spine: 'processNode' | 'orgUnit'; nodeId: string; newParentId: string | null; levelByDepth?: Map<number, string> },
): Promise<void> {
  return prisma.$transaction((tx) => moveSubtreeWithRelevelTx(tx, args.spine, args.nodeId, args.newParentId, args.levelByDepth));
}
/** Back-compat process-only alias. */
export const moveProcessSubtreeWithRelevel = (args: { nodeId: string; newParentId: string | null; levelByDepth?: Map<number, string> }) =>
  moveSubtreeWithRelevel({ spine: 'processNode', ...args });

/**
 * Delete the whole subtree rooted at `nodeId`: every descendant node row and the
 * closure rows touching any subtree id. Node deletes cascade their junctions and
 * (via the closure FKs' onDelete:Cascade) most closure rows, but we delete closure
 * rows explicitly too so no edge from an external ancestor INTO the subtree is left
 * dangling. One transaction.
 */
async function deleteSubtreeTx(tx: Tx, t: Tables, nodeId: string): Promise<number> {
  // Collect the subtree ids (descendants of nodeId, inclusive of nodeId itself).
  const ids = await tx.$queryRawUnsafe<{ descendantId: string }[]>(
    `SELECT "descendantId" FROM ${t.closure} WHERE "ancestorId" = $1`,
    nodeId,
  );
  const subtreeIds = ids.map((r) => r.descendantId);
  if (!subtreeIds.length) {
    // Closure missing (e.g. legacy/un-maintained node) — fall back to the node itself.
    subtreeIds.push(nodeId);
  }
  // Delete every closure row that references any subtree id, in either position.
  await tx.$executeRawUnsafe(
    `DELETE FROM ${t.closure}
       WHERE "ancestorId" = ANY($1::text[]) OR "descendantId" = ANY($1::text[])`,
    subtreeIds,
  );
  // Delete the node rows (children cascade their junctions via onDelete:Cascade).
  await tx.$executeRawUnsafe(
    `DELETE FROM ${t.node} WHERE "id" = ANY($1::text[])`,
    subtreeIds,
  );
  return subtreeIds.length;
}

/**
 * Full recursive-CTE rebuild of a company's closure (idempotent safety net). Wipes
 * the company's closure rows and regenerates them from the live parentId edges —
 * the same SQL the seed uses. Use after a bulk import, or to repair drift.
 */
async function rebuildClosureTx(tx: Tx, t: Tables, companyId: string): Promise<number> {
  // Remove existing edges for this company (ancestor scoped to the company).
  await tx.$executeRawUnsafe(
    `DELETE FROM ${t.closure}
       WHERE "ancestorId" IN (SELECT "id" FROM ${t.node} WHERE "companyId" = $1)`,
    companyId,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO ${t.closure} ("ancestorId", "descendantId", "depth")
       WITH RECURSIVE cte AS (
         SELECT "id" AS "ancestorId", "id" AS "descendantId", 0 AS "depth"
           FROM ${t.node} WHERE "companyId" = $1
         UNION ALL
         SELECT cte."ancestorId", n."id", cte."depth" + 1
           FROM ${t.node} n
           JOIN cte ON n."parentId" = cte."descendantId"
          WHERE n."companyId" = $1
       )
       SELECT "ancestorId", "descendantId", "depth" FROM cte`,
    companyId,
  );
  const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*)::bigint AS n FROM ${t.closure}
       WHERE "ancestorId" IN (SELECT "id" FROM ${t.node} WHERE "companyId" = $1)`,
    companyId,
  );
  return Number(rows[0]?.n ?? 0);
}

// ── Public, transactional wrappers (one tree pair each) ──────────────────────

export interface ClosureService {
  /** Write closure rows for a newly-created node. Wrap in its own transaction. */
  insertNode(args: { nodeId: string; parentId: string | null }): Promise<void>;
  /** Re-home a subtree and fix the closure. */
  moveSubtree(args: { nodeId: string; newParentId: string | null }): Promise<void>;
  /** Delete a subtree (nodes + closure rows). Returns the number of nodes removed. */
  deleteSubtree(args: { nodeId: string }): Promise<number>;
  /** Recursive-CTE full rebuild for a company. Returns the resulting row count. */
  rebuildClosure(args: { companyId: string }): Promise<number>;
}

function makeService(t: Tables): ClosureService {
  return {
    insertNode: ({ nodeId, parentId }) =>
      prisma.$transaction((tx) => insertNodeTx(tx, t, nodeId, parentId)),
    moveSubtree: ({ nodeId, newParentId }) =>
      prisma.$transaction((tx) => moveSubtreeTx(tx, t, nodeId, newParentId)),
    deleteSubtree: ({ nodeId }) =>
      prisma.$transaction((tx) => deleteSubtreeTx(tx, t, nodeId)),
    rebuildClosure: ({ companyId }) =>
      prisma.$transaction((tx) => rebuildClosureTx(tx, t, companyId)),
  };
}

/** Closure maintenance for the ProcessNode (value-stream) tree. */
export const processClosure = makeService(PROCESS);
/** Closure maintenance for the OrgUnit (organization) tree. */
export const orgClosure = makeService(ORG);

/** Resolve a closure service by the builder's spine name. */
export function closureFor(spine: 'processNode' | 'orgUnit'): ClosureService {
  return spine === 'processNode' ? processClosure : orgClosure;
}
