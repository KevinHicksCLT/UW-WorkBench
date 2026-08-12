// repro-empty-drills.ts — sweep the DRILL payloads (component element rows,
// forms register drills, review lists) for rows whose presence array is all
// false: those render as a fully blank heat row when a band expands or a
// drill opens.
//
// Run: npx tsx --env-file=.env scripts/repro-empty-drills.ts
import { prisma } from '../src/db/prisma.js';
import {
  buildHeatmap,
  loadDecisions,
  loadSpine,
  scopeLobs,
  type SpineFilters,
} from '../src/lib/resolvers/productBoard.js';
import { buildFormsModel } from '../src/lib/resolvers/productForms.js';

const EMPTY: SpineFilters = {
  segments: [],
  lobIds: [],
  offerings: [],
  states: [],
  versionTokens: [],
  versionIds: [],
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('no company');
  const [spine, decisions] = await Promise.all([loadSpine(company.id), loadDecisions(company.id)]);

  const scopes: { label: string; f: SpineFilters }[] = [{ label: 'ALL', f: EMPTY }];
  for (const s of new Set(spine.lobs.map((l) => l.segmentName)))
    scopes.push({ label: `segment:${s}`, f: { ...EMPTY, segments: [s] } });
  for (const l of spine.lobs)
    scopes.push({ label: `lob:${l.name}(${l.segmentName})`, f: { ...EMPTY, lobIds: [l.id] } });

  let bad = 0;
  for (const { label, f } of scopes) {
    const scoped = scopeLobs(spine.lobs, f);
    if (!scoped.length) continue;
    const heat = buildHeatmap(scoped, decisions);
    const problems: string[] = [];
    for (const row of heat.rows) {
      let zero = 0;
      const samples: string[] = [];
      for (const rr of row.reviewRows) {
        if (!rr.presence.some(Boolean)) {
          zero += 1;
          if (samples.length < 3) samples.push(`${rr.lobName} · ${rr.group.name}`);
        }
      }
      if (zero > 0)
        problems.push(
          `component "${row.component}": ${zero}/${row.reviewRows.length} review rows with ZERO presence — e.g. ${samples.join(' | ')}`,
        );
    }
    const forms = buildFormsModel(heat, scoped);
    if (forms) {
      for (const [key, drill] of forms.byKey) {
        let zero = 0;
        const samples: string[] = [];
        for (const rr of drill.reviewRows) {
          if (!rr.presence.some(Boolean)) {
            zero += 1;
            if (samples.length < 3) samples.push(rr.group.name);
          }
        }
        if (drill.self && !drill.self.presence.some(Boolean)) {
          problems.push(`forms drill "${key}" (${drill.label}): SELF row zero presence`);
        }
        if (zero > 0)
          problems.push(
            `forms drill "${key}" (${drill.label}): ${zero}/${drill.reviewRows.length} rows zero presence — e.g. ${samples.join(' | ')}`,
          );
        if (drill.reviewRows.length === 0 && !drill.self)
          problems.push(`forms drill "${key}" (${drill.label}): EMPTY drill (no rows, no self)`);
      }
    }
    if (problems.length) {
      bad += 1;
      console.log(`\n✗ ${label}`);
      for (const p of problems.slice(0, 15)) console.log('   ' + p);
      if (problems.length > 15) console.log(`   … +${problems.length - 15} more`);
    }
  }
  console.log(`\n=== done: ${bad}/${scopes.length} scopes with empty drill rows ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
