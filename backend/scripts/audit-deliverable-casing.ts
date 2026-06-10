import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D8.5 — audit Deliverable titles for letter-case
// inconsistencies and case-only duplicates. Read-only report; the fix script
// is fix-deliverable-casing.ts.

async function main() {
  const rows = await prisma.deliverable.findMany({
    select: { id: true, title: true, companyId: true, _count: { select: { tasks: true } } },
    orderBy: { title: 'asc' },
  });
  console.log(`Deliverables: ${rows.length}`);

  // 1. Case/whitespace-insensitive duplicate groups within a company.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.companyId}::${r.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`\nCase/whitespace-insensitive duplicate groups: ${dupGroups.length}`);
  for (const g of dupGroups) {
    console.log('  ' + g.map((r) => `"${r.title}" (${r._count.tasks} tasks)`).join('  |  '));
  }

  // 2. Casing styles.
  const style = (t: string) =>
    t === t.toUpperCase() && /[A-Z]/.test(t) ? 'ALLCAPS'
    : t === t.toLowerCase() && /[a-z]/.test(t) ? 'alllower'
    : /^[a-z]/.test(t) ? 'startsLower'
    : 'Mixed/Title';
  const byStyle = new Map<string, string[]>();
  for (const r of rows) {
    const s = style(r.title);
    const arr = byStyle.get(s) ?? [];
    arr.push(r.title);
    byStyle.set(s, arr);
  }
  console.log('\nCasing styles:');
  for (const [s, titles] of byStyle) {
    console.log(`  ${s}: ${titles.length}`);
    for (const t of titles.slice(0, 8)) console.log(`     e.g. "${t}"`);
  }

  // 3. Leading/trailing whitespace or double spaces.
  const ws = rows.filter((r) => r.title !== r.title.trim() || /\s{2,}/.test(r.title));
  console.log(`\nWhitespace problems: ${ws.length}`);
  for (const r of ws.slice(0, 10)) console.log(`  "${r.title}"`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
