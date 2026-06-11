import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { buildRoleResolver } from '../lib/roleMatch.js';

// Metrics tab (D6.3) — the two stages of the AI program, computed server-side
// from the canonical tables (no parallel copies):
//   Stage 1 "Analysis coverage": AnalysisStatus rows (one per value-stream /
//     division / role NODE of the unified graph) vs the node totals — how much
//     of the operating model has been analyzed, when we expect to finish, and
//     whether the incomplete work is still on plan.
//   Stage 2 "Adoption": Task.aiDisposition (Automated | Discarded | Augmented |
//     Manual) aggregated over the Task table, broken down by org group
//     (division), role (task owner), task category, deliverable type and value
//     stream. Both stores are edited in Data Admin (AnalysisStatus / Task).

const router = Router();
router.use(requireAuth);

const SUBJECT_TYPES = [
  { type: 'valueStream', typeKey: 'value_stream', label: 'Value streams' },
  { type: 'division', typeKey: 'division', label: 'Org groups' },
  { type: 'role', typeKey: 'role', label: 'Roles' },
] as const;

const DISPOSITIONS = ['Automated', 'Discarded', 'Augmented', 'Manual'] as const;
type Disposition = (typeof DISPOSITIONS)[number];

// Coarse task "category" (meta summary) — a pure, deterministic function of the
// canonical task title (the workbook does not classify tasks), so it is compute,
// not a second copy of the data.
function taskCategory(title: string): string {
  const t = title.toLowerCase();
  if (/review|approv|sign-?off|validat|verif|confirm|reconcil|audit/.test(t)) return 'Review & Approve';
  if (/analy|assess|evaluat|investigat|research|score|rate|model|estimat|calculat/.test(t)) return 'Analyze & Assess';
  if (/draft|creat|prepar|develop|design|writ|document|generat|build|issue/.test(t)) return 'Create & Produce';
  if (/coordinat|communicat|notif|schedul|meet|liais|escalat|share|present|respond|engag/.test(t)) return 'Coordinate & Communicate';
  if (/monitor|track|report|measur|oversee|maintain|manage|updat/.test(t)) return 'Monitor & Manage';
  return 'Execute & Process';
}

type Bucket = { name: string; total: number } & Record<Lowercase<Disposition>, number>;
function newBucket(name: string): Bucket {
  return { name, total: 0, automated: 0, discarded: 0, augmented: 0, manual: 0 };
}
function tally(map: Map<string, Bucket>, name: string, disposition: Disposition | null) {
  const b = map.get(name) ?? map.set(name, newBucket(name)).get(name)!;
  b.total++;
  if (disposition) b[disposition.toLowerCase() as Lowercase<Disposition>]++;
}
const sorted = (map: Map<string, Bucket>, limit?: number) => {
  const rows = [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return limit ? rows.slice(0, limit) : rows;
};

// GET /ai-analysis/summary — everything the Metrics page's two new sections need.
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const company = await prisma.company.findFirst({
      where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
      orderBy: { createdAt: 'asc' }, select: { id: true },
    });
    if (!company) return res.status(404).json({ error: 'No company' });
    const now = new Date();

    const [nodes, statuses, tasks, deliverables, valueStreams, roles] = await Promise.all([
      prisma.node.findMany({
        where: { companyId: company.id, typeKey: { in: SUBJECT_TYPES.map((s) => s.typeKey) } },
        select: { id: true, typeKey: true },
      }),
      prisma.analysisStatus.findMany({
        where: { companyId: company.id },
        select: { subjectType: true, subjectId: true, status: true, plannedDate: true },
      }),
      prisma.task.findMany({
        where: { companyId: company.id },
        select: { title: true, owner: true, aiDisposition: true, deliverableId: true },
      }),
      prisma.deliverable.findMany({
        where: { companyId: company.id },
        select: { id: true, type: true, valueStreamId: true },
      }),
      prisma.valueStream.findMany({ where: { companyId: company.id }, select: { id: true, name: true } }),
      prisma.role.findMany({
        where: { companyId: company.id },
        select: { id: true, name: true, itemRole: true, division: { select: { name: true } } },
      }),
    ]);

    // ── Stage 1: analysis coverage per subject type ─────────────────────────
    const nodeIds = new Map(SUBJECT_TYPES.map((s) => [s.type, new Set<string>()] as const));
    for (const n of nodes) {
      const s = SUBJECT_TYPES.find((x) => x.typeKey === n.typeKey)!;
      nodeIds.get(s.type)!.add(n.id);
    }
    const coverage = SUBJECT_TYPES.map(({ type, label }) => {
      const ids = nodeIds.get(type)!;
      // Only statuses whose subject still exists in the node tree count.
      const rows = statuses.filter((r) => r.subjectType === type && ids.has(r.subjectId));
      const complete = rows.filter((r) => r.status === 'Complete').length;
      const inProgress = rows.filter((r) => r.status === 'In Progress').length;
      const total = ids.size;
      const notStarted = total - complete - inProgress; // includes subjects with no row yet
      const open = rows.filter((r) => r.status !== 'Complete' && r.plannedDate);
      const overdue = open.filter((r) => r.plannedDate! < now).length;
      const expectedFinish = open.length
        ? open.reduce((max, r) => (r.plannedDate! > max ? r.plannedDate! : max), open[0].plannedDate!)
        : null;
      return {
        type, label, total, complete, inProgress, notStarted,
        pctComplete: total ? Math.round((100 * complete) / total) : 0,
        expectedFinish, overdue, onPlan: overdue === 0,
      };
    });

    // ── Stage 2: adoption breakdowns over the Task table ────────────────────
    const resolveRole = buildRoleResolver(roles);
    const divisionOf = new Map(roles.map((r) => [r.id, r.division?.name ?? 'Unassigned'] as const));
    const delivById = new Map(deliverables.map((d) => [d.id, d] as const));
    const vsName = new Map(valueStreams.map((v) => [v.id, v.name] as const));

    const counts: Record<Lowercase<Disposition>, number> = { automated: 0, discarded: 0, augmented: 0, manual: 0 };
    const byDivision = new Map<string, Bucket>();
    const byRole = new Map<string, Bucket>();
    const byCategory = new Map<string, Bucket>();
    const byDeliverableType = new Map<string, Bucket>();
    const byValueStream = new Map<string, Bucket>();

    for (const t of tasks) {
      const d = DISPOSITIONS.includes(t.aiDisposition as Disposition) ? (t.aiDisposition as Disposition) : null;
      if (d) counts[d.toLowerCase() as Lowercase<Disposition>]++;
      const role = t.owner ? resolveRole(t.owner) : null;
      tally(byDivision, role ? divisionOf.get(role.id)! : 'Unassigned', d);
      tally(byRole, role?.name ?? t.owner ?? 'Unassigned', d);
      tally(byCategory, taskCategory(t.title), d);
      const deliv = t.deliverableId ? delivById.get(t.deliverableId) : undefined;
      tally(byDeliverableType, deliv?.type ?? 'No deliverable', d);
      tally(byValueStream, (deliv?.valueStreamId && vsName.get(deliv.valueStreamId)) || 'Unassigned', d);
    }

    const totalTasks = tasks.length;
    const pct = (n: number) => (totalTasks ? Math.round((1000 * n) / totalTasks) / 10 : 0);
    res.json({
      coverage,
      adoption: {
        totalTasks,
        counts,
        pct: {
          automated: pct(counts.automated), discarded: pct(counts.discarded),
          augmented: pct(counts.augmented), manual: pct(counts.manual),
        },
        breakdowns: {
          division: sorted(byDivision),
          role: sorted(byRole, 15),
          category: sorted(byCategory),
          deliverableType: sorted(byDeliverableType),
          valueStream: sorted(byValueStream),
        },
      },
    });
  } catch (e) { next(e); }
});

export default router;
