// seed-ai-analysis.ts — illustrative data for the Metrics tab's two stages
// (D6.3). Deterministic (stable FNV-1a hash of subject names — no Math.random /
// Date.now) and idempotent: existing rows / already-assessed tasks are kept, so
// re-runs are no-ops and Data Admin edits survive reseeding.
//
//   Stage 1 — AnalysisStatus: one row per value-stream / division / role NODE of
//     the unified graph. ~60% Complete, ~20% In Progress (near-future planned
//     date, a small deterministic slice overdue so the on-plan indicator is
//     meaningful), ~20% Not Started (planned 1–5 months out).
//   Stage 2 — Task.aiDisposition: ~25% Automated, ~10% Discarded, ~30% Augmented,
//     rest Manual, assigned only where aiDisposition IS NULL.
//
// Run (cwd = backend): npx tsx scripts/seed-ai-analysis.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Stable FNV-1a hash (same recipe as src/seed/work.ts) so reruns reproduce.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

// Node typeKey → AnalysisStatus.subjectType
const SUBJECTS: Record<string, string> = { value_stream: 'valueStream', division: 'division', role: 'role' };

async function seedCompany(tenantId: string, companyId: string, name: string) {
  const today = new Date();

  // ── Stage 1: analysis coverage over the canonical node tree ────────────────
  const nodes = await prisma.node.findMany({
    where: { companyId, typeKey: { in: Object.keys(SUBJECTS) } },
    select: { id: true, typeKey: true, name: true },
  });
  const existing = await prisma.analysisStatus.findMany({
    where: { companyId }, select: { subjectType: true, subjectId: true },
  });
  const have = new Set(existing.map((r) => `${r.subjectType}␟${r.subjectId}`));

  const rows: { tenantId: string; companyId: string; subjectType: string; subjectId: string; status: string; plannedDate: Date; completedDate: Date | null }[] = [];
  for (const n of nodes) {
    const subjectType = SUBJECTS[n.typeKey];
    if (have.has(`${subjectType}␟${n.id}`)) continue;
    // Hash the NAME (not the cuid) so the distribution survives node rebuilds.
    const h = hash(`${subjectType}:${n.name}`);
    const bucket = h % 100;
    if (bucket < 60) {
      // Complete: finished 1–13 weeks ago, planned at/shortly after the finish.
      const completed = addDays(today, -(7 + (h % 90)));
      rows.push({ tenantId, companyId, subjectType, subjectId: n.id, status: 'Complete', plannedDate: addDays(completed, (h >> 3) % 10), completedDate: completed });
    } else if (bucket < 80) {
      // In Progress: near-future planned date; ~1 in 9 deterministically overdue
      // so the on-plan indicator has something real to report.
      const planned = (h >> 2) % 9 === 0 ? addDays(today, -(3 + (h % 10))) : addDays(today, 5 + (h % 40));
      rows.push({ tenantId, companyId, subjectType, subjectId: n.id, status: 'In Progress', plannedDate: planned, completedDate: null });
    } else {
      // Not Started: planned 1–5 months out.
      rows.push({ tenantId, companyId, subjectType, subjectId: n.id, status: 'Not Started', plannedDate: addDays(today, 30 + (h % 120)), completedDate: null });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.analysisStatus.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`${name}: analysis coverage — created ${rows.length}, kept existing ${existing.length} (subjects: ${nodes.length})`);

  // ── Stage 2: task AI disposition ────────────────────────────────────────────
  const tasks = await prisma.task.findMany({
    where: { companyId, aiDisposition: null },
    select: { id: true, title: true, owner: true, source: true },
  });
  const byDisposition = new Map<string, string[]>();
  for (const t of tasks) {
    // Hash the stable task identity (title + owner + source), not the cuid.
    const b = hash(`${t.title}␟${t.owner ?? ''}␟${t.source}`) % 100;
    const d = b < 25 ? 'Automated' : b < 35 ? 'Discarded' : b < 65 ? 'Augmented' : 'Manual';
    (byDisposition.get(d) ?? byDisposition.set(d, []).get(d)!).push(t.id);
  }
  for (const [disposition, ids] of byDisposition) {
    for (let i = 0; i < ids.length; i += 2000) {
      await prisma.task.updateMany({
        where: { id: { in: ids.slice(i, i + 2000) }, aiDisposition: null },
        data: { aiDisposition: disposition },
      });
    }
  }
  const summary = [...byDisposition.entries()].map(([d, ids]) => `${d} ${ids.length}`).join(', ');
  console.log(`${name}: task dispositions — assessed ${tasks.length} unassessed tasks (${summary || 'none'})`);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'strata' }, select: { id: true } });
  if (!tenant) throw new Error('strata tenant not found — run db:seed first');
  const companies = await prisma.company.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
  for (const c of companies) await seedCompany(tenant.id, c.id, c.name);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
