import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const PART_ORDER: Record<string, number> = { Lead: 0, Core: 1, Control: 2, Oversight: 3, Support: 4 };

// GET /departments/:id — department → roles, each with the role-level detail that
// used to live one click deeper (level, family, headcount, value-stream
// participation parsed into L3/L4, and responsibility/checklist counts). This
// lets the department page render a rich roles table instead of bare pills.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const department = await prisma.department.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        company: { select: { id: true, name: true } },
        division: { select: { id: true, name: true, higherCategory: true } },
        roles: {
          orderBy: { name: 'asc' },
          select: {
            id: true, name: true, roleLevel: true, roleFamily: true, description: true,
            _count: { select: { checklistItems: true, roleTasks: true } },
            valueStreamLinks: {
              orderBy: [{ participationType: 'asc' }, { subStream: 'asc' }],
              select: { valueStreamId: true, participationType: true, subStream: true, valueStream: { select: { name: true, domain: true, domainRef: { select: { name: true } } } } },
            },
          },
        },
      },
    });
    if (!department) return res.status(404).json({ error: 'Not found' });

    const roleIds = department.roles.map((r) => r.id);
    const head = roleIds.length
      ? await prisma.assignment.groupBy({ by: ['roleId'], where: { roleId: { in: roleIds } }, _count: { _all: true } })
      : [];
    const peopleByRole = new Map(head.map((h) => [h.roleId, h._count._all]));

    const roles = department.roles.map((r) => {
      const participations = r.valueStreamLinks
        .map((l) => {
          const [l3, l4] = (l.subStream ?? '').split(' — ');
          return {
            valueStreamId: l.valueStreamId,
            valueStreamName: l.valueStream.name,
            domain: l.valueStream.domainRef?.name ?? l.valueStream.domain ?? null,
            participationType: l.participationType,
            l3: l3 || null,
            l4: l4 || null,
          };
        })
        .sort((a, b) => (PART_ORDER[a.participationType] ?? 9) - (PART_ORDER[b.participationType] ?? 9) || a.valueStreamName.localeCompare(b.valueStreamName));
      return {
        id: r.id, name: r.name, roleLevel: r.roleLevel, roleFamily: r.roleFamily, description: r.description,
        peopleCount: peopleByRole.get(r.id) ?? 0,
        valueStreamCount: new Set(participations.map((p) => p.valueStreamId)).size,
        checklistCount: r._count.checklistItems,
        taskCount: r._count.roleTasks,
        participations,
      };
    });

    res.json({
      id: department.id, name: department.name,
      company: department.company, division: department.division,
      totals: { roles: roles.length, people: roles.reduce((a, r) => a + r.peopleCount, 0) },
      roles,
    });
  } catch (e) { next(e); }
});

export default router;
