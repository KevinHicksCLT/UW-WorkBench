// Applications catalog — the systems where work is executed and memorialized.
// Feeds the Applications tab; sidebar app items deep-link here.
// erd_v5: each app's value streams + roles come from the NodeAppUsage junction
// (app → ProcessNode) joined to the closure (L2 ancestor = value stream) and
// NodeRole (roles working those nodes) — no name matching, no full-table loads.
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheResponses } from '../lib/responseCache.js';
import { ancestorNames, rolesForNodes } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);
router.use(cacheResponses(15_000));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const companyId = company.id;

    const [apps, usages] = await Promise.all([
      prisma.application.findMany({
        where: { companyId },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: {
          id: true, code: true, name: true, kind: true, category: true, vendor: true,
          criticality: true, systemOfRecord: true, illustrative: true,
          totalTco: true,
          orgUnit: { select: { displayValue: true } },
          _count: { select: { nodeAppUsages: true } },
        },
      }),
      // every node an app is used on → resolve that node's value stream + roles.
      prisma.nodeAppUsage.findMany({
        where: { companyId },
        select: { applicationId: true, processNodeId: true },
      }),
    ]);

    // Resolve every used node's value-stream name + roles in two batched passes.
    const nodeIds = [...new Set(usages.map((u) => u.processNodeId))];
    const [vsNames, nodeRoles] = await Promise.all([
      ancestorNames(nodeIds),
      rolesForNodes(nodeIds),
    ]);

    // applicationId → { value-stream names, roleId → name, division → usage count }
    const enrich = new Map<string, { vs: Set<string>; roles: Map<string, string>; div: Map<string, number> }>();
    for (const u of usages) {
      let b = enrich.get(u.applicationId);
      if (!b) { b = { vs: new Set(), roles: new Map(), div: new Map() }; enrich.set(u.applicationId, b); }
      const loc = vsNames.get(u.processNodeId);
      if (loc?.valueStreamName) b.vs.add(loc.valueStreamName);
      if (loc?.division) b.div.set(loc.division, (b.div.get(loc.division) ?? 0) + 1);
      for (const r of nodeRoles.get(u.processNodeId) ?? []) b.roles.set(r.id, r.name);
    }
    // the division an app most-used-in — fallback when it has no primary org unit.
    const topDiv = (m?: Map<string, number>) =>
      m && m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

    res.json({
      applications: apps.map((a) => {
        const b = enrich.get(a.id);
        const roleList = [...(b?.roles ?? new Map()).entries()].map(([id, name]) => ({ id, name }))
          .sort((x, y) => x.name.localeCompare(y.name));
        return {
          id: a.id, code: a.code, name: a.name, kind: a.kind, category: a.category, vendor: a.vendor,
          criticality: a.criticality, description: null, systemOfRecord: a.systemOfRecord, illustrative: a.illustrative,
          totalTco: a.totalTco, primaryDivisionName: a.orgUnit?.displayValue ?? topDiv(b?.div),
          stepUsages: a._count.nodeAppUsages, sorDeliverables: 0,
          valueStreams: [...(b?.vs ?? new Set<string>())].sort((x, y) => x.localeCompare(y)),
          roles: roleList,
        };
      }),
    });
  } catch (e) { next(e); }
});

export default router;
