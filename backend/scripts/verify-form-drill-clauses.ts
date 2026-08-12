// verify-form-drill-clauses.ts — after the clause-row fix: every single-form
// register row must drill to a NON-empty list (spine contents and/or its own
// library clause rows), and every product model page must fill its Clauses
// band. Mirrors the /review and /product/:id/model route logic.
//
// Run: npx tsx --env-file=.env scripts/verify-form-drill-clauses.ts
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
import {
  buildFormsModel,
  clauseElement,
  clauseReviewRows,
  loadLatestClausesByForm,
  splitProductModel,
} from '../src/lib/resolvers/productForms.js';

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
  const scoped = scopeLobs(spine.lobs, EMPTY);
  const heat = buildHeatmap(scoped, decisions);
  const forms = buildFormsModel(heat, scoped);
  if (!forms) throw new Error('no forms model');

  // Batch: every register row's formId.
  const formIds = new Set<string>();
  for (const s of forms.sections)
    for (const r of s.rows) {
      const drill = forms.byKey.get(r.key);
      const selfFormId = drill?.self
        ? (Object.values(drill.self.group.perVersion).find((el) => el?.formId)?.formId ?? null)
        : null;
      if (selfFormId) formIds.add(selfFormId);
    }
  const lib = await loadLatestClausesByForm(company.id, [...formIds]);

  let total = 0;
  let empty = 0;
  let clauseRowsAdded = 0;
  const samples: string[] = [];
  for (const s of forms.sections)
    for (const r of s.rows) {
      total += 1;
      const drill = forms.byKey.get(r.key);
      if (!drill) continue;
      let rows = drill.reviewRows.length;
      const selfFormId = drill.self
        ? (Object.values(drill.self.group.perVersion).find((el) => el?.formId)?.formId ?? null)
        : null;
      if (drill.self && selfFormId) {
        const l = lib.get(selfFormId);
        if (l) {
          const added = clauseReviewRows(drill.self, selfFormId, l).length;
          rows += added;
          clauseRowsAdded += added;
        }
      }
      if (rows === 0 && !drill.self) {
        empty += 1;
        if (samples.length < 10) samples.push(`${s.layer}: ${r.label}`);
      } else if (rows === 0) {
        empty += 1;
        if (samples.length < 10) samples.push(`${s.layer}: ${r.label} (self only, no lib clauses)`);
      }
    }
  console.log(
    `register rows: ${total} · still empty drills: ${empty} · clause rows added: ${clauseRowsAdded}`,
  );
  for (const s of samples) console.log('  ' + s);

  // Product model page Clauses band.
  let products = 0;
  let clausesEmpty = 0;
  for (const lob of spine.lobs) {
    const byProduct = new Map<string, typeof lob.versions>();
    for (const v of lob.versions) {
      const list = byProduct.get(v.productName) ?? [];
      list.push(v);
      byProduct.set(v.productName, list);
    }
    for (const vers of byProduct.values()) {
      products += 1;
      const genNo = (t: string) => Number(/^v(\d+)$/.exec(t)?.[1] ?? 0);
      const latest = Math.max(...vers.map((v) => genNo(versionTokenOf(v.name))));
      const inGen = vers.filter((v) => genNo(versionTokenOf(v.name)) === latest);
      const countrywide = inGen.find((v) => stateOf(v.name) === NO_STATE) ?? inGen[0];
      if (!countrywide) continue;
      const model = splitProductModel(countrywide.components);
      if (model.forms.clauses.length === 0) {
        const baseFormId = model.forms.base[0]?.formId ?? null;
        const l = baseFormId ? lib.get(baseFormId) : null;
        if (l && baseFormId)
          model.forms.clauses = l.clauses.map((c) => clauseElement(baseFormId, l, c));
      }
      if (model.forms.clauses.length === 0) clausesEmpty += 1;
    }
  }
  console.log(`products: ${products} · model pages with an empty Clauses band: ${clausesEmpty}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
