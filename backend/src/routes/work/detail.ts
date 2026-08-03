import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { ancestorNames, rolesForNodes } from '../../lib/resolvers/index.js';
import { taskPlans } from '../../lib/workPlan.js';
import { SCORE_OF, TOP_CONTRIB, activeCompanyId, isExec } from './helpers.js';

// Detail grain of /work — the right-hand drill-down sidebar behind a
// Deliverables/Tasks row click.

export function registerDetailRoutes(router: Router): void {
  // ── Drill-down: a single deliverable ────────────────────────────────────────
  router.get('/deliverable/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;

      const d = await prisma.deliverable.findFirst({
        where: { id: req.params.id, companyId },
        select: {
          id: true,
          title: true,
          description: true,
          automatability: true,
          roleDeliverables: {
            select: { role_: true, role: { select: { id: true, displayValue: true } } },
          },
          nodeDeliverables: {
            select: { processNodeId: true, processNode: { select: { isTask: true } } },
          },
        },
      });
      if (!d) return res.status(404).json({ error: 'Not found' });

      const nodeIds = d.nodeDeliverables.map((n) => n.processNodeId);
      // The L4's grouped L5 tasks (exclude the L4 self-link).
      const taskNodeIds = d.nodeDeliverables
        .filter((n) => n.processNode?.isTask)
        .map((n) => n.processNodeId);
      const [loc, nodeRoles] = await Promise.all([
        ancestorNames(nodeIds),
        rolesForNodes(taskNodeIds),
      ]);
      const first = nodeIds[0];
      const a = first ? loc.get(first) : undefined;
      const ownerRoles = d.roleDeliverables
        .filter((r) => r.role_ === 'Owner')
        .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
      const contributorRoles = d.roleDeliverables
        .filter((r) => r.role_ === 'Contributor')
        .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
      // Deliverable roll-up = defined/total plan keys across its tasks (Work Library).
      const plans = await taskPlans(taskNodeIds);
      let planDefined = 0;
      let planTotal = 0;
      for (const p of plans.values()) {
        planDefined += p.defined;
        planTotal += p.total;
      }
      const subProcesses = [
        ...new Set(
          [...loc.values()].map((x) => [x.l3, x.l4].filter(Boolean).join(' · ')).filter(Boolean),
        ),
      ];

      // The L4's grouped L5 task nodes are the deliverable's tasks — each with
      // its own automatability score and Work Library plan coverage (no invented
      // fields; everything here is a DB row or derived from one).
      const tasks = taskNodeIds.length
        ? (
            await prisma.processNode.findMany({
              where: { id: { in: taskNodeIds } },
              orderBy: { displayValue: 'asc' },
              select: { id: true, displayValue: true, automatability: true },
            })
          ).map((n) => {
            const plan = plans.get(n.id);
            return {
              id: n.id,
              title: n.displayValue,
              owner: nodeRoles.get(n.id)?.find((r) => r.role_ === 'Owner')?.name ?? null,
              agentScore: n.automatability ? (SCORE_OF[n.automatability] ?? null) : null,
              plan: plan ? { defined: plan.defined, total: plan.total } : null,
            };
          })
        : [];

      res.json({
        kind: 'deliverable',
        id: d.id,
        title: d.title,
        description: d.description,
        type: 'Deliverable',
        owner: ownerRoles[0]?.name ?? null,
        valueStream: a?.valueStreamId
          ? { id: a.valueStreamId, name: a.valueStreamName, domain: a.domain }
          : null,
        level3: a?.l3 ?? null,
        level4: a?.l4 ?? null,
        division: a?.division ?? null,
        department: a?.department ?? null,
        subProcesses,
        ownerRoles,
        contributorRoles,
        planRollup: { defined: planDefined, total: planTotal },
        tasks,
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Drill-down: a single task ───────────────────────────────────────────────
  router.get('/task/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await activeCompanyId(req, res);
      if (!companyId) return;

      const t = await prisma.processNode.findFirst({
        where: { id: req.params.id, companyId, isTask: true },
        select: {
          id: true,
          displayValue: true,
          description: true,
          automatability: true,
          attributes: true,
          nodeRoles: {
            select: { role_: true, role: { select: { id: true, displayValue: true } } },
          },
          nodeDeliverables: { select: { deliverable: { select: { id: true, title: true } } } },
        },
      });
      if (!t) return res.status(404).json({ error: 'Not found' });

      const loc = (await ancestorNames([t.id])).get(t.id);
      const plan = (await taskPlans([t.id])).get(t.id) ?? null;
      const ownerRole = t.nodeRoles.find((r) => r.role_ === 'Owner')?.role ?? null;
      const leadRoles = t.nodeRoles
        .filter((r) => r.role_ === 'Owner')
        .map((r) => ({ id: r.role.id, name: r.role.displayValue }));
      // contributors = participant roles, exec-stripped + capped (mirrors the list view).
      const supportRoles = t.nodeRoles
        .filter(
          (r) =>
            r.role_ === 'Participant' &&
            r.role.id !== ownerRole?.id &&
            !isExec(r.role.displayValue),
        )
        .map((r) => ({ id: r.role.id, name: r.role.displayValue }))
        .slice(0, TOP_CONTRIB);
      // The task's own workbook deliverable TEXT (preserved on the node) — what the
      // old per-task Deliverable used to show. Falls back to the L4 grouping title.
      const attrDeliv = (t.attributes as { deliverable?: string } | null)?.deliverable ?? null;
      const groupDeliv = t.nodeDeliverables[0]?.deliverable ?? null;

      res.json({
        kind: 'task',
        id: t.id,
        title: t.displayValue,
        description: t.description,
        owner: ownerRole?.displayValue ?? null,
        jiraKey: null,
        plan: plan
          ? {
              checklist: plan.checklist,
              testing: plan.testing,
              defined: plan.defined,
              total: plan.total,
            }
          : null,
        ownerRole: ownerRole ? { id: ownerRole.id, name: ownerRole.displayValue } : null,
        agentScore: t.automatability ? (SCORE_OF[t.automatability] ?? null) : null,
        agentRationale: null,
        valueStream: loc?.valueStreamId
          ? { id: loc.valueStreamId, name: loc.valueStreamName }
          : null,
        level3: loc?.l3 ?? null,
        level4: loc?.l4 ?? null,
        subProcess: loc ? [loc.l3, loc.l4].filter(Boolean).join(' · ') || null : null,
        leadRoles,
        leadExtra: [],
        supportRoles,
        supportExtra: [],
        outputs: [],
        // `deliverable` = the task's own output text (title preserved for the UI);
        // `deliverableGroup` = the L4 sub-process Deliverable row it belongs to.
        deliverable: attrDeliv
          ? { id: groupDeliv?.id ?? null, title: attrDeliv }
          : groupDeliv
            ? { id: groupDeliv.id, title: groupDeliv.title }
            : null,
        deliverableGroup: groupDeliv ? { id: groupDeliv.id, title: groupDeliv.title } : null,
        downstream: [],
      });
    } catch (e) {
      next(e);
    }
  });
}
