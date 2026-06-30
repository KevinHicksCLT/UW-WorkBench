// DQ-01 — completeness invariant validator. Reports every empty node across the
// three Coverage-Audit gap types and EXITS NON-ZERO if any remain, so it can be
// used as an automated gate (CI / pre-promotion). DQ-02 is satisfied when this
// reports zero. Read-only. Run from backend/:
//   npx tsx scripts/validate-completeness.ts
//
// Invariant (per DQ-01): every value stream and every L3 sub-value stream must be
// NON-EMPTY —
//   1. each value stream has L3 children AND process steps;
//   2. each L3 has at least one role mapped (RoleValueStream.subStream covers it),
//      which transitively gives it tasks + checklist;
//   3. every value-stream-participant role has RoleTask AND ChecklistItem rows.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// An L3 is "covered" when a RoleValueStream.subStream equals the L3 name or
// begins with "<L3 name> " / "<L3 name>—" (matches backfill-l3-roles.ts).
const covers = (sub: string | null, l3: string) =>
  !!sub && (sub === l3 || sub.startsWith(l3 + ' ') || sub.startsWith(l3 + '—'));

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  // 1) Value streams with no L3 children OR no process steps.
  const vs = await prisma.valueStream.findMany({
    where: { companyId },
    select: { name: true, _count: { select: { processSteps: true } }, subStreams: { where: { level: 3 }, select: { id: true } } },
  });
  const vsEmpty = vs.filter((v) => v.subStreams.length === 0 || v._count.processSteps === 0);

  // 2) L3 sub-value streams with no role mapped.
  const l3s = await prisma.subValueStream.findMany({
    where: { level: 3, valueStream: { companyId } },
    select: { name: true, valueStreamId: true, valueStream: { select: { name: true } } },
  });
  const links = await prisma.roleValueStream.findMany({
    where: { valueStream: { companyId } },
    select: { roleId: true, valueStreamId: true, subStream: true },
  });
  const subsByStream = new Map<string, string[]>();
  for (const l of links) {
    if (!subsByStream.has(l.valueStreamId)) subsByStream.set(l.valueStreamId, []);
    subsByStream.get(l.valueStreamId)!.push(l.subStream ?? '');
  }
  const l3Empty = l3s.filter((l3) => !(subsByStream.get(l3.valueStreamId) ?? []).some((s) => covers(s, l3.name)));

  // 3) Value-stream-participant roles with no RoleTask or no ChecklistItem.
  const partRoleIds = [...new Set(links.map((l) => l.roleId))];
  const roles = await prisma.role.findMany({
    where: { id: { in: partRoleIds } },
    select: { name: true, _count: { select: { roleTasks: true, checklistItems: true } } },
  });
  const roleEmpty = roles.filter((r) => r._count.roleTasks === 0 || r._count.checklistItems === 0);

  // Report.
  const line = (s: string) => console.log(s);
  line(`Completeness validation — company "${company.name}"`);
  line(`  Value streams : ${vs.length} total, ${vsEmpty.length} empty (no L3 children or no process steps)`);
  for (const v of vsEmpty) line(`     ✗ ${v.name}`);
  line(`  L3 sub-streams: ${l3s.length} total, ${l3Empty.length} with no role mapped`);
  for (const l of l3Empty) line(`     ✗ ${l.valueStream.name} › ${l.name}`);
  line(`  Participant roles: ${roles.length} total, ${roleEmpty.length} missing tasks and/or checklist`);
  for (const r of roleEmpty) line(`     ✗ ${r.name} (roleTasks=${r._count.roleTasks}, checklist=${r._count.checklistItems})`);

  const gaps = vsEmpty.length + l3Empty.length + roleEmpty.length;
  if (gaps === 0) { line('\n✓ DQ-01 satisfied — ZERO empty nodes.'); return; }
  line(`\n✗ DQ-01 FAILED — ${gaps} empty node(s). Run split-value-streams.ts / backfill-l3-roles.ts / apply-gap-fill.ts.`);
  process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
