// AAA pilot pipeline — applies the whole reviewed treatment to EVERY task
// under one L4 (pilot: Business Analysis & Requirements Elaboration):
//   1. actor split      — one role per task; each non-majority actor's
//                         sub-tasks move to a new sibling task it owns
//   2. verify extraction— foreign-actor Verify rows collect into one
//                         verification task per verifying actor
//   3. single owner     — owner = the doer; all other role links drop
//   4. AI realism       — Sonnet reviews each task: is the named actor the
//                         realistic doer (architect vs engineer)? applies
//                         role substitutions, creating roles as needed
//   5. app depth        — Sonnet adds authoring-tool detail (Word/Excel/…)
//                         where an artifact is clearly authored outside its
//                         container; links narrow to what text references
//   6. dependencies     — one Sonnet pass proposes dependsOn edges across
//                         the final task set; stored on attributes.dependsOn
// Idempotent by construction (name guards, rule-driven rewrites). Run:
//   npx tsx --env-file=.env scripts/aaa-pipeline-l4.ts
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { taskPlans } from '../src/lib/workPlan.js';
import { parseAaaSubTasks, type AaaSubTask } from '../src/lib/subTaskAaa.js';

const L4 = '73fd2dd4-2e01-4ca5-b4b2-3d4d3569d237';
const MODEL = 'claude-sonnet-5';
const NAME_MODEL = 'claude-haiku-4-5';
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 2 });

const jsonOf = (text: string): unknown =>
  JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, ''),
  );

async function ask(
  model: string,
  system: string,
  prompt: string,
  maxTokens = 1500,
): Promise<string> {
  const r = await ai.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ');
}

type TaskRow = {
  id: string;
  displayValue: string;
  companyId: string;
  processLevelTypeId: string;
  sortOrder: number | null;
  automatability: string | null;
  attributes: Prisma.JsonValue;
};

const roleCache = new Map<string, string>();
async function roleId(
  companyId: string,
  name: string,
  homeOrgUnit: string | null,
): Promise<string> {
  const hit = roleCache.get(name);
  if (hit) return hit;
  let r = await prisma.role.findFirst({
    where: { companyId, displayValue: name },
    select: { id: true },
  });
  r ??= await prisma.role.create({
    data: { companyId, dbValue: name, displayValue: name, orgUnitId: homeOrgUnit },
    select: { id: true },
  });
  roleCache.set(name, r.id);
  return r.id;
}

async function newSibling(
  src: TaskRow,
  name: string,
  ownerRoleId: string,
  sortOrder: number,
): Promise<string> {
  const [ancestors, delivLinks] = await Promise.all([
    prisma.processNodeClosure.findMany({
      where: { descendantId: src.id, depth: { gt: 0 } },
      select: { ancestorId: true, depth: true },
    }),
    prisma.nodeDeliverable.findMany({
      where: { processNodeId: src.id },
      select: { deliverableId: true },
    }),
  ]);
  return prisma.$transaction(async (tx) => {
    const n = await tx.processNode.create({
      data: {
        companyId: src.companyId,
        parentId: L4,
        processLevelTypeId: src.processLevelTypeId,
        dbValue: name,
        displayValue: name,
        isTask: true,
        sortOrder,
        automatability: src.automatability,
      },
      select: { id: true },
    });
    await tx.processNodeClosure.createMany({
      data: [
        { ancestorId: n.id, descendantId: n.id, depth: 0 },
        ...ancestors.map((a) => ({ ancestorId: a.ancestorId, descendantId: n.id, depth: a.depth })),
      ],
    });
    await tx.nodeRole.create({
      data: { companyId: src.companyId, processNodeId: n.id, roleId: ownerRoleId, role_: 'Owner' },
    });
    await tx.nodeDeliverable.createMany({
      data: delivLinks.map((d) => ({
        companyId: src.companyId,
        processNodeId: n.id,
        deliverableId: d.deliverableId,
      })),
    });
    return n.id;
  });
}

/** Custom answer rows of a task keyed by leading number. */
async function answersByN(taskId: string) {
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: taskId, templateKeyId: null, NOT: { customKey: null } },
    select: { id: true, customKey: true, kind: true },
  });
  const map = new Map<number, { action?: string; verify?: string }>();
  for (const a of rows) {
    const m = a.customKey!.match(/^(\d+)\. (Verify: )?/);
    if (!m) continue;
    const e = map.get(Number(m[1])) ?? {};
    if (m[2] || a.kind === 'TEST') e.verify = a.id;
    else e.action = a.id;
    map.set(Number(m[1]), e);
  }
  return map;
}

async function renumber(
  list: AaaSubTask[],
  byN: Map<number, { action?: string; verify?: string }>,
  nodeId: string,
) {
  let k = 0;
  for (const s of [...list].sort((a, b) => a.n - b.n)) {
    k += 1;
    const ids = byN.get(s.n);
    if (ids?.action)
      await prisma.nodeTemplateAnswer.update({
        where: { id: ids.action },
        data: { processNodeId: nodeId, customKey: `${k}. ${s.action}`, sortOrder: 100 + k * 10 },
      });
    if (ids?.verify)
      await prisma.nodeTemplateAnswer.update({
        where: { id: ids.verify },
        data: {
          processNodeId: nodeId,
          customKey: `${k}. Verify: ${s.action}`,
          sortOrder: 105 + k * 10,
        },
      });
  }
}

const loadTasks = () =>
  prisma.processNode.findMany({
    where: { parentId: L4, isTask: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      displayValue: true,
      companyId: true,
      processLevelTypeId: true,
      sortOrder: true,
      automatability: true,
      attributes: true,
    },
  });

// ═══ Phase 1+2+3: deterministic split / verify extraction / single owner ═════
let tasks = await loadTasks();
const companyId = tasks[0].companyId;
const appNamesFor = async (taskId: string) =>
  (
    await prisma.nodeAppUsage.findMany({
      where: { processNodeId: taskId },
      select: { application: { select: { name: true } } },
    })
  ).map((a) => a.application.name);

const isVerifyTask = (name: string) => /^verify\b/i.test(name);
// Per-actor verification sink. Seed with any existing "Verify …" task's owner.
const verifySink = new Map<string, string>(); // actor → taskId
for (const t of tasks.filter((t) => isVerifyTask(t.displayValue))) {
  const owner = await prisma.nodeRole.findFirst({
    where: { processNodeId: t.id, role_: 'Owner' },
    select: { role: { select: { displayValue: true } } },
  });
  if (owner) verifySink.set(owner.role.displayValue, t.id);
}

let sortCursor = Math.max(...tasks.map((t) => t.sortOrder ?? 0)) + 1;
for (const t of tasks) {
  if (isVerifyTask(t.displayValue)) continue;
  const plan = (await taskPlans([t.id], {})).get(t.id)!;
  const apps = await appNamesFor(t.id);
  const { subTasks } = parseAaaSubTasks(plan.checklist, plan.testing, apps);
  if (!subTasks.length) continue;
  const byN = await answersByN(t.id);

  // Actor groups: majority keeps the task, the rest split out.
  const byActor = new Map<string, AaaSubTask[]>();
  for (const s of subTasks) {
    const a = s.actor ?? 'Unknown';
    byActor.set(a, [...(byActor.get(a) ?? []), s]);
  }
  const groups = [...byActor.entries()].sort((a, b) => b[1].length - a[1].length);
  const [keeperActor, keeperList] = groups[0];
  const ownerOrg = await prisma.nodeRole.findFirst({
    where: { processNodeId: t.id, role_: 'Owner' },
    select: { role: { select: { orgUnitId: true } } },
  });
  const homeOrg = ownerOrg?.role.orgUnitId ?? null;

  for (const [actor, list] of groups.slice(1)) {
    const rid = await roleId(companyId, actor, homeOrg);
    let name: string;
    if (list.length === 1) name = list[0].action;
    else {
      name = await ask(
        NAME_MODEL,
        'Reply with ONLY a concise task name, max 8 words, imperative verb first, no quotes.',
        `The ${actor}'s sub-tasks being split out of "${t.displayValue}":\n${list.map((s) => `- ${s.action}`).join('\n')}`,
        60,
      ).then((s) => s.trim());
      if (!name || name.length > 90) name = `${list[0].action} (+${list.length - 1} related)`;
    }
    const dup = await prisma.processNode.findFirst({
      where: { parentId: L4, displayValue: name },
      select: { id: true },
    });
    const nodeId = dup?.id ?? (await newSibling(t, name, rid, sortCursor++));
    await renumber(list, byN, nodeId);
    console.log(`split  "${t.displayValue}" → "${name}" (${actor}, ${list.length})`);
  }
  await renumber(keeperList, byN, t.id);

  // Single owner = keeper actor.
  const rid = await roleId(companyId, keeperActor, homeOrg);
  await prisma.nodeRole.deleteMany({ where: { processNodeId: t.id, NOT: { roleId: rid } } });
  const link = await prisma.nodeRole.findFirst({
    where: { processNodeId: t.id, roleId: rid },
    select: { id: true },
  });
  if (link) await prisma.nodeRole.update({ where: { id: link.id }, data: { role_: 'Owner' } });
  else
    await prisma.nodeRole.create({
      data: { companyId, processNodeId: t.id, roleId: rid, role_: 'Owner' },
    });
}

// Verify extraction across ALL (post-split) tasks.
tasks = await loadTasks();
for (const t of tasks) {
  if (isVerifyTask(t.displayValue)) continue;
  const owner = await prisma.nodeRole.findFirst({
    where: { processNodeId: t.id, role_: 'Owner' },
    select: { role: { select: { displayValue: true, orgUnitId: true } } },
  });
  const verifyRows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: t.id, kind: 'TEST', customKey: { contains: 'Verify: ' } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, customKey: true, value: true },
  });
  for (const r of verifyRows) {
    const actor = r.value?.match(/^By the ([^:\n]+):?$/im)?.[1]?.trim();
    if (!actor || actor === owner?.role.displayValue) continue;
    let sink = verifySink.get(actor);
    if (!sink) {
      const rid = await roleId(companyId, actor, owner?.role.orgUnitId ?? null);
      sink = await newSibling(t, `Verify elaboration outputs — ${actor}`, rid, sortCursor++);
      verifySink.set(actor, sink);
      console.log(`verify sink created for ${actor}`);
    }
    const count = await prisma.nodeTemplateAnswer.count({
      where: { processNodeId: sink, templateKeyId: null },
    });
    const action = r.customKey!.replace(/^\d+\. Verify: /, '');
    await prisma.nodeTemplateAnswer.update({
      where: { id: r.id },
      data: {
        processNodeId: sink,
        kind: 'CHECKLIST',
        customKey: `${count + 1}. Verify ${action.charAt(0).toLowerCase()}${action.slice(1)}`,
        sortOrder: 100 + (count + 1) * 10,
      },
    });
  }
}

// ═══ Phase 4+5: AI realism + authoring-tool depth, per task ══════════════════
tasks = await loadTasks();
const catalogRows = await prisma.application.findMany({
  where: { companyId },
  select: { id: true, name: true },
});
const catalogNames = catalogRows.map((c) => c.name);

const REALISM_SYSTEM = [
  'You review one operating-model task for an insurance carrier IT organization.',
  'Two checks. (1) REALISM: is the named actor the role that would really do each sub-task',
  '(e.g. architects, not engineers, define NFRs and architecture; compliance analysts own',
  'regulatory mapping)? Substitute ONLY when clearly wrong. (2) AUTHORING DEPTH: where an',
  'artifact is clearly AUTHORED in a desktop/authoring tool before landing in its container',
  'system (documents drafted in Microsoft Word, models drawn in a diagram tool, matrices',
  'built in Microsoft Excel), rewrite the sub-task body to name that tool and the publish',
  'path. Keep the exact text convention: "By the <role>:" line, numbered "1)" steps,',
  'final "Done when …" (or "Pass when …") line. Be conservative — no invented process.',
  'Reply ONLY JSON: {"roleSubstitutions":[{"from":"...","to":"..."}],',
  '"rewrites":[{"n":<sub-task number>,"value":"<full replacement body>"}],',
  '"newApps":["..."]} — empty arrays when nothing warrants change.',
].join(' ');

for (const t of tasks) {
  const plan = (await taskPlans([t.id], {})).get(t.id)!;
  const apps = await appNamesFor(t.id);
  const { subTasks } = parseAaaSubTasks(
    plan.checklist,
    plan.testing,
    apps.length ? apps : catalogNames,
  );
  if (!subTasks.length) continue;
  const owner = await prisma.nodeRole.findFirst({
    where: { processNodeId: t.id, role_: 'Owner' },
    select: { role: { select: { displayValue: true, orgUnitId: true } } },
  });
  const byN = await answersByN(t.id);
  const body = subTasks
    .map(
      (s) =>
        `#${s.n} ${s.action}\nBy the ${s.actor}:\n${s.steps.map((x, i) => `${i + 1}) ${x}`).join('\n')}\n${s.doneWhen ? `Done when ${s.doneWhen}` : ''}`,
    )
    .join('\n\n');
  let parsed: {
    roleSubstitutions?: { from: string; to: string }[];
    rewrites?: { n: number; value: string }[];
    newApps?: string[];
  };
  try {
    parsed = jsonOf(
      await ask(
        MODEL,
        REALISM_SYSTEM,
        `Task: "${t.displayValue}" (owner: ${owner?.role.displayValue}).\nKnown applications: ${catalogNames.join(', ')}.\n\nSub-tasks:\n${body}`,
        3000,
      ),
    ) as typeof parsed;
  } catch {
    console.log(`AI pass skipped (bad JSON) for "${t.displayValue}"`);
    continue;
  }
  for (const app of parsed.newApps ?? []) {
    if (!catalogNames.some((c) => c.toLowerCase() === app.toLowerCase())) {
      const row = await prisma.application.create({
        data: { companyId, name: app, kind: 'Tool', isInternal: false },
        select: { id: true, name: true },
      });
      catalogRows.push(row);
      catalogNames.push(row.name);
      console.log(`app created: ${app}`);
    }
  }
  for (const rw of parsed.rewrites ?? []) {
    const ids = byN.get(rw.n);
    if (!ids?.action || !rw.value?.includes('By the ')) continue;
    await prisma.nodeTemplateAnswer.update({
      where: { id: ids.action },
      data: { value: rw.value },
    });
  }
  for (const sub of parsed.roleSubstitutions ?? []) {
    if (!sub.from || !sub.to || sub.from === sub.to) continue;
    const answers = await prisma.nodeTemplateAnswer.findMany({
      where: {
        processNodeId: t.id,
        templateKeyId: null,
        value: { contains: `By the ${sub.from}` },
      },
      select: { id: true, value: true },
    });
    for (const a of answers)
      await prisma.nodeTemplateAnswer.update({
        where: { id: a.id },
        data: { value: a.value!.replaceAll(`By the ${sub.from}`, `By the ${sub.to}`) },
      });
    if (owner?.role.displayValue === sub.from) {
      const rid = await roleId(companyId, sub.to, owner.role.orgUnitId ?? null);
      await prisma.nodeRole.deleteMany({ where: { processNodeId: t.id } });
      await prisma.nodeRole.create({
        data: { companyId, processNodeId: t.id, roleId: rid, role_: 'Owner' },
      });
      console.log(`owner "${t.displayValue}": ${sub.from} → ${sub.to}`);
    }
  }
}

// App links narrow to text references, all tasks.
tasks = await loadTasks();
for (const t of tasks) {
  const answers = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: t.id, templateKeyId: null, NOT: { customKey: null } },
    select: { customKey: true, value: true },
  });
  const text = answers.map((a) => `${a.customKey}\n${a.value ?? ''}`).join('\n');
  const referenced = catalogRows.filter((c) =>
    new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
  );
  const links = await prisma.nodeAppUsage.findMany({
    where: { processNodeId: t.id },
    select: { id: true, applicationId: true },
  });
  const refIds = new Set(referenced.map((r) => r.id));
  const stale = links.filter((l) => !refIds.has(l.applicationId));
  if (stale.length)
    await prisma.nodeAppUsage.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  const have = new Set(links.map((l) => l.applicationId));
  const missing = referenced.filter((r) => !have.has(r.id));
  if (missing.length)
    await prisma.nodeAppUsage.createMany({
      data: missing.map((m) => ({
        companyId,
        processNodeId: t.id,
        applicationId: m.id,
        usageType: 'performed',
      })),
    });
}

// ═══ Phase 6: dependencies across the final task set ═════════════════════════
tasks = await loadTasks();
const owners = await prisma.nodeRole.findMany({
  where: { processNodeId: { in: tasks.map((t) => t.id) }, role_: 'Owner' },
  select: { processNodeId: true, role: { select: { displayValue: true } } },
});
const ownerName = new Map(owners.map((o) => [o.processNodeId, o.role.displayValue]));
const depPrompt = tasks
  .map((t, i) => `${i}: "${t.displayValue}" (owner: ${ownerName.get(t.id) ?? '?'})`)
  .join('\n');
try {
  const deps = jsonOf(
    await ask(
      MODEL,
      [
        'These tasks form one sub-process (requirements elaboration for an insurance carrier).',
        'Propose the dependency edges: which tasks cannot COMPLETE until another task has.',
        'Only real, load-bearing dependencies (inputs a task consumes), max 4 per task, no cycles,',
        'verification tasks depend on what they verify.',
        'Reply ONLY JSON: {"deps":[{"task":<index>,"dependsOn":[<index>,...]},...]}',
      ].join(' '),
      depPrompt,
      1500,
    ),
  ) as { deps?: { task: number; dependsOn: number[] }[] };
  for (const d of deps.deps ?? []) {
    const t = tasks[d.task];
    if (!t) continue;
    const ids = (d.dependsOn ?? [])
      .filter((i) => Number.isInteger(i) && tasks[i] && i !== d.task)
      .slice(0, 4)
      .map((i) => tasks[i].id);
    if (!ids.length) continue;
    const attrs = (t.attributes ?? {}) as Prisma.JsonObject;
    await prisma.processNode.update({
      where: { id: t.id },
      data: { attributes: { ...attrs, dependsOn: ids } },
    });
    console.log(`deps   "${t.displayValue}" ← ${ids.length}`);
  }
} catch (e) {
  console.log('dependency pass failed:', (e as Error).message);
}

console.log(`\nFinal task count under L4: ${tasks.length}`);
await prisma.$disconnect();
