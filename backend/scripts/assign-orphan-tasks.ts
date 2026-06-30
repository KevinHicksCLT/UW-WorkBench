// Assign every task that has no deliverable to one — closes the "tasks not
// assigned a Deliverable" gap on the Work tab. Two sources leave tasks orphaned:
//   • source='checklist' — folded in by merge-checklist-into-tasks.ts (T-05)
//     with no deliverable link.
//   • source='process'   — a handful of L5 steps whose own value stream carried
//     no catalogued Output/Deliverable, so seedWork left them null.
// Each orphan is linked to a deliverable owned by its OWNER role (the same
// role→deliverable join seedWork uses); if the role owns none, to a deliverable
// in a value stream the role participates in; failing that, any deliverable.
// Round-robin within the chosen pool so one deliverable isn't overloaded.
//
// Idempotent: only touches tasks where deliverableId IS NULL. Re-runnable.
//   npx tsx scripts/assign-orphan-tasks.ts
import { PrismaClient } from '@prisma/client';
import { buildRoleResolver } from '../src/lib/roleMatch.js';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  const [roles, roleVs, deliverables, orphans] = await Promise.all([
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } }),
    prisma.roleValueStream.findMany({ where: { role: { companyId } }, select: { roleId: true, valueStreamId: true } }),
    prisma.deliverable.findMany({ where: { companyId }, select: { id: true, owner: true, valueStreamId: true }, orderBy: { id: 'asc' } }),
    prisma.task.findMany({ where: { companyId, deliverableId: null }, select: { id: true, owner: true, source: true }, orderBy: { id: 'asc' } }),
  ]);
  if (orphans.length === 0) { console.log('No orphan tasks — nothing to do.'); return; }

  const resolveRole = buildRoleResolver(roles);

  // Deliverables indexed by owning role, and by value stream (mirrors seedWork).
  const delivByRole = new Map<string, typeof deliverables>();
  const delivByVs = new Map<string, typeof deliverables>();
  for (const d of deliverables) {
    const owner = resolveRole(d.owner ?? '');
    if (owner) (delivByRole.get(owner.id) ?? delivByRole.set(owner.id, []).get(owner.id)!).push(d);
    if (d.valueStreamId) (delivByVs.get(d.valueStreamId) ?? delivByVs.set(d.valueStreamId, []).get(d.valueStreamId)!).push(d);
  }
  const vsByRole = new Map<string, string[]>();
  for (const l of roleVs) (vsByRole.get(l.roleId) ?? vsByRole.set(l.roleId, []).get(l.roleId)!).push(l.valueStreamId);

  // Per-pool counter for round-robin spread (keyed by the pool's first id).
  const rr = new Map<string, number>();
  const stats = { viaRole: 0, viaVs: 0, viaAll: 0 };
  let assigned = 0;

  for (const t of orphans) {
    const role = t.owner ? resolveRole(t.owner) : null;
    let pool = role ? delivByRole.get(role.id) ?? [] : [];
    if (pool.length) stats.viaRole++;
    else {
      const vss = role ? vsByRole.get(role.id) ?? [] : [];
      pool = vss.flatMap((v) => delivByVs.get(v) ?? []);
      if (pool.length) stats.viaVs++;
      else { pool = deliverables; stats.viaAll++; }
    }
    if (!pool.length) continue; // company has zero deliverables (shouldn't happen)
    const key = pool[0].id;
    const i = rr.get(key) ?? 0;
    rr.set(key, i + 1);
    const d = pool[i % pool.length];
    await prisma.task.update({ where: { id: t.id }, data: { deliverableId: d.id } });
    assigned++;
  }

  const remaining = await prisma.task.count({ where: { companyId, deliverableId: null } });
  console.log(`Company: ${company.name}`);
  console.log(`Assigned ${assigned} orphan task(s) — ${stats.viaRole} via owned deliverable, ${stats.viaVs} via role value stream, ${stats.viaAll} via fallback.`);
  console.log(`Tasks still without a deliverable: ${remaining}.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
