// AAA rollout — applies the reviewed pilot treatment to EVERY L5 task under a
// value stream (default: Technology & Engineering) in one condensed pass per
// task:
//   • one Sonnet call per L5 regroups its action pool into thematic
//     single-actor L6 tasks (doer realism folded into the same call — e.g.
//     architects, not engineers, define NFRs)
//   • every action's Definition of Done absorbs its verification detail
//     ("Done when in <App> <pass condition>"); Verify rows are deleted
//   • each L6: single Owner (created if missing), the main's deliverable
//     links, closure rows, and only the applications its text references
//   • each L5: exactly one Owner; attributes.l6Regrouped marks completion
//     (script is resumable — flagged mains skip)
//   • per L4, one Sonnet dependency pass writes attributes.dependsOn
// Concurrency 8 across mains. Run:
//   npx tsx --env-file=.env scripts/aaa-tech-rollout.ts [l2Id]
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { taskPlans } from '../src/lib/workPlan.js';
import { parseAaaSubTasks } from '../src/lib/subTaskAaa.js';

const L2 = process.argv[2] ?? 'bb67119f-5481-4e4b-9314-0a46acae47e6'; // Technology & Engineering
const L6_TYPE = 'cmqssmorj0003j6a7a77y7wu7';
const CONCURRENCY = 8;
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 3 });

const SYSTEM = [
  'You organize one operating-model task (insurance carrier IT) into L6 sub-groups.',
  'Input: the task name and its pool of atomic actions (current actor, action, apps).',
  'Output: 2-6 thematic L6 tasks that partition the pool — every action index assigned',
  'to EXACTLY one group; each group SINGLE-actor. Names imperative and outcome-shaped',
  '("Document functional requirements", "Provision cloud accounts"), concise, no app',
  'names unless essential, first letter capitalized. Order groups in execution order.',
  'REALISM: keep the given actor unless it is clearly the wrong doer (architects, not',
  'engineers, define NFRs and architecture; compliance analysts own regulatory mapping;',
  'security architects own security requirements) — substitute conservatively and use',
  'exact existing role names where possible. Reply ONLY minified JSON:',
  '{"groups":[{"name":"...","actor":"...","actions":[<idx>,...]},...]}',
].join(' ');

const DEP_SYSTEM = [
  'These tasks form one sub-process of an insurance carrier IT value stream.',
  'Propose dependency edges: which tasks cannot COMPLETE until another has. Only real,',
  'load-bearing input dependencies, max 3 per task, no cycles.',
  'Reply ONLY minified JSON, no markdown: {"deps":[{"task":<index>,"dependsOn":[<index>,...]},...]}',
].join(' ');

const jsonOf = (t: string): unknown =>
  JSON.parse(
    t
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, ''),
  );

async function ask(system: string, prompt: string, maxTokens: number): Promise<string> {
  const r = await ai.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ');
}

// ── Scope ────────────────────────────────────────────────────────────────────
const closure = await prisma.processNodeClosure.findMany({
  where: { ancestorId: L2, depth: { in: [2, 3] } },
  select: { descendantId: true, depth: true },
});
const depthOf = new Map(closure.map((c) => [c.descendantId, c.depth]));
const scopeNodes = await prisma.processNode.findMany({
  where: { id: { in: closure.map((c) => c.descendantId) } },
  select: {
    id: true,
    displayValue: true,
    parentId: true,
    isTask: true,
    attributes: true,
    companyId: true,
    automatability: true,
  },
});
const l4s = scopeNodes.filter((n) => depthOf.get(n.id) === 2 && !n.isTask);
const mains = scopeNodes.filter(
  (n) =>
    depthOf.get(n.id) === 3 &&
    n.isTask &&
    (n.attributes as { l6Regrouped?: boolean } | null)?.l6Regrouped !== true,
);
const companyId = scopeNodes[0].companyId;
console.log(`scope: ${l4s.length} L4s, ${mains.length} L5 mains to process`);

const catalog = await prisma.application.findMany({
  where: { companyId },
  select: { id: true, name: true },
});
const appRegex = catalog.map((c) => ({
  ...c,
  re: new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
}));

const roleCache = new Map<string, string>();
async function roleId(name: string): Promise<string> {
  const hit = roleCache.get(name);
  if (hit) return hit;
  let r = await prisma.role.findFirst({
    where: { companyId, displayValue: name },
    select: { id: true },
  });
  r ??= await prisma.role.create({
    data: { companyId, dbValue: name, displayValue: name },
    select: { id: true },
  });
  roleCache.set(name, r.id);
  return r.id;
}

type Pool = {
  actor: string;
  action: string;
  steps: string[];
  doneWhen: string | null;
  passWhen: string | null;
  apps: string[];
  actionRowId: string;
  verifyRowId: string | null;
}[];

let processed = 0;
let failed = 0;

async function processMain(main: (typeof mains)[number]): Promise<void> {
  const plan = (await taskPlans([main.id], {})).get(main.id);
  if (!plan) return;
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: main.id, templateKeyId: null, NOT: { customKey: null } },
    select: { id: true, customKey: true, kind: true },
  });
  const byN = new Map<number, { action?: string; verify?: string }>();
  for (const r of rows) {
    const m = r.customKey!.match(/^(\d+)\. (Verify[ :])?/);
    if (!m) continue;
    const e = byN.get(Number(m[1])) ?? {};
    if (m[2] || r.kind === 'TEST') e.verify = r.id;
    else e.action = r.id;
    byN.set(Number(m[1]), e);
  }
  const { subTasks } = parseAaaSubTasks(
    plan.checklist,
    plan.testing,
    catalog.map((c) => c.name),
  );
  const pool: Pool = [];
  for (const s of subTasks) {
    const ids = byN.get(s.n);
    if (!ids?.action) continue;
    pool.push({
      actor: s.actor ?? 'Unknown',
      action: s.action,
      steps: s.steps,
      doneWhen: s.doneWhen,
      passWhen: s.verify?.passWhen ?? null,
      apps: s.apps,
      actionRowId: ids.action,
      verifyRowId: ids.verify ?? null,
    });
  }
  if (pool.length < 2) return;

  let groups: { name: string; actor: string; actions: number[] }[] = [];
  try {
    const text = await ask(
      SYSTEM,
      `Task: "${main.displayValue}"\nActions:\n${pool
        .map(
          (p, i) =>
            `${i}: [${p.actor}] ${p.action}${p.apps.length ? ` (${p.apps.join(', ')})` : ''}`,
        )
        .join('\n')}`,
      2500,
    );
    groups = (jsonOf(text) as { groups: typeof groups }).groups ?? [];
  } catch {
    groups = [];
  }
  const seen = new Set<number>();
  let valid = groups.length >= 1;
  for (const g of groups) {
    if (!g.name || !g.actor) valid = false;
    for (const i of g.actions ?? []) {
      if (!pool[i] || seen.has(i)) valid = false;
      seen.add(i);
    }
  }
  if (!valid || seen.size !== pool.length) {
    // Deterministic fallback: one group per current actor.
    const byActor = new Map<string, number[]>();
    pool.forEach((p, i) => byActor.set(p.actor, [...(byActor.get(p.actor) ?? []), i]));
    groups = [...byActor.entries()].map(([actor, actions]) => ({
      name: `${main.displayValue} — ${actor}`,
      actor,
      actions,
    }));
    failed += 1;
  }

  const [ancestors, delivLinks] = await Promise.all([
    prisma.processNodeClosure.findMany({
      where: { descendantId: main.id },
      select: { ancestorId: true, depth: true },
    }),
    prisma.nodeDeliverable.findMany({
      where: { processNodeId: main.id },
      select: { deliverableId: true },
    }),
  ]);

  const usedNames = new Set<string>();
  let gi = 0;
  for (const g of groups) {
    gi += 1;
    let name = g.name.trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    while (usedNames.has(name.toLowerCase())) name = `${name} (${gi})`;
    usedNames.add(name.toLowerCase());
    const rid = await roleId(g.actor.trim());
    const node = await prisma.$transaction(async (tx) => {
      const n = await tx.processNode.create({
        data: {
          companyId,
          parentId: main.id,
          processLevelTypeId: L6_TYPE,
          dbValue: name,
          displayValue: name,
          isTask: true,
          sortOrder: gi,
          automatability: main.automatability,
        },
        select: { id: true },
      });
      await tx.processNodeClosure.createMany({
        data: [
          { ancestorId: n.id, descendantId: n.id, depth: 0 },
          ...ancestors.map((a) => ({
            ancestorId: a.ancestorId,
            descendantId: n.id,
            depth: a.depth + 1,
          })),
        ],
      });
      await tx.nodeRole.create({
        data: { companyId, processNodeId: n.id, roleId: rid, role_: 'Owner' },
      });
      if (delivLinks.length)
        await tx.nodeDeliverable.createMany({
          data: delivLinks.map((d) => ({
            companyId,
            processNodeId: n.id,
            deliverableId: d.deliverableId,
          })),
        });
      return n;
    });
    let k = 0;
    const groupText: string[] = [];
    for (const idx of g.actions) {
      const p = pool[idx];
      k += 1;
      const cond = p.passWhen ?? p.doneWhen ?? 'the action is complete';
      const app = p.apps[0];
      const value = [
        `By the ${g.actor.trim()}:`,
        ...p.steps.map((s, i) => `${i + 1}) ${s}`),
        `Done when${app ? ` in ${app}` : ''} ${cond}`,
      ].join('\n');
      groupText.push(`${p.action}\n${p.steps.join('\n')}`);
      await prisma.nodeTemplateAnswer.update({
        where: { id: p.actionRowId },
        data: {
          processNodeId: node.id,
          customKey: `${k}. ${p.action}`,
          value,
          kind: 'CHECKLIST',
          sortOrder: 100 + k * 10,
        },
      });
      if (p.verifyRowId) await prisma.nodeTemplateAnswer.delete({ where: { id: p.verifyRowId } });
    }
    const text = groupText.join('\n');
    const appIds = appRegex.filter((a) => a.re.test(text)).map((a) => a.id);
    if (appIds.length)
      await prisma.nodeAppUsage.createMany({
        data: appIds.map((id) => ({
          companyId,
          processNodeId: node.id,
          applicationId: id,
          usageType: 'performed',
        })),
      });
  }

  // L5: exactly one Owner (keep the existing Owner, else the majority actor).
  const links = await prisma.nodeRole.findMany({
    where: { processNodeId: main.id },
    select: { id: true, roleId: true, role_: true },
  });
  let ownerRoleId = links.find((l) => l.role_ === 'Owner')?.roleId ?? null;
  if (!ownerRoleId) {
    const counts = new Map<string, number>();
    for (const p of pool) counts.set(p.actor, (counts.get(p.actor) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    ownerRoleId = top ? await roleId(top) : null;
  }
  if (ownerRoleId) {
    await prisma.nodeRole.deleteMany({
      where: { processNodeId: main.id, NOT: { roleId: ownerRoleId } },
    });
    const keep = await prisma.nodeRole.findFirst({
      where: { processNodeId: main.id, roleId: ownerRoleId },
      select: { id: true },
    });
    if (keep) await prisma.nodeRole.update({ where: { id: keep.id }, data: { role_: 'Owner' } });
    else
      await prisma.nodeRole.create({
        data: { companyId, processNodeId: main.id, roleId: ownerRoleId, role_: 'Owner' },
      });
  }

  const attrs = (main.attributes ?? {}) as Prisma.JsonObject;
  await prisma.processNode.update({
    where: { id: main.id },
    data: { attributes: { ...attrs, l6Regrouped: true } },
  });
  processed += 1;
  if (processed % 25 === 0)
    console.log(`progress: ${processed}/${mains.length} mains (fallbacks: ${failed})`);
}

// Worker pool over mains.
let cursor = 0;
async function worker(): Promise<void> {
  for (;;) {
    const i = cursor++;
    if (i >= mains.length) return;
    try {
      await processMain(mains[i]);
    } catch (e) {
      console.log(`ERROR "${mains[i].displayValue}": ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`mains done: ${processed} processed, ${failed} fallback groupings`);

// ── Dependency pass per L4 ───────────────────────────────────────────────────
for (const l4 of l4s) {
  const kids = await prisma.processNode.findMany({
    where: { parentId: l4.id, isTask: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, displayValue: true, attributes: true },
  });
  if (kids.length < 2) continue;
  if (kids.some((k) => Array.isArray((k.attributes as { dependsOn?: unknown } | null)?.dependsOn)))
    continue;
  try {
    const text = await ask(
      DEP_SYSTEM,
      `Sub-process: "${l4.displayValue}"\n${kids.map((k, i) => `${i}: "${k.displayValue}"`).join('\n')}`,
      2000,
    );
    const deps = (jsonOf(text) as { deps?: { task: number; dependsOn: number[] }[] }).deps ?? [];
    for (const d of deps) {
      const t = kids[d.task];
      if (!t) continue;
      const ids = (d.dependsOn ?? [])
        .filter((i) => Number.isInteger(i) && kids[i] && i !== d.task)
        .slice(0, 3)
        .map((i) => kids[i].id);
      if (!ids.length) continue;
      const attrs = (t.attributes ?? {}) as Prisma.JsonObject;
      await prisma.processNode.update({
        where: { id: t.id },
        data: { attributes: { ...attrs, dependsOn: ids } },
      });
    }
    console.log(`deps: ${l4.displayValue}`);
  } catch (e) {
    console.log(`deps FAILED ${l4.displayValue}: ${(e as Error).message}`);
  }
}

const l6Total = await prisma.processNodeClosure.count({
  where: { ancestorId: L2, depth: 4 },
});
console.log(`\nDONE. L6 nodes under the value stream: ${l6Total}`);
await prisma.$disconnect();
