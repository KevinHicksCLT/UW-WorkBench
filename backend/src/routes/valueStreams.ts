import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantValueStream } from '../lib/tenant.js';

const router = Router();
router.use(requireAuth);

type SubRow = {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  inputs: string | null;
  outputs: string | null;
  upstream: string | null;
  downstream: string | null;
  notes: string | null;
  depth: number;
};

// GET /value-streams — list streams in the tenant.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streams = await prisma.valueStream.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, domain: true },
    });
    res.json(streams);
  } catch (e) { next(e); }
});

// GET /value-streams/:id — stream + L3/L4 sub-streams (recursive CTE) +
// participating roles with their participation type.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vs = await tenantValueStream(req.params.id, req.tenantId);
    if (!vs) return res.status(404).json({ error: 'Not found' });

    // Prisma can't express WITH RECURSIVE through the query builder, so the
    // L3→L4 sub-stream tree is a typed raw query (architectural call: $queryRaw
    // recursive CTE for deep drill-downs). ${vs.id} is parameterized.
    const subStreams = await prisma.$queryRaw<SubRow[]>`
      WITH RECURSIVE tree AS (
        SELECT id, "parentId", level, name, inputs, outputs, upstream, downstream, notes, 0 AS depth
        FROM "SubValueStream"
        WHERE "valueStreamId" = ${vs.id} AND "parentId" IS NULL
        UNION ALL
        SELECT s.id, s."parentId", s.level, s.name, s.inputs, s.outputs, s.upstream, s.downstream, s.notes, tree.depth + 1
        FROM "SubValueStream" s
        JOIN tree ON s."parentId" = tree.id
      )
      SELECT id, "parentId", level, name, inputs, outputs, upstream, downstream, notes, depth FROM tree
      ORDER BY depth, name
    `;

    const roleLinks = await prisma.roleValueStream.findMany({
      where: { valueStreamId: vs.id },
      orderBy: [{ participationType: 'asc' }, { subStream: 'asc' }],
      include: { role: { select: { id: true, name: true, roleFamily: true } } },
    });

    res.json({
      id: vs.id,
      name: vs.name,
      domain: vs.domain,
      subStreams,
      roles: roleLinks.map((l) => ({
        roleId: l.roleId,
        roleName: l.role.name,
        participationType: l.participationType,
        subStream: l.subStream,
      })),
    });
  } catch (e) { next(e); }
});

export default router;
