// home-direct-to-division.ts — remove the "Direct to division" bucket by homing
// every role that sits directly on an L2 division (no L3 department) into the
// best-fit department under that same division. Updates Role.orgUnitId AND the
// role's primary RoleOrgAssignment so all org views regroup it. Idempotent:
// only touches roles currently homed at an L2 node.
//
// Run from backend/:  npx tsx scripts/home-direct-to-division.ts        (apply)
//                     npx tsx scripts/home-direct-to-division.ts --dry   (report)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

// role displayValue → target department displayValue (resolved within the role's
// own division). Best-fit by function; falls back to the division's "* Leadership"
// department when a role isn't listed here.
const ROLE_DEPT: Record<string, string> = {
  // Actuarial
  'Reinsurance Actuary': 'Capital & ALM',
  // Business Operations
  'Process Analyst': 'Operations Leadership',
  'WFM Analyst': 'Operations Leadership',
  // Cybersecurity & IAM
  'Access Administrator': 'Identity & Access',
  'IT Security Manager': 'Security Leadership',
  'Incident Response Lead': 'Cyber Operations',
  'Penetration Tester': 'Application Security',
  // Data & AI
  'Analytics Lead': 'Analytics Delivery',
  'BI Developer': 'Analytics Delivery',
  'Data Governance Lead': 'Data Governance',
  'Data Privacy Steward': 'Data Governance',
  'Data Product Owner': 'Data Leadership',
  'Data Quality Analyst': 'Data Governance',
  // Finance & Investments
  'AR Specialist': 'Financial Control',
  'Head of Capital Management': 'Planning & Capital',
  'Regulatory Reporting Manager': 'Statutory Reporting',
  'SOX Program Manager': 'Financial Control',
  'Tax Manager': 'Treasury & Tax',
  // Human Resources & Talent
  'Employee Relations Spec': 'Employee Relations',
  'HR Generalist': 'Business Partnership',
  'L&D Specialist': 'Learning & Change',
  // Legal & Corporate Governance
  'Employment Counsel': 'Commercial Legal',
  'IP Counsel': 'Commercial Legal',
  'Records Manager': 'Legal Operations',
  // Program Management Office
  'Resource Manager': 'Program Governance',
  // Reinsurance
  'Catastrophe & Exposure Manager': 'Reinsurance Placement',
  'Reinsurance Credit & Security Analyst': 'Operations',
  'Reinsurance Underwriter': 'Reinsurance Placement',
  'Treaty Analyst': 'Reinsurance Placement',
  // Risk, Compliance & Audit
  'Compliance Manager': 'Compliance',
  'Ethics Officer': 'Compliance',
  // Technology & Engineering
  'Disaster Recovery Engineer': 'Infrastructure & Data Platforms',
  'Integration Architect': 'Engineering Delivery',
  'Resilience Manager': 'Infrastructure & Data Platforms',
};

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('no company');
  const companyId = company.id;
  console.log(`\n=== home-direct-to-division ${DRY ? '(DRY RUN)' : '(APPLY)'} — ${company.name} ===`);

  // departments (L3) keyed by "<divisionId>::<deptName>".
  const depts = await prisma.orgUnit.findMany({
    where: { companyId, orgLevelType: { levelNumber: 3 } },
    select: { id: true, displayValue: true, parentId: true },
  });
  const deptByDivName = new Map<string, string>();
  for (const d of depts) if (d.parentId) deptByDivName.set(`${d.parentId}::${d.displayValue}`, d.id);

  // roles currently homed at an L2 division.
  const loose = await prisma.role.findMany({
    where: { companyId, orgUnit: { orgLevelType: { levelNumber: 2 } } },
    select: { id: true, displayValue: true, orgUnitId: true, orgUnit: { select: { displayValue: true } } },
  });

  let moved = 0; const unmapped: string[] = [];
  for (const r of loose) {
    const divId = r.orgUnitId!;
    const wantDept = ROLE_DEPT[r.displayValue];
    // fall back to the division's leadership department if the role isn't mapped.
    const leadership = depts.find((d) => d.parentId === divId && /leadership$/i.test(d.displayValue));
    const deptId = (wantDept && deptByDivName.get(`${divId}::${wantDept}`)) || leadership?.id;
    const deptName = depts.find((d) => d.id === deptId)?.displayValue;
    if (!deptId) { unmapped.push(`${r.displayValue} [${r.orgUnit?.displayValue}]`); continue; }
    console.log(`  ${r.displayValue}  [${r.orgUnit?.displayValue}] → ${deptName}`);
    moved++;
    if (!DRY) {
      await prisma.role.update({ where: { id: r.id }, data: { orgUnitId: deptId } });
      // move the primary org assignment off the division onto the department.
      await prisma.roleOrgAssignment.deleteMany({ where: { roleId: r.id, orgUnitId: divId } });
      await prisma.roleOrgAssignment.upsert({
        where: { roleId_orgUnitId: { roleId: r.id, orgUnitId: deptId } },
        update: { isPrimary: true },
        create: { roleId: r.id, orgUnitId: deptId, isPrimary: true },
      });
    }
  }

  console.log(`\n--- ${moved} roles homed into departments${unmapped.length ? `; ${unmapped.length} unmapped` : ''} ---`);
  if (unmapped.length) console.log(unmapped.join('\n'));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
