/**
 * One-off: normalize specific-step (custom-row) procedure values into the
 * structured-cells format — per line: trim and strip leading "1)" / "2."
 * numbering, drop empty lines, rejoin with \n. The Work Library ProcedureCells
 * editor and every ProcedureValue renderer expect clean unnumbered lines
 * (role byline first, atomic steps, "Done when …" last).
 *
 * Dry-run by default; pass --apply to write. Idempotent. Run from backend/:
 *   npx tsx --env-file=.env scripts/normalize-specific-step-values.ts [--apply]
 */
import { prisma } from '../src/db/prisma.js';

const apply = process.argv.includes('--apply');

function normalize(value: string): string {
  return value
    .split('\n')
    .map((l) => l.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean)
    .join('\n');
}

type Row = { id: string; value: string | null };
type Table = {
  name: string;
  find: () => Promise<Row[]>;
  update: (id: string, value: string) => Promise<unknown>;
};

const where = { customKey: { not: null }, value: { not: null } };
const select = { id: true, value: true };

const tables: Table[] = [
  {
    name: 'NodeTemplateAnswer',
    find: () => prisma.nodeTemplateAnswer.findMany({ where, select }),
    update: (id, value) => prisma.nodeTemplateAnswer.update({ where: { id }, data: { value } }),
  },
  {
    name: 'StandardTemplateAnswer',
    find: () => prisma.standardTemplateAnswer.findMany({ where, select }),
    update: (id, value) => prisma.standardTemplateAnswer.update({ where: { id }, data: { value } }),
  },
  {
    name: 'RegulationTemplateAnswer',
    find: () => prisma.regulationTemplateAnswer.findMany({ where, select }),
    update: (id, value) =>
      prisma.regulationTemplateAnswer.update({ where: { id }, data: { value } }),
  },
];

for (const t of tables) {
  const rows = await t.find();
  const changed = rows
    .filter((r): r is { id: string; value: string } => r.value != null)
    .map((r) => ({ id: r.id, before: r.value, after: normalize(r.value) }))
    .filter((r) => r.after !== r.before);
  console.log(`${t.name}: ${rows.length} custom rows, ${changed.length} need normalizing`);
  for (const c of changed.slice(0, 3))
    console.log(`  sample ${c.id}: ${JSON.stringify(c.before).slice(0, 120)}`);
  if (apply) {
    for (const c of changed) await t.update(c.id, c.after);
    if (changed.length) console.log(`  applied ${changed.length} updates`);
  }
}
if (!apply) console.log('\nDry-run only — pass --apply to write.');
await prisma.$disconnect();
