import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02 final pass — 7 value_stream nodes (the Life / Annuity /
// Retirement business line) have no division parent, so the VS list shows 29
// streams while the Home tile counts 36. Recover the right parent from the
// legacy ValueStream table (division / leadDivision provenance) or the
// strongest role-participation division; --fix applies.

const APPLY = process.argv.includes('--fix');

async function main() {
  const orphans = await prisma.node.findMany({
    where: { typeKey: 'value_stream', parentId: null },
    select: { id: true, name: true, companyId: true },
  });
  console.log(`Orphan value_stream nodes: ${orphans.length}`);
  if (!orphans.length) { await prisma.$disconnect(); return; }

  // The 7 Life & Retirement streams have NO role participation and the org has
  // no Life division — explicit functional placement (closest operating
  // division; adjustable later via the builder's parent dropdown):
  const FALLBACK: Record<string, string> = {
    'Annuity New Business & Servicing': 'Operations & Customer Service',
    'Disability & Absence Management': 'Claims',
    'Life & Annuity Claims': 'Claims',
    'Life New Business & Underwriting': 'Underwriting',
    'Life Policy Administration & Inforce Servicing': 'Operations & Customer Service',
    'Life, Annuity & Retirement Billing': 'Operations & Customer Service',
    'Retirement Plan Administration': 'Operations & Customer Service',
  };

  // Provenance: strongest role participation (RoleValueStream → role → division).
  const divNodes = await prisma.node.findMany({
    where: { typeKey: 'division' },
    select: { id: true, name: true },
  });
  const divByName = new Map(divNodes.map((d) => [d.name.toLowerCase(), d]));

  for (const o of orphans) {
    const links = await prisma.roleValueStream.findMany({
      where: { valueStream: { name: o.name } },
      select: { role: { select: { division: { select: { name: true } } } } },
    });
    const tally = new Map<string, number>();
    for (const l of links) {
      const d = l.role?.division?.name;
      if (d) tally.set(d, (tally.get(d) ?? 0) + 1);
    }
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const targetName = ranked[0]?.[0] ?? FALLBACK[o.name] ?? null;
    const target = targetName ? divByName.get(targetName.toLowerCase()) : undefined;
    if (ranked.length) console.log(`    participation: ${ranked.slice(0, 3).map(([d, n]) => `${d}×${n}`).join(', ')}`);
    console.log(`  ${o.name}  →  ${target ? target.name : `(unresolved${targetName ? `: legacy says "${targetName}" but no division node` : ''})`}`);
    if (APPLY && target) {
      await prisma.node.update({ where: { id: o.id }, data: { parentId: target.id } });
    }
  }
  console.log(APPLY ? 'APPLIED' : 'DRY RUN (--fix to apply)');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
