import type { PrismaClient } from '@prisma/client';
import { buildRoleResolver } from '../lib/roleMatch.js';

// Deliverables & Tasks work tracker — sourced from the operating model itself.
//
// Deliverables = every distinct "Output / Deliverable" in the I/O inventory
// (IoItem), at the L4 sub-process grain, owned by its first Key Role. Tasks come
// from two sources, kept distinct via Task.source:
//   • 'process' — every L5 process step (ProcessStep), owned by its Lead, linked
//     back to a deliverable in the same value stream + sub-process.
//   • 'role'    — every role responsibility (RoleTask) distributed across the
//     deliverables its owning role is accountable for (see below). This folds
//     the ~4.7k role tasks into the work tracker and guarantees every
//     deliverable carries at least one task.
// Titles, owners, value streams and sub-processes are REAL (from the workbook);
// status / priority / due dates have no workbook source, so they are derived
// deterministically (illustrative) purely to drive the banner + Priority column.
//
// Deterministic and idempotent: clears the company's deliverables + tasks, then
// rebuilds from the seeded IoItem / ProcessStep / RoleTask tables.

const firstRole = (cell: string | null): string | null => {
  if (!cell) return null;
  const first = cell.split(/[,;]+/)[0]?.trim();
  return first || null;
};

// Stable FNV-1a hash so illustrative status/priority/due are reproducible.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pick = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];

// Coarse deliverable "type" inferred from the work product's name (the workbook
// does not classify them). Keeps the Type filter meaningful.
function classifyType(name: string): string {
  const n = name.toLowerCase();
  if (/dashboard|scorecard|report|summary|review|analysis|insight/.test(n)) return 'Report';
  if (/model|rating|score|prediction|forecast|projection/.test(n)) return 'Model';
  if (/dataset|data feed|extract|record|file|register|ledger|inventory/.test(n)) return 'Data';
  if (/invoice|payment|statement|reconciliation|settlement|schedule/.test(n)) return 'Financial';
  if (/decision|approval|sign-?off|recommendation|referral|authorization/.test(n)) return 'Decision';
  if (/policy|contract|agreement|spec|specification|plan|procedure|standard|guideline|document|charter|framework/.test(n)) return 'Document';
  return 'Deliverable';
}

const DELIVERABLE_STATUS = ['Not Started', 'In Progress', 'In Progress', 'In Progress', 'At Risk', 'Done', 'Done'];
const TASK_STATUS = ['To Do', 'To Do', 'In Progress', 'In Progress', 'Blocked', 'Done', 'Done'];
const PRIORITY = ['High', 'Medium', 'Medium', 'Medium', 'Low'];

function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

export async function seedWork(prisma: PrismaClient, ctx: { tenantId: string; companyId: string }) {
  const { tenantId, companyId } = ctx;

  // Fresh rebuild for this company.
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.deliverable.deleteMany({ where: { companyId } });

  const [ioItems, steps] = await Promise.all([
    prisma.ioItem.findMany({
      where: { valueStream: { companyId } },
      select: { type: true, name: true, l3: true, l4: true, keyRoles: true, valueStreamId: true },
    }),
    prisma.processStep.findMany({
      where: { valueStream: { companyId } },
      select: { name: true, l3: true, l4: true, stepNumber: true, leads: true, supporting: true, outputs: true, valueStreamId: true },
    }),
  ]);

  const today = new Date();

  // ── Deliverables: one per distinct (value stream, L4, name) Output/Deliverable ──
  const groupKey = (vsId: string, l4: string | null) => `${vsId}␟${l4 ?? ''}`;
  const l3Key = (vsId: string, l3: string | null) => `${vsId}␟${l3 ?? ''}`;
  type DRow = { id: string; title: string };
  const byGroup = new Map<string, DRow[]>(); // (vsId, l4) → created deliverables, for task linking
  const byL3 = new Map<string, DRow[]>();    // (vsId, l3) → deliverables (broader fallback)
  const byVs = new Map<string, DRow[]>();     // vsId → deliverables (broadest fallback)
  const seen = new Set<string>();
  let dCount = 0;

  for (const io of ioItems) {
    if (!/output|deliver/i.test(io.type)) continue;
    const dedupe = `${io.valueStreamId}␟${io.l4 ?? ''}␟${io.name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const h = hash(dedupe);
    const created = await prisma.deliverable.create({
      data: {
        tenantId, companyId,
        title: io.name,
        description: [io.l3, io.l4].filter(Boolean).join(' · ') || null,
        owner: firstRole(io.keyRoles),
        type: classifyType(io.name),
        status: pick(h, DELIVERABLE_STATUS),
        valueStreamId: io.valueStreamId,
        dueDate: addDays(today, (h % 110) - 18),
      },
      select: { id: true, title: true },
    });
    dCount++;
    const k = groupKey(io.valueStreamId, io.l4);
    (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(created);
    const k3 = l3Key(io.valueStreamId, io.l3);
    (byL3.get(k3) ?? byL3.set(k3, []).get(k3)!).push(created);
    (byVs.get(io.valueStreamId) ?? byVs.set(io.valueStreamId, []).get(io.valueStreamId)!).push(created);
  }

  // ── Supplemental deliverables for value streams the I/O inventory left empty ──
  // A few (newer) value streams have process flows but no catalogued Output/
  // Deliverable, which would leave their tasks with nothing to roll up to. For
  // those, treat each L4 sub-process as a deliverable (named by the sub-process,
  // owned by its lead) so the work still has structure.
  const vsWithDeliv = new Set(byVs.keys());
  const supplGroups = new Map<string, { vsId: string; l3: string | null; l4: string; leads: string | null }>();
  for (const s of steps) {
    if (vsWithDeliv.has(s.valueStreamId) || !s.l4) continue;
    const key = `${s.valueStreamId}␟${s.l4}`;
    if (!supplGroups.has(key)) supplGroups.set(key, { vsId: s.valueStreamId, l3: s.l3, l4: s.l4, leads: s.leads });
  }
  for (const g of supplGroups.values()) {
    const h = hash(`${g.vsId}␟${g.l4}`);
    const created = await prisma.deliverable.create({
      data: {
        tenantId, companyId,
        title: g.l4,
        description: [g.l3, g.l4].filter(Boolean).join(' · ') || null,
        owner: firstRole(g.leads),
        type: classifyType(g.l4),
        status: pick(h, DELIVERABLE_STATUS),
        valueStreamId: g.vsId,
        dueDate: addDays(today, (h % 110) - 18),
      },
      select: { id: true, title: true },
    });
    dCount++;
    const k = groupKey(g.vsId, g.l4);
    (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(created);
    const k3 = l3Key(g.vsId, g.l3);
    (byL3.get(k3) ?? byL3.set(k3, []).get(k3)!).push(created);
    (byVs.get(g.vsId) ?? byVs.set(g.vsId, []).get(g.vsId)!).push(created);
  }

  // ── Tasks: one per L5 process step, linked to a deliverable in the same group ──
  // Prefer the deliverable whose title the step's output names; then the same
  // sub-process (L4), then the same process area (L3), then any in the value
  // stream; only unlinked when the whole value stream has no deliverables.
  const taskData = steps.map((s) => {
    const sameL4 = byGroup.get(groupKey(s.valueStreamId, s.l4)) ?? [];
    const sameL3 = byL3.get(l3Key(s.valueStreamId, s.l3)) ?? [];
    const sameVs = byVs.get(s.valueStreamId) ?? [];
    const group = sameL4.length ? sameL4 : sameL3.length ? sameL3 : sameVs;
    const out = (s.outputs ?? '').toLowerCase();
    const linked = group.find((d) => out.includes(d.title.toLowerCase())) ?? group[0] ?? null;
    const h = hash(`${s.valueStreamId}␟${s.l4 ?? ''}␟${s.stepNumber}␟${s.name}`);
    return {
      tenantId, companyId,
      deliverableId: linked?.id ?? null,
      title: s.name,
      owner: firstRole(s.leads) ?? firstRole(s.supporting),
      status: pick(h, TASK_STATUS),
      priority: pick(h >> 3, PRIORITY),
      source: 'process',
      dueDate: addDays(today, (h % 120) - 20),
    };
  });
  for (let i = 0; i < taskData.length; i += 500) {
    await prisma.task.createMany({ data: taskData.slice(i, i + 500) });
  }

  // ── Role tasks: distribute each role's responsibilities across its deliverables ──
  // A role's deliverables = the ones it owns (deliverable.owner resolved back to a
  // role). Round-robin over max(#deliverables, #tasks) so every deliverable gets
  // ≥1 task and every task is used ≥1; a task repeats only when the role owns more
  // deliverables than it has tasks. Deliverables whose owner has no role tasks are
  // then filled from a value-stream pool (role tasks of any role participating in
  // that stream), and finally a deterministic placeholder — so NO deliverable is
  // left empty.
  const [roles, roleTasks, roleVs, deliverables, existingTasks] = await Promise.all([
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } }),
    prisma.roleTask.findMany({ where: { role: { companyId } }, select: { roleId: true, text: true }, orderBy: { id: 'asc' } }),
    prisma.roleValueStream.findMany({ where: { role: { companyId } }, select: { roleId: true, valueStreamId: true } }),
    prisma.deliverable.findMany({ where: { companyId }, select: { id: true, title: true, owner: true, valueStreamId: true }, orderBy: { id: 'asc' } }),
    prisma.task.findMany({ where: { companyId }, select: { deliverableId: true } }),
  ]);

  const resolveRole = buildRoleResolver(roles);
  const roleName = new Map(roles.map((r) => [r.id, r.name] as const));

  const tasksByRole = new Map<string, string[]>();
  for (const rt of roleTasks) (tasksByRole.get(rt.roleId) ?? tasksByRole.set(rt.roleId, []).get(rt.roleId)!).push(rt.text);

  // Deliverables indexed by the role that owns them, and by value stream — the
  // two ways a role task can find a home.
  type DelivRow = (typeof deliverables)[number];
  const delivByRole = new Map<string, DelivRow[]>();
  const delivByVs = new Map<string, DelivRow[]>();
  for (const d of deliverables) {
    const owner = resolveRole(d.owner ?? '');
    if (owner) (delivByRole.get(owner.id) ?? delivByRole.set(owner.id, []).get(owner.id)!).push(d);
    if (d.valueStreamId) (delivByVs.get(d.valueStreamId) ?? delivByVs.set(d.valueStreamId, []).get(d.valueStreamId)!).push(d);
  }
  const vsByRole = new Map<string, string[]>();
  for (const link of roleVs) (vsByRole.get(link.roleId) ?? vsByRole.set(link.roleId, []).get(link.roleId)!).push(link.valueStreamId);

  const hasTask = new Set(existingTasks.map((t) => t.deliverableId).filter(Boolean) as string[]);
  const roleTaskRows: any[] = [];
  const makeRoleTask = (d: { id: string; title: string }, text: string, owner: string | null) => {
    const h = hash(`${d.id}␟${text}`);
    return {
      tenantId, companyId, deliverableId: d.id, title: text, owner,
      status: pick(h, TASK_STATUS), priority: pick(h >> 3, PRIORITY), source: 'role',
      dueDate: addDays(today, (h % 120) - 20),
    };
  };

  // EVERY role's responsibilities are rendered (the full ~4.7k set). A role's
  // tasks go onto the deliverables it owns; if it owns none, onto the
  // deliverables of the value streams it participates in; failing that, spread
  // across all deliverables. Owner roles use max(#deliverables, #tasks) so each
  // owned deliverable is filled AND each task appears; non-owner roles place each
  // task once across their candidate pool.
  for (const [rid, texts] of tasksByRole) {
    if (texts.length === 0) continue;
    const owned = delivByRole.get(rid) ?? [];
    const owns = owned.length > 0;
    let pool = owned;
    if (!owns) {
      const vss = vsByRole.get(rid) ?? [];
      pool = vss.flatMap((v) => delivByVs.get(v) ?? []);
      if (pool.length === 0) pool = deliverables;
    }
    const n = owns ? Math.max(pool.length, texts.length) : texts.length;
    for (let i = 0; i < n; i++) {
      const d = pool[i % pool.length];
      roleTaskRows.push(makeRoleTask(d, texts[i % texts.length], roleName.get(rid) ?? null));
      hasTask.add(d.id);
    }
  }

  // Safety net: any deliverable still without a task (its value stream had no
  // participating role tasks) gets a deterministic placeholder.
  let supplemented = 0;
  for (const d of deliverables) {
    if (hasTask.has(d.id)) continue;
    roleTaskRows.push(makeRoleTask(d, `Own and progress ${d.title}`, d.owner));
    hasTask.add(d.id);
    supplemented++;
  }

  for (let i = 0; i < roleTaskRows.length; i += 500) {
    await prisma.task.createMany({ data: roleTaskRows.slice(i, i + 500) });
  }

  console.log(`   + ${dCount} deliverables, ${taskData.length} process tasks, ${roleTaskRows.length} role tasks (${supplemented} placeholder fills)`);
}
