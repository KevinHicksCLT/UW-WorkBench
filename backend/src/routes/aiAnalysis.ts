import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ancestorNames } from '../lib/resolvers/index.js';

// Metrics tab (D6.3) — the two stages of the AI program, computed server-side
// from the canonical erd_v5 tables (no parallel copies):
//   Stage 1 "Analysis coverage": AnalysisStatus rows (one per value-stream /
//     division / role subject) vs the spine totals — how much of the operating
//     model has been analyzed, when we expect to finish, and whether the
//     incomplete work is still on plan.
//   Stage 2 "Adoption": each L5 task ProcessNode's `automatability`
//     (automated | augmented | manual) aggregated over the task tree, broken
//     down by value stream, division, role (task owner), task category and
//     deliverable. Replaces the dropped Task.aiDisposition model.

const router = Router();
router.use(requireAuth);

// subjectType (AnalysisStatus) → process/org level used for the denominator.
const SUBJECT_TYPES = [
  { type: 'valueStream', spine: 'process', level: 2, label: 'Value streams' },
  { type: 'division', spine: 'org', level: 2, label: 'Org groups' },
  { type: 'role', spine: 'role', level: 0, label: 'Roles' },
] as const;

type Disposition = 'Automated' | 'Discarded' | 'Augmented' | 'Manual';

// ProcessNode.automatability → adoption disposition. Tiers: autonomous/workflow
// (score 1-2, agent-runnable) → Automated; augmented/assist (score 3-4, AI in the
// loop) → Augmented; manual (score 5) → Manual. (No "Discarded" source in the
// workbook, so that bucket stays at 0.) Legacy "automated" token kept as Automated.
function dispositionOf(automatability: string | null): Disposition {
  if (automatability === 'autonomous' || automatability === 'workflow' || automatability === 'automated') return 'Automated';
  if (automatability === 'augmented' || automatability === 'assist' || automatability === 'assisted') return 'Augmented';
  return 'Manual';
}

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
function tally(map: Map<string, Bucket>, name: string, disposition: Disposition) {
  const b = map.get(name) ?? map.set(name, newBucket(name)).get(name)!;
  b.total++;
  b[disposition.toLowerCase() as Lowercase<Disposition>]++;
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
    const companyId = company.id;
    const now = new Date();

    const [statuses, processLevels, orgLevels, roleCount, tasks, orgCount, deliverableCount, applicationCount] = await Promise.all([
      prisma.analysisStatus.findMany({
        where: { companyId },
        select: { subjectType: true, subjectId: true, status: true, plannedDate: true },
      }),
      // counts per process level (value-stream denominator)
      prisma.processNode.groupBy({ by: ['processLevelTypeId'], where: { companyId }, _count: { _all: true } }),
      prisma.orgUnit.groupBy({ by: ['orgLevelTypeId'], where: { companyId }, _count: { _all: true } }),
      prisma.role.count({ where: { companyId } }),
      // L5 task nodes + their owning role (for division/role breakdowns).
      prisma.processNode.findMany({
        where: { companyId, isTask: true },
        select: {
          id: true, displayValue: true, automatability: true,
          nodeRoles: {
            where: { role_: 'Owner' },
            select: { role: { select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } } } },
          },
          nodeDeliverables: { select: { id: true } },
        },
      }),
      // Baseline-inventory totals (Stage 1 "Current State Analysis"): full counts
      // of each canonical entity — derived read-time from the spine, never copied.
      prisma.orgUnit.count({ where: { companyId } }),
      prisma.deliverable.count({ where: { companyId } }),
      prisma.application.count({ where: { companyId } }),
    ]);

    // level-type id → levelNumber maps for the coverage denominators.
    const [pTypes, oTypes] = await Promise.all([
      prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
      prisma.orgLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } }),
    ]);
    const pLevelOf = new Map(pTypes.map((t) => [t.id, t.levelNumber]));
    const oLevelOf = new Map(oTypes.map((t) => [t.id, t.levelNumber]));
    const totalForType = (s: (typeof SUBJECT_TYPES)[number]): number => {
      if (s.spine === 'role') return roleCount;
      if (s.spine === 'process') return processLevels.filter((g) => pLevelOf.get(g.processLevelTypeId) === s.level).reduce((a, g) => a + g._count._all, 0);
      return orgLevels.filter((g) => oLevelOf.get(g.orgLevelTypeId) === s.level).reduce((a, g) => a + g._count._all, 0);
    };

    // ── Stage 1: analysis coverage per subject type ─────────────────────────
    const coverage = SUBJECT_TYPES.map((s) => {
      const { type, label } = s;
      const rows = statuses.filter((r) => r.subjectType === type);
      const complete = rows.filter((r) => r.status === 'Complete').length;
      const inProgress = rows.filter((r) => r.status === 'In Progress').length;
      const total = totalForType(s);
      const notStarted = Math.max(0, total - complete - inProgress);
      const open = rows.filter((r) => r.status !== 'Complete' && r.plannedDate);
      const overdue = open.filter((r) => r.plannedDate! < now).length;
      const expectedFinish = open.length
        ? open.reduce((max, r) => (r.plannedDate! > max ? r.plannedDate! : max), open[0].plannedDate!)
        : null;
      return {
        type: type as string, label: label as string, total, complete, inProgress, notStarted,
        pctComplete: total ? Math.round((100 * complete) / total) : 0,
        expectedFinish, overdue, onPlan: overdue === 0,
      };
    });

    // Tasks coverage — there is no AnalysisStatus subject for tasks; a task is
    // "analyzed" once it carries an AI disposition (automatability set). Computed
    // from the canonical Task tree, no planned dates → no overdue.
    const tasksAnalyzed = tasks.filter((t) => t.automatability != null).length;
    coverage.push({
      type: 'task', label: 'Tasks', total: tasks.length, complete: tasksAnalyzed,
      inProgress: 0, notStarted: tasks.length - tasksAnalyzed,
      pctComplete: tasks.length ? Math.round((100 * tasksAnalyzed) / tasks.length) : 0,
      expectedFinish: null, overdue: 0, onPlan: true,
    });

    // ── Stage 2: adoption breakdowns over the L5 task tree ──────────────────
    // value-stream (L2) name per task, resolved once via the closure.
    const vsByTask = await ancestorNames(tasks.map((t) => t.id));

    const counts: Record<Lowercase<Disposition>, number> = { automated: 0, discarded: 0, augmented: 0, manual: 0 };
    const byDivision = new Map<string, Bucket>();
    const byRole = new Map<string, Bucket>();
    const byCategory = new Map<string, Bucket>();
    const byDeliverableType = new Map<string, Bucket>();
    const byValueStream = new Map<string, Bucket>();

    for (const t of tasks) {
      const d = dispositionOf(t.automatability);
      counts[d.toLowerCase() as Lowercase<Disposition>]++;
      const owner = t.nodeRoles[0]?.role ?? null;
      tally(byDivision, owner?.orgUnit?.displayValue ?? 'Unassigned', d);
      tally(byRole, owner?.displayValue ?? 'Unassigned', d);
      tally(byCategory, taskCategory(t.displayValue), d);
      tally(byDeliverableType, t.nodeDeliverables.length ? 'Deliverable' : 'No deliverable', d);
      tally(byValueStream, vsByTask.get(t.id)?.valueStreamName ?? 'Unassigned', d);
    }

    // ── Baseline inventory: how big the current operating model is ──────────
    // Value streams = L2 process nodes (the canonical value-stream level, same
    // denominator as the valueStream coverage subject). Everything else is a
    // full table count. Pure counts — no analysis tracking implied.
    const inventory = {
      orgs: orgCount,
      valueStreams: totalForType(SUBJECT_TYPES[0]),
      roles: roleCount,
      tasks: tasks.length,
      deliverables: deliverableCount,
      applications: applicationCount,
    };

    const totalTasks = tasks.length;
    const pct = (n: number) => (totalTasks ? Math.round((1000 * n) / totalTasks) / 10 : 0);
    res.json({
      inventory,
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
