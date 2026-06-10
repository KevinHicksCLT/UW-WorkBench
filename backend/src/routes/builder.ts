import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

// Interactive operating-model builder (P7 of the rework). One surface to edit the
// unified Node tree, draw NodeLink connections, and rename the NodeType taxonomy.
// ADMIN-only; every write audited; structure rules enforced from NodeType.parentKeys
// (the taxonomy is data — the builder validates against it, never against code).

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
  logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'Node', entityId, action, diff });
}

// ── Taxonomy ────────────────────────────────────────────────────────────────
router.get('/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.nodeType.findMany({ where: { tenantId: req.tenantId }, orderBy: { sortOrder: 'asc' } });
    res.json({ types, relationTypes: RELATION_TYPES });
  } catch (e) { next(e); }
});

router.patch('/types/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.nodeType.findUnique({ where: { tenantId_key: { tenantId: req.tenantId, key: req.params.key } } });
    if (!t) return res.status(404).json({ error: 'Not found' });
    const data: Record<string, string> = {};
    for (const f of ['label', 'pluralLabel'] as const) {
      const v = (req.body ?? {})[f];
      if (v !== undefined) {
        if (typeof v !== 'string' || !v.trim()) return res.status(400).json({ error: `${f} must be a non-empty string` });
        data[f] = v.trim();
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    const updated = await prisma.nodeType.update({ where: { id: t.id }, data });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'NodeType', entityId: t.key, action: 'UPDATE', diff: data });
    res.json(updated);
  } catch (e) { next(e); }
});

// ── Structure (the tree) ────────────────────────────────────────────────────
// Flat node list with parentId; the canvas nests client-side. io_item excluded by
// default (835 leaf rows) — pass ?includeIo=1 to include.
router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const includeIo = req.query.includeIo === '1';
    const nodes = await prisma.node.findMany({
      where: { companyId: cid, ...(includeIo ? {} : { typeKey: { not: 'io_item' } }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, typeKey: true, parentId: true, name: true, description: true, sortOrder: true, provenance: true, code: true },
    });
    const linkCounts = await prisma.nodeLink.groupBy({ by: ['toId'], where: { companyId: cid }, _count: { _all: true } });
    const inbound = new Map(linkCounts.map((l) => [l.toId, l._count._all]));
    res.json({ nodes: nodes.map((n) => ({ ...n, inboundLinks: inbound.get(n.id) ?? 0 })) });
  } catch (e) { next(e); }
});

// Validate that childTypeKey may sit under the parent node (NodeType.parentKeys).
async function validateParent(tenantId: string, companyId: string, typeKey: string, parentId: string | null): Promise<string | null> {
  const t = await prisma.nodeType.findUnique({ where: { tenantId_key: { tenantId, key: typeKey } } });
  if (!t) return `Unknown node type: ${typeKey}`;
  if (!parentId) return t.parentKeys.length === 0 ? null : `${t.label} requires a parent (${t.parentKeys.join(' or ')})`;
  const parent = await prisma.node.findFirst({ where: { id: parentId, companyId }, select: { typeKey: true, name: true } });
  if (!parent) return 'Parent not found in this company';
  if (!t.parentKeys.includes(parent.typeKey)) return `A ${t.label} cannot sit under a ${parent.typeKey} ("${parent.name}") — allowed parents: ${t.parentKeys.join(', ')}`;
  return null;
}

router.post('/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const { typeKey, parentId, name, description } = req.body ?? {};
    if (typeof typeKey !== 'string' || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'typeKey and a non-empty name are required' });
    }
    const problem = await validateParent(req.tenantId, cid, typeKey, parentId ?? null);
    if (problem) return res.status(400).json({ error: problem });
    const maxSort = await prisma.node.aggregate({ where: { companyId: cid, parentId: parentId ?? null, typeKey }, _max: { sortOrder: true } });
    const node = await prisma.node.create({
      data: {
        companyId: cid, typeKey, parentId: parentId ?? null, name: name.trim(),
        description: typeof description === 'string' ? description : null,
        provenance: 'real', sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    audit(req, node.id, 'CREATE', { typeKey, name: node.name, parentId: node.parentId });
    res.status(201).json(node);
  } catch (e) { next(e); }
});

router.patch('/nodes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const node = await prisma.node.findFirst({ where: { id: req.params.id, companyId: cid } });
    if (!node) return res.status(404).json({ error: 'Not found' });

    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ error: 'name must be a non-empty string' });
      data.name = body.name.trim();
    }
    if (body.description !== undefined) data.description = body.description === null ? null : String(body.description);
    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (!Number.isInteger(n)) return res.status(400).json({ error: 'sortOrder must be an integer' });
      data.sortOrder = n;
    }
    // Level move (e.g. demote a division to a department): change the node's
    // type, usually together with a new parent. The hierarchy stays valid —
    // the new type must accept the (new) parent, and every existing child's
    // type must accept the new type as ITS parent.
    const effectiveTypeKey = typeof body.typeKey === 'string' && body.typeKey !== node.typeKey ? body.typeKey : node.typeKey;
    if (effectiveTypeKey !== node.typeKey) {
      const childTypes = await prisma.node.findMany({
        where: { parentId: node.id }, select: { typeKey: true }, distinct: ['typeKey'],
      });
      for (const c of childTypes) {
        const ct = await prisma.nodeType.findUnique({ where: { tenantId_key: { tenantId: req.tenantId, key: c.typeKey } } });
        if (!ct?.parentKeys.includes(effectiveTypeKey)) {
          return res.status(400).json({ error: `Cannot change level: this node has ${ct?.label ?? c.typeKey} children, which cannot sit under a ${effectiveTypeKey}. Move or re-level the children first.` });
        }
      }
      // When the type changes and no new parent was supplied, the current parent
      // must still be legal for the new type (validated below).
      data.typeKey = effectiveTypeKey;
    }
    if (body.parentId !== undefined || effectiveTypeKey !== node.typeKey) {
      const newParentId: string | null = body.parentId !== undefined ? (body.parentId ?? null) : node.parentId;
      if (newParentId === node.id) return res.status(400).json({ error: 'A node cannot be its own parent' });
      const problem = await validateParent(req.tenantId, cid, effectiveTypeKey, newParentId);
      if (problem) return res.status(400).json({ error: problem });
      // Guard against cycles: the new parent must not be a descendant of this node.
      let cursor: string | null = newParentId;
      while (cursor) {
        if (cursor === node.id) return res.status(400).json({ error: 'Cannot move a node under its own descendant' });
        const up: { parentId: string | null } | null = await prisma.node.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = up?.parentId ?? null;
      }
      if (body.parentId !== undefined) data.parentId = body.parentId ?? null;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });

    const updated = await prisma.node.update({ where: { id: node.id }, data });
    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(data)) diff[k] = { from: (node as any)[k] ?? null, to: (updated as any)[k] ?? null };
    audit(req, node.id, 'UPDATE', diff);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/nodes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const node = await prisma.node.findFirst({ where: { id: req.params.id, companyId: cid }, include: { _count: { select: { children: true } } } });
    if (!node) return res.status(404).json({ error: 'Not found' });
    if (node._count.children > 0 && req.query.confirm !== node.name) {
      return res.status(409).json({
        error: `"${node.name}" has ${node._count.children} child node(s); deleting cascades the whole subtree. Repeat the request with ?confirm=<exact name>.`,
        children: node._count.children,
      });
    }
    await prisma.node.delete({ where: { id: node.id } });
    audit(req, node.id, 'DELETE', { name: node.name, typeKey: node.typeKey, children: node._count.children });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Connections (the web) ───────────────────────────────────────────────────
router.get('/nodes/:id/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const node = await prisma.node.findFirst({ where: { id: req.params.id, companyId: cid }, select: { id: true } });
    if (!node) return res.status(404).json({ error: 'Not found' });
    const [out, inn] = await Promise.all([
      prisma.nodeLink.findMany({ where: { fromId: node.id }, include: { to: { select: { id: true, name: true, typeKey: true } } } }),
      prisma.nodeLink.findMany({ where: { toId: node.id }, include: { from: { select: { id: true, name: true, typeKey: true } } } }),
    ]);
    res.json({
      out: out.map((l) => ({ id: l.id, relationType: l.relationType, attributes: l.attributes, peer: l.to })),
      in: inn.map((l) => ({ id: l.id, relationType: l.relationType, attributes: l.attributes, peer: l.from })),
    });
  } catch (e) { next(e); }
});

router.post('/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const { fromId, toId, relationType, attributes } = req.body ?? {};
    if (typeof fromId !== 'string' || typeof toId !== 'string') return res.status(400).json({ error: 'fromId and toId are required' });
    if (fromId === toId) return res.status(400).json({ error: 'A node cannot link to itself' });
    if (typeof relationType !== 'string' || !RELATION_TYPES.includes(relationType)) {
      return res.status(400).json({ error: `relationType must be one of ${RELATION_TYPES.join(' | ')}` });
    }
    const [from, to] = await Promise.all([
      prisma.node.findFirst({ where: { id: fromId, companyId: cid }, select: { id: true, name: true } }),
      prisma.node.findFirst({ where: { id: toId, companyId: cid }, select: { id: true, name: true } }),
    ]);
    if (!from || !to) return res.status(400).json({ error: 'Both nodes must exist in the active company' });
    const link = await prisma.nodeLink.create({ data: { companyId: cid, fromId, toId, relationType, attributes: attributes ?? undefined } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'NodeLink', entityId: link.id, action: 'CREATE', diff: { from: from.name, to: to.name, relationType } });
    res.status(201).json(link);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(400).json({ error: 'That connection already exists' });
    next(e);
  }
});

router.delete('/links/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = await companyForReq(req);
    if (!cid) return res.status(400).json({ error: 'Valid companyId query parameter is required' });
    const link = await prisma.nodeLink.findFirst({ where: { id: req.params.id, companyId: cid }, include: { from: { select: { name: true } }, to: { select: { name: true } } } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    await prisma.nodeLink.delete({ where: { id: link.id } });
    logAudit({ tenantId: req.tenantId, actorEmail: req.user.email, entityType: 'NodeLink', entityId: link.id, action: 'DELETE', diff: { from: link.from.name, to: link.to.name, relationType: link.relationType } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
