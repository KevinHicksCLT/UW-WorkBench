// DQ-01 — completeness invariant: no empty L3 sub-value streams.
// Some L3s (chiefly the later-added Life/Disability/Retirement L3s) have no role
// mapped to them, so they surface no roles/tasks/checklist. This spreads each
// affected stream's existing participant roles onto its empty L3s (subStream =
// the exact L3 name), so every L3 inherits roles — and, because those roles
// already carry tasks + checklist, tasks/checklist too.
//
// Roles are linked by participation strength (Lead > Core > Support > Oversight >
// Control), up to CAP per L3. Idempotent: the (roleId, valueStreamId, subStream)
// unique key means re-runs only fill what's still missing. Run from backend/:
//   npx tsx scripts/backfill-l3-roles.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CAP = 5; // max roles to attach per empty L3
const RANK: Record<string, number> = { Lead: 0, Core: 1, Support: 2, Oversight: 3, Control: 4 };

// Matches the live audit: an L3 is "covered" when a RoleValueStream.subStream
// equals the L3 name or begins with "<L3 name> " / "<L3 name>—".
function covers(subStream: string | null, l3: string): boolean {
  if (!subStream) return false;
  return subStream === l3 || subStream.startsWith(l3 + ' ') || subStream.startsWith(l3 + '—');
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  const l3s = await prisma.subValueStream.findMany({
    where: { level: 3, valueStream: { companyId } },
    select: { name: true, valueStreamId: true },
  });
  const links = await prisma.roleValueStream.findMany({
    where: { valueStream: { companyId } },
    select: { roleId: true, valueStreamId: true, subStream: true, participationType: true },
  });

  // Per stream: existing subStream texts + candidate roles (best participation).
  const byStream = new Map<string, { subs: string[]; roles: Map<string, string> }>();
  for (const l of links) {
    let e = byStream.get(l.valueStreamId);
    if (!e) { e = { subs: [], roles: new Map() }; byStream.set(l.valueStreamId, e); }
    if (l.subStream) e.subs.push(l.subStream);
    const cur = e.roles.get(l.roleId);
    const pt = l.participationType ?? 'Core';
    if (cur == null || (RANK[pt] ?? 9) < (RANK[cur] ?? 9)) e.roles.set(l.roleId, pt);
  }

  let created = 0, filledL3 = 0, skipped = 0;
  for (const l3 of l3s) {
    const e = byStream.get(l3.valueStreamId);
    if (!e) { skipped++; continue; } // stream with no participants at all (none in practice)
    if (e.subs.some((s) => covers(s, l3.name))) continue; // already covered

    const candidates = [...e.roles.entries()]
      .sort((a, b) => (RANK[a[1]] ?? 9) - (RANK[b[1]] ?? 9))
      .slice(0, CAP);
    if (candidates.length === 0) { skipped++; continue; }
    filledL3++;
    for (const [roleId, pt] of candidates) {
      try {
        await prisma.roleValueStream.create({
          data: {
            tenantId, roleId, valueStreamId: l3.valueStreamId, subStream: l3.name,
            participationType: pt, notes: 'DQ-01 backfill — L3 completeness', sourceSheet: 'backfill-06',
          },
        });
        created++;
      } catch (err: unknown) {
        // unique (roleId,valueStreamId,subStream) — already present, ignore.
        if (!(err as { code?: string }).code || (err as { code?: string }).code !== 'P2002') throw err;
      }
    }
  }
  console.log(`DQ-01: filled ${filledL3} empty L3s with ${created} role links (cap ${CAP}); ${skipped} skipped (no candidate roles).`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
