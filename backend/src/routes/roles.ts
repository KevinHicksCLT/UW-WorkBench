import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ancestorNames } from '../lib/resolvers/index.js';

const router = Router();
router.use(requireAuth);

// Group responsibilities by their checklist name for display, de-duplicating by
// normalized text within each group.
function groupByChecklist(rows: { text: string; checklist: string | null }[]) {
  const m = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const cat = r.checklist ?? 'Uncategorized';
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

// GET /roles/:id — role + division/department (org closure), value-stream
// participation, deliverables, the role's task ProcessNodes and its checklist
// responsibilities. erd_v5: every link is an FK seek off the role (NodeRole,
// RoleDeliverable, ChecklistItem) — no company-wide text scan.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: {
        id: true, displayValue: true, companyId: true, orgUnitId: true,
        company: { select: { id: true, name: true } },
        orgUnit: {
          select: {
            id: true, displayValue: true,
            orgLevelType: { select: { levelNumber: true } },
            parent: { select: { id: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } } },
          },
        },
      },
    });
    if (!role) return res.status(404).json({ error: 'Not found' });

    const [nodeRoles, roleDelivs, checkItems] = await Promise.all([
      // The role's task links (Owner = Lead, Participant = Support).
      prisma.nodeRole.findMany({
        where: { roleId: role.id },
        select: {
          role_: true,
          processNode: { select: { id: true, displayValue: true, sortOrder: true } },
        },
      }),
      // The deliverables the role owns/contributes.
      prisma.roleDeliverable.findMany({
        where: { roleId: role.id },
        select: { role_: true, deliverable: { select: { id: true, title: true } } },
      }),
      // Responsibilities — checklist items assigned to the role.
      prisma.checklistItem.findMany({
        where: { roleId: role.id },
        orderBy: { id: 'asc' },
        select: { text: true, checklist: { select: { name: true } } },
      }),
    ]);

    // Resolve each task node's location strings once via the closure.
    const nodeIds = nodeRoles.map((n) => n.processNode.id);
    const loc = await ancestorNames(nodeIds);

    // processTasks — one per task node the role leads/supports.
    type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
    const processTasks: ProcTask[] = nodeRoles.map((nr) => {
      const a = loc.get(nr.processNode.id);
      return {
        valueStreamId: a?.valueStreamId ?? '',
        valueStreamName: a?.valueStreamName ?? '—',
        l3: a?.l3 ?? null,
        l4: a?.l4 ?? null,
        stepNumber: nr.processNode.sortOrder,
        name: nr.processNode.displayValue,
        relation: (nr.role_ === 'Owner' ? 'Lead' : 'Support') as 'Lead' | 'Support',
        outputs: null,
      };
    }).sort((a, b) => a.valueStreamName.localeCompare(b.valueStreamName) || String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')) || a.stepNumber - b.stepNumber);

    // ioRows — the role's deliverables grouped by (value stream, L4). The task
    // location feeding a deliverable is no longer stored, so they group under the
    // role's strongest stream (the value stream most of its task nodes roll up to).
    const primaryVs = (() => {
      const counts = new Map<string, { name: string; n: number }>();
      for (const a of loc.values()) {
        if (!a.valueStreamId) continue;
        const e = counts.get(a.valueStreamId) ?? { name: a.valueStreamName ?? '—', n: 0 };
        e.n++; counts.set(a.valueStreamId, e);
      }
      const top = [...counts.entries()].sort((x, y) => y[1].n - x[1].n)[0];
      const first = processTasks[0];
      return top ? { id: top[0], name: top[1].name, l3: null as string | null, l4: null as string | null } : (first ? { id: first.valueStreamId, name: first.valueStreamName, l3: first.l3, l4: first.l4 } : null);
    })();
    const ioRows = roleDelivs.length && primaryVs
      ? [{ valueStreamId: primaryVs.id, valueStreamName: primaryVs.name, domain: null as string | null, l3: primaryVs.l3, l4: primaryVs.l4, inputs: [] as string[], deliverables: [...new Set(roleDelivs.map((d) => d.deliverable.title))] }]
      : [];
    const deliverableCount = ioRows.reduce((n, r) => n + r.deliverables.length, 0);
    const inputCount = 0;

    // participation — the distinct value streams the role's task nodes roll up
    // to, with the strongest relation (Lead beats Support).
    const partMap = new Map<string, { valueStreamId: string; valueStreamName: string; participationType: 'Lead' | 'Support' }>();
    for (const nr of nodeRoles) {
      const a = loc.get(nr.processNode.id);
      if (!a?.valueStreamId) continue;
      const rel = nr.role_ === 'Owner' ? 'Lead' : 'Support';
      const cur = partMap.get(a.valueStreamId);
      if (!cur || (rel === 'Lead' && cur.participationType !== 'Lead')) {
        partMap.set(a.valueStreamId, { valueStreamId: a.valueStreamId, valueStreamName: a.valueStreamName ?? '—', participationType: rel });
      }
    }
    const participation = [...partMap.values()]
      .sort((a, b) => (a.participationType === b.participationType ? a.valueStreamName.localeCompare(b.valueStreamName) : a.participationType === 'Lead' ? -1 : 1))
      .map((p) => ({ valueStreamId: p.valueStreamId, valueStreamName: p.valueStreamName, domain: null, participationType: p.participationType, subStream: null, inputs: null, outputs: null }));

    // org context: a role homed at L3 (Department) → department = orgUnit,
    // division = its L2 parent; a role homed directly at L2 → division = orgUnit,
    // department = null ("Direct to division").
    let division: { id: string; name: string } | null = null;
    let department: { id: string; name: string } | null = null;
    if (role.orgUnit) {
      const lvl = role.orgUnit.orgLevelType?.levelNumber;
      if (lvl === 3) {
        department = { id: role.orgUnit.id, name: role.orgUnit.displayValue };
        if (role.orgUnit.parent && role.orgUnit.parent.orgLevelType?.levelNumber === 2) {
          division = { id: role.orgUnit.parent.id, name: role.orgUnit.parent.displayValue };
        }
      } else {
        division = { id: role.orgUnit.id, name: role.orgUnit.displayValue };
      }
    }

    res.json({
      ioRows,
      deliverableCount,
      inputCount,
      processTasks,
      id: role.id,
      name: role.displayValue,
      roleFamily: null,
      roleLevel: null,
      company: role.company,
      division,
      department,
      participation,
      responsibilities: groupByChecklist(checkItems.map((c) => ({ text: c.text, checklist: c.checklist?.name ?? null }))),
    });
  } catch (e) { next(e); }
});

export default router;
