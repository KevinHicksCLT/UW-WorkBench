/**
 * Inspector reads — the unified node detail (GET /:nodeId), the deliverable
 * chain (GET /:nodeId/chain), and the role/application/deliverable picker
 * search endpoints.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtree, rolesForNodes, appsForNodes } from '../../lib/resolvers/index.js';
import { taskPlans, subtreePlanRollup, type TaskPlan } from '../../lib/workPlan.js';
import { subtreeStandards, subtreeRegulations } from '../../lib/govRollup.js';
import { SCORE_OF, activeCompany, ownedNode } from './helpers.js';

/** Registers the inspector read routes on the shared router (order preserved). */
export function registerDetailRoutes(router: Router): void {
  router.get('/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const node = await ownedNode(req, company.id, req.params.nodeId);
      if (!node) return res.status(404).json({ error: 'Not found' });

      // Subtree (includes self) → the rollup scope. taskIds = the leaf steps.
      const { nodes } = await processSubtree(node.id);
      const subtreeIds = nodes.map((n) => n.id);
      const taskIds = nodes.filter((n) => n.isTask).map((n) => n.id);
      const detail = node.isTask;
      // Detail reads scope to the node itself; rollups to the whole subtree.
      const scopeIds = detail ? [node.id] : subtreeIds;

      const [nodeRoles, appUsages, delivLinks, checkLinks] = await Promise.all([
        prisma.nodeRole.findMany({
          where: { processNodeId: { in: scopeIds } },
          select: {
            id: true,
            processNodeId: true,
            role_: true,
            ownerLevel: true,
            validationStatus: true,
            role: { select: { id: true, displayValue: true } },
          },
        }),
        prisma.nodeAppUsage.findMany({
          where: { processNodeId: { in: scopeIds } },
          select: {
            id: true,
            processNodeId: true,
            usageType: true,
            application: { select: { id: true, name: true } },
          },
        }),
        prisma.nodeDeliverable.findMany({
          where: { processNodeId: { in: scopeIds } },
          select: {
            id: true,
            processNodeId: true,
            deliverable: { select: { id: true, title: true } },
          },
        }),
        prisma.nodeChecklist.findMany({
          where: { processNodeId: { in: scopeIds } },
          select: {
            id: true,
            processNodeId: true,
            checklistItem: { select: { id: true, text: true } },
          },
        }),
      ]);

      // Testing templates in scope: by task node OR by a deliverable in scope.
      const deliverableIds = [...new Set(delivLinks.map((d) => d.deliverable.id))];
      const testingScopeTaskIds = detail ? [node.id] : taskIds;
      const tOr: ({ taskNodeId: { in: string[] } } | { deliverableId: { in: string[] } })[] = [];
      if (testingScopeTaskIds.length) tOr.push({ taskNodeId: { in: testingScopeTaskIds } });
      if (deliverableIds.length) tOr.push({ deliverableId: { in: deliverableIds } });
      const testingRows = tOr.length
        ? await prisma.testingTemplate.findMany({
            where: { OR: tOr },
            select: {
              id: true,
              deliverableId: true,
              taskNodeId: true,
              system: true,
              location: true,
              checkType: true,
              expected: true,
            },
          })
        : [];

      // Counts (distinct entities across the scope).
      const counts = {
        roles: new Set(nodeRoles.map((r) => r.role.id)).size,
        applications: new Set(appUsages.map((a) => a.application.id)).size,
        deliverables: deliverableIds.length,
        tasks: detail ? 1 : taskIds.length,
        checklist: new Set(checkLinks.map((c) => c.checklistItem.id)).size,
        testing: new Set(testingRows.map((t) => t.id)).size,
        standards: 0,
        regulations: 0, // set below once governing links resolve
      };

      // Automation rollup (mirrors the Automatable page): each task's 1-5 score from
      // its automatability; "automatable" = score ≤ 2 (Workflow + Autonomous tier).
      const tiers: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let scored = 0;
      let auto = 0;
      for (const n of nodes) {
        if (!n.isTask || !n.automatability) continue;
        const s = SCORE_OF[n.automatability];
        if (typeof s !== 'number') continue;
        tiers[s] += 1;
        scored += 1;
        if (s <= 2) auto += 1;
      }
      const automation = {
        score: detail
          ? node.automatability
            ? (SCORE_OF[node.automatability] ?? null)
            : null
          : null,
        scored,
        auto,
        pct: scored ? Math.round((100 * auto) / scored) : null,
        tiers,
      };

      // Roles: detail = the node's rows (with the NodeRole id so the row is editable);
      // rollup = one entry per role, Owner wins, with a task degree for "· N tasks".
      type RoleRow = {
        nodeRoleId?: string;
        roleId: string;
        name: string;
        relation: string;
        raci?: string | null;
        tasks?: number;
        validationStatus?: string;
      };
      let roles: RoleRow[];
      if (detail) {
        roles = nodeRoles
          .map((r) => ({
            nodeRoleId: r.id,
            roleId: r.role.id,
            name: r.role.displayValue,
            relation: r.role_,
            raci: r.ownerLevel ?? null,
            validationStatus: r.validationStatus,
          }))
          .sort((a, b) =>
            a.relation === b.relation
              ? a.name.localeCompare(b.name)
              : a.relation === 'Owner'
                ? -1
                : 1,
          );
      } else {
        // Container level: links attached DIRECTLY to this node stay editable
        // (junction id present → the UI offers relation/RACI edit + detach);
        // everything inherited from the subtree aggregates into rollup rows.
        const own = nodeRoles.filter((r) => r.processNodeId === node.id);
        const inherited = nodeRoles.filter((r) => r.processNodeId !== node.id);
        const ownRows: RoleRow[] = own.map((r) => ({
          nodeRoleId: r.id,
          roleId: r.role.id,
          name: r.role.displayValue,
          relation: r.role_,
          raci: r.ownerLevel ?? null,
          validationStatus: r.validationStatus,
        }));
        const byRole = new Map<
          string,
          { roleId: string; name: string; owner: boolean; tasks: number }
        >();
        for (const r of inherited) {
          let e = byRole.get(r.role.id);
          if (!e) {
            e = { roleId: r.role.id, name: r.role.displayValue, owner: false, tasks: 0 };
            byRole.set(r.role.id, e);
          }
          e.tasks += 1;
          if (r.role_ === 'Owner') e.owner = true;
        }
        roles = [
          ...ownRows,
          ...[...byRole.values()]
            .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))
            .map((e) => ({
              roleId: e.roleId,
              name: e.name,
              relation: e.owner ? ('Owner' as const) : ('Participant' as const),
              tasks: e.tasks,
            })),
        ];
      }

      // Applications: detail = node rows (usageId editable); rollup = one per app.
      type AppRow = {
        usageId?: string;
        appId: string;
        name: string;
        usageType: string;
        tasks?: number;
      };
      let applications: AppRow[];
      if (detail) {
        applications = appUsages
          .map((a) => ({
            usageId: a.id,
            appId: a.application.id,
            name: a.application.name,
            usageType: a.usageType,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // Container level: this node's own usages stay editable; inherited
        // subtree usages aggregate (mirrors the roles handling above).
        const ownUsages = appUsages.filter((a) => a.processNodeId === node.id);
        const inheritedUsages = appUsages.filter((a) => a.processNodeId !== node.id);
        const ownAppRows: AppRow[] = ownUsages
          .map((a) => ({
            usageId: a.id,
            appId: a.application.id,
            name: a.application.name,
            usageType: a.usageType,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const byApp = new Map<
          string,
          { appId: string; name: string; types: Set<string>; tasks: number }
        >();
        for (const a of inheritedUsages) {
          let e = byApp.get(a.application.id);
          if (!e) {
            e = { appId: a.application.id, name: a.application.name, types: new Set(), tasks: 0 };
            byApp.set(a.application.id, e);
          }
          e.types.add(a.usageType);
          e.tasks += 1;
        }
        applications = [
          ...ownAppRows,
          ...[...byApp.values()]
            .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))
            .map((e) => ({
              appId: e.appId,
              name: e.name,
              usageType: [...e.types].join(' · '),
              tasks: e.tasks,
            })),
        ];
      }

      // Deliverables: detail = node links (linkId editable); rollup = distinct list.
      let deliverables: { linkId?: string; deliverableId: string; title: string }[];
      if (detail) {
        deliverables = delivLinks.map((d) => ({
          linkId: d.id,
          deliverableId: d.deliverable.id,
          title: d.deliverable.title,
        }));
      } else {
        // Container level: the node's OWN deliverable links stay editable —
        // this is where "a deliverable is defined at the sub-process (L4)
        // level" lands; the tasks beneath inherit/produce it. Inherited
        // subtree links list read-only.
        const ownLinks = delivLinks.filter((d) => d.processNodeId === node.id);
        const ownRows = ownLinks.map((d) => ({
          linkId: d.id,
          deliverableId: d.deliverable.id,
          title: d.deliverable.title,
        }));
        const ownIds = new Set(ownRows.map((r) => r.deliverableId));
        const seen = new Map<string, string>();
        for (const d of delivLinks)
          if (!ownIds.has(d.deliverable.id) && !seen.has(d.deliverable.id))
            seen.set(d.deliverable.id, d.deliverable.title);
        deliverables = [
          ...ownRows,
          ...[...seen.entries()].map(([id, title]) => ({ deliverableId: id, title })),
        ];
      }

      // Checklist: detail = node items (editable); rollup = distinct texts + count.
      let checklist: { nodeChecklistId?: string; checklistItemId: string; text: string }[];
      if (detail) {
        const seen = new Set<string>();
        checklist = checkLinks
          .filter((c) => {
            if (seen.has(c.checklistItem.id)) return false;
            seen.add(c.checklistItem.id);
            return true;
          })
          .map((c) => ({
            nodeChecklistId: c.id,
            checklistItemId: c.checklistItem.id,
            text: c.checklistItem.text,
          }));
      } else {
        const seen = new Set<string>();
        checklist = checkLinks
          .filter((c) => {
            if (seen.has(c.checklistItem.id)) return false;
            seen.add(c.checklistItem.id);
            return true;
          })
          .map((c) => ({ checklistItemId: c.checklistItem.id, text: c.checklistItem.text }));
      }

      // Testing: detail = the single template tied to this node (first), as editable
      // fields; rollup = a flat list with task/deliverable context.
      type TestingRow = {
        id: string | null;
        deliverableId?: string | null;
        system: string | null;
        location: string | null;
        checkType: string | null;
        expected: string | null;
      };
      let testing: TestingRow | TestingRow[] | null = null;
      if (detail) {
        const own = testingRows.find((t) => t.taskNodeId === node.id) ?? testingRows[0] ?? null;
        testing = own
          ? {
              id: own.id,
              deliverableId: own.deliverableId,
              system: own.system,
              location: own.location,
              checkType: own.checkType,
              expected: own.expected,
            }
          : {
              id: null,
              deliverableId: deliverableIds[0] ?? null,
              system: '',
              location: '',
              checkType: 'presence',
              expected: '',
            };
      } else {
        testing = testingRows.map((t) => ({
          id: t.id,
          system: t.system,
          location: t.location,
          checkType: t.checkType,
          expected: t.expected,
        }));
      }

      // Work Library plan surfacing: detail = the task's full plan (checklist/
      // testing key rows + tied standards/regs steps, ✓ defined / ✗ missing);
      // rollup = defined/total counts across the subtree's tasks.
      let plan: TaskPlan | null = null;
      let planRollup: {
        tasks: number;
        tasksWithPlan: number;
        defined: number;
        total: number;
      } | null = null;
      if (detail) {
        plan = (await taskPlans([node.id], { includeTied: true })).get(node.id) ?? null;
        counts.checklist = plan?.checklist.length ?? 0;
        counts.testing = plan?.testing.length ?? 0;
      } else if (taskIds.length) {
        // One aggregate SQL round trip — never loads each task's full plan.
        const r = await subtreePlanRollup(node.id);
        planRollup = {
          tasks: taskIds.length,
          tasksWithPlan: r.tasksWithPlan,
          defined: r.defined,
          total: r.total,
        };
        counts.checklist = r.checklistKeys;
        counts.testing = r.testingKeys;
      }

      // Breadcrumb (ancestors top→down) + domain (topmost ancestor) for the accent.
      const ancEdges = await prisma.processNodeClosure.findMany({
        where: { descendantId: node.id, depth: { gt: 0 } },
        select: { ancestorId: true, depth: true },
      });
      const ancNodes = ancEdges.length
        ? await prisma.processNode.findMany({
            where: { id: { in: ancEdges.map((e) => e.ancestorId) } },
            select: { id: true, displayValue: true },
          })
        : [];
      const ancNameById = new Map(ancNodes.map((n) => [n.id, n.displayValue]));
      const breadcrumb = [...ancEdges]
        .sort((a, b) => b.depth - a.depth) // deepest depth = topmost ancestor → first crumb
        .map((e) => ({ id: e.ancestorId, name: ancNameById.get(e.ancestorId) ?? '—' }));
      const domain = breadcrumb[0]?.name ?? null;
      // Value stream = the L2 ancestor (or self if this node is L2).
      let valueStreamId: string | null = node.processLevelType.levelNumber === 2 ? node.id : null;
      if (!valueStreamId && ancNodes.length) {
        const ancLevels = await prisma.processNode.findMany({
          where: { id: { in: ancNodes.map((n) => n.id) } },
          select: { id: true, processLevelType: { select: { levelNumber: true } } },
        });
        valueStreamId = ancLevels.find((a) => a.processLevelType.levelNumber === 2)?.id ?? null;
      }

      // Standards + regulations governing this node: those attached to its L2/L3
      // process ancestors (value stream + area) plus the node itself when it is an
      // L2/L3 container — the same inheritance the Tasks list surfaces on a leaf.
      // Standards/regs live on TASK nodes only; any level (a task itself or a
      // container) rolls up the distinct set across its subtree's tasks.
      const [stdRows, regRows] = await Promise.all([
        subtreeStandards(node.id),
        subtreeRegulations(node.id),
      ]);
      const standards = stdRows.map((r) => ({ standardId: r.standardId, name: r.name }));
      const regulations = regRows.map((r) => ({ regId: r.regId, title: r.title }));
      counts.standards = standards.length;
      counts.regulations = regulations.length;

      // Drill children (the Tasks tab list at a container; siblings-context at a leaf).
      const children = await prisma.processNode.findMany({
        where: { parentId: node.id },
        orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
        select: {
          id: true,
          displayValue: true,
          isTask: true,
          processLevelType: { select: { displayValue: true } },
        },
      });

      // % automatable by the next level down (this node's direct children): each
      // task's score attributed to the direct child it descends from. Lets the
      // Overview show "% automatable by <PL3 / PL4 / step>" at whatever level we sit.
      const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
      const topChildOf = (taskId: string): string | null => {
        let cur: string | null = taskId;
        let guard = 0;
        while (cur && guard++ < 64) {
          const p: string | null = parentOf.get(cur) ?? null;
          if (p === node.id) return cur;
          if (!p || !parentOf.has(p)) return null;
          cur = p;
        }
        return null;
      };
      const childAgg = new Map<string, { auto: number; scored: number }>();
      for (const n of nodes) {
        if (!n.isTask || !n.automatability) continue;
        const s = SCORE_OF[n.automatability];
        if (typeof s !== 'number') continue;
        const c = topChildOf(n.id);
        if (!c) continue;
        const e = childAgg.get(c) ?? { auto: 0, scored: 0 };
        e.scored += 1;
        if (s <= 2) e.auto += 1;
        childAgg.set(c, e);
      }
      const byChild = children.map((c) => {
        const e = childAgg.get(c.id);
        return {
          id: c.id,
          name: c.displayValue,
          isTask: c.isTask,
          scored: e?.scored ?? 0,
          auto: e?.auto ?? 0,
          pct: e && e.scored ? Math.round((100 * e.auto) / e.scored) : null,
        };
      });
      const byChildLabel = children[0]?.processLevelType.displayValue ?? null;

      res.json({
        id: node.id,
        name: node.displayValue,
        levelNumber: node.processLevelType.levelNumber,
        levelLabel: node.processLevelType.displayValue,
        isTask: node.isTask,
        detail,
        code: node.code ?? null,
        attributes: node.attributes ?? null,
        automatability: node.automatability ?? null,
        automation: { ...automation, byChild, byChildLabel },
        domain,
        valueStreamId,
        breadcrumb,
        counts,
        roles,
        applications,
        deliverables,
        checklist,
        testing,
        plan,
        planRollup,
        standards,
        regulations,
        children: children.map((c) => ({ id: c.id, name: c.displayValue, isTask: c.isTask })),
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Connected chain (Deliverable → Tasks → Checklist → Testing) ──────────────
  // One organized view of how a deliverable is produced: the task steps that
  // produce it (NodeDeliverable on isTask nodes), each task's checklist items
  // (NodeChecklist), and the testing templates verifying it (TestingTemplate by
  // task node, plus deliverable-level templates). Scope = the node itself at a
  // leaf (detail) or its whole subtree at a container (rollup).
  router.get('/:nodeId/chain', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const node = await ownedNode(req, company.id, req.params.nodeId);
      if (!node) return res.status(404).json({ error: 'Not found' });

      const { nodes } = await processSubtree(node.id);
      const detail = node.isTask;
      const scopeIds = detail ? [node.id] : nodes.map((n) => n.id);
      const isTaskSet = new Set(nodes.filter((n) => n.isTask).map((n) => n.id));
      const nameById = new Map(nodes.map((n) => [n.id, n.displayValue]));
      nameById.set(node.id, node.displayValue);

      const delivLinks = await prisma.nodeDeliverable.findMany({
        where: { processNodeId: { in: scopeIds } },
        select: {
          id: true,
          processNodeId: true,
          deliverable: { select: { id: true, title: true } },
        },
      });
      if (!delivLinks.length) return res.json({ chain: [] });

      const taskNodeIds = [
        ...new Set(
          delivLinks.map((l) => l.processNodeId).filter((id) => isTaskSet.has(id) || detail),
        ),
      ];

      // Work Library plans drive the checklist/testing content of each task card
      // (✓ defined value / ✗ missing key), including tied standard/reg steps.
      const [plans, roleEntries, appEntries] = await Promise.all([
        taskPlans(taskNodeIds, { includeTied: true }),
        rolesForNodes(taskNodeIds),
        appsForNodes(taskNodeIds),
      ]);

      const rolesForTask = (nodeId: string) => {
        const seen = new Map<string, { roleId: string; name: string; relation: string }>();
        for (const e of roleEntries.get(nodeId) ?? []) {
          const cur = seen.get(e.id);
          if (!cur || (e.role_ === 'Owner' && cur.relation !== 'Owner'))
            seen.set(e.id, { roleId: e.id, name: e.name, relation: e.role_ });
        }
        return [...seen.values()].sort((a, b) =>
          a.relation === b.relation
            ? a.name.localeCompare(b.name)
            : a.relation === 'Owner'
              ? -1
              : 1,
        );
      };
      const appsForTask = (nodeId: string) => {
        const seen = new Map<string, { appId: string; name: string; types: Set<string> }>();
        for (const a of appEntries.get(nodeId) ?? []) {
          let e = seen.get(a.id);
          if (!e) {
            e = { appId: a.id, name: a.name, types: new Set() };
            seen.set(a.id, e);
          }
          e.types.add(a.usageType);
        }
        return [...seen.values()]
          .map((e) => ({ appId: e.appId, name: e.name, usageType: [...e.types].join(' · ') }))
          .sort((a, b) => a.name.localeCompare(b.name));
      };

      // Group links by deliverable; tasks = the (task) nodes producing it.
      const byDeliv = new Map<
        string,
        { title: string; linkId: string | null; taskIds: { nodeId: string; linkId: string }[] }
      >();
      for (const l of delivLinks) {
        let e = byDeliv.get(l.deliverable.id);
        if (!e) {
          e = { title: l.deliverable.title, linkId: null, taskIds: [] };
          byDeliv.set(l.deliverable.id, e);
        }
        // A link on the inspected node itself is detachable at ANY level — this
        // is how a deliverable defined at the sub-process (L4) heads its chain.
        if (l.processNodeId === node.id) e.linkId = l.id;
        if (isTaskSet.has(l.processNodeId) || (detail && l.processNodeId === node.id))
          e.taskIds.push({ nodeId: l.processNodeId, linkId: l.id });
      }

      const chain = [...byDeliv.entries()]
        .map(([deliverableId, d]) => {
          const tasks = d.taskIds.map(({ nodeId }) => {
            const p = plans.get(nodeId);
            return {
              taskId: nodeId,
              name: nameById.get(nodeId) ?? '—',
              roles: rolesForTask(nodeId),
              applications: appsForTask(nodeId),
              checklist: p?.checklist ?? [],
              testing: p?.testing ?? [],
              standards: p?.standards ?? [],
              regulations: p?.regulations ?? [],
            };
          });
          // Deliverable roll-up = verified/total across its tasks' plan rows.
          let defined = 0;
          let total = 0;
          for (const { nodeId } of d.taskIds) {
            const p = plans.get(nodeId);
            if (p) {
              defined += p.defined;
              total += p.total;
            }
          }
          return {
            deliverableId,
            title: d.title,
            linkId: d.linkId,
            tasks,
            rollup: { defined, total },
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));

      res.json({ chain });
    } catch (e) {
      next(e);
    }
  });

  // ── Pickers (associate an existing entity) ───────────────────────────────────
  router.get('/search/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const rows = await prisma.role.findMany({
        where: {
          companyId: company.id,
          ...(q ? { displayValue: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { displayValue: 'asc' },
        take: 20,
        select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } },
      });
      res.json({
        items: rows.map((r) => ({
          id: r.id,
          name: r.displayValue,
          sub: r.orgUnit?.displayValue ?? null,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/search/applications', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const rows = await prisma.application.findMany({
        where: {
          companyId: company.id,
          ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { name: 'asc' },
        take: 20,
        select: { id: true, name: true, category: true },
      });
      res.json({ items: rows.map((a) => ({ id: a.id, name: a.name, sub: a.category ?? null })) });
    } catch (e) {
      next(e);
    }
  });

  router.get('/search/deliverables', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const rows = await prisma.deliverable.findMany({
        where: {
          companyId: company.id,
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { title: 'asc' },
        take: 20,
        select: { id: true, title: true },
      });
      res.json({ items: rows.map((d) => ({ id: d.id, name: d.title })) });
    } catch (e) {
      next(e);
    }
  });

  // Propagation summary for a role: distinct value streams (process L2) it touches,
}
