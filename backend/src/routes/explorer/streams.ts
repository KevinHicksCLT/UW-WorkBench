// Value-stream drill page payload — GET /explorer/streams/:id. Accepts a
// process L2 (value stream) or L3 (process area — what the Value Streams TOC
// rows actually carry) and expands it down the spine to L5 tasks, hierarchy
// assembled from a single closure-backed subtree read (never a recursive walk).
// Both levels return the same shape: areas → subs → tasks (an L3 root wraps
// itself as the single area).
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtree } from '../../lib/resolvers/index.js';

type StreamTask = { id: string; name: string; sortOrder: number };
type StreamSub = { id: string; name: string; sortOrder: number; tasks: StreamTask[] };
type StreamArea = { id: string; name: string; sortOrder: number; subs: StreamSub[] };

export function registerStreamRoutes(router: Router): void {
  router.get('/streams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const root = await prisma.processNode.findFirst({
        where: {
          id: req.params.id,
          company: { tenantId: req.tenantId },
          processLevelType: { levelNumber: { in: [2, 3] } },
        },
        select: {
          id: true,
          displayValue: true,
          sortOrder: true,
          processLevelType: { select: { levelNumber: true } },
          parent: {
            select: {
              id: true,
              displayValue: true,
              parent: { select: { displayValue: true } },
            },
          },
        },
      });
      if (!root) return res.status(404).json({ error: 'Not found' });
      const rootLevel = root.processLevelType?.levelNumber ?? 2;

      const { nodes } = await processSubtree(root.id, { excludeSelf: true });

      // Depths are relative to the root: an L2 root sees L3 at depth 1; an L3
      // root sees L4 at depth 1 and becomes the single "area" itself.
      const areaDepth = rootLevel === 2 ? 1 : 0;
      const subDepth = areaDepth + 1;

      const areas = new Map<string, StreamArea>();
      if (rootLevel === 3) {
        areas.set(root.id, {
          id: root.id,
          name: root.displayValue,
          sortOrder: root.sortOrder,
          subs: [],
        });
      } else {
        for (const n of nodes) {
          if (n.depth === areaDepth) {
            areas.set(n.id, { id: n.id, name: n.displayValue, sortOrder: n.sortOrder, subs: [] });
          }
        }
      }
      const subs = new Map<string, StreamSub>();
      for (const n of nodes) {
        if (n.depth === subDepth && n.parentId && areas.has(n.parentId)) {
          const sub: StreamSub = {
            id: n.id,
            name: n.displayValue,
            sortOrder: n.sortOrder,
            tasks: [],
          };
          subs.set(n.id, sub);
          areas.get(n.parentId)!.subs.push(sub);
        }
      }
      let taskCount = 0;
      for (const n of nodes) {
        if (n.isTask && n.parentId && subs.has(n.parentId)) {
          subs.get(n.parentId)!.tasks.push({
            id: n.id,
            name: n.displayValue,
            sortOrder: n.sortOrder,
          });
          taskCount++;
        }
      }
      const sorted = [...areas.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((a) => ({
          ...a,
          subs: a.subs
            .sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name))
            .map((s) => ({
              ...s,
              tasks: s.tasks.sort(
                (x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name),
              ),
            })),
        }));

      // Header context: an L2 shows its L1 domain; an L3 shows "domain · stream".
      const domain =
        rootLevel === 2
          ? (root.parent?.displayValue ?? null)
          : [root.parent?.parent?.displayValue, root.parent?.displayValue]
              .filter(Boolean)
              .join(' · ') || null;

      res.json({
        stream: { id: root.id, name: root.displayValue, domain },
        totals: { areas: sorted.length, subProcesses: subs.size, tasks: taskCount },
        areas: sorted,
      });
    } catch (e) {
      next(e);
    }
  });
}
