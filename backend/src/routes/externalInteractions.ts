import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /external-interactions — rows feeding the dependency graph
// (external party ↔ internal owner role ↔ related value stream).
// erd_v5: ExternalInteraction now carries real FKs — externalParty (name +
// partyType), role (internal owner), processNode (related value stream). The
// old free-text columns (divisionFunction, inputs/outputs, dependencyType,
// frequency, notes) were dropped; we surface `nature` and null the rest while
// keeping the response keys identical so the graph renders unchanged.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.externalInteraction.findMany({
      where: { externalParty: { company: { tenantId: req.tenantId } } },
      orderBy: [{ externalParty: { partyType: 'asc' } }, { externalParty: { name: 'asc' } }],
      select: {
        id: true,
        nature: true,
        externalParty: { select: { name: true, partyType: true } },
        role: { select: { id: true, displayValue: true } },
        processNode: { select: { displayValue: true } },
      },
    });
    res.json(
      items.map((e) => ({
        id: e.id,
        partyType: e.externalParty.partyType,
        externalRole: e.externalParty.name,
        internalRoleId: e.role?.id ?? null,
        internalRoleName: e.role?.displayValue ?? null,
        divisionFunction: null,
        interactionType: e.nature,
        inputs: null,
        outputs: null,
        relatedValueStream: e.processNode?.displayValue ?? null,
        dependencyType: e.nature,
        frequency: null,
        notes: null,
      }))
    );
  } catch (e) { next(e); }
});

export default router;
