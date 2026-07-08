// Apply generated role descriptions from scripts/output/role-desc-batch-*.json
// onto Role.description. Idempotent; refuses descriptions for unknown ids and
// reports every skip. Run:
//   npx tsx --env-file=.env scripts/apply-role-descriptions.ts [--dry-run]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

type Row = { id: string; name: string; description: string };

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dir = 'scripts/output';
  const files = readdirSync(dir)
    .filter((f) => /^role-desc-batch-\d+\.json$/.test(f))
    .sort();
  if (!files.length) throw new Error('no role-desc-batch-*.json files found');

  const rows = new Map<string, Row>();
  const dupes: string[] = [];
  for (const f of files) {
    const batch = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Row[];
    for (const r of batch) {
      if (rows.has(r.id)) dupes.push(`${r.id} (${r.name}) in ${f}`);
      rows.set(r.id, r);
    }
  }
  console.log(`${files.length} files, ${rows.size} unique descriptions, ${dupes.length} dupes`);
  for (const d of dupes) console.log('  dupe:', d);

  const roles = await prisma.role.findMany({ select: { id: true, displayValue: true } });
  const known = new Map(roles.map((r) => [r.id, r.displayValue]));

  let applied = 0;
  const skipped: string[] = [];
  for (const r of rows.values()) {
    if (!known.has(r.id)) {
      skipped.push(`unknown id ${r.id} (${r.name})`);
      continue;
    }
    const text = r.description?.trim();
    if (!text || text.split(/\s+/).length < 15) {
      skipped.push(`too short for ${known.get(r.id)}: "${text?.slice(0, 60)}"`);
      continue;
    }
    if (!dryRun) {
      await prisma.role.update({ where: { id: r.id }, data: { description: text } });
    }
    applied++;
  }
  const missing = roles.filter((r) => !rows.has(r.id)).map((r) => r.displayValue);

  console.log(`${dryRun ? 'would apply' : 'applied'}: ${applied}`);
  console.log(`skipped: ${skipped.length}`);
  for (const s of skipped) console.log('  skip:', s);
  console.log(`roles with no generated description: ${missing.length}`);
  for (const m of missing) console.log('  missing:', m);
}

main().finally(() => prisma.$disconnect());
