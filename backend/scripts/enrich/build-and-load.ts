// Per-area merge + coverage-check + load driver for the enrichment rollout.
//   npx tsx --env-file=.env scripts/enrich/build-and-load.ts [--dry-run] <slug> [<slug> ...]
// For each slug: reads enrich-tasks-<slug>.json (area name + expected task ids)
// and enrichment-part-<slug>.json (authored), reports coverage (missing/extra),
// writes enrichment-<slug>.json {area, companyId, tasks}, then applies it via
// load-enrichment in-process. Skips load for an area only if a part is missing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const slugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (slugs.length === 0) throw new Error('usage: build-and-load.ts [--dry-run] <slug>...');

const { companyId } = JSON.parse(readFileSync('scripts/output/enrich-catalog.json', 'utf8')) as {
  companyId: string;
};

for (const slug of slugs) {
  const taskFile = `scripts/output/enrich-tasks-${slug}.json`;
  const partFile = `scripts/output/enrichment-part-${slug}.json`;
  if (!existsSync(taskFile)) {
    console.error(`MISS task file ${taskFile}`);
    continue;
  }
  if (!existsSync(partFile)) {
    console.error(`MISS part file ${partFile} — SKIP ${slug}`);
    continue;
  }

  const { area, tasks: srcTasks } = JSON.parse(readFileSync(taskFile, 'utf8')) as {
    area: string;
    tasks: { id: string }[];
  };
  const part = JSON.parse(readFileSync(partFile, 'utf8')) as { taskId: string }[];
  const want = new Set(srcTasks.map((t) => t.id));
  const got = new Set(part.map((p) => p.taskId));
  const missing = [...want].filter((id) => !got.has(id));
  const extra = [...got].filter((id) => !want.has(id));
  console.log(
    `${slug}: authored ${got.size}/${want.size}` +
      (missing.length ? ` MISSING ${missing.length}` : '') +
      (extra.length ? ` EXTRA ${extra.length}` : ''),
  );
  if (extra.length)
    console.log(`  extra ids: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? '…' : ''}`);
  if (missing.length)
    console.log(
      `  missing ids: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`,
    );

  const merged = `scripts/output/enrichment-${slug}.json`;
  writeFileSync(
    merged,
    JSON.stringify({ area, companyId, tasks: part.filter((p) => want.has(p.taskId)) }, null, 2),
  );

  const cmd = `npx tsx --env-file=.env scripts/enrich/load-enrichment.ts ${merged}${dryRun ? ' --dry-run' : ''}`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  process.stdout.write(out);
}
