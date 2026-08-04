/**
 * enrich-state-mandates.ts — give every state-required form/coverage element
 * the ACTUAL mandate detail behind it, with a real statutory citation.
 *
 * The spine's state elements carry one-line descriptions ("Catastrophe
 * deductible and settlement wording required.") — the register can say WHERE
 * the filing obligation lives, but not WHAT the state specifically mandates.
 * This pass asks Claude (insurance-regulatory prompt, forced tool use) for the
 * concrete requirements per (state × line × element) and writes them onto the
 * element JSON as `mandate` + `mandateCitation`. The board's mandates resolver
 * (lib/resolvers/productMandates.ts) prefers these fields.
 *
 * Idempotent: elements already carrying `mandate` are skipped. Replay:
 *   npx tsx --env-file=.env scripts/enrich-state-mandates.ts --dry   # count only
 *   npx tsx --env-file=.env scripts/enrich-state-mandates.ts        # enrich
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';
import { classifyForm, STATE_NAMES } from '../src/lib/resolvers/productForms.js';

const MODEL = process.env.MANDATE_ENRICH_MODEL ?? 'claude-sonnet-5';
const BATCH = 8;
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

interface WorkItem {
  key: string;
  state: string;
  stateName: string;
  lobName: string;
  element: string;
  description: string;
  /** Every (nodeId, element index) this item's text applies to. */
  targets: { nodeId: string; idx: number }[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MANDATE_TOOL: Anthropic.Tool = {
  name: 'report_mandates',
  description: 'Report the specific state mandate behind each element.',
  input_schema: {
    type: 'object',
    required: ['mandates'],
    properties: {
      mandates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['key', 'mandate', 'citation'],
          properties: {
            key: { type: 'string', description: 'The item key, verbatim from the input.' },
            mandate: {
              type: 'string',
              description:
                '2-4 sentences of the SPECIFIC requirements the state imposes — concrete ' +
                'rules, not a restatement that a form is required.',
            },
            citation: {
              type: 'string',
              description:
                'The real statutory/regulatory source, e.g. "Mass. Gen. Laws ch. 175, §99". ' +
                'Name the recognized law/regime; never invent section numbers you are unsure of.',
            },
          },
        },
      },
    },
  },
};

const SYSTEM = [
  'You are a US property & casualty insurance product and regulatory expert. For each',
  'state-required form or coverage element you are given (state, line of business, element',
  'name, current one-line description), state WHAT the state specifically mandates — the',
  'actual substance a product manager needs: prescribed policy form or wording standards,',
  'mandatory deductible types with their triggers/percentages where the state sets them,',
  'required settlement/valuation provisions, mandatory coverages or offers, prescribed',
  'endorsements, bureau/rating-plan requirements — whatever the named element is about.',
  'Be concrete and state-specific (e.g. Massachusetts: statutory fire-policy wording under',
  'Mass. Gen. Laws ch. 175 §99, hurricane deductibles must be plainly disclosed and are',
  'restricted in coastal territories; Michigan: PIP medical benefit choice levels under the',
  '2019 no-fault reform, MCL 500.3107c). 2-4 sentences, plain business language, no hedging',
  'filler. Citation: the real governing statute/regulation or bureau plan by its recognized',
  'name; include section numbers only when confident they are right. Use the report_mandates',
  'tool with one entry per input item, keys verbatim.',
].join(' ');

async function collectWork(): Promise<{ items: WorkItem[]; skipped: number }> {
  const lvl5 = await prisma.productLevelType.findFirst({
    where: { levelNumber: 5 },
    select: { id: true },
  });
  if (!lvl5) throw new Error('No level-5 product level type');
  const comps = await prisma.productNode.findMany({
    where: { productLevelTypeId: lvl5.id, displayValue: { in: ['Forms', 'Coverages'] } },
    select: { id: true, parentId: true, attributes: true },
  });
  // LOB name per component: parent version → product → LOB.
  const versions = await prisma.productNode.findMany({
    where: { id: { in: comps.map((c) => c.parentId).filter((x): x is string => !!x) } },
    select: { id: true, parentId: true },
  });
  const products = await prisma.productNode.findMany({
    where: { id: { in: versions.map((v) => v.parentId).filter((x): x is string => !!x) } },
    select: { id: true, parentId: true },
  });
  const lobs = await prisma.productNode.findMany({
    where: { id: { in: products.map((p) => p.parentId).filter((x): x is string => !!x) } },
    select: { id: true, displayValue: true },
  });
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const lobById = new Map(lobs.map((l) => [l.id, l]));
  const lobNameOfComp = (parentId: string | null): string => {
    const version = parentId ? versionById.get(parentId) : undefined;
    const product = version?.parentId ? productById.get(version.parentId) : undefined;
    const lob = product?.parentId ? lobById.get(product.parentId) : undefined;
    return lob?.displayValue ?? '';
  };

  const byKey = new Map<string, WorkItem>();
  let skipped = 0;
  for (const c of comps) {
    const els = ((c.attributes as { elements?: El[] } | null)?.elements ?? []) as El[];
    els.forEach((el, idx) => {
      const name = el.element ?? '';
      if (!name) return;
      const cls = classifyForm(
        name,
        {
          element: name,
          description: el.description ?? null,
          livesIn: el.livesIn ?? null,
          format: null,
        },
        false,
      );
      if (!cls.state) return;
      if (typeof el.mandate === 'string' && el.mandate.trim()) {
        skipped += 1;
        return;
      }
      const lobName = lobNameOfComp(c.parentId);
      const key = `${cls.state}|${norm(lobName)}|${norm(name)}`;
      let item = byKey.get(key);
      if (!item) {
        item = {
          key,
          state: cls.state,
          stateName: STATE_NAMES[cls.state] ?? cls.state,
          lobName,
          element: name,
          description: el.description ?? '',
          targets: [],
        };
        byKey.set(key, item);
      }
      item.targets.push({ nodeId: c.id, idx });
    });
  }
  return { items: [...byKey.values()], skipped };
}

interface MandateOut {
  key: string;
  mandate: string;
  citation: string;
}

async function enrichBatch(ai: Anthropic, batch: WorkItem[]): Promise<MandateOut[]> {
  // Items carry a short numeric id — models drift when echoing long composite
  // keys, and a dropped echo silently loses the item.
  const prompt = [
    'Items (key | state | line of business | element | current description):',
    ...batch.map(
      (w, i) => `#${i} | ${w.stateName} | ${w.lobName} | ${w.element} | ${w.description || '—'}`,
    ),
    '',
    'Echo each item key EXACTLY as given (#0, #1, …).',
  ].join('\n');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await ai.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        tools: [MANDATE_TOOL],
        tool_choice: { type: 'tool', name: 'report_mandates' },
      });
      const block = result.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const raw = (block?.input as { mandates?: unknown })?.mandates;
      if (!Array.isArray(raw)) throw new Error('no mandates array');
      // Resolve the numeric echo back to the item's real composite key.
      return raw.flatMap((m): MandateOut[] => {
        if (
          !m ||
          typeof (m as MandateOut).key !== 'string' ||
          typeof (m as MandateOut).mandate !== 'string' ||
          typeof (m as MandateOut).citation !== 'string'
        )
          return [];
        const n = Number(/(\d+)/.exec((m as MandateOut).key)?.[1] ?? NaN);
        const item = batch[n];
        if (!item) return [];
        return [{ ...(m as MandateOut), key: item.key }];
      });
    } catch (e) {
      if (attempt === 1) {
        console.error(`  batch failed twice (${batch[0]?.key}…): ${String(e)}`);
        return [];
      }
    }
  }
  return [];
}

async function main() {
  const { items, skipped } = await collectWork();
  console.log(
    `${items.length} distinct (state × line × element) mandates to enrich; ` +
      `${items.reduce((n, i) => n + i.targets.length, 0)} element occurrences; ` +
      `${skipped} already enriched (skipped).`,
  );
  if (DRY || items.length === 0) {
    await prisma.$disconnect();
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

  const batches: WorkItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  const results: MandateOut[] = [];
  let done = 0;
  // Bounded concurrency without a dependency.
  const queue = [...batches];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const batch = queue.shift();
        if (!batch) return;
        const out = await enrichBatch(ai, batch);
        results.push(...out);
        done += 1;
        console.log(`  batch ${done}/${batches.length} → ${out.length}/${batch.length} mandates`);
      }
    }),
  );

  // Apply: group writes per node so each node is updated once. Keys are
  // matched loosely (trim/lowercase) — a model echo that drifts must not
  // silently drop the item.
  const byNode = new Map<string, { idx: number; mandate: string; citation: string }[]>();
  const looseKey = (k: string) => k.trim().toLowerCase();
  const itemByKey = new Map(items.map((i) => [looseKey(i.key), i]));
  let unmatched = 0;
  for (const m of results) {
    const item = itemByKey.get(looseKey(m.key));
    if (!item) {
      unmatched += 1;
      console.error(`  unmatched key from model: ${m.key.slice(0, 100)}`);
      continue;
    }
    for (const t of item.targets) {
      const list = byNode.get(t.nodeId) ?? [];
      list.push({ idx: t.idx, mandate: m.mandate, citation: m.citation });
      byNode.set(t.nodeId, list);
    }
  }
  let updated = 0;
  for (const [nodeId, writes] of byNode) {
    const node = await prisma.productNode.findUnique({
      where: { id: nodeId },
      select: { attributes: true },
    });
    if (!node) continue;
    const attrs = (node.attributes ?? {}) as { elements?: El[] };
    const els = Array.isArray(attrs.elements) ? attrs.elements : [];
    for (const w of writes) {
      const el = els[w.idx];
      if (!el) continue;
      el.mandate = w.mandate;
      el.mandateCitation = w.citation;
    }
    await prisma.productNode.update({
      where: { id: nodeId },
      data: { attributes: { ...attrs, elements: els } },
    });
    updated += 1;
  }
  console.log(
    `Enriched ${results.length - unmatched}/${items.length} mandates across ${updated} nodes` +
      `${unmatched ? ` (${unmatched} unmatched keys — re-run to retry)` : ''}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
