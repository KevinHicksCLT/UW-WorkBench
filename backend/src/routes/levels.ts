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
    const rows = await prisma.level.findMany({
      where: { tenantId: req.tenantId, companyId },
      orderBy: [{ levelNumber: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, levelNumber: true, parentId: true, name: true,
        description: true, leads: true, supporting: true, inputs: true, outputs: true, externalParticipants: true, notes: true,
      },
    });

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
