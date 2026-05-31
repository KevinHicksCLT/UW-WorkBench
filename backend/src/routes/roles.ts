import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

type WithCategory = { text: string; category: { name: string } | null };

// Group checklist items / tasks by category name for display.
function groupByCategory(rows: WithCategory[]) {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const cat = r.category?.name ?? 'Uncategorized';
    if (!m.has(cat)) m.set(cat, []);
    m.get(cat)!.push(r.text);
  }
  return [...m.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

// GET /roles/:id — role + division/department, value-stream participation,
// external interactions, and checklist items + role tasks grouped by category.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        company: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        valueStreamLinks: {
          orderBy: [{ participationType: 'asc' }, { subStream: 'asc' }],
          include: { valueStream: { select: { id: true, name: true, domain: true } } },
        },
        externalInteractions: {
          select: { id: true, partyType: true, externalRole: true, interactionType: true, relatedValueStream: true },
        },
        _count: { select: { checklistItems: true, roleTasks: true } },
      },
    });
    if (!role) return res.status(404).json({ error: 'Not found' });

    const [items, tasks] = await Promise.all([
      prisma.checklistItem.findMany({
        where: { roleId: role.id },
        select: { text: true, category: { select: { name: true } } },
        orderBy: { id: 'asc' },
      }),
      prisma.roleTask.findMany({
        where: { roleId: role.id },
        select: { text: true, category: { select: { name: true } } },
        orderBy: { id: 'asc' },
      }),
    ]);

    res.json({
      ...role,
      participation: role.valueStreamLinks.map((l) => ({
        valueStreamId: l.valueStreamId,
        valueStreamName: l.valueStream.name,
        domain: l.valueStream.domain,
        participationType: l.participationType,
        subStream: l.subStream,
      })),
      checklist: groupByCategory(items),
      tasks: groupByCategory(tasks),
    });
  } catch (e) { next(e); }
});

export default router;
