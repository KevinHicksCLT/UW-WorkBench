// enrich-standards.ts — turn every leaf Standard into a fully-specified,
// independently testable + applicable control. For each leaf, Claude (grounded
// in the standard's own text + the live value-stream catalog + the role catalog)
// produces:
//   • testProcedure — concrete, ordered verification steps (how you prove it)
//   • evidence      — the audit artifact that proof leaves behind
//   • applierRoles  — the role(s) that EXECUTE/apply the control day-to-day
//                     (distinct from the accountable OWNER already on ownerRoleId)
//   • valueStreams  — the specific L2/L3 process node(s) the control governs
//
// Writes: Standard.testProcedure / Standard.evidence, RoleStandard rows (the
// appliers), and NodeStandard rows (the governed value-stream processes). Owner
// stays on Standard.ownerRoleId; this only adds the appliers + VS + test/evidence.
//
// Idempotent: by default only enriches leaves with no testProcedure yet; --force
// re-does everything (and replaces that leaf's RoleStandard/NodeStandard links).
// Ground truth is the live DB; text is grounded per-standard, never templated.
//
// Run (cwd = backend):
//   npx tsx scripts/enrich-standards.ts --area "Information Security" --dry-run
//   npx tsx scripts/enrich-standards.ts --area "Information Security"
//   npx tsx scripts/enrich-standards.ts --area "Information Security" --limit 8
//   npx tsx scripts/enrich-standards.ts                      # every area, gaps only
//   npx tsx scripts/enrich-standards.ts --force
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';
import { buildRoleResolver } from '../src/lib/roleMatch.js';

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = flag('dry-run');
const FORCE = flag('force');
const AREA = opt('area', '');
const LIMIT = Number(opt('limit', '0')) || 0;
const BATCH = Number(opt('batch', '6')) || 6;
const CONCURRENCY = Number(opt('concurrency', '4')) || 4;
const COMPANY = opt('company', '');

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const SYSTEM = `You are a senior insurance compliance + software-delivery architect specifying internal control standards for a US insurer's operating model. For each standard you are given, you produce the artifacts that make it INDEPENDENTLY TESTABLE and clearly APPLICABLE. You are precise, concrete, and domain-specific — every word reflects THIS control, never a generic template. You never invent controls beyond the one given.

For each standard return, via the tool:
- testSteps: 2–4 ordered, concrete verification steps an auditor/reviewer performs to prove THIS control is met. Each step is a short imperative sentence naming what to inspect/sample/attempt and the pass condition. Specific to the control's subject (e.g. a cipher, an SLA number, a scan, an approval).
- evidence: ONE sentence naming the concrete artifact the verification leaves behind (report/export/log/record/screenshot with what it must show).
- applierRoles: 1–3 job titles of the people who EXECUTE/apply this control in day-to-day delivery or operations — NOT the accountable owner/executive. Use realistic insurer/IT role titles (e.g. "Security Engineer", "DevOps Engineer", "Claims Adjuster", "Application Developer"). Prefer the hands-on doer.
- nodeRefs: the numbers (1–3) from the VALUE-STREAM CATALOG identifying the process area(s) this control actually governs. Prefer a specific L3 Process; also include its L2 Division when helpful. Only pick nodes the control genuinely applies to. A broadly cross-cutting control may pick the 2–3 most central process areas — do NOT list everything.`;

type Out = { i: number; testSteps: string[]; evidence: string; applierRoles: string[]; nodeRefs: number[] };

const TOOL: Anthropic.Tool = {
  name: 'submit_standards',
  description: 'Return the testability + applicability spec for every standard index provided.',
  input_schema: {
    type: 'object',
    properties: {
      standards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer', description: 'the standard index from the prompt' },
            testSteps: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
            evidence: { type: 'string' },
            applierRoles: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
            nodeRefs: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3 },
          },
          required: ['i', 'testSteps', 'evidence', 'applierRoles', 'nodeRefs'],
        },
      },
    },
    required: ['standards'],
  },
};

async function callBatch(catalog: string, rows: { name: string; category: string | null; description: string | null; ownerLabel: string | null }[]): Promise<Out[]> {
  const list = rows.map((r, i) =>
    `#${i + 1} — ${r.name}  [category: ${r.category ?? '—'}]${r.ownerLabel ? `  [owner: ${r.ownerLabel}]` : ''}\n   ${(r.description ?? '').trim()}`,
  ).join('\n\n');
  const prompt = `VALUE-STREAM CATALOG (pick nodeRefs from these numbers):\n${catalog}\n\nSTANDARDS TO SPECIFY (${rows.length}):\n${list}\n\nReturn a spec for every standard index #1..#${rows.length}.`;
  const msg = await anthropic().messages.create({
    model: MODEL, max_tokens: 4096, system: SYSTEM,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'submit_standards' },
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new Error('no tool_use in response');
  return (block.input as { standards: Out[] }).standards;
}

async function main() {
  const company = await prisma.company.findFirst({
    where: COMPANY ? { id: COMPANY } : {}, orderBy: { createdAt: 'asc' }, select: { id: true, name: true },
  });
  if (!company) throw new Error('no company');
  const cid = company.id;
  console.log(`company: ${company.name} (${cid})  model=${MODEL}  ${DRY ? '[DRY RUN]' : ''}`);

  // Value-stream catalog: L2 Division + L3 Process nodes (the mappable grain).
  const plts = await prisma.processLevelType.findMany({ where: { companyId: cid }, select: { id: true, levelNumber: true } });
  const l2l3 = plts.filter((p) => p.levelNumber === 2 || p.levelNumber === 3).map((p) => p.id);
  const nodes = await prisma.processNode.findMany({
    where: { companyId: cid, processLevelTypeId: { in: l2l3 } },
    select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } }, parent: { select: { displayValue: true } } },
    orderBy: [{ sortOrder: 'asc' }],
  });
  // Stable index → node. Catalog lines number from 1.
  const catNodes = nodes.map((n) => ({ id: n.id, label: `L${n.processLevelType.levelNumber} ${n.displayValue}${n.parent ? ` (in ${n.parent.displayValue})` : ''}` }));
  const catalog = catNodes.map((n, i) => `${i + 1}. ${n.label}`).join('\n');

  // Role resolver over the company's roles (displayValue = the title text).
  const roles = await prisma.role.findMany({ where: { companyId: cid }, select: { id: true, displayValue: true } });
  const resolveRole = buildRoleResolver(roles.map((r) => ({ id: r.id, name: r.displayValue })));

  // Target leaves.
  const leaves = await prisma.standard.findMany({
    where: {
      companyId: cid, isArea: false, children: { none: {} },
      ...(AREA ? { department: AREA } : {}),
      ...(FORCE ? {} : { testProcedure: null }),
    },
    orderBy: [{ department: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true, description: true, ownerLabel: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`leaves to enrich: ${leaves.length}${AREA ? ` (area="${AREA}")` : ''}`);
  if (!leaves.length) return;
  if (DRY) {
    console.log('sample catalog head:\n' + catNodes.slice(0, 6).map((n, i) => `${i + 1}. ${n.label}`).join('\n'));
    console.log('\nsample leaves:', leaves.slice(0, 5).map((l) => l.name));
    return;
  }

  // Batch + bounded concurrency.
  const batches: typeof leaves[] = [];
  for (let i = 0; i < leaves.length; i += BATCH) batches.push(leaves.slice(i, i + BATCH));

  let done = 0, roleLinks = 0, nodeLinks = 0, unresolvedRoles = new Set<string>();
  const runBatch = async (batch: typeof leaves) => {
    let outs: Out[];
    try { outs = await callBatch(catalog, batch); }
    catch (e) { console.error(`  batch failed (${batch[0]?.name}…):`, (e as Error).message); return; }
    const byIdx = new Map(outs.map((o) => [o.i, o]));
    for (let i = 0; i < batch.length; i++) {
      const leaf = batch[i];
      const o = byIdx.get(i + 1);
      if (!o) { console.warn(`  no output for #${i + 1} ${leaf.name}`); continue; }
      const testProcedure = o.testSteps.map((s) => s.trim().replace(/^[-•\d.\s]+/, '')).filter(Boolean).join('\n');
      const applierIds: string[] = [];
      for (const rt of o.applierRoles) { const m = resolveRole(rt); if (m) applierIds.push(m.id); else unresolvedRoles.add(rt); }
      const nodeIds = [...new Set(o.nodeRefs.map((n) => catNodes[n - 1]?.id).filter((x): x is string => !!x))];
      const roleIds = [...new Set(applierIds)];

      await prisma.$transaction(async (tx) => {
        await tx.standard.update({ where: { id: leaf.id }, data: { testProcedure, evidence: o.evidence.trim() } });
        if (FORCE) {
          await tx.roleStandard.deleteMany({ where: { standardId: leaf.id } });
          await tx.nodeStandard.deleteMany({ where: { standardId: leaf.id } });
        }
        for (const roleId of roleIds) {
          await tx.roleStandard.upsert({
            where: { roleId_standardId: { roleId, standardId: leaf.id } },
            create: { companyId: cid, roleId, standardId: leaf.id }, update: {},
          });
        }
        for (const processNodeId of nodeIds) {
          await tx.nodeStandard.upsert({
            where: { processNodeId_standardId: { processNodeId, standardId: leaf.id } },
            create: { companyId: cid, processNodeId, standardId: leaf.id }, update: {},
          });
        }
      });
      roleLinks += roleIds.length; nodeLinks += nodeIds.length; done++;
    }
    console.log(`  …${done}/${leaves.length}`);
  };

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map(runBatch));
  }
  console.log(`\nDONE: enriched ${done} standards · ${roleLinks} applier links · ${nodeLinks} VS links`);
  if (unresolvedRoles.size) console.log(`unresolved applier titles (${unresolvedRoles.size}): ${[...unresolvedRoles].slice(0, 40).join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
