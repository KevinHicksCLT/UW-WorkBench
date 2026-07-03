// Role-profile assembly — the derivation behind GET /roles/:id/profile.
// Split from routes/roles.ts so the grouping logic is pure and unit-testable:
// `assembleRoleProfile` takes plain rows (no Prisma), the route does one
// batched Promise.all round and hands them over. No per-row query fan-out.
import type { AncestorNames } from './resolvers/ancestorNames.js';

export type ProfileRoleRow = {
  id: string;
  displayValue: string;
  description: string | null;
  roleFamily: string | null;
  roleLevel: string | null;
  company: { id: string; name: string };
  orgUnit: {
    id: string;
    displayValue: string;
    orgLevelType: { levelNumber: number } | null;
    parent: {
      id: string;
      displayValue: string;
      orgLevelType: { levelNumber: number } | null;
    } | null;
  } | null;
};
export type ProfileNodeRoleRow = {
  role_: string;
  processNode: { id: string; displayValue: string; sortOrder: number };
};
export type ProfileRoleDeliverableRow = {
  role_: string;
  deliverable: { id: string; title: string };
};
export type ProfileNodeDeliverableRow = {
  processNodeId: string;
  deliverable: { id: string; title: string };
};
export type ProfileChecklistRow = { text: string; checklist: string | null };

export type ProfileTask = {
  nodeId: string;
  name: string;
  relation: 'Lead' | 'Support';
  valueStreamId: string | null;
  valueStreamName: string;
  l3: string | null;
  l4: string | null;
  stepNumber: number;
  deliverables: { id: string; title: string }[];
};
export type ProfileDeliverable = {
  id: string;
  title: string;
  /** Owner | Contributor from RoleDeliverable; null when only reachable via tasks. */
  role_: 'Owner' | 'Contributor' | null;
  valueStreamName: string | null;
  tasks: { name: string; relation: 'Lead' | 'Support'; l3: string | null; l4: string | null }[];
};

// Group responsibilities by their checklist name, de-duplicating by normalized
// text within each group. (Also consumed by routes/roles.ts for the drawer.)
export function groupByChecklist(rows: ProfileChecklistRow[]) {
  const m = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const cat = r.checklist ?? 'Uncategorized';
    if (!m.has(cat)) {
      m.set(cat, []);
      seen.set(cat, new Set());
    }
    const key = r.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.get(cat)!.has(key)) continue;
    seen.get(cat)!.add(key);
    m.get(cat)!.push(r.text);
  }
  return [...m.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function assembleRoleProfile(input: {
  role: ProfileRoleRow;
  nodeRoles: ProfileNodeRoleRow[];
  roleDelivs: ProfileRoleDeliverableRow[];
  nodeDelivs: ProfileNodeDeliverableRow[];
  checkItems: ProfileChecklistRow[];
  loc: Map<string, Pick<AncestorNames, 'valueStreamId' | 'valueStreamName' | 'l3' | 'l4'>>;
}) {
  const { role, nodeRoles, roleDelivs, nodeDelivs, checkItems, loc } = input;

  // Task↔deliverable index (a task node can feed several deliverables).
  const delivsByNode = new Map<string, { id: string; title: string }[]>();
  for (const nd of nodeDelivs) {
    const list = delivsByNode.get(nd.processNodeId) ?? [];
    if (!list.some((d) => d.id === nd.deliverable.id)) list.push(nd.deliverable);
    delivsByNode.set(nd.processNodeId, list);
  }

  // taskSummary — one row per task node; a role that is both Owner and
  // Participant on the same node collapses to its strongest relation (Lead).
  const taskByNode = new Map<string, ProfileTask>();
  for (const nr of nodeRoles) {
    const node = nr.processNode;
    const rel: 'Lead' | 'Support' = nr.role_ === 'Owner' ? 'Lead' : 'Support';
    const existing = taskByNode.get(node.id);
    if (existing) {
      if (rel === 'Lead') existing.relation = 'Lead';
      continue;
    }
    const a = loc.get(node.id);
    taskByNode.set(node.id, {
      nodeId: node.id,
      name: node.displayValue,
      relation: rel,
      valueStreamId: a?.valueStreamId ?? null,
      valueStreamName: a?.valueStreamName ?? '—',
      l3: a?.l3 ?? null,
      l4: a?.l4 ?? null,
      stepNumber: node.sortOrder,
      deliverables: delivsByNode.get(node.id) ?? [],
    });
  }
  const taskSummary = [...taskByNode.values()].sort(
    (a, b) =>
      a.valueStreamName.localeCompare(b.valueStreamName) ||
      String(a.l4 ?? '').localeCompare(String(b.l4 ?? '')) ||
      a.stepNumber - b.stepNumber,
  );

  // Primary value stream — the stream most of the role's tasks roll up to
  // (fallback location for deliverables only reachable via direct links).
  const vsCounts = new Map<string, { name: string; n: number }>();
  for (const t of taskSummary) {
    if (!t.valueStreamId) continue;
    const e = vsCounts.get(t.valueStreamId) ?? { name: t.valueStreamName, n: 0 };
    e.n++;
    vsCounts.set(t.valueStreamId, e);
  }
  const primaryVsName = [...vsCounts.values()].sort((a, b) => b.n - a.n)[0]?.name ?? null;

  // deliverables — the union of direct RoleDeliverable links (carrying the
  // Owner/Contributor chip; Owner beats Contributor on duplicates) and
  // deliverables reachable through the role's tasks (chip null unless linked).
  const deliverableMap = new Map<string, ProfileDeliverable>();
  for (const rd of roleDelivs) {
    const rel: 'Owner' | 'Contributor' = rd.role_ === 'Owner' ? 'Owner' : 'Contributor';
    const existing = deliverableMap.get(rd.deliverable.id);
    if (existing) {
      if (rel === 'Owner') existing.role_ = 'Owner';
      continue;
    }
    deliverableMap.set(rd.deliverable.id, {
      id: rd.deliverable.id,
      title: rd.deliverable.title,
      role_: rel,
      valueStreamName: null, // filled from its tasks below
      tasks: [],
    });
  }
  const vsCountByDeliverable = new Map<string, Map<string, number>>();
  for (const t of taskSummary) {
    for (const d of t.deliverables) {
      let entry = deliverableMap.get(d.id);
      if (!entry) {
        entry = { id: d.id, title: d.title, role_: null, valueStreamName: null, tasks: [] };
        deliverableMap.set(d.id, entry);
      }
      entry.tasks.push({ name: t.name, relation: t.relation, l3: t.l3, l4: t.l4 });
      if (t.valueStreamName !== '—') {
        const counts = vsCountByDeliverable.get(d.id) ?? new Map<string, number>();
        counts.set(t.valueStreamName, (counts.get(t.valueStreamName) ?? 0) + 1);
        vsCountByDeliverable.set(d.id, counts);
      }
    }
  }
  // Per-deliverable value stream = modal stream of the role's tasks under it;
  // direct-only links (no task path) fall back to the role's primary stream.
  for (const [id, entry] of deliverableMap) {
    const top = [...(vsCountByDeliverable.get(id) ?? new Map<string, number>()).entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    entry.valueStreamName = top?.[0] ?? primaryVsName;
  }
  const deliverables = [...deliverableMap.values()].sort((a, b) => {
    // Owned first, then contributed, then task-derived; alpha within each band.
    const band = (d: ProfileDeliverable) =>
      d.role_ === 'Owner' ? 0 : d.role_ === 'Contributor' ? 1 : 2;
    return band(a) - band(b) || a.title.localeCompare(b.title);
  });

  // participation — distinct value streams, strongest relation wins.
  const partMap = new Map<
    string,
    { valueStreamId: string; valueStreamName: string; participationType: 'Lead' | 'Support' }
  >();
  for (const t of taskSummary) {
    if (!t.valueStreamId) continue;
    const cur = partMap.get(t.valueStreamId);
    if (!cur || (t.relation === 'Lead' && cur.participationType !== 'Lead')) {
      partMap.set(t.valueStreamId, {
        valueStreamId: t.valueStreamId,
        valueStreamName: t.valueStreamName,
        participationType: t.relation,
      });
    }
  }
  const participation = [...partMap.values()].sort((a, b) =>
    a.participationType === b.participationType
      ? a.valueStreamName.localeCompare(b.valueStreamName)
      : a.participationType === 'Lead'
        ? -1
        : 1,
  );

  // Org context (same L2/L3 unpacking as the drawer endpoint).
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

  return {
    id: role.id,
    name: role.displayValue,
    description: role.description,
    roleFamily: role.roleFamily,
    roleLevel: role.roleLevel,
    company: role.company,
    division,
    department,
    participation,
    deliverables,
    taskSummary,
    responsibilities: groupByChecklist(checkItems),
  };
}
