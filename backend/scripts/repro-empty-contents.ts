// repro-empty-contents.ts — the "lowest level" sweep:
//  (a) forms-register drills whose review list carries NO content rows (self
//      only) — drilling such a form shows an empty table;
//  (b) the Product Models product page (/product-spine/product/:id/model):
//      per product, which model sections come back empty (base, coverages,
//      terms, endorsements, clauses, rating, pricing, underwriting, filings,
//      lifecycle) and which state overlays carry zero forms.
//
// Run: npx tsx --env-file=.env scripts/repro-empty-contents.ts
import { prisma } from '../src/db/prisma.js';
import {
  buildHeatmap,
  loadDecisions,
  loadSpine,
  scopeLobs,
  stateOf,
  NO_STATE,
  versionTokenOf,
  type SpineFilters,
} from '../src/lib/resolvers/productBoard.js';
import { buildFormsModel, splitProductModel } from '../src/lib/resolvers/productForms.js';

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

  // ── (a) forms drills with no contents ─────────────────────────────────────
  const scoped = scopeLobs(spine.lobs, EMPTY);
  const heat = buildHeatmap(scoped, decisions);
  const forms = buildFormsModel(heat, scoped);
  if (forms) {
    const byLayer = new Map<string, { total: number; selfOnly: number; samples: string[] }>();
    // Register rows only (the ones users see and click).
    for (const s of forms.sections) {
      const agg = byLayer.get(s.layer) ?? { total: 0, selfOnly: 0, samples: [] };
      for (const row of s.rows) {
        agg.total += 1;
        const drill = forms.byKey.get(row.key);
        if (drill && drill.reviewRows.length === 0) {
          agg.selfOnly += 1;
          if (agg.samples.length < 8) agg.samples.push(`${row.label} — ${row.sub ?? ''}`);
        }
      }
      byLayer.set(s.layer, agg);
    }
    console.log('── forms register drills with EMPTY contents (self only) ──');
    for (const [layer, a] of byLayer) {
      console.log(`  ${layer}: ${a.selfOnly}/${a.total} rows drill to an empty list`);
      for (const smp of a.samples) console.log(`     e.g. ${smp}`);
    }
  }

  // ── (b) product model page sections ───────────────────────────────────────
  console.log('\n── product model page (per L3 product, latest generation) ──');
  const sectionEmpty = new Map<string, number>();
  let products = 0;
  const emptySamples: string[] = [];
  let overlaysEmpty = 0;
  let overlaysTotal = 0;
  for (const lob of spine.lobs) {
    const byProduct = new Map<string, typeof lob.versions>();
    for (const v of lob.versions) {
      const list = byProduct.get(v.productName) ?? [];
      list.push(v);
      byProduct.set(v.productName, list);
    }
    for (const [productName, vers] of byProduct) {
      products += 1;
      // Latest generation, countrywide core (same rule as the route).
      const genNo = (t: string) => Number(/^v(\d+)$/.exec(t)?.[1] ?? 0);
      const latest = Math.max(...vers.map((v) => genNo(versionTokenOf(v.name))));
      const inGen = vers.filter((v) => genNo(versionTokenOf(v.name)) === latest);
      const countrywide = inGen.find((v) => stateOf(v.name) === NO_STATE) ?? inGen[0];
      if (!countrywide) continue;
      const model = splitProductModel(countrywide.components);
      const secs: [string, number][] = [
        ['forms.base', model.forms.base.length],
        ['forms.coverages', model.forms.coverages.length],
        ['forms.terms', model.forms.terms.length],
        ['forms.endorsements', model.forms.endorsements.length],
        ['forms.clauses', model.forms.clauses.length],
        ['rating', model.rating.length],
        ['pricing', model.pricing.length],
        ['underwriting', model.underwriting.length],
        ['filings', model.filings.length],
        ['lifecycle', model.lifecycle.length],
      ];
      const empties = secs.filter(([, n]) => n === 0).map(([k]) => k);
      for (const k of empties) sectionEmpty.set(k, (sectionEmpty.get(k) ?? 0) + 1);
      if (empties.length && emptySamples.length < 20)
        emptySamples.push(`${lob.name} › ${productName}: empty [${empties.join(', ')}]`);
      // State overlays: forms the state adds beyond the core.
      const coreFormIds = new Set(
        (countrywide.components.get('Forms')?.elements ?? []).map((e) => e.formId).filter(Boolean),
      );
      for (const v of inGen) {
        if (v.id === countrywide.id || stateOf(v.name) === NO_STATE) continue;
        overlaysTotal += 1;
        const added = (v.components.get('Forms')?.elements ?? []).filter(
          (e) => !e.formId || !coreFormIds.has(e.formId),
        );
        if (added.length === 0) overlaysEmpty += 1;
      }
    }
  }
  console.log(`products: ${products}`);
  console.log('sections empty (product count):');
  for (const [k, n] of [...sectionEmpty.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}: ${n}/${products}`);
  console.log(`state overlays with ZERO added forms: ${overlaysEmpty}/${overlaysTotal}`);
  console.log('\nsamples:');
  for (const s of emptySamples) console.log('  ' + s);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
