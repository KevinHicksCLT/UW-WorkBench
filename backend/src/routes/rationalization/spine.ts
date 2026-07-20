// Spine read API for the Workspace's Value-streams and Roles comparison
// lenses. Pulls the REAL operating-model graph — value streams with their
// L3 area → L4 sub-process → L5 task subtrees, and roles with their owned /
// participated tasks — so the boards compare live data, nothing authored.
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { ancestorNames, processSubtree } from '../../lib/resolvers/index.js';
import { activeCompanyId } from './helpers.js';

export function registerSpineRoutes(router: Router) {
  // GET /rationalization/spine/streams — every L2 value stream with its L1
  // domain and task count. The comparison picker's pool.
  router.get('/spine/streams', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;

      const levels = await prisma.processLevelType.findMany({
        where: { companyId },
        select: { id: true, levelNumber: true },
      });
      const l2Ids = levels.filter((l) => l.levelNumber === 2).map((l) => l.id);
      const streams = await prisma.processNode.findMany({
        where: { companyId, processLevelTypeId: { in: l2Ids } },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          displayValue: true,
          parent: { select: { displayValue: true } },
        },
      });

      // One grouped closure query gives every stream's task count.
      const counts = await prisma.processNodeClosure.groupBy({
        by: ['ancestorId'],
        where: {
          ancestorId: { in: streams.map((s) => s.id) },
          descendant: { isTask: true },
        },
        _count: { descendantId: true },
      });
      const countBy = new Map(counts.map((c) => [c.ancestorId, c._count.descendantId]));

      res.json(
        streams.map((s) => ({
          id: s.id,
          name: s.displayValue,
          domain: s.parent?.displayValue ?? null,
          taskCount: countBy.get(s.id) ?? 0,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  // GET /rationalization/spine/streams/:id — one stream's full subtree:
  // L3 areas → L4 sub-processes → L5 tasks, straight off the closure.
  router.get('/spine/streams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const root = await prisma.processNode.findFirst({
        where: { id: req.params.id, companyId },
        select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
      });
      if (!root) return res.status(404).json({ error: 'Not found' });

      const { nodes } = await processSubtree(root.id, { excludeSelf: true });
      const byParent = new Map<string, typeof nodes>();
      for (const n of nodes) {
        const g = byParent.get(n.parentId ?? '') ?? [];
        g.push(n);
        byParent.set(n.parentId ?? '', g);
      }
      // Tasks can hang at any depth; each L3 branch flattens its leaf tasks
      // under the L4 (or the L3 itself when a branch skips a level).
      const areas = (byParent.get(root.id) ?? []).map((l3) => {
        const l4s = (byParent.get(l3.id) ?? []).filter((n) => !n.isTask);
        const looseTasks = (byParent.get(l3.id) ?? []).filter((n) => n.isTask);
        const subs = l4s.map((l4) => {
          const collect = (id: string): { id: string; name: string }[] => {
            const kids = byParent.get(id) ?? [];
            return kids.flatMap((k) =>
              k.isTask ? [{ id: k.id, name: k.displayValue }] : collect(k.id),
            );
          };
          return { id: l4.id, name: l4.displayValue, tasks: collect(l4.id) };
        });
        if (looseTasks.length) {
          subs.push({
            id: `${l3.id}:direct`,
            name: l3.displayValue,
            tasks: looseTasks.map((t) => ({ id: t.id, name: t.displayValue })),
          });
        }
        return { id: l3.id, name: l3.displayValue, subs };
      });

      res.json({
        id: root.id,
        name: root.displayValue,
        domain: root.parent?.displayValue ?? null,
        areas,
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /rationalization/spine/roles — every role with its org home and task
  // counts. The Roles comparison picker's pool, grouped by division/department.
  router.get('/spine/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;

      const roles = await prisma.role.findMany({
        where: { companyId },
        orderBy: { displayValue: 'asc' },
        select: {
          id: true,
          displayValue: true,
          roleFamily: true,
          orgUnit: {
            select: { displayValue: true, parent: { select: { displayValue: true } } },
          },
        },
      });
      const counts = await prisma.nodeRole.groupBy({
        by: ['roleId', 'role_'],
        where: { role: { companyId }, processNode: { isTask: true } },
        _count: { id: true },
      });
      const byRole = new Map<string, { owner: number; participant: number }>();
      for (const c of counts) {
        const r = byRole.get(c.roleId) ?? { owner: 0, participant: 0 };
        if (c.role_ === 'Owner') r.owner += c._count.id;
        else r.participant += c._count.id;
        byRole.set(c.roleId, r);
      }

      res.json(
        roles.map((r) => ({
          id: r.id,
          name: r.displayValue,
          family: r.roleFamily,
          department: r.orgUnit?.displayValue ?? null,
          division: r.orgUnit?.parent?.displayValue ?? null,
          ownedTasks: byRole.get(r.id)?.owner ?? 0,
          participantTasks: byRole.get(r.id)?.participant ?? 0,
        })),
      );
    } catch (e) {
      next(e);
    }
  });

  // GET /rationalization/spine/roles/:id — one role's task set with ancestry
  // (value stream › L3 › L4) and involvement kind.
  router.get('/spine/roles/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;
      const role = await prisma.role.findFirst({
        where: { id: req.params.id, companyId },
        select: {
          id: true,
          displayValue: true,
          orgUnit: {
            select: { displayValue: true, parent: { select: { displayValue: true } } },
          },
        },
      });
      if (!role) return res.status(404).json({ error: 'Not found' });

      const links = await prisma.nodeRole.findMany({
        where: { roleId: role.id, processNode: { isTask: true } },
        select: {
          role_: true,
          processNode: { select: { id: true, displayValue: true } },
        },
      });
      const nodeIds = [...new Set(links.map((l) => l.processNode.id))];
      const names = await ancestorNames(nodeIds);

      res.json({
        id: role.id,
        name: role.displayValue,
        department: role.orgUnit?.displayValue ?? null,
        division: role.orgUnit?.parent?.displayValue ?? null,
        tasks: links.map((l) => {
          const loc = names.get(l.processNode.id);
          return {
            id: l.processNode.id,
            name: l.processNode.displayValue,
            involvement: l.role_,
            valueStream: loc?.valueStreamName ?? null,
            l3: loc?.l3 ?? null,
            l4: loc?.l4 ?? null,
          };
        }),
      });
    } catch (e) {
      next(e);
    }
  });
}
