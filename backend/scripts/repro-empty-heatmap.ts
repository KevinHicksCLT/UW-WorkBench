// repro-empty-heatmap.ts — sweep every drill scope the Products board offers
// (segment, LOB, offering/product, state, version) and report scopes whose
// heat map renders empty: no rows, rows with zero lit cells, zero totals, or
// a missing forms register.
//
// Run: npx tsx --env-file=.env scripts/repro-empty-heatmap.ts
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

function check(
  label: string,
  lobs: ReturnType<typeof scopeLobs>,
  decisions: Map<string, never> | Map<string, any>,
) {
  const heat = buildHeatmap(lobs, decisions);
  const forms = buildFormsModel(heat, lobs);
  const problems: string[] = [];
  if (heat.rows.length === 0) problems.push('NO heat rows');
  if (heat.totals.total === 0) problems.push('totals.total=0');
  for (const r of heat.rows) {
    const lit = r.cells.filter((c) => !c.na).length;
    const counted = r.cells.filter((c) => c.total > 0).length;
    if (lit === 0) problems.push(`row "${r.component}" zero lit cells (total=${r.total})`);
    else if (counted === 0)
      problems.push(`row "${r.component}" lit but zero counts (total=${r.total})`);
    else if (r.total === 0) problems.push(`row "${r.component}" total=0`);
  }
  if (!forms) problems.push('forms register NULL');
  else {
    const rows = forms.sections.reduce((n, s) => n + s.rows.length, 0);
    if (rows === 0) problems.push('forms register has 0 rows');
    for (const s of forms.sections)
      for (const r of s.rows) {
        const lit = r.cells.filter((c) => !c.na && c.total > 0).length;
        if (lit === 0) problems.push(`form row "${r.label || r.key}" (${s.layer}) zero lit cells`);
      }
  }
  if (problems.length) {
    console.log(
      `\n✗ ${label} — versions=${lobs.reduce((n, l) => n + l.versions.length, 0)} cols=${heat.columns.length} mode=${heat.columnMode}`,
    );
    for (const p of problems.slice(0, 12)) console.log('   ' + p);
    if (problems.length > 12) console.log(`   … +${problems.length - 12} more`);
    return false;
  }
  return true;
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('no company');
  const [spine, decisions] = await Promise.all([loadSpine(company.id), loadDecisions(company.id)]);
  console.log(`company=${company.name} lobs=${spine.lobs.length}`);

  let ok = 0;
  let bad = 0;
  const run = (label: string, f: SpineFilters) => {
    const scoped = scopeLobs(spine.lobs, f);
    if (scoped.length === 0) {
      console.log(`\n✗ ${label} — scope EMPTY (0 lobs)`);
      bad += 1;
      return;
    }
    if (check(label, scoped, decisions)) ok += 1;
    else bad += 1;
  };

  run('ALL (no filters)', EMPTY);

  const segments = [...new Set(spine.lobs.map((l) => l.segmentName))];
  for (const s of segments) run(`segment: ${s}`, { ...EMPTY, segments: [s] });
  for (const l of spine.lobs)
    run(`lob: ${l.name} (${l.segmentName})`, { ...EMPTY, lobIds: [l.id] });

  const offerings = new Map<string, string>(); // productName → lobId
  const states = new Set<string>();
  const tokens = new Set<string>();
  for (const l of spine.lobs)
    for (const v of l.versions) {
      offerings.set(v.productName, l.id);
      for (const s of v.states) states.add(s);
      tokens.add(v.name.split(/[\s—–]+/).filter(Boolean)[0] ?? v.name);
    }
  for (const [p, lobId] of offerings)
    run(`offering: ${p}`, { ...EMPTY, lobIds: [lobId], offerings: [p] });
  for (const s of [...states].sort()) run(`state: ${s}`, { ...EMPTY, states: [s] });
  for (const t of [...tokens].sort()) run(`token: ${t}`, { ...EMPTY, versionTokens: [t] });

  // Offering + state combos for a few big products (deepest drill).
  let combo = 0;
  outer: for (const l of spine.lobs)
    for (const v of l.versions) {
      for (const st of v.states.slice(0, 2)) {
        run(`deep: ${v.productName} + ${st}`, {
          ...EMPTY,
          lobIds: [l.id],
          offerings: [v.productName],
          states: [st],
        });
        combo += 1;
        if (combo >= 60) break outer;
      }
    }

  console.log(`\n=== done: ${ok} scopes clean, ${bad} scopes with problems ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
