import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { streamAncestry } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('third-parties'));

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

    // Most interactions carry no direct processNode, so the related value stream
    // is derived from the internal owner role's primary value stream (the L2 most
    // of its task nodes roll up to).
    const roleIds = [...new Set(items.map((i) => i.role?.id).filter((x): x is string => !!x))];
    const nodeRoles = roleIds.length
      ? await prisma.nodeRole.findMany({
          where: { roleId: { in: roleIds } },
          select: { roleId: true, processNodeId: true },
        })
      : [];
    const ancestry = await streamAncestry(nodeRoles.map((n) => n.processNodeId));
    const vsCountByRole = new Map<string, Map<string, number>>();
    for (const nr of nodeRoles) {
      const vs = ancestry.get(nr.processNodeId)?.valueStreamName;
      if (!vs) continue;
      const m = vsCountByRole.get(nr.roleId) ?? new Map<string, number>();
      m.set(vs, (m.get(vs) ?? 0) + 1);
      vsCountByRole.set(nr.roleId, m);
    }
    const primaryVs = (roleId: string | undefined) => {
      const m = roleId ? vsCountByRole.get(roleId) : undefined;
      return m && m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    };

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
        relatedValueStream: e.processNode?.displayValue ?? primaryVs(e.role?.id),
        dependencyType: e.nature,
        frequency: null,
        notes: null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

export default router;
