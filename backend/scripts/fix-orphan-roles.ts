import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// The 12 Life & Retirement roles (imported 2026-06-10, after the production
// fork — production has none of them) arrived with no division/department, so
// the org map showed an "Unassigned" segment. Assign each to the existing
// department that owns that function, in BOTH models the app reads:
//   • legacy Role.divisionId/departmentId (role detail, assignments)
//   • the unified Node graph (org map/list/table — role node → department node)
// Companion to fix-vs-orphans.ts, which placed this business line's 7 value
// streams the same way. Dry-run by default; --fix applies. Idempotent.

const APPLY = process.argv.includes('--fix');

// role name → [division, department] (existing rows only — never creates)
const PLACEMENT: Record<string, [string, string]> = {
  'New Business Case Manager': ['Underwriting', 'Operations & Governance'],
  'Life Underwriter': ['Underwriting', 'Field Underwriting'],
  'Annuity Suitability Analyst': ['Underwriting', 'Underwriting Analysis'],
  'Policy Issue Specialist': ['Operations & Customer Service', 'Policy Issuance & Fulfillment'],
  'Life Policy Service Representative': ['Operations & Customer Service', 'Policy Operations'],
  'Billing Operations Manager': ['Operations & Customer Service', 'Billing Operations'],
  'Retirement Operations Administrator': ['Operations & Customer Service', 'Policy Operations'],
  'Retirement Recordkeeping Specialist': ['Operations & Customer Service', 'Policy Operations'],
  'Annuity Service Specialist': ['Operations & Customer Service', 'Customer Service'],
  'Life Claims Examiner': ['Claims', 'Claims Handling'],
  'Disability Claims Intake Specialist': ['Claims', 'First Notice of Loss'],
  'Disability Case Manager': ['Claims', 'Medical Claims Management'],
};

async function main() {
  const orphans = await prisma.role.findMany({
    where: { divisionId: null, departmentId: null },
    select: { id: true, name: true },
  });
  console.log(`Homeless roles: ${orphans.length}`);

  const departments = await prisma.department.findMany({
    select: { id: true, name: true, divisionId: true, division: { select: { name: true } } },
  });
  const deptNodes = await prisma.node.findMany({
    where: { typeKey: 'department' },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });

  let fixed = 0;
  for (const r of orphans) {
    const place = PLACEMENT[r.name];
    if (!place) { console.log(`  SKIP (no placement): ${r.name}`); continue; }
    const [divName, deptName] = place;
    const dept = departments.find((d) => d.name === deptName && d.division?.name === divName);
    const deptNode = deptNodes.find((d) => d.name === deptName && d.parent?.name === divName);
    if (!dept || !deptNode) { console.log(`  SKIP (target missing): ${r.name} → ${divName} › ${deptName} (table=${!!dept}, node=${!!deptNode})`); continue; }
    console.log(`  ${r.name}  →  ${divName} › ${deptName}`);
    if (!APPLY) continue;
    await prisma.role.update({ where: { id: r.id }, data: { divisionId: dept.divisionId, departmentId: dept.id } });
    // The role's node carries the legacy Role.id in `code` (org-table contract).
    const updated = await prisma.node.updateMany({
      where: { typeKey: 'role', code: r.id, parentId: null },
      data: { parentId: deptNode.id },
    });
    if (updated.count === 0) {
      // Fallback: match the node by name when no code link exists.
      await prisma.node.updateMany({ where: { typeKey: 'role', name: r.name, parentId: null }, data: { parentId: deptNode.id } });
    }
    fixed++;
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN (--fix to apply)'}: ${fixed} roles placed.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
