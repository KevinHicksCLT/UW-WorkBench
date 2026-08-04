// Vagueness sharpener — quality gate after the rollout. Flags action rows
// whose content is too thin to execute against:
//   • DoD with no application ("Done when the status is confirmed.") or a
//     generic X-is-done pattern
//   • fewer than 3 steps, or steps that merely restate the action title
// For each L6 task carrying flagged rows, ONE Sonnet call rewrites just those
// rows: concrete numbered steps a person can follow, the application named
// from the task's linked apps, and a specific measurable DoD
// ("Done when in <App> <observable condition>"). Unflagged rows untouched.
// Run: npx tsx --env-file=.env scripts/aaa-l6-sharpen.ts <l2Id> [...]
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';

const streams = process.argv.slice(2);
if (!streams.length) {
  console.error('usage: aaa-l6-sharpen.ts <l2Id> [...]');
  process.exit(1);
}
const CONCURRENCY = 8;
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 3 });

const GENERIC_DOD =
  /^Done when (the |a |all |each |every )?[\w '/-]{0,40}(is|are) (complete|completed|confirmed|done|composed|recorded|updated|reviewed|defined|documented|validated|finished|in place|available)\.?$/i;

const SYSTEM = [
  'You sharpen operating-model actions for an insurance carrier so a person (or agent)',
  'can execute them without guessing. For each action you receive, rewrite its body in',
  'EXACTLY this format:',
  'By the <actor>:',
  '1) <concrete step naming where/how, using the given applications>',
  '2) <next step>',
  '3) <next step>',
  'Done when in <application> <specific observable condition>',
  'Rules: keep the same actor; use ONLY the listed applications (pick the one the work',
  'really happens in); 3-4 steps, each a real instruction (open/select/enter/run/check',
  'something specific), never a restatement of the action title; the DoD must be a',
  'verifiable state in the named application. Insurance-domain accuracy over generic',
  'filler. Reply ONLY minified JSON: {"rows":[{"id":"<rowId>","value":"<full body>"}]}',
].join(' ');

let flaggedTasks: {
  taskId: string;
  taskName: string;
  actor: string;
  apps: string[];
  rows: { id: string; key: string; value: string }[];
}[] = [];

for (const L2 of streams) {
  const d4 = (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L2, depth: 4 },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId);
  const l6s = await prisma.processNode.findMany({
    where: { id: { in: d4 }, isTask: true },
    select: {
      id: true,
      displayValue: true,
      nodeRoles: {
        where: { role_: 'Owner' },
        select: { role: { select: { displayValue: true } } },
      },
      nodeAppUsages: { select: { application: { select: { name: true } } } },
    },
  });
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: d4 }, templateKeyId: null, NOT: { customKey: null } },
    select: { id: true, processNodeId: true, customKey: true, value: true },
  });
  const byTask = new Map<string, typeof rows>();
  for (const r of rows) byTask.set(r.processNodeId, [...(byTask.get(r.processNodeId) ?? []), r]);

  for (const t of l6s) {
    const trows = byTask.get(t.id) ?? [];
    const flagged = trows.filter((r) => {
      const v = r.value ?? '';
      const dod = v.match(/^Done when .*$/im)?.[0] ?? '';
      const steps = v.split(/\r?\n/).filter((l) => /^\d+\)/.test(l.trim()));
      const action = r.customKey!.replace(/^\d+\. /, '').toLowerCase();
      const thinSteps =
        steps.length < 3 ||
        steps.every(
          (s) =>
            s
              .replace(/^\d+\)\s*/, '')
              .trim()
              .split(/\s+/).length <= 6,
        ) ||
        steps.some((s) => {
          const body = s
            .replace(/^\d+\)\s*/, '')
            .trim()
            .toLowerCase()
            .replace(/\.$/, '');
          return action.includes(body) || body.includes(action);
        });
      const vagueDod = !/^Done when in /i.test(dod) || GENERIC_DOD.test(dod);
      return vagueDod && thinSteps;
    });
    if (!flagged.length) continue;
    flaggedTasks.push({
      taskId: t.id,
      taskName: t.displayValue,
      actor: t.nodeRoles[0]?.role.displayValue ?? 'Unknown',
      apps: t.nodeAppUsages.map((a) => a.application.name),
      rows: flagged.map((r) => ({ id: r.id, key: r.customKey!, value: r.value ?? '' })),
    });
  }
}
console.log(
  `flagged: ${flaggedTasks.reduce((a, t) => a + t.rows.length, 0)} vague actions across ${flaggedTasks.length} L6 tasks`,
);

let sharpened = 0;
let failed = 0;
let cursor = 0;
async function worker(): Promise<void> {
  for (;;) {
    const i = cursor++;
    if (i >= flaggedTasks.length) return;
    const t = flaggedTasks[i];
    try {
      const prompt = [
        `Task: "${t.taskName}" — actor: ${t.actor}`,
        `Applications available: ${t.apps.join(', ') || '(none — name the most realistic tool)'}`,
        '',
        ...t.rows.map(
          (r) =>
            `rowId ${r.id}\nAction: ${r.key.replace(/^\d+\. /, '')}\nCurrent body:\n${r.value}\n`,
        ),
      ].join('\n');
      const res = await ai.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      const out = JSON.parse(text) as { rows?: { id: string; value: string }[] };
      const valid = new Set(t.rows.map((r) => r.id));
      for (const r of out.rows ?? []) {
        if (!valid.has(r.id)) continue;
        if (!/^By the /.test(r.value) || !/^Done when in /im.test(r.value)) continue;
        await prisma.nodeTemplateAnswer.update({ where: { id: r.id }, data: { value: r.value } });
        sharpened += 1;
      }
    } catch {
      failed += 1;
    }
    if ((i + 1) % 50 === 0) console.log(`progress: ${i + 1}/${flaggedTasks.length} tasks`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`sharpened ${sharpened} actions (${failed} task calls failed)`);
await prisma.$disconnect();
