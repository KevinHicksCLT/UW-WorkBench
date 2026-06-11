import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Why does the org map show an "Unassigned" segment? Find org nodes without a
// proper parent and compare the node graph against the legacy org tables.

async function main() {
  // 1. Division nodes without a segment parent.
  const divNodes = await prisma.node.findMany({
    where: { typeKey: 'division' },
    select: { id: true, name: true, provenance: true, createdAt: true, parent: { select: { name: true, typeKey: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(`division nodes: ${divNodes.length}`);
  for (const d of divNodes.filter((x) => !x.parent || x.parent.typeKey !== 'segment')) {
    console.log(`  UNPARENTED: "${d.name}"  parent=${d.parent ? d.parent.name + ' [' + d.parent.typeKey + ']' : 'none'}  provenance=${d.provenance}  created=${d.createdAt.toISOString()}`);
  }

  // 2. Legacy Division table vs nodes.
  const legacyDivs = await prisma.division.findMany({ select: { name: true, higherCategory: true } });
  console.log(`\nlegacy Division rows: ${legacyDivs.length}`);
  const nodeNames = new Set(divNodes.map((d) => d.name.toLowerCase()));
  for (const l of legacyDivs.filter((x) => !nodeNames.has(x.name.toLowerCase()))) {
    console.log(`  legacy-only: "${l.name}"  higherCategory=${l.higherCategory ?? 'NULL'}`);
  }
  for (const l of legacyDivs.filter((x) => !x.higherCategory)) {
    console.log(`  legacy NULL higherCategory: "${l.name}"`);
  }

  // 3. Role nodes without a department/division parent + roles in "Direct to division".
  const roleNodes = await prisma.node.findMany({
    where: { typeKey: 'role' },
    select: { id: true, name: true, parent: { select: { name: true, typeKey: true } } },
  });
  const orphanRoles = roleNodes.filter((r) => !r.parent);
  console.log(`\nrole nodes: ${roleNodes.length}; without parent: ${orphanRoles.length}`);
  for (const r of orphanRoles.slice(0, 10)) console.log(`  orphan role: "${r.name}"`);
  const direct = roleNodes.filter((r) => r.parent?.typeKey === 'division');
  console.log(`roles parented directly to a division (no department): ${direct.length}`);
  for (const r of direct.slice(0, 10)) console.log(`  direct-to-division: "${r.name}" under ${r.parent!.name}`);

  // 4. Legacy roles without department/division.
  const legacyRoles = await prisma.role.findMany({ select: { name: true, divisionId: true, departmentId: true } });
  const noHome = legacyRoles.filter((r) => !r.divisionId && !r.departmentId);
  console.log(`\nlegacy Role rows: ${legacyRoles.length}; with neither division nor department: ${noHome.length}`);
  for (const r of noHome.slice(0, 10)) console.log(`  legacy homeless role: "${r.name}"`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
