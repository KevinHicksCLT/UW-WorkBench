// atomize-deliverables.ts — break grouped/compound Deliverable rows into single
// actionable, testable, applicable deliverables and enrich every deliverable with
// description + owner + contributor(s) + a presence TestingTemplate.
//
// A "compound" title packs 2+ distinct produced artifacts (e.g.
// "Payroll Processing & Administration" = Payroll Processing + Payroll
// Administration). Claude decides split-or-keep per title, names each atomic
// artifact, writes a short description + presence test, and partitions the L5
// tasks between the splits. Single-concept titles (e.g. "Risk, Compliance &
// Audit") are kept as one row and only enriched.
//
// Owner/contributor are derived from each member task's NodeRole rows:
//   owner       = modal Owner role across the split's tasks
//   contributor = union of Participant roles across the split's tasks,
//                 EXCLUDING executive/officer-level roles and the owner.
//
// Idempotent-ish: skips deliverables that already have a description set.
//
// Run (cwd = backend):
//   npx tsx scripts/atomize-deliverables.ts --dry-run --limit 20   # classify+print, no writes
//   npx tsx scripts/atomize-deliverables.ts                         # full apply
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';
const SUFFIX = ' output/record (validated & control sign-off)';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = flag('dry-run');
const LIMIT = Number(opt('limit', '0')) || 0;
const CONCURRENCY = Number(opt('concurrency', '4')) || 4;
const TOP_N = Number(opt('top', '5')) || 5;

// executive / senior roles that should NOT be task-level contributors
const EXEC = /\b(chief|officer|c-?suite|cxo|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio|president|vice[- ]president|vp|head of|head,|director|board)\b/i;
const isExec = (t: string) => EXEC.test(t);

const SYSTEM = `You refine a business "deliverable" catalogue. Each deliverable is the tangible OUTPUT produced by a group of low-level (L5) tasks inside one process. Titles carry a boilerplate suffix "output/record (validated & control sign-off)" — IGNORE and DROP that suffix; judge only the artifact name before it.

Examine the artifact name and the tasks, then choose exactly ONE decision:

1. SPLIT — the name joins two or more DISTINCT artifacts (genuinely different things produced), each backed by its own tasks. Examples: "Payroll Processing & Administration" → "Payroll Processing" + "Payroll Administration"; "Rate Filing & Regulatory Submission" → "Rate Filing" + "Regulatory Submission"; "AML Regulatory Reporting & Recordkeeping" → two. Return one split per distinct artifact and partition the tasks between them (every task assigned to exactly one split).

2. REWORD — the "&"/"and"/comma/slash joins words that describe essentially the SAME single artifact (redundant, overlapping, or one is just an aspect of the other), so splitting would be artificial. Examples: "Access Certification & Periodic Reviews" (periodic reviews ARE the access-certification activity → one artifact) → "Access Certification"; "Monitoring & Oversight" → "Monitoring"; "Policies & Procedures" → "Policies and Procedures" reworded to "Policy Set". Return ONE split whose name has NO "&"/"and", covering ALL tasks.

3. KEEP — the "&" belongs to an ESTABLISHED, indivisible term that would lose meaning if reworded or split. Examples: "Profit & Loss", "Mergers & Acquisitions", "Governance, Risk & Compliance", "Health & Safety", "Research & Development". Return ONE split, name = the established term, covering ALL tasks.

Rules for every split you return:
- name: the concrete single artifact (noun phrase). Build it ONLY from words present in the original title — never invent an artifact the title does not name (no "Audit Trail", "Record", "Report", "Log" unless that word is in the title). For SPLIT and REWORD the name must contain NO "&"/"and" (rephrase; e.g. "Policies & Procedures" → "Procedure Manual" only if faithful, else keep both words without the conjunction). For KEEP the established term may retain "&".
- description: <=25 words — what the single artifact IS (the thing produced), not the activity.
- test: <=25 words — a PRESENCE check a reviewer can use to confirm the artifact exists and is complete/signed-off.
- taskIndexes: indexes of the tasks that produce THIS artifact. For REWORD/KEEP that is ALL indexes.

Set "decision" to "split", "reword", or "keep" accordingly.`;

const TOOL: Anthropic.Tool = {
  name: 'submit_split',
  description: 'Return the atomic deliverable split(s) for one grouped deliverable.',
  input_schema: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['split', 'reword', 'keep'], description: 'split=2+ distinct artifacts; reword=same concept, drop &/and; keep=intrinsic term' },
      splits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string', description: '<=25 words' },
            test: { type: 'string', description: '<=25 words presence check' },
            taskIndexes: { type: 'array', items: { type: 'integer' } },
          },
          required: ['name', 'description', 'test', 'taskIndexes'],
        },
      },
    },
    required: ['decision', 'splits'],
  },
};

type Decision = 'split' | 'reword' | 'keep';
type Split = { name: string; description: string; test: string; taskIndexes: number[] };
type TaskInfo = { id: string; text: string; automatability: string | null; ownerRoleId: string | null; ownerLabel: string; participants: { roleId: string; label: string }[] };
type Deliv = { id: string; title: string; automatability: string | null; vs: string; tasks: TaskInfo[] };

async function classify(d: Deliv): Promise<{ decision: Decision; splits: Split[] }> {
  const lines = d.tasks.map((t, i) => `[${i}] ${t.text}`).join('\n');
  const resp = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'submit_split' },
    messages: [{ role: 'user', content: `Deliverable title: "${d.title}"\nValue stream context: ${d.vs}\n\nTasks that produce it:\n${lines}` }],
  });
  for (const b of resp.content) {
    if (b.type === 'tool_use' && b.name === 'submit_split') {
      const inp = b.input as { decision?: Decision; splits?: Split[] };
      return { decision: inp.decision ?? 'keep', splits: inp.splits ?? [] };
    }
  }
  throw new Error('no tool_use in response');
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (cursor < items.length) { const i = cursor++; await fn(items[i], i); }
  }));
}

// does the artifact name contain a real separator that could join distinct artifacts?
const hasSeparator = (base: string) => /\s&\s|\sand\s|,|\//i.test(base);
// strip residual conjunctions from a non-"keep" name
const deconj = (s: string) => s.replace(/\s*&\s*/g, ' ').replace(/\s+and\s+/gi, ' ').replace(/\s{2,}/g, ' ').trim();

const modal = (xs: (string | null)[]): string | null => {
  const c = new Map<string, number>();
  for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1);
  let best: string | null = null, n = -1;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
};

// Normalise + validate classifier splits against the real task set.
function reconcile(d: Deliv, splits: Split[]): Split[] {
  const N = d.tasks.length;
  let clean = splits.filter((s) => s && s.name && Array.isArray(s.taskIndexes)).map((s) => ({
    ...s,
    taskIndexes: [...new Set(s.taskIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < N))],
  }));
  if (clean.length === 0) clean = [{ name: d.title.replace(SUFFIX, ''), description: '', test: '', taskIndexes: [] }];
  // ensure every task assigned exactly once: drop dupes (first wins), append leftovers to largest split
  const seen = new Set<number>();
  for (const s of clean) s.taskIndexes = s.taskIndexes.filter((i) => (seen.has(i) ? false : (seen.add(i), true)));
  const missing = d.tasks.map((_, i) => i).filter((i) => !seen.has(i));
  if (missing.length) {
    const biggest = clean.reduce((a, b) => (b.taskIndexes.length >= a.taskIndexes.length ? b : a), clean[0]);
    biggest.taskIndexes.push(...missing);
  }
  return clean.filter((s) => s.taskIndexes.length > 0);
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  if (!company) throw new Error('no company');
  console.log(`Company: ${company.name} (${company.id})  MODEL=${MODEL}  ${DRY ? 'DRY-RUN' : 'APPLY'}`);

  let dels = await prisma.deliverable.findMany({
    where: { companyId: company.id },
    include: {
      nodeDeliverables: { include: { processNode: { include: { nodeRoles: { include: { role: { select: { displayValue: true } } } } } } } },
    },
    orderBy: { title: 'asc' },
  });
  // skip already-enriched (description set) unless dry-run
  const already = dels.filter((d) => (d as { description?: string | null }).description).length;
  dels = dels.filter((d) => !(d as { description?: string | null }).description);
  if (LIMIT) dels = dels.slice(0, LIMIT);
  console.log(`Deliverables: ${dels.length} to process · ${already} already enriched (skipped)`);

  // build compact records + VS context (one closure lookup per deliverable's first task)
  const recs: Deliv[] = [];
  for (const d of dels) {
    const tasks: TaskInfo[] = d.nodeDeliverables.map((nd) => {
      const n = nd.processNode;
      const owner = n.nodeRoles.find((r) => r.role_ === 'Owner');
      const parts = n.nodeRoles.filter((r) => r.role_ === 'Participant');
      return {
        id: n.id, text: n.displayValue, automatability: n.automatability,
        ownerRoleId: owner?.roleId ?? null, ownerLabel: owner?.role.displayValue ?? '',
        participants: parts.map((p) => ({ roleId: p.roleId, label: p.role.displayValue })),
      };
    });
    let vs = '';
    if (tasks[0]) {
      const anc = await prisma.processNodeClosure.findMany({
        where: { descendantId: tasks[0].id, depth: { gt: 0 } },
        include: { ancestor: { select: { displayValue: true, processLevelType: { select: { levelNumber: true } } } } },
        orderBy: { depth: 'desc' },
      });
      vs = anc.map((a) => a.ancestor.displayValue).join(' > ');
    }
    recs.push({ id: d.id, title: d.title, automatability: d.automatability, vs, tasks });
  }

  const counts = { split: 0, reword: 0, keep: 0 };
  let newRows = 0, failed = 0, done = 0;
  const samples: string[] = [];

  await pool(recs, CONCURRENCY, async (d) => {
    let splits: Split[];
    let decision: Decision = 'keep';
    try {
      const r = await classify(d);
      decision = r.decision;
      splits = reconcile(d, r.splits);
    } catch (e) {
      failed++; console.error(`\n  classify failed for "${d.title}": ${(e as Error).message}`); return;
    }
    // guard: a title with no separator cannot be split — force single keep
    const base = d.title.replace(SUFFIX, '').trim();
    if (!hasSeparator(base) && splits.length > 1) {
      splits = [{ name: base, description: splits[0]?.description ?? '', test: splits[0]?.test ?? '', taskIndexes: d.tasks.map((_, i) => i) }];
      decision = 'keep';
    }
    // decision must agree with split count
    if (splits.length > 1) decision = 'split';
    else if (decision === 'split') decision = 'reword';
    counts[decision]++;

    // resolve role sets per split
    const built = splits.map((s) => {
      const st = s.taskIndexes.map((i) => d.tasks[i]);
      const ownerRoleId = modal(st.map((t) => t.ownerRoleId));
      // frequency-rank participant roles across this split's tasks; exec + owner excluded; cap to TOP_N
      const freq = new Map<string, number>();
      for (const t of st) for (const p of t.participants) {
        if (p.roleId === ownerRoleId) continue;
        if (isExec(p.label)) continue;
        freq.set(p.roleId, (freq.get(p.roleId) ?? 0) + 1);
      }
      const contribIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map((e) => e[0]);
      const auto = modal(st.map((t) => t.automatability));
      const raw = s.name.replace(SUFFIX, '').trim();
      const name = decision === 'keep' ? raw : deconj(raw);
      return { s, st, ownerRoleId, contribIds, auto, name };
    });

    if (samples.length < 40) {
      samples.push(`[${decision}] "${base}" →\n` + built.map((b) => `    • ${b.name}  [${b.st.length} tasks | owner ${d.tasks.find((t) => t.ownerRoleId === b.ownerRoleId)?.ownerLabel ?? '—'} | ${b.contribIds.length} contrib]`).join('\n'));
    }

    if (DRY) { done++; return; }

    // APPLY
    try {
      await prisma.$transaction(async (tx) => {
        const multi = built.length > 1;
        for (let k = 0; k < built.length; k++) {
          const b = built[k];
          const title = b.name;
          let delId: string;
          if (!multi) {
            // reword/keep: rename original in place, keep id + existing nodeDeliverables
            delId = d.id;
            await tx.deliverable.update({ where: { id: d.id }, data: { title, automatability: b.auto ?? d.automatability } });
          } else {
            const created = await tx.deliverable.create({ data: { companyId: company.id, title, automatability: b.auto } });
            delId = created.id;
            for (const t of b.st) {
              await tx.nodeDeliverable.create({ data: { companyId: company.id, processNodeId: t.id, deliverableId: delId } });
            }
          }
          // description via raw SQL (client may predate the column)
          await tx.$executeRawUnsafe('UPDATE "Deliverable" SET "description" = $1 WHERE "id" = $2', b.s.description || null, delId);
          // owner
          if (b.ownerRoleId) {
            await tx.roleDeliverable.upsert({
              where: { roleId_deliverableId_role_: { roleId: b.ownerRoleId, deliverableId: delId, role_: 'Owner' } },
              create: { companyId: company.id, roleId: b.ownerRoleId, deliverableId: delId, role_: 'Owner' }, update: {},
            });
          }
          // contributors
          for (const rid of b.contribIds) {
            await tx.roleDeliverable.upsert({
              where: { roleId_deliverableId_role_: { roleId: rid, deliverableId: delId, role_: 'Contributor' } },
              create: { companyId: company.id, roleId: rid, deliverableId: delId, role_: 'Contributor' }, update: {},
            });
          }
          // presence test
          if (b.s.test) {
            await tx.testingTemplate.create({ data: { deliverableId: delId, taskNodeId: b.st[0]?.id ?? null, checkType: 'presence', expected: b.s.test } });
          }
          if (multi) newRows++;
        }
        if (built.length > 1) {
          // delete the original grouped deliverable (nodeDeliverables cascade)
          await tx.deliverable.delete({ where: { id: d.id } });
        }
      }, { timeout: 30000 });
    } catch (e) {
      failed++; console.error(`\n  apply failed for "${d.title}": ${(e as Error).message}`); return;
    }
    done++;
    if (done % 25 === 0) process.stdout.write(`\r  processed ${done}/${recs.length} · split=${counts.split} reword=${counts.reword} keep=${counts.keep} · ${newRows} new rows…   `);
  });

  console.log(`\n\nDone. processed=${done} · split=${counts.split} reword=${counts.reword} keep=${counts.keep} · newSplitRows=${newRows} failed=${failed}`);
  console.log('\nSamples:');
  for (const s of samples) console.log('  ' + s);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
