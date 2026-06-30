// E-03 — give every third-party (ExternalInteraction) an internal owner.
// Reviewer flagged that the E-01 application-vendor rows had no internal owner.
// Each external party is owned internally by the lead role of the value stream
// it serves (the stream that consumes the vendor/app). We resolve the lead role
// per value stream from RoleValueStream (participationType 'Lead', else the
// strongest available link) and set ExternalInteraction.internalRoleId.
//
// Only fills rows that currently have NO owner (internalRoleId AND
// internalRoleOwner both null) — existing owners are left intact. Idempotent.
//   npx tsx scripts/assign-external-owners.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// participationType → priority (lower = stronger ownership claim)
const PRIORITY: Record<string, number> = { Lead: 0, Core: 1, Control: 2, Oversight: 3, Support: 4 };

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;
  console.log(`Company: ${company.name}`);

  // Lead role per value stream (by name).
  const links = await prisma.roleValueStream.findMany({
    where: { role: { companyId } },
    select: { participationType: true, role: { select: { id: true, name: true } }, valueStream: { select: { name: true } } },
  });
  const lead = new Map<string, { roleId: string; roleName: string; p: number }>();
  for (const l of links) {
    const vs = l.valueStream?.name;
    if (!vs) continue;
    const p = PRIORITY[l.participationType ?? ''] ?? 5;
    const cur = lead.get(vs);
    if (!cur || p < cur.p) lead.set(vs, { roleId: l.role.id, roleName: l.role.name, p });
  }
  console.log(`Resolved lead role for ${lead.size} value streams.`);

  const owners = await prisma.externalInteraction.findMany({
    where: { companyId, internalRoleId: null, internalRoleOwner: null },
    select: { id: true, relatedValueStream: true },
  });

  let set = 0;
  const noLead = new Set<string>();
  const noStream: string[] = [];
  for (const e of owners) {
    const vs = e.relatedValueStream;
    if (!vs) { noStream.push(e.id); continue; }
    const owner = lead.get(vs);
    if (!owner) { noLead.add(vs); continue; }
    await prisma.externalInteraction.update({
      where: { id: e.id },
      data: { internalRoleId: owner.roleId, internalRoleOwner: owner.roleName },
    });
    set++;
  }
  console.log(`E-03: assigned internal owner on ${set} third-parties (of ${owners.length} owner-less).`);
  if (noLead.size) console.log('  streams with no lead role (skipped):', [...noLead].join(', '));
  if (noStream.length) console.log(`  ${noStream.length} rows had no related value stream (skipped).`);

  const stillNull = await prisma.externalInteraction.count({ where: { companyId, internalRoleId: null, internalRoleOwner: null } });
  console.log(`  remaining owner-less rows: ${stillNull}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
