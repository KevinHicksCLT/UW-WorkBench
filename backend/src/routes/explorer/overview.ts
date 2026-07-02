/**
 * Map bootstrap (/overview) + the flat value-stream list with participating divisions/categories/roles.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtrees, rolesForNodes } from '../../lib/resolvers/index.js';
import { activeCompany, processLevelMap } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerOverviewRoutes(router: Router): void {
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l1 = idOf(1); const l2 = idOf(2);

    const [domains, divisions, divRoleCounts] = await Promise.all([
      l1 ? prisma.processNode.findMany({ where: { companyId: company.id, processLevelTypeId: l1 }, orderBy: { sortOrder: 'asc' }, select: { id: true, displayValue: true } }) : Promise.resolve([]),
      l2 ? prisma.processNode.findMany({ where: { companyId: company.id, processLevelTypeId: l2 }, orderBy: [{ parent: { sortOrder: 'asc' } }, { sortOrder: 'asc' }], select: { id: true, displayValue: true, parentId: true } }) : Promise.resolve([]),
      // role degree per L2 node (NodeRole) → the "roles" badge on each division.
      prisma.nodeRole.groupBy({ by: ['processNodeId'], where: { companyId: company.id }, _count: { _all: true } }),
    ]);
    const domainName = new Map(domains.map((d) => [d.id, d.displayValue]));
    const vsByDomain = new Map<string, number>();
    for (const d of divisions) { const p = d.parentId; if (p) vsByDomain.set(p, (vsByDomain.get(p) ?? 0) + 1); }
    const roleDeg = new Map(divRoleCounts.map((g) => [g.processNodeId, g._count._all]));

    res.json({
      company: { id: company.id, name: company.name },
      counts: { domains: domains.length, divisions: divisions.length, valueStreams: divisions.length },
      domains: domains.map((d) => ({ id: d.id, name: d.displayValue, valueStreams: vsByDomain.get(d.id) ?? 0 })),
      divisions: divisions.map((d) => ({ id: d.id, name: d.displayValue, higherCategory: d.parentId ? domainName.get(d.parentId) ?? null : null, higherCategoryId: d.parentId ?? null, roles: roleDeg.get(d.id) ?? 0 })),
    });
  } catch (e) { next(e); }
});

// Flat value-stream list (process L2) with the divisions / categories / roles that
// participate — used by the cross-cutting bottom rail of the column board.
router.get('/value-streams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l2 = idOf(2);
    const streams = l2 ? await prisma.processNode.findMany({
      where: { companyId: company.id, processLevelTypeId: l2 },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true, parentId: true, parent: { select: { displayValue: true } } },
    }) : [];

    // Roles participating in each stream's subtree, with their home division.
    // One batched closure read across all streams (not two queries per stream).
    // The roles' home org units ride along via the resolver's opt-in include —
    // one batched query over distinct role ids, no second Role.findMany here.
    const subtreeByStream = await processSubtrees(streams.map((s) => s.id));
    const allNodeIds = [...subtreeByStream.values()].flatMap((t) => t.nodes.map((n) => n.id));
    const roleEntries = await rolesForNodes(allNodeIds, { withOrgUnit: true });

    res.json({
      valueStreams: streams.map((s) => {
        const nodeIds = (subtreeByStream.get(s.id)?.nodes ?? []).map((n) => n.id);
        const roleSet = new Set<string>();
        const divIds = new Set<string>();
        const categories = new Set<string>();
        for (const nid of nodeIds) for (const r of roleEntries.get(nid) ?? []) {
          roleSet.add(r.id);
          const home = r.orgUnit;
          if (home) { divIds.add(home.id); if (home.parent?.displayValue) categories.add(home.parent.displayValue); }
        }
        return {
          id: s.id, name: s.displayValue, domain: s.parent?.displayValue ?? null, domainId: s.parentId,
          divisionIds: [...divIds], categories: [...categories], roleIds: [...roleSet],
        };
      }),
    });
  } catch (e) { next(e); }
});

// AI-adoption heat-map (Telemetry / Active AI). Value-stream ProcessNodes (L2)
}
