import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { roleMatcher, cellMentionsRole } from '../lib/roleMatch.js';

const router = Router();
router.use(requireAuth);

type WithCategory = { text: string; category: { name: string } | null };

const isDeliverable = (type: string) => /output|deliver/i.test(type);

// Group responsibilities by category name for display, de-duplicating by
// normalized text within each category. (ChecklistItem and RoleTask are ~99.8%
// identical, so they are merged into one list — see the GET /:id handler.)
function groupByCategory(rows: WithCategory[]) {
  const m = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const cat = r.category?.name ?? 'Uncategorized';
    if (!m.has(cat)) { m.set(cat, []); seen.set(cat, new Set()); }
    const key = r.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.get(cat)!.has(key)) continue;
    seen.get(cat)!.add(key);
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

    const [items, tasks, assignments, ioItemRows, stepRows] = await Promise.all([
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
      // Users in the role (illustrative; hydrated later). Carries allocation so
      // the role drill-down can show who sits in the role.
      prisma.assignment.findMany({
        where: { roleId: role.id },
        orderBy: { person: { name: 'asc' } },
        select: { allocationPct: true, isPrimary: true, person: { select: { id: true, name: true, title: true, region: true, employmentType: true, vendor: true, illustrative: true } } },
      }),
      // Lowest-level I/O inventory (one row per input/deliverable at the L4
      // sub-process grain) tied to roles only by the free-text `keyRoles` column.
      prisma.ioItem.findMany({
        where: { valueStream: { companyId: role.companyId } },
        select: { type: true, name: true, l3: true, l4: true, keyRoles: true, dataElements: true, valueStream: { select: { id: true, name: true, domain: true } } },
      }),
      // L5 process steps — the lowest-level activities, tied to roles by the
      // `leads` / `supporting` columns. These are the role's process-level tasks.
      prisma.processStep.findMany({
        where: { valueStream: { companyId: role.companyId } },
        select: { name: true, l3: true, l4: true, stepNumber: true, leads: true, supporting: true, inputs: true, outputs: true, valueStream: { select: { id: true, name: true } } },
      }),
    ]);

    // Resolve which I/O items and process steps belong to THIS role, then
    // consolidate the inputs/deliverables into one row per (value stream, L4).
    const matches = roleMatcher({ name: role.name, itemRole: role.itemRole });
    const mine = (cell: string | null) => cellMentionsRole(cell, matches);

    type IoRow = { valueStreamId: string; valueStreamName: string; domain: string | null; l3: string | null; l4: string | null; inputs: string[]; deliverables: string[] };
    const rowMap = new Map<string, IoRow>();
    for (const io of ioItemRows) {
      if (!mine(io.keyRoles)) continue;
      const key = `${io.valueStream.id}␟${io.l3 ?? ''}␟${io.l4 ?? ''}`;
      let row = rowMap.get(key);
      if (!row) { row = { valueStreamId: io.valueStream.id, valueStreamName: io.valueStream.name, domain: io.valueStream.domain, l3: io.l3, l4: io.l4, inputs: [], deliverables: [] }; rowMap.set(key, row); }
      const bucket = isDeliverable(io.type) ? row.deliverables : row.inputs;
      if (!bucket.includes(io.name)) bucket.push(io.name);
    }
    const ioRows = [...rowMap.values()].sort((a, b) => a.valueStreamName.localeCompare(b.valueStreamName) || String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')));
    const deliverableCount = ioRows.reduce((n, r) => n + r.deliverables.length, 0);
    const inputCount = ioRows.reduce((n, r) => n + r.inputs.length, 0);

    type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
    const processTasks: ProcTask[] = [];
    for (const st of stepRows) {
      const lead = mine(st.leads);
      const support = !lead && mine(st.supporting);
      if (!lead && !support) continue;
      processTasks.push({ valueStreamId: st.valueStream.id, valueStreamName: st.valueStream.name, l3: st.l3, l4: st.l4, stepNumber: st.stepNumber, name: st.name, relation: lead ? 'Lead' : 'Support', outputs: st.outputs });
    }
    processTasks.sort((a, b) => a.valueStreamName.localeCompare(b.valueStreamName) || String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')) || a.stepNumber - b.stepNumber);

    res.json({
      // Lowest-level, role-resolved I/O + process tasks (see roleMatch.ts).
      ioRows,
      deliverableCount,
      inputCount,
      processTasks,
      ...role,
      // Each participation carries its workbook I/O (inputs/outputs) so the role
      // drill-down can show the role's deliverables alongside the value stream.
      participation: role.valueStreamLinks.map((l) => ({
        valueStreamId: l.valueStreamId,
        valueStreamName: l.valueStream.name,
        domain: l.valueStream.domain,
        participationType: l.participationType,
        subStream: l.subStream,
        inputs: l.inputs,
        outputs: l.outputs,
      })),
      people: assignments.map((a) => ({ ...a.person, allocationPct: a.allocationPct, isPrimary: a.isPrimary })),
      // Checklist + role-task rows are ~identical; merge + de-dupe into one list.
      responsibilities: groupByCategory([...items, ...tasks]),
    });
  } catch (e) { next(e); }
});

export default router;
