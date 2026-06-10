// Gap backlog O1 + X1/X2 (2026-06-10): fix the legacy org tables so the node
// backfill derives a credible org.
//  A) The 9 division-less roles (the Data Admin "Unassigned" bucket — the exact
//     source of the Home 249/743 vs Organization 240/717 count gaps) are homed
//     into their natural division + department.
//  B) Singleton executive roles (Chief *, Head of *, General Counsel) keep ONE
//     incumbent; surplus people are reassigned to the least-populated
//     non-singleton role in the same division (their title follows).
// Headcount is conserved: people are moved, never deleted. Idempotent.
// Re-run backfill-nodes.ts + backfill-node-links.ts afterwards.
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

const SINGLETON = /^(chief |head of |general counsel$|ceo$)/i;

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

    // ── B) one incumbent per singleton executive role ──
    const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true } });
    const assignments = await prisma.assignment.findMany({
      where: { role: { companyId } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, roleId: true, personId: true },
    });
    const byRole = new Map<string, typeof assignments>();
    for (const a of assignments) { const arr = byRole.get(a.roleId) ?? []; arr.push(a); byRole.set(a.roleId, arr); }
    const headcount = new Map<string, number>();
    for (const r of roles) headcount.set(r.id, byRole.get(r.id)?.length ?? 0);

    let moved = 0;
    for (const r of roles.filter((x) => SINGLETON.test(x.name))) {
      const incumbents = byRole.get(r.id) ?? [];
      if (incumbents.length <= 1) continue;
      // candidate targets: non-singleton roles in the same division
      const targets = roles.filter((t) => t.divisionId === r.divisionId && t.id !== r.id && !SINGLETON.test(t.name));
      if (!targets.length) { console.log(`  ⚠ no reassignment target in division for ${r.name}`); continue; }
      for (const surplus of incumbents.slice(1)) {
        targets.sort((a, b) => (headcount.get(a.id) ?? 0) - (headcount.get(b.id) ?? 0));
        const target = targets[0];
        await prisma.assignment.update({ where: { id: surplus.id }, data: { roleId: target.id } });
        const person = await prisma.person.findUnique({ where: { id: surplus.personId }, select: { id: true, title: true } });
        if (person && person.title === r.name) await prisma.person.update({ where: { id: person.id }, data: { title: target.name } });
        headcount.set(target.id, (headcount.get(target.id) ?? 0) + 1);
        moved++;
        console.log(`  ${r.name}: surplus incumbent → ${target.name}`);
      }
      headcount.set(r.id, 1);
    }

    // ── reconcile ──
    const people = await prisma.person.count({ where: { companyId } });
    const assigned = await prisma.assignment.count({ where: { role: { companyId } } });
    const orphanLeft = await prisma.role.count({ where: { companyId, divisionId: null } });
    const multi = await prisma.$queryRaw<{ name: string; c: bigint }[]>`
      SELECT r.name, count(a.id) AS c FROM "Role" r JOIN "Assignment" a ON a."roleId"=r.id
      WHERE r."companyId"=${companyId} AND (r.name ~* '^(chief |head of )' OR r.name ~* '^general counsel$')
      GROUP BY r.name HAVING count(a.id) > 1`;
    console.log(`  moved ${moved} surplus exec incumbents · people ${people} · assignments ${assigned} · orphan roles left ${orphanLeft} · singletons still >1: ${multi.length}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
