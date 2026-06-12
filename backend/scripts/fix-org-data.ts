// Gap backlog O1 + X1/X2 (2026-06-10): fix the legacy org tables so the node
// backfill derives a credible org.
//  A) The 9 division-less roles (the Data Admin "Unassigned" bucket — the exact
//     source of the Home 249/743 vs Organization 240/717 count gaps) are homed
//     into their natural division + department.
// Idempotent. Re-run backfill-nodes.ts + backfill-node-links.ts afterwards.
import { prisma } from '../src/db/prisma.js';

const ROLE_HOME: Record<string, { division: string; department: string }> = {
  'Appointed Actuary': { division: 'Actuarial', department: 'Actuarial Leadership' },
  'Cloud Architect': { division: 'Technology & Engineering', department: 'Cloud & Platform' },
  'Enterprise Architect': { division: 'Technology & Engineering', department: 'Executive Leadership' },
  'Solution Architect': { division: 'Technology & Engineering', department: 'Engineering Delivery' },
  'FinOps Lead': { division: 'Technology & Engineering', department: 'Cloud & Platform' },
  'SRE': { division: 'Technology & Engineering', department: 'Platform Engineering' },
  'Sustainability stakeholder': { division: 'Risk, Compliance & Audit', department: 'Enterprise Risk' },
  'AIOps Engineer': { division: 'Technology & Engineering', department: 'Operations' },
  'Capacity stakeholder': { division: 'Technology & Engineering', department: 'Infrastructure & Networks' },
};

async function main() {
  for (const company of await prisma.company.findMany({ select: { id: true, name: true } })) {
    const companyId = company.id;
    console.log(`\n=== ${company.name} ===`);

    // ── A) home the orphan roles ──
    const divisions = await prisma.division.findMany({ where: { companyId }, select: { id: true, name: true } });
    const divByName = new Map(divisions.map((d) => [d.name, d.id]));
    const departments = await prisma.department.findMany({ where: { divisionId: { in: divisions.map((d) => d.id) } }, select: { id: true, name: true, divisionId: true } });
    const deptByKey = new Map(departments.map((d) => [`${d.divisionId}|${d.name}`, d.id]));

    const orphans = await prisma.role.findMany({ where: { companyId, divisionId: null }, select: { id: true, name: true } });
    for (const r of orphans) {
      const home = ROLE_HOME[r.name];
      if (!home) { console.log(`  ⚠ orphan role with no mapping: ${r.name}`); continue; }
      const divisionId = divByName.get(home.division);
      const departmentId = divisionId ? deptByKey.get(`${divisionId}|${home.department}`) : undefined;
      if (!divisionId || !departmentId) { console.log(`  ⚠ home not found for ${r.name}: ${home.division} / ${home.department}`); continue; }
      await prisma.role.update({ where: { id: r.id }, data: { divisionId, departmentId } });
      console.log(`  homed: ${r.name} → ${home.division} / ${home.department}`);
    }

    // ── reconcile ──
    const orphanLeft = await prisma.role.count({ where: { companyId, divisionId: null } });
    console.log(`  orphan roles left ${orphanLeft}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
