import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logger } from '../lib/logger.js';
import { ancestorNames } from '../lib/resolvers/index.js';
import { assembleRoleProfile, groupByChecklist } from '../lib/roleProfile.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('roles'));

// Per-role list columns fed by unbounded links (tasks, checklist, deliverables)
// are capped so the flat table stays a scannable summary and the payload stays
// small — the full set lives in the role drawer (GET /roles/:id). Value streams
// and standards are naturally small per role, so they render in full.
const LIST_CAP = 25;
const capped = (items: string[]) => (items.length > LIST_CAP ? items.slice(0, LIST_CAP) : items);

// GET /roles — flat table for the Roles tab list view: one row per role.
// Department/Division come off the org spine (OrgUnit L3/L2); a role homed
// straight on a division has no department ("Direct to division"). The four
// participation columns (value streams / deliverables / tasks / standards) plus
// checklist responsibilities are resolved for EVERY role in a handful of batched
// queries — no per-role fan-out.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const t0 = Date.now();
    const roles = await prisma.role.findMany({
      where: { company: { tenantId: req.tenantId } },
      select: {
        id: true,
        displayValue: true,
        roleType: true,
        orgUnit: {
          select: {
            displayValue: true,
            orgLevelType: { select: { levelNumber: true } },
            parent: {
              select: { displayValue: true, orgLevelType: { select: { levelNumber: true } } },
            },
          },
        },
      },
      orderBy: { displayValue: 'asc' },
    });
    const tRoles = Date.now();

    const orgOf = (role: (typeof roles)[number]) => {
      let division: string | null = null;
      let department: string | null = null;
      if (role.orgUnit) {
        if (role.orgUnit.orgLevelType.levelNumber === 3) {
          department = role.orgUnit.displayValue;
          if (role.orgUnit.parent?.orgLevelType.levelNumber === 2)
            division = role.orgUnit.parent.displayValue;
        } else {
          division = role.orgUnit.displayValue;
          department = 'Direct to division';
        }
      }
      return { division, department };
    };

    const roleIds = roles.map((r) => r.id);
    if (!roleIds.length) return res.json({ rows: [] });
    // Every remaining read keys off the roles' task nodes. Rather than pulling
    // the ~50k NodeRole rows first and shipping ~11k node ids back as a second
    // round of IN-lists, each query derives the node set itself with the same
    // subselect — so ALL of them run in ONE parallel round against Neon (the
    // per-round-trip latency dominates this endpoint).
    const roleIdList = Prisma.join(roleIds);
    const nodeSubselect = Prisma.sql`SELECT DISTINCT "processNodeId" FROM public."NodeRole" WHERE "roleId" IN (${roleIdList})`;
    const [nodeRoles, roleDelivs, roleStandards, closureAnc, nodeChecks, nodeDelivs, areaStds] =
      await Promise.all([
        // role ↔ task-node links + the task's display name (the Tasks column).
        prisma.$queryRaw<{ roleId: string; processNodeId: string; taskName: string }[]>(Prisma.sql`
        SELECT nr."roleId", nr."processNodeId", pn."displayValue" AS "taskName"
        FROM public."NodeRole" nr
        JOIN public."ProcessNode" pn ON pn.id = nr."processNodeId"
        WHERE nr."roleId" IN (${roleIdList})`),
        prisma.roleDeliverable.findMany({
          where: { roleId: { in: roleIds } },
          select: { roleId: true, deliverable: { select: { title: true } } },
        }),
        prisma.roleStandard.findMany({
          where: { roleId: { in: roleIds } },
          select: { roleId: true, standard: { select: { name: true } } },
        }),
        // One closure pass over every role's task nodes, pre-joined to the L2
        // ancestor's name — each node's value stream. (The old two-step
        // closure+ancestors read shipped every ancestor edge; only the L2 name is
        // ever consumed, so filter in SQL and cut the row volume ~80%.)
        prisma.$queryRaw<{ descendantId: string; name: string }[]>(Prisma.sql`
        SELECT c."descendantId", pn."displayValue" AS name
        FROM public."ProcessNodeClosure" c
        JOIN public."ProcessNode" pn ON pn.id = c."ancestorId"
        JOIN public."ProcessLevelType" plt ON plt.id = pn."processLevelTypeId" AND plt."levelNumber" = 2
        WHERE c."descendantId" IN (${nodeSubselect})`),
        // Checklists + deliverables carried on those nodes, so a role with no
        // DIRECT standard/deliverable link still fills the column from the work
        // it actually does.
        prisma.$queryRaw<{ processNodeId: string; text: string }[]>(Prisma.sql`
        SELECT nc."processNodeId", ci.text
        FROM public."NodeChecklist" nc
        JOIN public."ChecklistItem" ci ON ci.id = nc."checklistItemId"
        WHERE nc."processNodeId" IN (${nodeSubselect})`),
        prisma.$queryRaw<{ processNodeId: string; title: string }[]>(Prisma.sql`
        SELECT nd."processNodeId", d.title
        FROM public."NodeDeliverable" nd
        JOIN public."Deliverable" d ON d.id = nd."deliverableId"
        WHERE nd."processNodeId" IN (${nodeSubselect})`),
        // Standards live on the task nodes themselves (tasks = single source of
        // truth; areas/value streams roll up from them), so a role's governing
        // standards come straight from its nodes' own links.
        prisma.$queryRaw<{ processNodeId: string; name: string }[]>(Prisma.sql`
        SELECT ns."processNodeId", s.name
        FROM public."NodeStandard" ns
        JOIN public."Standard" s ON s.id = ns."standardId"
        WHERE NOT ns.excluded AND ns."processNodeId" IN (${nodeSubselect})`),
      ]);
    const tLinks = Date.now();

    const stdByTaskNode = new Map<string, string[]>();
    for (const ns of areaStds) {
      const a = stdByTaskNode.get(ns.processNodeId) ?? [];
      a.push(ns.name);
      stdByTaskNode.set(ns.processNodeId, a);
    }
    // node → value stream name (L2 ancestor).
    const vsByNode = new Map<string, string>();
    for (const e of closureAnc) vsByNode.set(e.descendantId, e.name);
    // node → checklist texts / deliverable titles.
    const checksByNode = new Map<string, string[]>();
    for (const nc of nodeChecks) {
      const a = checksByNode.get(nc.processNodeId) ?? [];
      a.push(nc.text);
      checksByNode.set(nc.processNodeId, a);
    }
    const delivsByNode = new Map<string, string[]>();
    for (const nd of nodeDelivs) {
      const a = delivsByNode.get(nd.processNodeId) ?? [];
      a.push(nd.title);
      delivsByNode.set(nd.processNodeId, a);
    }

    // Aggregate per role — one pass over the role↔node links.
    const vsByRole = new Map<string, Set<string>>();
    const tasksByRole = new Map<string, Set<string>>();
    const checksByRole = new Map<string, Set<string>>();
    const nodeDelivByRole = new Map<string, Set<string>>();
    const areaStdByRole = new Map<string, Set<string>>();
    const push = (m: Map<string, Set<string>>, k: string, v: string | null | undefined) => {
      if (!v) return;
      const s = m.get(k) ?? new Set<string>();
      s.add(v);
      m.set(k, s);
    };
    for (const nr of nodeRoles) {
      push(tasksByRole, nr.roleId, nr.taskName);
      push(vsByRole, nr.roleId, vsByNode.get(nr.processNodeId));
      for (const text of checksByNode.get(nr.processNodeId) ?? [])
        push(checksByRole, nr.roleId, text);
      for (const title of delivsByNode.get(nr.processNodeId) ?? [])
        push(nodeDelivByRole, nr.roleId, title);
      for (const sn of stdByTaskNode.get(nr.processNodeId) ?? [])
        push(areaStdByRole, nr.roleId, sn);
    }
    // Direct links take priority; fall back to work-derived where a role has none.
    const delivByRole = new Map<string, Set<string>>();
    for (const rd of roleDelivs) push(delivByRole, rd.roleId, rd.deliverable.title);
    const stdByRole = new Map<string, Set<string>>();
    for (const rs of roleStandards) push(stdByRole, rs.roleId, rs.standard.name);

    type Row = {
      key: string;
      roleId: string;
      role: string;
      roleType: string | null;
      department: string | null;
      division: string | null;
      valueStreams: string[];
      deliverables: string[];
      tasks: string[];
      standards: string[];
      checklist: string[];
    };
    const setArr = (m: Map<string, Set<string>>, id: string) =>
      [...(m.get(id) ?? new Set<string>())].sort();
    // Union of direct + work-derived links (direct first), de-duplicated.
    const merged = (a: Map<string, Set<string>>, b: Map<string, Set<string>>, id: string) =>
      [...new Set([...(a.get(id) ?? []), ...(b.get(id) ?? [])])].sort();
    const rows: Row[] = roles.map((role) => {
      const { division, department } = orgOf(role);
      return {
        key: role.id,
        roleId: role.id,
        role: role.displayValue,
        roleType: role.roleType ?? null,
        department,
        division,
        valueStreams: setArr(vsByRole, role.id),
        deliverables: capped(merged(delivByRole, nodeDelivByRole, role.id)),
        tasks: capped(setArr(tasksByRole, role.id)),
        standards: capped(merged(stdByRole, areaStdByRole, role.id)),
        checklist: capped(setArr(checksByRole, role.id)),
      };
    });
    logger.debug(
      { roles: tRoles - t0, links: tLinks - tRoles, aggregate: Date.now() - tLinks },
      'GET /roles timings (ms)',
    );
    res.json({ rows });
  } catch (e) {
    next(e);
  }
});

// GET /roles/org-chart — the reporting-line root. Manager chains aren't backfilled
// yet (Role.managerRoleId is unset company-wide), so for now this returns just the
// CEO with an empty `reports` list — the org chart's top box and nothing under it.
router.get('/org-chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ceo = await prisma.role.findFirst({
      where: {
        company: { tenantId: req.tenantId },
        displayValue: { contains: 'Chief Executive', mode: 'insensitive' },
      },
      select: { id: true, displayValue: true },
    });
    res.json({ root: ceo ? { id: ceo.id, name: ceo.displayValue, reports: [] } : null });
  } catch (e) {
    next(e);
  }
});

// GET /roles/:id/profile — the full role-profile page payload: description +
// family/level, org context, value-stream participation (Lead/Support),
// deliverables with the role's tasks under each (Owner/Contributor), and the
// expandable task summary with per-task deliverable ties. One batched query
// round; all grouping in lib/roleProfile (pure, unit-tested).
router.get('/:id/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: {
        id: true,
        displayValue: true,
        description: true,
        roleFamily: true,
        roleLevel: true,
        company: { select: { id: true, name: true } },
        orgUnit: {
          select: {
            id: true,
            displayValue: true,
            orgLevelType: { select: { levelNumber: true } },
            parent: {
              select: {
                id: true,
                displayValue: true,
                orgLevelType: { select: { levelNumber: true } },
              },
            },
          },
        },
      },
    });
    if (!role) return res.status(404).json({ error: 'Not found' });

    const [nodeRoles, roleDelivs, checkItems] = await Promise.all([
      prisma.nodeRole.findMany({
        where: { roleId: role.id },
        select: {
          role_: true,
          processNode: { select: { id: true, displayValue: true, sortOrder: true } },
        },
      }),
      prisma.roleDeliverable.findMany({
        where: { roleId: role.id },
        select: { role_: true, deliverable: { select: { id: true, title: true } } },
      }),
      prisma.checklistItem.findMany({
        where: { roleId: role.id },
        orderBy: { id: 'asc' },
        select: { text: true, checklist: { select: { name: true } } },
      }),
    ]);
    const nodeIds = nodeRoles.map((n) => n.processNode.id);
    const [loc, nodeDelivs] = await Promise.all([
      ancestorNames(nodeIds),
      nodeIds.length
        ? prisma.nodeDeliverable.findMany({
            where: { processNodeId: { in: nodeIds } },
            select: { processNodeId: true, deliverable: { select: { id: true, title: true } } },
          })
        : Promise.resolve([]),
    ]);

    res.json(
      assembleRoleProfile({
        role,
        nodeRoles,
        roleDelivs,
        nodeDelivs,
        checkItems: checkItems.map((c) => ({ text: c.text, checklist: c.checklist?.name ?? null })),
        loc,
      }),
    );
  } catch (e) {
    next(e);
  }
});

// GET /roles/:id — role + division/department (org closure), value-stream
// participation, deliverables, the role's task ProcessNodes and its checklist
// responsibilities. erd_v5: every link is an FK seek off the role (NodeRole,
// RoleDeliverable, ChecklistItem) — no company-wide text scan.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId } },
      select: {
        id: true,
        displayValue: true,
        companyId: true,
        orgUnitId: true,
        description: true,
        roleFamily: true,
        roleLevel: true,
        company: { select: { id: true, name: true } },
        orgUnit: {
          select: {
            id: true,
            displayValue: true,
            orgLevelType: { select: { levelNumber: true } },
            parent: {
              select: {
                id: true,
                displayValue: true,
                orgLevelType: { select: { levelNumber: true } },
              },
            },
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
    type ProcTask = {
      valueStreamId: string;
      valueStreamName: string;
      l3: string | null;
      l4: string | null;
      stepNumber: number;
      name: string;
      relation: 'Lead' | 'Support';
      outputs: string | null;
    };
    const processTasks: ProcTask[] = nodeRoles
      .map((nr) => {
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
      })
      .sort(
        (a, b) =>
          a.valueStreamName.localeCompare(b.valueStreamName) ||
          String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')) ||
          a.stepNumber - b.stepNumber,
      );

    // ioRows — the role's deliverables grouped by (value stream, L4). The task
    // location feeding a deliverable is no longer stored, so they group under the
    // role's strongest stream (the value stream most of its task nodes roll up to).
    const primaryVs = (() => {
      const counts = new Map<string, { name: string; n: number }>();
      for (const a of loc.values()) {
        if (!a.valueStreamId) continue;
        const e = counts.get(a.valueStreamId) ?? { name: a.valueStreamName ?? '—', n: 0 };
        e.n++;
        counts.set(a.valueStreamId, e);
      }
      const top = [...counts.entries()].sort((x, y) => y[1].n - x[1].n)[0];
      const first = processTasks[0];
      return top
        ? { id: top[0], name: top[1].name, l3: null as string | null, l4: null as string | null }
        : first
          ? { id: first.valueStreamId, name: first.valueStreamName, l3: first.l3, l4: first.l4 }
          : null;
    })();
    const ioRows =
      roleDelivs.length && primaryVs
        ? [
            {
              valueStreamId: primaryVs.id,
              valueStreamName: primaryVs.name,
              domain: null as string | null,
              l3: primaryVs.l3,
              l4: primaryVs.l4,
              inputs: [] as string[],
              deliverables: [...new Set(roleDelivs.map((d) => d.deliverable.title))],
            },
          ]
        : [];
    const deliverableCount = ioRows.reduce((n, r) => n + r.deliverables.length, 0);
    const inputCount = 0;

    // participation — the distinct value streams the role's task nodes roll up
    // to, with the strongest relation (Lead beats Support).
    const partMap = new Map<
      string,
      { valueStreamId: string; valueStreamName: string; participationType: 'Lead' | 'Support' }
    >();
    for (const nr of nodeRoles) {
      const a = loc.get(nr.processNode.id);
      if (!a?.valueStreamId) continue;
      const rel = nr.role_ === 'Owner' ? 'Lead' : 'Support';
      const cur = partMap.get(a.valueStreamId);
      if (!cur || (rel === 'Lead' && cur.participationType !== 'Lead')) {
        partMap.set(a.valueStreamId, {
          valueStreamId: a.valueStreamId,
          valueStreamName: a.valueStreamName ?? '—',
          participationType: rel,
        });
      }
    }
    const participation = [...partMap.values()]
      .sort((a, b) =>
        a.participationType === b.participationType
          ? a.valueStreamName.localeCompare(b.valueStreamName)
          : a.participationType === 'Lead'
            ? -1
            : 1,
      )
      .map((p) => ({
        valueStreamId: p.valueStreamId,
        valueStreamName: p.valueStreamName,
        domain: null,
        participationType: p.participationType,
        subStream: null,
        inputs: null,
        outputs: null,
      }));

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
      description: role.description,
      roleFamily: role.roleFamily,
      roleLevel: role.roleLevel,
      company: role.company,
      division,
      department,
      participation,
      responsibilities: groupByChecklist(
        checkItems.map((c) => ({ text: c.text, checklist: c.checklist?.name ?? null })),
      ),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
