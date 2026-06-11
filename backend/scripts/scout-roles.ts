// One-off scout: dump the org → role inventory + per-role content coverage so
// external research can be grounded in what's actually in the DB.
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const c = companies[0];
  console.log(`company: ${c.name}`);

  const divisions = await prisma.division.findMany({
    where: { companyId: c.id },
    orderBy: { name: 'asc' },
    include: {
      departments: {
        orderBy: { name: 'asc' },
        include: { roles: { orderBy: { name: 'asc' }, select: { id: true, name: true, roleLevel: true, roleFamily: true } } },
      },
    },
  });
  // Roles directly on a division (no department) or orphaned
  const allRoles = await prisma.role.findMany({
    where: { companyId: c.id },
    select: { id: true, name: true, departmentId: true, divisionId: true, roleLevel: true },
  });
  const deptRoleIds = new Set(divisions.flatMap((d) => d.departments.flatMap((x) => x.roles.map((r) => r.id))));
  const orphans = allRoles.filter((r) => !deptRoleIds.has(r.id));

  const [checklists, roleTasks, rvs, assignments] = await Promise.all([
    prisma.checklistItem.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.roleTask.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.roleValueStream.groupBy({ by: ['roleId'], _count: { _all: true } }),
    prisma.assignment.groupBy({ by: ['roleId'], _count: { _all: true } }),
  ]);
  const cnt = (g: { roleId: string; _count: { _all: number } }[]) => new Map(g.map((x) => [x.roleId, x._count._all]));
  const cl = cnt(checklists), rt = cnt(roleTasks), vs = cnt(rvs), asg = cnt(assignments);

  // Free-text role references in IoItem.keyRoles and ProcessStep.leads/supporting
  const io = await prisma.ioItem.findMany({ select: { keyRoles: true } });
  const steps = await prisma.processStep.findMany({ select: { leads: true, supporting: true } });
  const refNames = new Set<string>();
  const collect = (s: string | null) => s?.split(/[,;\/]| and /i).map((x) => x.trim()).filter(Boolean).forEach((x) => refNames.add(x.toLowerCase()));
  io.forEach((x) => collect(x.keyRoles));
  steps.forEach((x) => { collect(x.leads); collect(x.supporting); });
  const roleNamesLower = new Set(allRoles.map((r) => r.name.toLowerCase()));
  const roleAliases = await prisma.role.findMany({ where: { companyId: c.id, itemRole: { not: null } }, select: { itemRole: true } });
  roleAliases.forEach((r) => r.itemRole && roleNamesLower.add(r.itemRole.toLowerCase()));
  const unresolvedRefs = [...refNames].filter((n) => !roleNamesLower.has(n));

  console.log(`\ntotals: ${allRoles.length} roles, ${orphans.length} not under any department`);
  for (const d of divisions) {
    console.log(`\n## ${d.name} (${d.higherCategory ?? '?'})`);
    for (const dep of d.departments) {
      const names = dep.roles.map((r) => {
        const flags = [
          (cl.get(r.id) ?? 0) === 0 ? 'no-checklist' : '',
          (rt.get(r.id) ?? 0) === 0 ? 'no-tasks' : '',
          (vs.get(r.id) ?? 0) === 0 ? 'no-VS' : '',
          (asg.get(r.id) ?? 0) === 0 ? 'no-people' : '',
        ].filter(Boolean);
        return `${r.name}${flags.length ? ` [${flags.join(',')}]` : ''}`;
      });
      console.log(`  - ${dep.name}: ${names.join(' | ') || '(no roles)'}`);
    }
  }
  if (orphans.length) console.log(`\norphan roles: ${orphans.map((r) => r.name).join(' | ')}`);
  console.log(`\nunresolved free-text role refs (in IO keyRoles / step leads-supporting, not matching any role or alias): ${unresolvedRefs.length}`);
  console.log(unresolvedRefs.slice(0, 60).join(' | '));

  await prisma.$disconnect();
}
main();
