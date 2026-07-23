// Resume-state report for the domain enrichment rollout. Fail-safe for limit
// kills: derives the truth from disk + DB instead of trusting session memory,
// so a fresh session knows exactly what to do next with one command.
//
//   npx tsx --env-file=.env scripts/enrich/status.ts "Corporate Functions"
//
// Per L3 area it reports authored artifacts on disk (Phase A part file, Phase B
// workplan file) and loaded depth in the DB (roles/checklist for Phase A, plan
// text/steps for Phase B), then prints the derived NEXT ACTION:
//   author-A   no part file             → spawn a Phase A authoring agent
//   load-A     part file, DB at baseline → normalize-part + build-and-load
//   seed-B     Phase A loaded, no seed   → dump-workplan-seed
//   author-B   seed, no workplan file    → spawn a Phase B authoring agent
//   load-B     workplan file, no plan text → strip-step-numbering + load-workplan
//   DONE       both phases in the DB
// Counts guard against truncated files: a part/workplan whose task count is
// short of the area's is flagged PARTIAL (killed agent left a fragment).
import { existsSync, readFileSync } from 'node:fs';
import { prisma } from '../../src/db/prisma.js';

const domainName = process.argv[2] ?? 'Corporate Functions';

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fileCount(path: string): number | null {
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    const arr = Array.isArray(j) ? j : j.tasks;
    return Array.isArray(arr) ? arr.length : -1;
  } catch {
    return -1; // unparseable = truncated mid-write
  }
}

async function main() {
  const domain = await prisma.processNode.findFirstOrThrow({
    where: { displayValue: domainName, processLevelType: { levelNumber: 1 } },
    select: { id: true },
  });
  const streams = await prisma.processNode.findMany({
    where: { parentId: domain.id },
    select: { id: true, displayValue: true },
    orderBy: { sortOrder: 'asc' },
  });

  const usedSlugs = new Set<string>();
  const rows: string[] = [];
  const actions = new Map<string, string[]>();
  const note = (action: string, s: string) => {
    if (!actions.has(action)) actions.set(action, []);
    actions.get(action)!.push(s);
  };

  for (const vs of streams) {
    const areas = await prisma.processNode.findMany({
      where: { parentId: vs.id },
      select: { id: true, displayValue: true },
      orderBy: { sortOrder: 'asc' },
    });
    for (const area of areas) {
      let s = slug(area.displayValue);
      if (usedSlugs.has(s)) s = `${s}-${slug(vs.displayValue)}`;
      usedSlugs.add(s);

      const desc = await prisma.processNodeClosure.findMany({
        where: { ancestorId: area.id },
        select: { descendantId: true },
      });
      const tasks = await prisma.processNode.findMany({
        where: { id: { in: desc.map((d) => d.descendantId) }, isTask: true },
        select: { id: true },
      });
      const ids = tasks.map((t) => t.id);
      const n = ids.length;
      if (n === 0) continue;

      const [chk, planText, steps] = await Promise.all([
        prisma.nodeChecklist.count({ where: { processNodeId: { in: ids } } }),
        prisma.nodeTemplateAnswer.count({
          where: { processNodeId: { in: ids }, templateKeyId: { not: null }, value: { not: null } },
        }),
        prisma.nodeTemplateAnswer.count({
          where: { processNodeId: { in: ids }, templateKeyId: null },
        }),
      ]);
      const chkAvg = chk / n;
      const stepsAvg = steps / n;

      const part = fileCount(`scripts/output/enrichment-part-${s}.json`);
      const wp = fileCount(`scripts/output/workplan-${s}.json`);
      const seed = existsSync(`scripts/output/wp-seed-${s}.json`);

      const aLoaded = chkAvg >= 9; // gold ≈ 12-14; baseline ≈ 6
      const bLoaded = planText > 0 && stepsAvg >= 5;

      let next: string;
      if (bLoaded && aLoaded) next = 'DONE';
      else if (part !== null && part >= 0 && part < n) next = `PARTIAL-A (${part}/${n})`;
      else if (wp !== null && wp >= 0 && wp < n && aLoaded) next = `PARTIAL-B (${wp}/${n})`;
      else if (part === null && !aLoaded) next = 'author-A';
      else if (!aLoaded) next = 'load-A';
      else if (!seed && wp === null) next = 'seed-B';
      else if (wp === null) next = 'author-B';
      else next = 'load-B';
      note(next.split(' ')[0], s);

      rows.push(
        [
          next.padEnd(14),
          vs.displayValue.slice(0, 22).padEnd(23),
          s.padEnd(48),
          String(n).padStart(4),
          `chk ${chkAvg.toFixed(1).padStart(5)}`,
          `steps ${stepsAvg.toFixed(1).padStart(5)}`,
          `partFile ${part === null ? '-' : part}`,
          `wpFile ${wp === null ? '-' : wp}`,
        ].join(' '),
      );
    }
  }

  console.log(rows.join('\n'));
  console.log('\n=== NEXT ACTIONS ===');
  for (const [action, slugs] of [...actions.entries()].sort())
    console.log(`${action} (${slugs.length}): ${slugs.join(' ')}`);
  console.log('\nRecipes: author-* = spawn agent per RUNBOOK §3/§4b (write file INCREMENTALLY).');
  console.log(
    'load-A: node scripts/enrich/normalize-part.mjs <slug> <vs-catalog> && npx tsx --env-file=.env scripts/enrich/build-and-load.ts <slug>',
  );
  console.log(
    'load-B: node scripts/enrich/strip-step-numbering.mjs scripts/output/workplan-<slug>.json && npx tsx --env-file=.env scripts/enrich/load-workplan.ts scripts/output/workplan-<slug>.json',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
