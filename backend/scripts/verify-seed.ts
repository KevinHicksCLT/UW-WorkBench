// verify-seed.ts — asserts seeded DB counts match the normalized spine.json.
// Run from repo root: npx tsx backend/scripts/verify-seed.ts
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SPINE = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/spine.json');

async function main() {
  const spine = JSON.parse(readFileSync(SPINE, 'utf8'));
  const company = await prisma.company.findFirst({ where: { slug: spine.company.slug } });
  if (!company) throw new Error('No seeded company found — run the seed first.');
  const c = company.id;

  // Expected counts for the two deduped tables (mirror the seed's dedup).
  const uniq = (arr: string[]) => new Set(arr).size;
  const expectedSub =
    uniq(spine.subValueStreams.filter((s: any) => s.l3).map((s: any) => `${s.valueStreamName}␟${s.l3}`)) +
    uniq(spine.subValueStreams.filter((s: any) => s.l4).map((s: any) => `${s.valueStreamName}␟${s.l3}␟${s.l4}`));
  const expectedRVS = uniq(
    spine.roleValueStreams.map((l: any) => `${l.roleName}␟${l.valueStreamName}␟${l.subStream}`)
  );

  const checks: { name: string; expected: number; actual: number }[] = [
    { name: 'divisions', expected: spine.divisions.length, actual: await prisma.division.count({ where: { companyId: c } }) },
    { name: 'departments', expected: spine.departments.length, actual: await prisma.department.count({ where: { companyId: c } }) },
    { name: 'roles', expected: spine.roles.length, actual: await prisma.role.count({ where: { companyId: c } }) },
    { name: 'categories', expected: spine.categories.length, actual: await prisma.category.count({ where: { companyId: c } }) },
    { name: 'valueStreams', expected: spine.valueStreams.length, actual: await prisma.valueStream.count({ where: { companyId: c } }) },
    { name: 'subValueStreams', expected: expectedSub, actual: await prisma.subValueStream.count({ where: { valueStream: { companyId: c } } }) },
    { name: 'checklistItems', expected: spine.checklistItems.length, actual: await prisma.checklistItem.count({ where: { role: { companyId: c } } }) },
    { name: 'roleTasks', expected: spine.roleTasks.length, actual: await prisma.roleTask.count({ where: { role: { companyId: c } } }) },
    { name: 'roleValueStreams', expected: expectedRVS, actual: await prisma.roleValueStream.count({ where: { valueStream: { companyId: c } } }) },
    { name: 'externalInteractions', expected: spine.externalInteractions.length, actual: await prisma.externalInteraction.count({ where: { companyId: c } }) },
  ];

  let ok = true;
  console.log(`Verifying seed for "${company.name}":\n`);
  for (const ch of checks) {
    const pass = ch.expected === ch.actual;
    ok &&= pass;
    console.log(`  ${pass ? '✓' : '✗'} ${ch.name.padEnd(20)} expected ${ch.expected}  actual ${ch.actual}`);
  }

  // Provenance spot-check (exit criterion: every record traces to the workbook).
  const noProvenance = await prisma.role.count({ where: { companyId: c, sourceSheet: null } });
  console.log(`\n  ${noProvenance === 0 ? '✓' : '✗'} all roles carry sourceSheet provenance (${noProvenance} missing)`);

  if (!ok || noProvenance !== 0) {
    console.error('\n✗ Verification FAILED');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('\n✓ Verification passed — counts match the workbook.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
