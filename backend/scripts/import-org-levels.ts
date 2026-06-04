// import-org-levels.ts — populate the SEPARATE OrgLevel tree from the org spine.
//   L0 Company → L1 Domain (Division.higherCategory) → L2 Division
//   → L3 Department → L4 Role
// Connections are all from the existing org FKs (outside any workbook). Idempotent.
//   npm run import:org -w cascade-backend
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  await prisma.orgLevel.deleteMany({ where: { companyId } });

  const mk = (d: { levelNumber: number; name: string; parentId: string | null; sortOrder?: number; sourceType: string; sourceRefId?: string | null }) =>
    prisma.orgLevel.create({ data: { tenantId, companyId, sortOrder: 0, ...d }, select: { id: true } });

  // L0
  const l0 = await mk({ levelNumber: 0, name: company.name, parentId: null, sourceType: 'company', sourceRefId: companyId });

  // L1 Domains
  const divisions = await prisma.division.findMany({ where: { companyId }, select: { id: true, name: true, higherCategory: true } });
  const domainNames = [...new Set(divisions.map((d) => d.higherCategory).filter((x): x is string => !!x))].sort();
  const domainLevel = new Map<string, string>();
  let i = 0;
  for (const name of domainNames) domainLevel.set(name, (await mk({ levelNumber: 1, name, parentId: l0.id, sortOrder: i++, sourceType: 'domain' })).id);

  // L2 Divisions
  const divLevel = new Map<string, string>();
  i = 0;
  for (const d of divisions.sort((a, b) => a.name.localeCompare(b.name))) {
    const parentId = (d.higherCategory && domainLevel.get(d.higherCategory)) || l0.id;
    divLevel.set(d.id, (await mk({ levelNumber: 2, name: d.name, parentId, sortOrder: i++, sourceType: 'division', sourceRefId: d.id })).id);
  }

  // L3 Departments
  const departments = await prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true } });
  const deptLevel = new Map<string, string>();
  i = 0;
  for (const d of departments) {
    const parentId = divLevel.get(d.divisionId) ?? l0.id;
    deptLevel.set(d.id, (await mk({ levelNumber: 3, name: d.name, parentId, sortOrder: i++, sourceType: 'department', sourceRefId: d.id })).id);
  }

  // L4 Roles (under department if set, else division)
  const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, departmentId: true, divisionId: true } });
  let roleCount = 0;
  i = 0;
  for (const r of roles) {
    const parentId = (r.departmentId && deptLevel.get(r.departmentId)) || (r.divisionId && divLevel.get(r.divisionId)) || l0.id;
    await mk({ levelNumber: 4, name: r.name, parentId, sortOrder: i++, sourceType: 'role', sourceRefId: r.id });
    roleCount++;
  }

  const counts = await prisma.orgLevel.groupBy({ by: ['levelNumber'], where: { companyId }, _count: true });
  console.log('Imported org levels into', company.name);
  console.table(counts.map((c) => ({ level: c.levelNumber, count: c._count })));
  console.log(`Roles: ${roleCount}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
