import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

// Read API for the configurable Level tree (Phase 2 source for the value-stream
// list + map). Returns the flat, level-ordered list plus a nested tree; the L5
// detail fields drive the metrics sidebar at the bottom level.
const router = Router();
router.use(requireAuth);

type Node = {
  id: string; levelNumber: number; parentId: string | null; name: string;
  description: string | null; leads: string | null; supporting: string | null;
  inputs: string | null; outputs: string | null; externalParticipants: string | null; notes: string | null;
  children: Node[];
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!companyId) return res.status(400).json({ error: 'companyId query parameter is required' });
    // erd_v5: the configurable value-stream tree is ProcessNode; levelNumber comes
    // from the node's ProcessLevelType. The legacy detail columns (leads/supporting/
    // inputs/outputs/...) live in ProcessNode.attributes JSON.
    const raw = await prisma.processNode.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
      select: {
        id: true, parentId: true, displayValue: true, attributes: true,
        processLevelType: { select: { levelNumber: true } },
      },
    });
    const attr = (a: unknown, k: string): string | null => {
      const v = a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : null;
      return typeof v === 'string' ? v : null;
    };
    const rows = raw
      .map((n) => ({
        id: n.id, levelNumber: n.processLevelType.levelNumber, parentId: n.parentId, name: n.displayValue,
        description: attr(n.attributes, 'description'), leads: attr(n.attributes, 'leads'),
        supporting: attr(n.attributes, 'supporting'), inputs: attr(n.attributes, 'inputs'),
        outputs: attr(n.attributes, 'outputs'), externalParticipants: attr(n.attributes, 'externalParticipants'),
        notes: attr(n.attributes, 'notes'),
      }))
      .sort((a, b) => a.levelNumber - b.levelNumber);

    // Assemble the tree (rows are level-ordered, so parents precede children).
    const byId = new Map<string, Node>();
    const roots: Node[] = [];
    for (const r of rows) byId.set(r.id, { ...r, children: [] });
    for (const r of rows) {
      const node = byId.get(r.id)!;
      const parent = r.parentId ? byId.get(r.parentId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    res.json({ levels: rows, tree: roots });
  } catch (e) {
    next(e);
  }
});

export default router;
