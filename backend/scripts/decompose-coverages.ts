/**
 * decompose-coverages.ts — replace lumped coverage blobs with the real model.
 *
 * The spine's Coverages components carry blob elements ("BI, PD, collision,
 * comprehensive, UM/UIM, medical payments, roadside…") — one element where the
 * real product has many. That flattens the board: every coverage row reads
 * COMMON while the genuine state story (no-fault PIP, mandatory UM/UIM offers,
 * statutory WC benefit schedules) never surfaces.
 *
 * Per product, Claude (P&C product/regulatory prompt, forced tool use):
 *   1. SPLITS each lumped element into its atomic coverages (real coverage
 *      vocabulary for that line — no invention);
 *   2. names the REAL state-specific benefit/coverage variations among the
 *      states this product is actually written in (only well-established
 *      rules: FL/MI/NY/NJ PIP, UM/UIM mandatory offers, TX PIP offer, WC
 *      statutory schedules, …) with statutory citations. These are ADDED to
 *      the matching state versions as plain-named coverage elements (the name
 *      carries no state token, so the board groups the same benefit across
 *      the states that carry it — the honest Similar/Unique signal), with the
 *      citation on mandate/mandateCitation so the mandate UI shows the basis.
 *
 * Idempotent: components stamped attributes.coverageDecomposedAt are skipped.
 * Replay:
 *   npx tsx --env-file=.env scripts/decompose-coverages.ts --dry
 *   npx tsx --env-file=.env scripts/decompose-coverages.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';
import { stateOf, NO_STATE, STATE_NAMES } from '../src/lib/resolvers/productBoard.js';

const MODEL = process.env.MANDATE_ENRICH_MODEL ?? 'claude-sonnet-5';
const CONCURRENCY = 4;
const DRY = process.argv.includes('--dry');

interface El {
  element?: string;
  description?: string;
  livesIn?: string;
  format?: string;
  mandate?: string;
  mandateCitation?: string;
  [k: string]: unknown;
}

interface CompRef {
  nodeId: string;
  versionId: string;
  versionName: string;
  state: string; // NO_STATE for countrywide
  elements: El[];
  decomposed: boolean;
}

interface ProductWork {
  productName: string;
  lobName: string;
  comps: CompRef[];
  /** Distinct lumped element texts across the product's versions. */
  lumped: string[];
  states: string[];
}

const isLumped = (name: string) => name.split(',').length >= 3;

const SPLIT_TOOL: Anthropic.Tool = {
  name: 'report_model',
  description: 'Report the atomic coverage split and the real state variations.',
  input_schema: {
    type: 'object',
    required: ['splits', 'stateCoverages'],
    properties: {
      splits: {
        type: 'array',
        description: 'One entry per lumped input element (key echoed verbatim as #N).',
        items: {
          type: 'object',
          required: ['key', 'coverages'],
          properties: {
            key: { type: 'string' },
            coverages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'description'],
                properties: {
                  name: { type: 'string', description: 'Standard coverage name, no state tokens.' },
                  description: {
                    type: 'string',
                    description: '1 sentence: what this coverage actually covers for this line.',
                  },
                },
              },
            },
          },
        },
      },
      stateCoverages: {
        type: 'array',
        description:
          'REAL state-specific benefit/coverage variations among the listed states only. ' +
          'Well-established rules only — omit a state rather than invent.',
        items: {
          type: 'object',
          required: ['state', 'name', 'description', 'citation'],
          properties: {
            state: { type: 'string', description: 'USPS code, must be one of the listed states.' },
            name: {
              type: 'string',
              description:
                'Plain coverage name WITHOUT any state token (e.g. "Personal Injury Protection (PIP)") — ' +
                'the same benefit in different states must share the exact same name.',
            },
            description: {
              type: 'string',
              description:
                '1-2 sentences: the actual state rule that makes this coverage exist/differ here.',
            },
            citation: {
              type: 'string',
              description: 'Real statute/regulation, no invented sections.',
            },
          },
        },
      },
    },
  },
};

const SYSTEM = [
  'You are a US P&C insurance product expert. You are given one product (line of business,',
  'product name), its lumped coverage elements, and the states it is written in. Two jobs:',
  '(1) Split each lumped element into its atomic coverages using the standard coverage',
  'vocabulary for that line (auto: bodily injury liability, property damage liability,',
  'collision, comprehensive, UM/UIM, medical payments, …; homeowners: Coverage A-F, …).',
  'Do not invent exotic coverages — only what the lumped text actually names or clearly',
  'implies for the line. (2) Name the REAL state-specific benefit/coverage variations among',
  'the GIVEN states only — the well-established ones an underwriter would recognize:',
  'no-fault PIP where mandatory (FL §627.736, MI MCL 500.3107, NY Reg 68, NJ, MA, …),',
  'PIP/med-pay mandatory offers (TX, WA, …), UM/UIM mandatory coverage vs mandatory offer',
  'states, first-party benefits (PA), WC statutory benefit schedules, windstorm/hurricane',
  'specifics for property lines, etc. Only include a state if the rule is genuine and',
  'applies to this line of business; omit rather than invent. Same benefit across states =',
  'exact same coverage name (no state tokens in names). Use the report_model tool.',
].join(' ');

async function collect(): Promise<ProductWork[]> {
  const lvl5 = await prisma.productLevelType.findFirst({
    where: { levelNumber: 5 },
    select: { id: true },
  });
  if (!lvl5) throw new Error('no lvl5');
  const comps = await prisma.productNode.findMany({
    where: { productLevelTypeId: lvl5.id, displayValue: 'Coverages' },
    select: { id: true, parentId: true, attributes: true },
  });
  const versions = await prisma.productNode.findMany({
    where: { id: { in: comps.map((c) => c.parentId).filter((x): x is string => !!x) } },
    select: { id: true, displayValue: true, parentId: true },
  });
  const products = await prisma.productNode.findMany({
    where: { id: { in: versions.map((v) => v.parentId).filter((x): x is string => !!x) } },
    select: { id: true, displayValue: true, parentId: true },
  });
  const lobs = await prisma.productNode.findMany({
    where: { id: { in: products.map((p) => p.parentId).filter((x): x is string => !!x) } },
    select: { id: true, displayValue: true },
  });
  const vById = new Map(versions.map((v) => [v.id, v]));
  const pById = new Map(products.map((p) => [p.id, p]));
  const lById = new Map(lobs.map((l) => [l.id, l]));

  const byProduct = new Map<string, ProductWork>();
  for (const c of comps) {
    const v = c.parentId ? vById.get(c.parentId) : undefined;
    if (!v) continue;
    const p = v.parentId ? pById.get(v.parentId) : undefined;
    const l = p?.parentId ? lById.get(p.parentId) : undefined;
    const attrs = (c.attributes ?? {}) as { elements?: El[]; coverageDecomposedAt?: string };
    const els = Array.isArray(attrs.elements) ? attrs.elements : [];
    const key = `${l?.id ?? '?'}::${p?.id ?? '?'}`;
    let w = byProduct.get(key);
    if (!w) {
      w = {
        productName: p?.displayValue ?? '?',
        lobName: l?.displayValue ?? '?',
        comps: [],
        lumped: [],
        states: [],
      };
      byProduct.set(key, w);
    }
    const state = stateOf(v.displayValue);
    w.comps.push({
      nodeId: c.id,
      versionId: v.id,
      versionName: v.displayValue,
      state,
      elements: els,
      decomposed: typeof attrs.coverageDecomposedAt === 'string',
    });
    if (state !== NO_STATE && !w.states.includes(state)) w.states.push(state);
    for (const e of els) {
      const name = e.element ?? '';
      if (name && isLumped(name) && !w.lumped.includes(name)) w.lumped.push(name);
    }
  }
  // Only products with something to do, where at least one comp is unprocessed.
  return [...byProduct.values()].filter(
    (w) => w.lumped.length > 0 && w.comps.some((c) => !c.decomposed),
  );
}

interface ModelOut {
  splits: { key: string; coverages: { name: string; description: string }[] }[];
  stateCoverages: { state: string; name: string; description: string; citation: string }[];
}

async function askModel(ai: Anthropic, w: ProductWork): Promise<ModelOut | null> {
  const prompt = [
    `Line of business: ${w.lobName}`,
    `Product: ${w.productName}`,
    `States written in: ${w.states.length ? w.states.join(', ') : '(countrywide only)'}`,
    '',
    'Lumped coverage elements to split:',
    ...w.lumped.map((t, i) => `#${i} | ${t}`),
    '',
    'Echo each split key EXACTLY as given (#0, #1, …).',
  ].join('\n');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await ai.messages.create({
        model: MODEL,
        max_tokens: 6000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        tools: [SPLIT_TOOL],
        tool_choice: { type: 'tool', name: 'report_model' },
      });
      const block = result.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const input = block?.input as ModelOut | undefined;
      if (!input || !Array.isArray(input.splits) || !Array.isArray(input.stateCoverages))
        throw new Error('bad shape');
      return input;
    } catch (e) {
      if (attempt === 1) {
        console.error(`  ${w.productName}: failed twice — ${String(e)}`);
        return null;
      }
    }
  }
  return null;
}

async function apply(w: ProductWork, out: ModelOut): Promise<void> {
  const splitByText = new Map<string, { name: string; description: string }[]>();
  for (const s of out.splits) {
    const n = Number(/(\d+)/.exec(s.key)?.[1] ?? NaN);
    const text = w.lumped[n];
    if (text && Array.isArray(s.coverages) && s.coverages.length > 0)
      splitByText.set(text, s.coverages);
  }
  const addsByState = new Map<string, ModelOut['stateCoverages']>();
  for (const sc of out.stateCoverages) {
    if (!STATE_NAMES[sc.state] || !w.states.includes(sc.state)) continue;
    const list = addsByState.get(sc.state) ?? [];
    list.push(sc);
    addsByState.set(sc.state, list);
  }

  for (const comp of w.comps) {
    if (comp.decomposed) continue;
    const next: El[] = [];
    for (const e of comp.elements) {
      const split = e.element ? splitByText.get(e.element) : undefined;
      if (!split) {
        next.push(e);
        continue;
      }
      for (const c of split) {
        next.push({
          element: c.name,
          description: c.description,
          livesIn: e.livesIn ?? null,
          format: e.format ?? null,
        } as El);
      }
    }
    // Real state benefit coverages land on the STATE version only, deduped
    // against anything already named the same.
    if (comp.state !== NO_STATE) {
      const have = new Set(next.map((e) => (e.element ?? '').toLowerCase()));
      for (const sc of addsByState.get(comp.state) ?? []) {
        if (have.has(sc.name.toLowerCase())) continue;
        have.add(sc.name.toLowerCase());
        next.push({
          element: sc.name,
          description: sc.description,
          livesIn: comp.elements[0]?.livesIn ?? null,
          format: comp.elements[0]?.format ?? null,
          mandate: sc.description,
          mandateCitation: sc.citation,
        } as El);
      }
    }
    const node = await prisma.productNode.findUnique({
      where: { id: comp.nodeId },
      select: { attributes: true },
    });
    if (!node) continue;
    const attrs = (node.attributes ?? {}) as Record<string, unknown>;
    await prisma.productNode.update({
      where: { id: comp.nodeId },
      data: {
        attributes: {
          ...attrs,
          elements: next,
          coverageDecomposedAt: new Date().toISOString(),
        },
      },
    });
  }
}

async function main() {
  const work = await collect();
  const lumpedCount = work.reduce((n, w) => n + w.lumped.length, 0);
  console.log(`${work.length} products with lumped coverages (${lumpedCount} blob elements).`);
  if (DRY || work.length === 0) {
    await prisma.$disconnect();
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

  let done = 0;
  const queue = [...work];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const w = queue.shift();
        if (!w) return;
        const out = await askModel(ai, w);
        if (out) await apply(w, out);
        done += 1;
        console.log(
          `  ${done}/${work.length} ${w.lobName} / ${w.productName}` +
            `${out ? ` — ${out.splits.length} splits, ${out.stateCoverages.length} state coverages` : ' — FAILED'}`,
        );
      }
    }),
  );
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
