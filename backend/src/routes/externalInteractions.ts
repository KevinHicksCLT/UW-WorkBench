import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /external-interactions — rows feeding the dependency graph
// (external party ↔ internal owner role ↔ related value stream).
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.externalInteraction.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ partyType: 'asc' }, { externalRole: 'asc' }],
      include: { internalRole: { select: { id: true, name: true } } },
    });
    res.json(
      items.map((e) => ({
        id: e.id,
        partyType: e.partyType,
        externalRole: e.externalRole,
        internalRoleId: e.internalRoleId,
        internalRoleName: e.internalRole?.name ?? e.internalRoleOwner,
        divisionFunction: e.divisionFunction,
        interactionType: e.interactionType,
        inputs: e.inputs,
        outputs: e.outputs,
        relatedValueStream: e.relatedValueStream,
        dependencyType: e.dependencyType,
        frequency: e.frequency,
        notes: e.notes,
      }))
    );
  } catch (e) { next(e); }
});

export default router;
