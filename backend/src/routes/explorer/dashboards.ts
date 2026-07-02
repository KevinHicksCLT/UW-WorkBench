/**
 * The map drill sidebar: step lens + level/role/department/org dashboards behind /roles/:level/:id?.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtree, ancestorNames, rolesForNodes, appsForNodes } from '../../lib/resolvers/index.js';
import { activeCompany, processLevelMap } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerDashboardRoutes(router: Router): void {
type Fmt = 'money' | 'years' | 'number';
type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string }; href?: string; children?: MetricItem[]; tag?: string };
type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi' | 'tree'; items: MetricItem[]; illustrative?: boolean; hidden?: boolean; expanded?: boolean; emptyText?: string };
type Dashboard = { level: string; title: string; subtitle?: string; tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean; drawer?: string }[]; sections: MetricSection[] };

const CORE_EMPTY = {
  deliverables: 'No deliverables recorded at this level.',
  roles: 'No roles resolved for this slice of work.',
  tasks: 'No role tasks recorded for the involved roles.',
  checklist: 'No checklist items recorded for the involved roles.',
};

// Consolidated who/what/how for a set of ProcessNodes (the focused slice of a
// value stream). Roles (NodeRole), their checklist items (NodeChecklist), the
// deliverables produced (NodeDeliverable), and the applications used
// (NodeAppUsage) — all FK-junction reads, no name matching.
type Lens = {
  rolesTree: MetricItem[];
  deliverables: MetricItem[];
  deliverableChain: MetricItem[];
  tasks: MetricItem[];
  checklist: MetricItem[];
  applications: MetricItem[];
  roleCount: number; unresolvedRoles: string[];
};

async function stepLens(nodeIds: string[]): Promise<Lens> {
  if (!nodeIds.length) {
    return { rolesTree: [], deliverables: [], deliverableChain: [], tasks: [], checklist: [], applications: [], roleCount: 0, unresolvedRoles: [] };
  }
  const [roleEntries, appEntries, delivLinks, checkLinks] = await Promise.all([
    rolesForNodes(nodeIds),
    appsForNodes(nodeIds),
    prisma.nodeDeliverable.findMany({ where: { processNodeId: { in: nodeIds } }, select: { deliverable: { select: { id: true, title: true } } } }),
    prisma.nodeChecklist.findMany({ where: { processNodeId: { in: nodeIds } }, select: { processNodeId: true, checklistItem: { select: { id: true, text: true, role: { select: { id: true, displayValue: true } }, checklist: { select: { name: true } } } } } }),
  ]);

  // Roles (Owner = Lead, Participant = Support), deduped, leads first.
  const roleMap = new Map<string, { id: string; name: string; part: 'Lead' | 'Support' }>();
  for (const entries of roleEntries.values()) for (const e of entries) {
    const part = e.role_ === 'Owner' ? 'Lead' : 'Support';
    const cur = roleMap.get(e.id);
    if (!cur || (part === 'Lead' && cur.part !== 'Lead')) roleMap.set(e.id, { id: e.id, name: e.name, part });
  }
  const roles = [...roleMap.values()].sort((a, b) => (a.part === b.part ? a.name.localeCompare(b.name) : a.part === 'Lead' ? -1 : 1));
  const rolesTree: MetricItem[] = roles.map((r) => ({ label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id }, tag: 'role' }));

  // Applications, primary "performed" first.
  const appMap = new Map<string, { name: string; types: Set<string> }>();
  for (const list of appEntries.values()) for (const a of list) {
    let e = appMap.get(a.id);
    if (!e) { e = { name: a.name, types: new Set() }; appMap.set(a.id, e); }
    e.types.add(a.usageType);
  }
  const applications: MetricItem[] = [...appMap.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([appId, a]) => ({ label: a.name, value: 0, hint: [...a.types].join(' · '), href: `/applications?focus=${appId}`, tag: 'app' }));

  // Deliverables (one per L4 sub-process; dedupe by deliverable id so two distinct
  // L4s that happen to share a sub-process name stay separate).
  const delivById = new Map<string, string>(); // id → title
  for (const d of delivLinks) if (!delivById.has(d.deliverable.id)) delivById.set(d.deliverable.id, d.deliverable.title);
  const deliverables: MetricItem[] = [...delivById.values()].map((title) => ({ label: title, value: 0, tag: 'deliverable', children: [] as MetricItem[] }));

  // Checklist items grouped by role. ChecklistItem.roleId is unset in this dataset
  // (the workbook codifies checklist steps against the PROCESS NODE, not a role),
  // so we attribute each item to the role(s) that work its node: the node's Owner
  // role(s) via NodeRole, falling back to any role on the node, then to the item's
  // own roleId, then to an unattributed bucket. This is what makes checklist items
  // reliably surface under the roles in the deliverable chain.
  const ownerByNode = new Map<string, string[]>(); // nodeId → owner role ids (else any role ids)
  for (const [nid, entries] of roleEntries) {
    const owners = entries.filter((e) => e.role_ === 'Owner').map((e) => e.id);
    ownerByNode.set(nid, owners.length ? owners : entries.map((e) => e.id));
  }
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
  const checkByRole = new Map<string, { role: string; items: { text: string; cat: string | null }[] }>();
  const pushItem = (rid: string, roleName: string, text: string, cat: string | null) => {
    let e = checkByRole.get(rid);
    if (!e) { e = { role: roleName, items: [] }; checkByRole.set(rid, e); }
    e.items.push({ text, cat });
  };
  for (const c of checkLinks) {
    const ci = c.checklistItem;
    const cat = ci.checklist?.name ?? null;
    const nodeRoleIds = ownerByNode.get(c.processNodeId) ?? [];
    if (nodeRoleIds.length) {
      // attribute to the node's role(s) — dedupe so the same step isn't double-counted per role.
      for (const rid of nodeRoleIds) pushItem(rid, roleNameById.get(rid) ?? '—', ci.text, cat);
    } else if (ci.role?.id) {
      pushItem(ci.role.id, ci.role.displayValue, ci.text, cat);
    } else {
      pushItem('_', '—', ci.text, cat);
    }
  }
  // Flat checklist section: dedupe identical (role,text) pairs the node-fan-out can create.
  const seenCheck = new Set<string>();
  const checklist: MetricItem[] = [...checkByRole.values()].flatMap((e) =>
    e.items.filter((it) => {
      const k = `${e.role}␟${it.text}`;
      if (seenCheck.has(k)) return false;
      seenCheck.add(k);
      return true;
    })
      .map((it) => ({ label: it.text, value: 0, sub: it.cat ?? undefined, hint: e.role, tag: 'checklist' })));

  // Connected chain: deliverable → the roles working these nodes → CHECKLIST
  // items (the codified steps the role reviews) → a couple of supporting apps.
  // Checklist items MUST appear for any role that has them — they are the point
  // of the chain (legend: DELIVERABLE → ROLE → CHECKLIST → APPLICATION). Apps are
  // a tail, and the apps-only shape is only used when a role genuinely has none.
  const CHAIN_ROLES = 3, CHAIN_CHECKS = 12, CHAIN_APPS = 2;
  // Surface roles that actually carry checklist items in this scope FIRST (Lead
  // ahead of Support on a tie), so the chain reliably shows checklist work rather
  // than landing on three roles that happen to have none. Roles without checklist
  // items fill any remaining slots and fall back to an apps-only tail.
  const chainRoles = [...roles].sort((a, b) => {
    const ha = (checkByRole.get(a.id)?.items.length ?? 0) > 0 ? 0 : 1;
    const hb = (checkByRole.get(b.id)?.items.length ?? 0) > 0 ? 0 : 1;
    return ha - hb; // stable sort keeps the original Lead-first/name order within each bucket
  }).slice(0, CHAIN_ROLES);
  const roleNodes: MetricItem[] = chainRoles.map((r) => {
    const seen = new Set<string>();
    const checks = (checkByRole.get(r.id)?.items ?? [])
      .filter((c) => {
        if (seen.has(c.text)) return false;
        seen.add(c.text);
        return true;
      })
      .slice(0, CHAIN_CHECKS)
      .map((c) => ({ label: c.text, value: 0, sub: c.cat ?? undefined, tag: 'checklist' as const }));
    const appNodes = applications.slice(0, CHAIN_APPS).map((a) => ({ ...a }));
    // checklist first (always, when the role has any), then a small app tail.
    return { label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id }, tag: 'role', children: [...checks, ...appNodes] };
  });
  const deliverableChain: MetricItem[] = deliverables.map((d) => ({ ...d, children: roleNodes }));

  // Flat tasks roll-up: each task node's display name with its owner role nested.
  const tasks: MetricItem[] = []; // tasks are L5 nodes themselves; the lens scope already is task-level

  return {
    rolesTree, deliverables, deliverableChain, tasks, checklist, applications,
    roleCount: roles.length, unresolvedRoles: [],
  };
}

function coreSections(lens: Lens, opts: { deliverables: MetricItem[]; expanded?: boolean; rolesFallback?: MetricItem[]; tasksChecklist?: boolean }): MetricSection[] {
  const out: MetricSection[] = [
    { title: 'Roles', kind: 'tree', items: lens.rolesTree.length ? lens.rolesTree : (opts.rolesFallback ?? []), emptyText: CORE_EMPTY.roles },
    { title: 'Applications & systems', kind: 'list', items: lens.applications },
    { title: 'Deliverables', kind: 'tree', expanded: opts.expanded, items: opts.deliverables, emptyText: CORE_EMPTY.deliverables },
  ];
  if (opts.tasksChecklist) {
    // Checklist items replace the old task list in the sidebar (the task scope is
    // the lens itself; what the user reviews here are the codified checklist steps).
    out.push(
      { title: 'Checklist', kind: 'tree', items: lens.checklist, emptyText: CORE_EMPTY.checklist },
    );
  }
  return out;
}

// task-node ids for a given subtree root, bounded to L5 (isTask).
async function taskNodeIds(rootId: string): Promise<string[]> {
  const { nodes } = await processSubtree(rootId);
  return nodes.filter((n) => n.isTask).map((n) => n.id);
}

// Level dashboards keyed by the focused ProcessNode's level.
async function processNodeDashboard(node: { id: string; displayValue: string; level: number }): Promise<Dashboard> {
  if (node.level === 2) {
    // Value stream: the lens over its whole task subtree + L3 process-area list.
    const { nodes } = await processSubtree(node.id, { excludeSelf: true });
    const l3 = nodes.filter((n) => n.depth === 1);
    const taskIds = nodes.filter((n) => n.isTask).map((n) => n.id);
    const taskCountByL3 = new Map<string, number>();
    // count tasks under each L3 via their closure root.
    await Promise.all(l3.map(async (a) => { taskCountByL3.set(a.id, (await taskNodeIds(a.id)).length); }));
    const lens = await stepLens(taskIds);
    return {
      level: 'valueStream', title: node.displayValue, subtitle: 'Who does the work, on what',
      tiles: [
        { label: 'Supporting roles', value: lens.roleCount, drawer: 'Roles' },
        { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
        { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
      ],
      sections: [
        ...coreSections(lens, { deliverables: lens.deliverableChain, tasksChecklist: true }),
        { title: 'Process Level 4', kind: 'list', items: l3.map((s) => ({ label: s.displayValue, value: 0, hint: taskCountByL3.get(s.id) ? `${taskCountByL3.get(s.id)} steps` : 'no flow', drill: { level: 'step', id: s.id } })) },
      ],
    };
  }
  // L3 / L4 / L5: lens scoped to that node's task subtree.
  const taskIds = await taskNodeIds(node.id);
  const lens = await stepLens(taskIds);
  const subtitle = node.level === 3 ? 'Process area (L3)' : node.level === 4 ? 'Sub-process (L4)' : 'Task (L5)';
  const expanded = node.level >= 4;
  return {
    level: node.level === 5 ? 'leafStep' : 'step', title: node.displayValue, subtitle,
    tiles: [
      { label: 'Supporting roles', value: lens.roleCount, drawer: 'Roles' },
      { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
      { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
    ],
    sections: [...coreSections(lens, { deliverables: lens.deliverableChain, expanded })],
  };
}

// Role dashboard: the role's deliverables, value-stream participation, and
// checklist responsibilities.
async function roleDashboard(roleId: string): Promise<Dashboard | null> {
  const role = await prisma.role.findFirst({ where: { id: roleId }, select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } } });
  if (!role) return null;
  const [nodeRoles, roleDelivs, checks] = await Promise.all([
    prisma.nodeRole.findMany({ where: { roleId }, select: { processNode: { select: { id: true } } } }),
    prisma.roleDeliverable.findMany({ where: { roleId }, select: { deliverable: { select: { title: true } } } }),
    prisma.checklistItem.findMany({ where: { roleId }, select: { text: true, checklist: { select: { name: true } } } }),
  ]);
  const loc = await ancestorNames(nodeRoles.map((n) => n.processNode.id));
  const streams = new Map<string, string>();
  for (const a of loc.values()) if (a.valueStreamId) streams.set(a.valueStreamId, a.valueStreamName ?? '—');
  const deliverables = [...new Set(roleDelivs.map((d) => d.deliverable.title))];
  return {
    level: 'role', title: role.displayValue, subtitle: role.orgUnit?.displayValue ?? 'Role',
    tiles: [
      { label: 'Value streams', value: streams.size },
      { label: 'Deliverables', value: deliverables.length },
      { label: 'Responsibilities', value: checks.length, hint: 'checklist items' },
      { label: 'Tasks', value: nodeRoles.length, hint: 'process steps' },
    ],
    sections: [
      { title: 'Deliverables', kind: 'list', items: deliverables.map((d) => ({ label: d, value: 0 })), emptyText: CORE_EMPTY.deliverables },
      { title: 'Value-stream participation', kind: 'list', items: [...streams.values()].sort().map((s) => ({ label: s, value: 0 })) },
      { title: 'Responsibilities', kind: 'tree', items: checks.slice(0, 50).map((c) => ({ label: c.text, value: 0, sub: c.checklist?.name ?? undefined, tag: 'checklist' })), emptyText: CORE_EMPTY.checklist },
    ],
  };
}

// Department dashboard (org L3): the roles homed under this department + their
// value-stream participation. Mirrors roleDashboard's altitude but for a team.
async function departmentDashboard(orgUnitId: string, label: string): Promise<Dashboard | null> {
  const roles = await prisma.role.findMany({
    where: { orgUnitId },
    orderBy: { displayValue: 'asc' },
    select: { id: true, displayValue: true },
  });
  // value-stream participation for the team's roles (NodeRole → closure).
  const roleIds = roles.map((r) => r.id);
  const nodeRoles = roleIds.length
    ? await prisma.nodeRole.findMany({ where: { roleId: { in: roleIds } }, select: { processNodeId: true } })
    : [];
  const loc = await ancestorNames(nodeRoles.map((n) => n.processNodeId));
  const streams = new Map<string, string>();
  for (const a of loc.values()) if (a.valueStreamId) streams.set(a.valueStreamId, a.valueStreamName ?? '—');
  return {
    level: 'department', title: label, subtitle: 'Team · roles & value-stream reach',
    tiles: [
      { label: 'Roles', value: roles.length },
      { label: 'Value streams', value: streams.size },
    ],
    sections: [
      { title: 'Roles', kind: 'tree', items: roles.map((r) => ({ label: r.displayValue, value: 0, drill: { level: 'role', id: r.id }, tag: 'role' })), emptyText: 'No roles homed to this team.' },
      { title: 'Value-stream participation', kind: 'list', items: [...streams.values()].sort().map((s) => ({ label: s, value: 0 })) },
    ],
  };
}

// Org dashboard (company / domain / division): roles roll-up.
async function orgDashboard(companyId: string, level: string, id: string | undefined, label: string): Promise<Dashboard | null> {
  if (level === 'company') {
    const { idOf } = await processLevelMap(companyId);
    const l2 = idOf(2);
    const [roleCount, divisions] = await Promise.all([
      prisma.role.count({ where: { companyId } }),
      l2 ? prisma.processNode.findMany({ where: { companyId, processLevelTypeId: l2 }, orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true } }) : Promise.resolve([]),
    ]);
    return {
      level: 'company', title: label, subtitle: 'Roles · top-down ownership',
      tiles: [{ label: 'Roles', value: roleCount }, { label: 'Value streams', value: divisions.length }],
      sections: [{ title: 'Value streams', kind: 'list', items: divisions.map((d) => ({ label: d.displayValue, value: 0, drill: { level: 'valueStream', id: d.id } })) }],
    };
  }
  return null;
}

// /explorer/roles/:level/:id — the map's right-hand drill sidebar.
router.get('/roles/:level/:id?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const id = req.params.id ? decodeURIComponent(req.params.id) : undefined;

    let out: Dashboard | null = null;
    // A node id (process or org) drives the dashboard by its level; otherwise the
    // bare level (company/domain/division) gives the org roll-up.
    if (id) {
      const pn = await prisma.processNode.findFirst({
        where: { id, companyId: company.id },
        select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } } },
      });
      if (pn) {
        if (req.params.level === 'role') out = await roleDashboard(id); // (defensive — role ids aren't process nodes)
        else out = await processNodeDashboard({ id: pn.id, displayValue: pn.displayValue, level: pn.processLevelType.levelNumber });
      } else if (req.params.level === 'role') {
        out = await roleDashboard(id);
      } else {
        // The id is an OrgUnit (segment/division), not a ProcessNode. A division
        // (org L2) shares its dbValue with the same-named value stream (process L2);
        // map across and render that value stream's subtree-scoped dashboard so the
        // sidebar shows real division numbers instead of a company-wide roll-up.
        const ou = await prisma.orgUnit.findFirst({
          where: { id, companyId: company.id },
          select: { dbValue: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } },
        });
        // Department (org L3) → team dashboard (roles homed under it + their reach).
        if (ou && ou.orgLevelType.levelNumber === 3) {
          out = await departmentDashboard(id, ou.displayValue);
        } else if (ou && ou.orgLevelType.levelNumber === 2) {
          const { idOf } = await processLevelMap(company.id);
          const l2 = idOf(2);
          const vs = l2
            ? await prisma.processNode.findFirst({
                where: { companyId: company.id, processLevelTypeId: l2, dbValue: ou.dbValue },
                select: { id: true, displayValue: true },
              })
            : null;
          if (vs) out = await processNodeDashboard({ id: vs.id, displayValue: vs.displayValue, level: 2 });
        }
        // Segment (org L1) or an unmatched division → safe company-wide roll-up.
        if (!out) out = await orgDashboard(company.id, 'company', id, company.name);
      }
    } else {
      out = await orgDashboard(company.id, req.params.level, undefined, company.name);
    }
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out);
  } catch (e) { next(e); }
});

}
