import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { closureFor, moveProcessSubtreeWithRelevel, moveSubtreeWithRelevelTx } from '../lib/closure.js';
import { invalidateStructureCounts } from '../lib/resolvers/index.js';

// Interactive operating-model builder.
//
// erd_v5: the old unified Node / NodeType / NodeLink graph is gone. The two real,
// level-typed spines — ProcessNode (value streams) and OrgUnit (organization) —
// are the editable trees. This router presents them through the SAME node/typeKey
// vocabulary the builder UI speaks:
//   • typeKey  = "p{level}" for a ProcessNode at that level, "o{level}" for an
//                OrgUnit. The taxonomy (/types) is synthesized from the company's
//                ProcessLevelType + OrgLevelType rows, so parentKeys/labels are
//                data-driven exactly as before.
//   • a node's name = its editable displayValue; description/detail live in
//                ProcessNode.attributes (OrgUnit has no attributes column).
//
// READ paths (/types, /tree) are fully migrated. WRITE paths maintain the
// ProcessNodeClosure / OrgUnitClosure edges transactionally via lib/closure.ts:
// create → insertNode, reparent → moveSubtree, delete → deleteSubtree. Generic
// NodeLink connections have no erd_v5 equivalent (relationships are typed
// junctions), so the connection endpoints return empty / are disabled.
//
// ADMIN-only; every write audited.

const router = Router();
router.use(requireAuth);
router.use(requireRole('ADMIN'));

const RELATION_TYPES = [
  'PARTICIPATES_IN', 'SUPPORTS', 'OWNS', 'LEADS', 'PRODUCES', 'CONSUMES',
  'DEPENDS_ON', 'IMPACTS', 'REPORTS_TO', 'INTERACTS_WITH',
];

async function companyForReq(req: Request): Promise<string | null> {
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) return null;
  const company = await prisma.company.findFirst({ where: { id: cid, tenantId: req.tenantId }, select: { id: true } });
  return company ? cid : null;
}

function audit(req: Request, entityId: string, action: string, diff?: Record<string, unknown>) {
  logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'ProcessNode', entityId, action, diff });
}

// typeKey ⇄ (spine, levelNumber). p2 = ProcessNode level 2, o1 = OrgUnit level 1.
type Spine = 'processNode' | 'orgUnit';
const typeKeyFor = (spine: Spine, level: number) => (spine === 'processNode' ? 'p' : 'o') + level;
function parseTypeKey(typeKey: string): { spine: Spine; level: number } | null {
  const m = /^([po])(\d+)$/.exec(typeKey);
  if (!m) return null;
  return { spine: m[1] === 'p' ? 'processNode' : 'orgUnit', level: Number(m[2]) };
}
// Structural view of a spine row / delegate as used by the dynamic Prisma access
// below. Purely compile-time (casts are erased); Prisma still validates shapes.
type SpineRecord = {
  id: string; parentId: string | null; displayValue: string; sortOrder: number;
  attributes?: unknown;
  processLevelType?: { levelNumber: number } | null;
  orgLevelType?: { levelNumber: number } | null;
};
type SpineDelegate = {
  findFirst(args: unknown): Promise<SpineRecord | null>;
  findUnique(args: unknown): Promise<SpineRecord>;
  create(args: unknown): Promise<SpineRecord>;
  update(args: unknown): Promise<SpineRecord>;
  count(args: unknown): Promise<number>;
  aggregate(args: unknown): Promise<{ _max: { sortOrder: number | null } }>;
};
type LevelTypeDelegate = {
  findFirst(args: unknown): Promise<{ id: string } | null>;
  findMany(args: unknown): Promise<{ id: string; levelNumber: number }[]>;
  createMany(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<{ displayValue: string }>;
};

// attributes is a JSON column — narrow the "hidden" flag without assuming shape.
const isHidden = (attrs: unknown): boolean =>
  typeof attrs === 'object' && attrs !== null && (attrs as Record<string, unknown>).hidden === true;

const delegateFor = (spine: Spine) => (prisma as unknown as Record<string, SpineDelegate>)[spine];
const levelDelegateFor = (spine: Spine) => (prisma as unknown as Record<string, LevelTypeDelegate>)[spine === 'processNode' ? 'processLevelType' : 'orgLevelType'];
const levelRelationFor = (spine: Spine) => (spine === 'processNode' ? 'processLevelType' : 'orgLevelType');
const levelFkFor = (spine: Spine) => (spine === 'processNode' ? 'processLevelTypeId' : 'orgLevelTypeId');

// ── Taxonomy ────────────────────────────────────────────────────────────────
// Synthesize the NodeType list from the company's level types. Each level's
// parent is the level above in the same spine.
router.get('/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const [pLevels, oLevels] = await Promise.all([
      prisma.processLevelType.findMany({ where: { companyId: cid }, orderBy: { levelNumber: 'asc' }, select: { levelNumber: true, displayValue: true } }),
      prisma.orgLevelType.findMany({ where: { companyId: cid }, orderBy: { levelNumber: 'asc' }, select: { levelNumber: true, displayValue: true } }),
    ]);
    const build = (spine: Spine, levels: { levelNumber: number; displayValue: string }[], offset: number) =>
      levels.map((l, i) => ({
        key: typeKeyFor(spine, l.levelNumber),
        label: l.displayValue,
        pluralLabel: l.displayValue + (/s$/i.test(l.displayValue) ? '' : 's'),
        level: l.levelNumber,
        parentKeys: i === 0 ? [] : [typeKeyFor(spine, levels[i - 1].levelNumber)],
        sortOrder: offset + i,
      }));
    const types = [...build('processNode', pLevels, 0), ...build('orgUnit', oLevels, 100)];
    res.json({ types, relationTypes: RELATION_TYPES });
  } catch (e) { next(e); }
});

router.patch('/types/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const parsed = parseTypeKey(req.params.key);
    if (!parsed) return res.status(404).json({ error: 'Unknown node type' });
    const lt = await levelDelegateFor(parsed.spine).findFirst({ where: { companyId: cid, levelNumber: parsed.level }, select: { id: true } });
    if (!lt) return res.status(404).json({ error: 'Not found' });
    const label = (req.body ?? {}).label;
    if (typeof label !== 'string' || !label.trim()) return res.status(400).json({ error: 'label must be a non-empty string' });
    const updated = await levelDelegateFor(parsed.spine).update({ where: { id: lt.id }, data: { displayValue: label.trim() } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'LevelType', entityId: req.params.key, action: 'UPDATE', diff: { label: label.trim() } });
    res.json({ key: req.params.key, label: updated.displayValue });
  } catch (e) { next(e); }
});

// ── Structure (the tree) ────────────────────────────────────────────────────
// Flat node list with parentId; the canvas nests client-side. Both spines are
// merged into one list keyed by the synthetic typeKey.
type FlatNode = { id: string; typeKey: string; parentId: string | null; name: string; description: string | null; sortOrder: number; provenance: string; code: string | null; attributes: unknown; hidden: boolean; inboundLinks: number };

router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });

    const [pNodes, oNodes] = await Promise.all([
      prisma.processNode.findMany({
        where: { companyId: cid },
        orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
        select: { id: true, parentId: true, displayValue: true, sortOrder: true, code: true, attributes: true, processLevelType: { select: { levelNumber: true } } },
      }),
      prisma.orgUnit.findMany({
        where: { companyId: cid },
        orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
        select: { id: true, parentId: true, displayValue: true, sortOrder: true, orgLevelType: { select: { levelNumber: true } } },
      }),
    ]);

    const attrDesc = (a: unknown): string | null => {
      const v = a && typeof a === 'object' ? (a as Record<string, unknown>).description : null;
      return typeof v === 'string' ? v : null;
    };
    const nodes: FlatNode[] = [
      ...pNodes.map((n) => ({
        id: n.id, typeKey: typeKeyFor('processNode', n.processLevelType.levelNumber), parentId: n.parentId,
        name: n.displayValue, description: attrDesc(n.attributes), sortOrder: n.sortOrder, provenance: 'real',
        code: n.code ?? null, attributes: n.attributes ?? null, hidden: isHidden(n.attributes), inboundLinks: 0,
      })),
      ...oNodes.map((n) => ({
        id: n.id, typeKey: typeKeyFor('orgUnit', n.orgLevelType.levelNumber), parentId: n.parentId,
        name: n.displayValue, description: null, sortOrder: n.sortOrder, provenance: 'real',
        code: null, attributes: null, hidden: false, inboundLinks: 0,
      })),
    ];
    res.json({ nodes });
  } catch (e) { next(e); }
});

// Resolve the level-type id for (spine, level) in a company.
async function levelTypeId(spine: Spine, companyId: string, level: number): Promise<string | null> {
  const lt = await levelDelegateFor(spine).findFirst({ where: { companyId, levelNumber: level }, select: { id: true } });
  return lt?.id ?? null;
}

type ClosureDelegate = {
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<{ depth: number }[]>;
};
const closureDelegateFor = (spine: Spine) => (prisma as unknown as Record<string, ClosureDelegate>)[spine === 'processNode' ? 'processNodeClosure' : 'orgUnitClosure'];

// Validate + plan a reparent on EITHER spine. The tree allows re-leveling: a node
// can drop under ANY target and adopts level (parentLevel + 1), its whole subtree
// shifting with it. If the drop would nest past the deepest configured level we
// AUTO-CREATE the missing levels (no hard cap) so depth is unlimited. Returns the
// depth→levelTypeId map to apply (empty when the level is unchanged) plus the node's
// resulting level, or an error to surface verbatim.
type MovePlan = { levelByDepth: Map<number, string>; newRootLevel: number };
async function planMove(
  spine: Spine, cid: string, nodeId: string, currentLevel: number, newParentId: string | null,
): Promise<MovePlan | { error: string; status: number }> {
  if (newParentId === nodeId) return { error: 'A node cannot be its own parent', status: 400 };
  const del = delegateFor(spine);
  const levelDel = levelDelegateFor(spine);
  const closureDel = closureDelegateFor(spine);
  const levelRel = levelRelationFor(spine);

  let newRootLevel: number;
  if (newParentId) {
    const parent = await del.findFirst({ where: { id: newParentId, companyId: cid }, select: { [levelRel]: { select: { levelNumber: true } } } });
    if (!parent) return { error: 'Parent not found in this company', status: 400 };
    // Cycle guard: the new parent must not sit inside this node's own subtree.
    const inSubtree = await closureDel.findFirst({ where: { ancestorId: nodeId, descendantId: newParentId }, select: { ancestorId: true } });
    if (inSubtree) return { error: 'Cannot move a node under its own descendant', status: 400 };
    newRootLevel = (parent[levelRel]?.levelNumber ?? 0) + 1;
  } else {
    newRootLevel = 1; // dropped to root
  }

  // Deepest relative depth in the moved subtree (0 = the node itself).
  const depths = await closureDel.findMany({ where: { ancestorId: nodeId }, select: { depth: true } });
  const maxDepth = depths.reduce((m: number, r: { depth: number }) => Math.max(m, r.depth), 0);

  let levels: { id: string; levelNumber: number }[] = await levelDel.findMany({ where: { companyId: cid }, select: { id: true, levelNumber: true } });
  const maxLevel = levels.reduce((m, l) => Math.max(m, l.levelNumber), 0);
  const neededMax = newRootLevel + maxDepth;
  if (neededMax > maxLevel) {
    const toCreate = [];
    for (let n = maxLevel + 1; n <= neededMax; n++) toCreate.push({ companyId: cid, levelNumber: n, dbValue: `L${n}`, displayValue: `Level ${n}` });
    await levelDel.createMany({ data: toCreate, skipDuplicates: true });
    levels = await levelDel.findMany({ where: { companyId: cid }, select: { id: true, levelNumber: true } });
  }

  const levelByDepth = new Map<number, string>();
  if (newRootLevel !== currentLevel) {
    const byNum = new Map(levels.map((l) => [l.levelNumber, l.id]));
    for (let d = 0; d <= maxDepth; d++) {
      const id = byNum.get(newRootLevel + d);
      if (!id) return { error: `This company has no level ${newRootLevel + d} configured`, status: 400 };
      levelByDepth.set(d, id);
    }
  }
  return { levelByDepth, newRootLevel };
}
const planProcessMove = (cid: string, nodeId: string, currentLevel: number, newParentId: string | null) =>
  planMove('processNode', cid, nodeId, currentLevel, newParentId);

router.post('/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const { typeKey, parentId, name, description } = req.body ?? {};
    if (typeof typeKey !== 'string' || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'typeKey and a non-empty name are required' });
    }
    const t = parseTypeKey(typeKey);
    if (!t) return res.status(400).json({ error: `Unknown node type: ${typeKey}` });
    const del = delegateFor(t.spine);

    // Validate the parent: must exist in this company, in the same spine, one level up.
    if (parentId) {
      const parent = await del.findFirst({ where: { id: parentId, companyId: cid }, select: { id: true, [levelRelationFor(t.spine)]: { select: { levelNumber: true } } } });
      if (!parent) return res.status(400).json({ error: 'Parent not found in this company' });
      const parentLevel = parent[levelRelationFor(t.spine)]?.levelNumber ?? 0;
      if (parentLevel + 1 !== t.level) return res.status(400).json({ error: `A ${typeKey} must sit directly under a level-${t.level - 1} node` });
    }
    const ltId = await levelTypeId(t.spine, cid, t.level);
    if (!ltId) return res.status(400).json({ error: `This company has no level ${t.level} configured for ${t.spine}` });

    const maxSort = await del.aggregate({ where: { companyId: cid, parentId: parentId ?? null }, _max: { sortOrder: true } });
    const data: Record<string, unknown> = {
      companyId: cid, parentId: parentId ?? null, dbValue: name.trim(), displayValue: name.trim(),
      [levelFkFor(t.spine)]: ltId, sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    };
    if (t.spine === 'processNode' && typeof description === 'string') data.attributes = { description };
    const node = await del.create({ data });
    // Closure: self-row + ancestor edges (transactional).
    await closureFor(t.spine).insertNode({ nodeId: node.id, parentId: node.parentId ?? null });
    invalidateStructureCounts(cid);
    audit(req, node.id, 'CREATE', { typeKey, name: node.displayValue, parentId: node.parentId });
    res.status(201).json({ id: node.id, typeKey, parentId: node.parentId, name: node.displayValue, sortOrder: node.sortOrder, provenance: 'real', hidden: false });
  } catch (e) { next(e); }
});

router.patch('/nodes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    // Find the node in either spine.
    const found = await findNode(cid, req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    const { spine, level } = found;
    const del = delegateFor(spine);

    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ error: 'name must be a non-empty string' });
      data.displayValue = body.name.trim();
    }
    if (spine === 'processNode') {
      const attrs = { ...((found.attributes as Record<string, unknown>) ?? {}) };
      let touchedAttrs = false;
      if (body.description !== undefined) { attrs.description = body.description === null ? null : String(body.description); touchedAttrs = true; }
      if (body.hidden !== undefined) { if (body.hidden) { attrs.hidden = true; } else { delete attrs.hidden; } touchedAttrs = true; }
      if (touchedAttrs) data.attributes = attrs;
    }
    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (!Number.isInteger(n)) return res.status(400).json({ error: 'sortOrder must be an integer' });
      data.sortOrder = n;
    }
    // Parent reassignment. The ProcessNode tree supports re-leveling (drop under any
    // target; the subtree adopts the new depth, capped at the deepest level) via
    // planProcessMove + moveProcessSubtreeWithRelevel. OrgUnit keeps the stricter
    // "parent exactly one level up" rule. Either path maintains the closure edges
    // transactionally; other field updates go through del.update.
    let moveTo: string | null | undefined; // undefined = no move requested
    let relevel: Map<number, string> | undefined;
    let newLevel = level;
    if (body.parentId !== undefined) {
      const newParentId: string | null = body.parentId ?? null;
      if (spine === 'processNode') {
        const plan = await planProcessMove(cid, req.params.id, level, newParentId);
        if ('error' in plan) return res.status(plan.status).json({ error: plan.error });
        relevel = plan.levelByDepth;
        newLevel = plan.newRootLevel;
      } else {
        if (newParentId === req.params.id) return res.status(400).json({ error: 'A node cannot be its own parent' });
        if (newParentId) {
          const parent = await del.findFirst({ where: { id: newParentId, companyId: cid }, select: { id: true, [levelRelationFor(spine)]: { select: { levelNumber: true } } } });
          if (!parent) return res.status(400).json({ error: 'Parent not found in this company' });
          if ((parent[levelRelationFor(spine)]?.levelNumber ?? 0) + 1 !== level) {
            return res.status(400).json({ error: 'Re-leveling (changing a node\'s level) is not supported for this tree; pick a parent one level above this node.' });
          }
          // Cycle guard: the new parent must not be inside this node's own subtree.
          let cursor: string | null = newParentId;
          for (let i = 0; i < 64 && cursor; i++) {
            if (cursor === req.params.id) return res.status(400).json({ error: 'Cannot move a node under its own descendant' });
            const up: { parentId: string | null } | null = await del.findUnique({ where: { id: cursor }, select: { parentId: true } });
            cursor = up?.parentId ?? null;
          }
        }
      }
      moveTo = newParentId;
    }
    if (!Object.keys(data).length && moveTo === undefined) return res.status(400).json({ error: 'Nothing to update' });

    if (Object.keys(data).length) await del.update({ where: { id: req.params.id }, data });
    if (moveTo !== undefined) {
      if (spine === 'processNode') {
        await moveProcessSubtreeWithRelevel({ nodeId: req.params.id, newParentId: moveTo, levelByDepth: relevel });
      } else {
        await closureFor(spine).moveSubtree({ nodeId: req.params.id, newParentId: moveTo });
      }
      invalidateStructureCounts(cid);
    }
    const updated = await del.findUnique({ where: { id: req.params.id } });
    audit(req, req.params.id, 'UPDATE', { ...data, ...(moveTo !== undefined ? { parentId: moveTo } : {}) });
    res.json({ id: updated.id, typeKey: typeKeyFor(spine, newLevel), parentId: updated.parentId, name: updated.displayValue, sortOrder: updated.sortOrder, attributes: spine === 'processNode' ? updated.attributes : null, hidden: isHidden(updated.attributes) });
  } catch (e) { next(e); }
});

router.delete('/nodes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const found = await findNode(cid, req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    const del = delegateFor(found.spine);
    const childCount = await del.count({ where: { parentId: req.params.id } });
    if (childCount > 0 && req.query.confirm !== found.name) {
      return res.status(409).json({
        error: `"${found.name}" has ${childCount} child node(s); deleting cascades the whole subtree. Repeat the request with ?confirm=<exact name>.`,
        children: childCount,
      });
    }
    // Closure: delete the whole subtree (nodes + closure rows) transactionally.
    await closureFor(found.spine).deleteSubtree({ nodeId: req.params.id });
    invalidateStructureCounts(cid);
    audit(req, req.params.id, 'DELETE', { name: found.name, typeKey: typeKeyFor(found.spine, found.level), children: childCount });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Apply an ordered list of move + reorder ops in ONE transaction — the canvas
// editor's "Save". Process spine only. Everything commits or nothing does, so the
// client can keep its staged edits on failure. All ops are validated/planned up
// front (reads) so the transaction body only writes.
router.post('/nodes/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const ops = Array.isArray(req.body?.ops) ? req.body.ops : null;
    if (!ops) return res.status(400).json({ error: 'ops must be an array' });
    if (ops.length > 500) return res.status(400).json({ error: 'Too many ops in one batch (max 500)' });
    if (ops.length === 0) return res.json({ applied: 0 });

    type Planned =
      | { op: 'move'; spine: Spine; id: string; newParentId: string | null; levelByDepth: Map<number, string> }
      | { op: 'reorder'; spine: Spine; orderedIds: string[] }
      | { op: 'rename'; spine: Spine; id: string; name: string };
    const planned: Planned[] = [];
    for (const raw of ops) {
      if (raw?.op === 'rename') {
        if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return res.status(400).json({ error: 'rename op needs an id and a non-empty name' });
        const found = await findNode(cid, raw.id);
        if (!found) return res.status(404).json({ error: `Node not found: ${raw.id}` });
        planned.push({ op: 'rename', spine: found.spine, id: raw.id, name: raw.name.trim() });
      } else if (raw?.op === 'move') {
        if (typeof raw.id !== 'string') return res.status(400).json({ error: 'move op needs an id' });
        const found = await findNode(cid, raw.id);
        if (!found) return res.status(404).json({ error: `Node not found: ${raw.id}` });
        const newParentId: string | null = raw.newParentId ?? null;
        const plan = await planMove(found.spine, cid, raw.id, found.level, newParentId);
        if ('error' in plan) return res.status(plan.status).json({ error: plan.error });
        planned.push({ op: 'move', spine: found.spine, id: raw.id, newParentId, levelByDepth: plan.levelByDepth });
      } else if (raw?.op === 'reorder') {
        const ids: unknown[] = Array.isArray(raw.orderedIds) ? raw.orderedIds : [];
        if (!ids.length || ids.some((x) => typeof x !== 'string')) return res.status(400).json({ error: 'reorder op needs orderedIds: string[]' });
        const strIds = ids as string[];
        const first = await findNode(cid, strIds[0]);
        if (!first) return res.status(404).json({ error: 'reorder references unknown node(s)' });
        const count = await delegateFor(first.spine).count({ where: { id: { in: strIds }, companyId: cid } });
        if (count !== strIds.length) return res.status(404).json({ error: 'reorder references unknown node(s)' });
        planned.push({ op: 'reorder', spine: first.spine, orderedIds: strIds });
      } else {
        return res.status(400).json({ error: `Unknown op: ${raw?.op}` });
      }
    }
    // Apply moves before reorders so sortOrder assignments land on the final tree.
    planned.sort((a, b) => (a.op === b.op ? 0 : a.op === 'move' ? -1 : 1));

    await prisma.$transaction(async (tx) => {
      for (const p of planned) {
        const txDel = (tx as unknown as Record<string, SpineDelegate>)[p.spine];
        if (p.op === 'move') {
          await moveSubtreeWithRelevelTx(tx, p.spine, p.id, p.newParentId, p.levelByDepth);
        } else if (p.op === 'rename') {
          await txDel.update({ where: { id: p.id }, data: { displayValue: p.name } });
        } else {
          for (let i = 0; i < p.orderedIds.length; i++) {
            await txDel.update({ where: { id: p.orderedIds[i] }, data: { sortOrder: i + 1 } });
          }
        }
      }
    });
    invalidateStructureCounts(cid);
    for (const p of planned) {
      if (p.op === 'move') audit(req, p.id, 'UPDATE', { parentId: p.newParentId, batch: true });
      else if (p.op === 'rename') audit(req, p.id, 'UPDATE', { name: p.name });
      else audit(req, p.orderedIds[0], 'UPDATE', { reorder: p.orderedIds });
    }
    res.json({ applied: planned.length });
  } catch (e) { next(e); }
});

// Locate a node by id across both spines (in the company), with its level + attributes.
async function findNode(companyId: string, id: string): Promise<{ spine: Spine; level: number; name: string; attributes: unknown } | null> {
  const p = await prisma.processNode.findFirst({ where: { id, companyId }, select: { displayValue: true, attributes: true, processLevelType: { select: { levelNumber: true } } } });
  if (p) return { spine: 'processNode', level: p.processLevelType.levelNumber, name: p.displayValue, attributes: p.attributes };
  const o = await prisma.orgUnit.findFirst({ where: { id, companyId }, select: { displayValue: true, orgLevelType: { select: { levelNumber: true } } } });
  if (o) return { spine: 'orgUnit', level: o.orgLevelType.levelNumber, name: o.displayValue, attributes: null };
  return null;
}

// ── Connections (the web) ───────────────────────────────────────────────────
// erd_v5 has no generic NodeLink table — relationships between operating-model
// entities are modeled as typed junctions (NodeRole, NodeDeliverable, …) edited
// through the dedicated tabs / generic /admin CRUD. The free-form connection
// endpoints therefore return empty and reject writes cleanly.
router.get('/nodes/:id/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const found = await findNode(cid, req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json({ out: [], in: [] });
  } catch (e) { next(e); }
});

router.post('/links', async (_req: Request, res: Response) => {
  res.status(400).json({ error: 'Free-form connections are not available in this model — relationships are typed junctions edited via the relevant tab or Data Admin.' });
});

router.delete('/links/:id', async (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

export default router;
