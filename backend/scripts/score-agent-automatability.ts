// score-agent-automatability.ts — have Claude assess how readily an AI agent
// could perform each Task in the Work tracker, on a 1–5 scale (1 = an agent can
// do it end-to-end today … 5 = human-only). Writes Task.agentScore /
// agentRationale / agentScoredAt.
//
// The work seeder repeats role-task text across every deliverable a role owns,
// so the ~5.8k Task rows collapse to far fewer DISTINCT (title + owner) pairs.
// We score each distinct pair once and fan the result back out — keeping the
// number of model calls (and cost) proportional to the real work, not the rows.
//
// Idempotent: by default only scores tasks with no agentScore yet. Re-running
// after new tasks appear fills only the gaps. Use --force to rescore everything.
//
// Run (cwd = backend):
//   npx tsx scripts/score-agent-automatability.ts            # score the gaps
//   npx tsx scripts/score-agent-automatability.ts --dry-run  # count work, no API
//   npx tsx scripts/score-agent-automatability.ts --limit 80 # score 80 uniques
//   npx tsx scripts/score-agent-automatability.ts --force    # rescore all
//   npx tsx scripts/score-agent-automatability.ts --company <id>
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';
import { buildRoleResolver } from '../src/lib/roleMatch.js';

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const DRY = flag('dry-run');
const FORCE = flag('force');
const LIMIT = Number(opt('limit', '0')) || 0;
const BATCH = Number(opt('batch', '40')) || 40;
const CONCURRENCY = Number(opt('concurrency', '4')) || 4;
const COMPANY = opt('company', '');

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const SYSTEM = `You assess how readily an autonomous AI agent could perform a business task TODAY, given current LLM-agent capabilities (tool use, browsing, code, document generation, data work). Score each task 1–5:

1 — Fully automatable now: an AI agent can complete it end-to-end today. Digital, well-defined, rules/data-driven, low judgment (extract/transform data, reconcile records, generate a report or notification, populate a template, summarize, validate against rules).
2 — Largely automatable, needs setup: the agent can do most of it but needs system integration/tooling or light human review (draft a document for sign-off, classify with edge cases, prepare an analysis a human checks).
3 — Partially automatable: meaningful human judgment, interpretation, or coordination; the agent assists on portions only (assess a non-trivial risk, negotiate within set guidelines, resolve an ambiguous case).
4 — Mostly human: significant expertise, stakeholder judgment, or accountability; the agent helps on sub-steps only (approve material exceptions, shape strategy, manage a team).
5 — Human-only: physical presence, high-stakes accountability, relationship/negotiation, legal or executive sign-off that cannot be delegated to an agent (final executive decision, in-person inspection, board representation, firing someone).

Judge the task itself, using the role/deliverable as context. When unsure between two scores, pick the higher (more human) one. Give a rationale of at most 12 words.`;

const TOOL: Anthropic.Tool = {
  name: 'submit_scores',
  description: 'Return an automatability score for every task index provided.',
  input_schema: {
    type: 'object',
    properties: {
      scores: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer', description: 'the task index from the prompt' },
            score: { type: 'integer', minimum: 1, maximum: 5 },
            rationale: { type: 'string', description: '≤12 words' },
          },
          required: ['i', 'score', 'rationale'],
        },
      },
    },
    required: ['scores'],
  },
};

type Uniq = { sig: string; title: string; owner: string; family: string; level: string; deliverable: string; vs: string; ids: string[] };

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing in backend/.env');
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function scoreBatch(batch: Uniq[]): Promise<Map<number, { score: number; rationale: string }>> {
  const lines = batch.map((u, i) => {
    const ctx = [
      u.owner ? `role: "${u.owner}"${u.family || u.level ? ` (${[u.family, u.level].filter(Boolean).join(', ')})` : ''}` : '',
      u.deliverable ? `deliverable: "${u.deliverable}"` : '',
      u.vs ? `value stream: "${u.vs}"` : '',
    ].filter(Boolean).join(' | ');
    return `[${i}] task: "${u.title}"${ctx ? ' | ' + ctx : ''}`;
  }).join('\n');

  const resp = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'submit_scores' },
    messages: [{ role: 'user', content: `Score these ${batch.length} tasks (return one entry per index 0–${batch.length - 1}):\n\n${lines}` }],
  });

  const out = new Map<number, { score: number; rationale: string }>();
  for (const block of resp.content) {
    if (block.type !== 'tool_use' || block.name !== 'submit_scores') continue;
    const scores = (block.input as { scores?: { i: number; score: number; rationale: string }[] }).scores ?? [];
    for (const s of scores) {
      const score = Math.min(5, Math.max(1, Math.round(s.score)));
      if (s.i >= 0 && s.i < batch.length) out.set(s.i, { score, rationale: (s.rationale ?? '').slice(0, 200) });
    }
  }
  return out;
}

// Run an array of async thunks with bounded concurrency.
async function pool<T>(items: T[], n: number, fn: (t: T, idx: number) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  }));
}

async function main() {
  const company = await prisma.company.findFirst({
    where: COMPANY ? { id: COMPANY } : {},
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!company) throw new Error('No company found');
  console.log(`Company: ${company.name} (${company.id})`);

  const [tasks, roles, valueStreams] = await Promise.all([
    prisma.task.findMany({
      where: { companyId: company.id },
      select: { id: true, title: true, owner: true, agentScore: true, deliverable: { select: { title: true, valueStreamId: true } } },
    }),
    prisma.role.findMany({ where: { companyId: company.id }, select: { id: true, name: true, itemRole: true, roleFamily: true, roleLevel: true } }),
    prisma.valueStream.findMany({ where: { companyId: company.id }, select: { id: true, name: true } }),
  ]);
  const resolve = buildRoleResolver(roles);
  const roleById = new Map(roles.map((r) => [r.id, r] as const));
  const vsName = new Map(valueStreams.map((v) => [v.id, v.name] as const));

  // Collapse to distinct (title + owner) signatures, carrying every task id.
  const bySig = new Map<string, Uniq>();
  let alreadyScored = 0;
  for (const t of tasks) {
    if (!FORCE && t.agentScore != null) { alreadyScored++; continue; }
    const sig = `${norm(t.title)}␟${norm(t.owner ?? '')}`;
    let u = bySig.get(sig);
    if (!u) {
      const role = t.owner ? resolve(t.owner) : null;
      const rec = role ? roleById.get(role.id) : null;
      u = {
        sig, title: t.title, owner: t.owner ?? '',
        family: rec?.roleFamily ?? '', level: rec?.roleLevel ?? '',
        deliverable: t.deliverable?.title ?? '',
        vs: t.deliverable?.valueStreamId ? vsName.get(t.deliverable.valueStreamId) ?? '' : '',
        ids: [],
      };
      bySig.set(sig, u);
    }
    u.ids.push(t.id);
  }

  let uniques = [...bySig.values()];
  if (LIMIT) uniques = uniques.slice(0, LIMIT);
  const rowCount = uniques.reduce((n, u) => n + u.ids.length, 0);
  const batches = Array.from({ length: Math.ceil(uniques.length / BATCH) }, (_, b) => uniques.slice(b * BATCH, b * BATCH + BATCH));

  console.log(`Tasks: ${tasks.length} total · ${alreadyScored} already scored (skipped) · ${rowCount} to score`);
  console.log(`Distinct (title+owner) signatures to score: ${uniques.length} → ${batches.length} batches of ≤${BATCH}, concurrency ${CONCURRENCY}`);
  if (DRY) {
    console.log('\n--dry-run: sample of what would be scored:');
    for (const u of uniques.slice(0, 8)) console.log(`  • "${u.title}" — ${u.owner || '(no owner)'}${u.family ? ` [${u.family}]` : ''} ×${u.ids.length}`);
    await prisma.$disconnect();
    return;
  }
  if (uniques.length === 0) { console.log('Nothing to score.'); await prisma.$disconnect(); return; }

  const now = new Date();
  let doneBatches = 0, scoredRows = 0, failed = 0;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const samples: { title: string; owner: string; score: number; rationale: string }[] = [];

  await pool(batches, CONCURRENCY, async (batch) => {
    let result: Map<number, { score: number; rationale: string }>;
    try {
      result = await scoreBatch(batch);
    } catch (e) {
      failed += batch.length;
      console.error(`  batch failed: ${(e as Error).message}`);
      return;
    }
    // Persist each signature's score across all its task ids.
    for (let i = 0; i < batch.length; i++) {
      const r = result.get(i);
      if (!r) { failed++; continue; }
      const u = batch[i];
      await prisma.task.updateMany({
        where: { id: { in: u.ids } },
        data: { agentScore: r.score, agentRationale: r.rationale, agentScoredAt: now },
      });
      dist[r.score] = (dist[r.score] ?? 0) + u.ids.length;
      scoredRows += u.ids.length;
      if (samples.length < 24) samples.push({ title: u.title, owner: u.owner, score: r.score, rationale: r.rationale });
    }
    doneBatches++;
    process.stdout.write(`\r  scored ${doneBatches}/${batches.length} batches · ${scoredRows} rows…   `);
  });

  console.log('\n\nDistribution (task rows by score):');
  for (let s = 1; s <= 5; s++) {
    const n = dist[s] ?? 0;
    const pct = scoredRows ? Math.round((n / scoredRows) * 100) : 0;
    console.log(`  ${s}  ${'█'.repeat(Math.round(pct / 2)).padEnd(50)} ${n} (${pct}%)`);
  }
  if (failed) console.log(`  (${failed} signatures could not be scored)`);

  console.log('\nSanity sample:');
  for (const s of samples.sort((a, b) => a.score - b.score)) {
    console.log(`  [${s.score}] "${s.title}" — ${s.owner || '(no owner)'} :: ${s.rationale}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
