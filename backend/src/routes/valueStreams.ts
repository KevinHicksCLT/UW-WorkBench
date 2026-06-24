import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { processSubtree, rolesForNodes } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);

// GET /value-streams — the canonical streams (process L2 nodes), with the
// parent segment as the domain grouping.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nodes = await prisma.processNode.findMany({
      where: { processLevelType: { levelNumber: 2 }, company: { tenantId: req.tenantId } },
      // Value-chain order (segment, then stream sortOrder) — not alphabetical.
      orderBy: [{ parent: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
    });
    res.json(nodes.map((n) => ({ id: n.id, name: n.displayValue, domain: n.parent?.displayValue ?? null })));
  } catch (e) { next(e); }
});

// GET /value-streams/:id — stream + L3 process areas / L4 sub-processes (from the
// closure subtree, depth-ordered) + participating roles. erd_v5 replaces the
// recursive CTE + "L3‖L4" string-key joins with one closure read.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const node = await prisma.processNode.findFirst({
      where: { id: req.params.id, processLevelType: { levelNumber: 2 }, company: { tenantId: req.tenantId } },
      select: { id: true, displayValue: true, companyId: true, parent: { select: { displayValue: true } } },
    });
    if (!node) return res.status(404).json({ error: 'Not found' });

    // Whole subtree (L3 areas, L4 sub-processes, L5 task steps) in one closure read.
    const { nodes } = await processSubtree(node.id, { excludeSelf: true });
    const byParent = new Map<string, typeof nodes>();
    for (const n of nodes) {
      const p = n.parentId ?? '';
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(n);
    }
    const l3s = nodes.filter((n) => n.depth === 1);

    // Owner role per L5 task node → the sub-process's step list (name + lead).
    const taskIds = nodes.filter((n) => n.depth === 3).map((n) => n.id);
    const taskRoles = await rolesForNodes(taskIds);
    const leadOf = (id: string) => taskRoles.get(id)?.find((r) => r.role_ === 'Owner')?.name ?? null;

    const processAreas = l3s.map((area) => ({
      id: area.id,
      name: area.displayValue,
      subProcesses: (byParent.get(area.id) ?? []).filter((s) => s.depth === 2).map((sub) => ({
        id: sub.id,
        name: sub.displayValue,
        description: null as string | null,
        inputs: [] as string[],
        outputs: [] as string[],
        steps: (byParent.get(sub.id) ?? []).filter((s) => s.depth === 3).map((step) => ({ name: step.displayValue, leads: leadOf(step.id) })),
      })),
    }));

    // Participating roles — every role linked anywhere in the subtree, with the
    // strongest relation (Owner → Lead beats Participant → Support).
    const allNodeRoles = await rolesForNodes([node.id, ...nodes.map((n) => n.id)]);
    const roleMap = new Map<string, { roleId: string; roleName: string; participationType: string }>();
    for (const entries of allNodeRoles.values()) {
      for (const e of entries) {
        const part = e.role_ === 'Owner' ? 'Lead' : 'Support';
        const cur = roleMap.get(e.id);
        if (!cur || (part === 'Lead' && cur.participationType !== 'Lead')) {
          roleMap.set(e.id, { roleId: e.id, roleName: e.name, participationType: part });
        }
      }
    }
    const roles = [...roleMap.values()].sort((a, b) =>
      a.participationType === b.participationType ? a.roleName.localeCompare(b.roleName) : a.participationType === 'Lead' ? -1 : 1);

    // Per-stream KPI definitions (metrics keyed to nodes in the subtree).
    const metrics = await prisma.metric.findMany({
      where: { processNodeId: { in: [node.id, ...nodes.map((n) => n.id)] } },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, unit: true, value: true, kind: true, period: true },
    });

    res.json({
      id: node.id,
      name: node.displayValue,
      domain: node.parent?.displayValue ?? null,
      subStreams: [], // retained key (Flow Map tab); closure now drives processAreas
      processAreas,
      metrics,
      roles,
    });
  } catch (e) { next(e); }
});

export default router;
