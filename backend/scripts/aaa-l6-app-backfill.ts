// L6 application backfill — the rollout linked only apps the action text
// literally named, leaving ~45% of L6 tasks app-less. Two grounded fixes:
//   1. INHERIT — an app-less L6 takes its parent L5's researched app links
//      (the original task-level catalog assignment).
//   2. SEMANTIC — actions that are clearly communications get Microsoft
//      Outlook (created if absent) and their DoD gains the app ("Done when in
//      Microsoft Outlook …"); meetings/workshops get Microsoft Teams.
// Run: npx tsx --env-file=.env scripts/aaa-l6-app-backfill.ts <l2Id> [...]
import { prisma } from '../src/db/prisma.js';

const streams = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'bb67119f-5481-4e4b-9314-0a46acae47e6',
      '17cb3453-4288-4970-bfd0-925a71ee174a',
      'a4afae36-3189-4957-8eee-f435c3fa6fe2',
    ];

const OUTLOOK_RE =
  /notif|e-?mail|stakeholder communication|communicat(e|ion) (to|with)|circulate|distribut(e|ion) (of )?(the )?(report|summary|minutes|update)|all-clear|situation report|advisory/i;
const TEAMS_RE =
  /\bmeeting\b|workshop|walkthrough|stand-?up|ceremony|tabletop|working session|retrospective|office-?hours/i;

const first = await prisma.processNode.findFirst({
  where: { id: streams[0] },
  select: { companyId: true },
});
const companyId = first!.companyId;

async function ensureApp(name: string, description: string): Promise<string> {
  let a = await prisma.application.findFirst({ where: { companyId, name }, select: { id: true } });
  a ??= await prisma.application.create({
    data: { companyId, name, kind: 'Tool', isInternal: false, description },
    select: { id: true },
  });
  return a.id;
}
const outlookId = await ensureApp(
  'Microsoft Outlook',
  'Email and calendaring. Stakeholder notifications, distribution of reports and summaries, and meeting scheduling.',
);
const teamsId = await ensureApp(
  'Microsoft Teams',
  'Meetings, workshops and channel collaboration. Working sessions, walkthroughs and stand-ups are held here.',
);

let inherited = 0;
let outlookLinked = 0;
let teamsLinked = 0;
let dodUpdated = 0;

for (const L2 of streams) {
  const d4 = (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L2, depth: 4 },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId);
  const l6s = await prisma.processNode.findMany({
    where: { id: { in: d4 }, isTask: true },
    select: { id: true, parentId: true },
  });
  const linked = new Set(
    (
      await prisma.nodeAppUsage.findMany({
        where: { processNodeId: { in: d4 } },
        select: { processNodeId: true },
      })
    ).map((a) => a.processNodeId),
  );
  const parentIds = [...new Set(l6s.map((n) => n.parentId).filter((p): p is string => !!p))];
  const parentApps = await prisma.nodeAppUsage.findMany({
    where: { processNodeId: { in: parentIds } },
    select: { processNodeId: true, applicationId: true, usageType: true },
  });
  const byParent = new Map<string, { applicationId: string; usageType: string }[]>();
  for (const a of parentApps)
    byParent.set(a.processNodeId, [
      ...(byParent.get(a.processNodeId) ?? []),
      { applicationId: a.applicationId, usageType: a.usageType },
    ]);

  for (const n of l6s) {
    // 1. Inherit the parent L5's app links when the L6 has none of its own.
    if (!linked.has(n.id)) {
      const apps = byParent.get(n.parentId ?? '') ?? [];
      if (apps.length) {
        await prisma.nodeAppUsage.createMany({
          data: apps.map((a) => ({
            companyId,
            processNodeId: n.id,
            applicationId: a.applicationId,
            usageType: a.usageType,
          })),
        });
        inherited += 1;
      }
    }
    // 2. Semantic comms/meeting links + DoD app grounding.
    const rows = await prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: n.id, templateKeyId: null, NOT: { customKey: null } },
      select: { id: true, customKey: true, value: true },
    });
    let wantsOutlook = false;
    let wantsTeams = false;
    for (const r of rows) {
      const text = `${r.customKey}\n${r.value ?? ''}`;
      const isComms = OUTLOOK_RE.test(text);
      const isMeeting = TEAMS_RE.test(text);
      if (isComms) wantsOutlook = true;
      if (isMeeting) wantsTeams = true;
      // DoD grounding: only for confidently-classed rows whose DoD names no app.
      const app = isComms ? 'Microsoft Outlook' : isMeeting ? 'Microsoft Teams' : null;
      if (app && r.value && /^Done when (?!in )/im.test(r.value)) {
        const nv = r.value.replace(/^Done when (?!in )/im, `Done when in ${app} `);
        if (nv !== r.value) {
          await prisma.nodeTemplateAnswer.update({ where: { id: r.id }, data: { value: nv } });
          dodUpdated += 1;
        }
      }
    }
    for (const [want, appId, count] of [
      [wantsOutlook, outlookId, () => (outlookLinked += 1)],
      [wantsTeams, teamsId, () => (teamsLinked += 1)],
    ] as const) {
      if (!want) continue;
      const has = await prisma.nodeAppUsage.findFirst({
        where: { processNodeId: n.id, applicationId: appId },
        select: { id: true },
      });
      if (!has) {
        await prisma.nodeAppUsage.create({
          data: { companyId, processNodeId: n.id, applicationId: appId, usageType: 'performed' },
        });
        count();
      }
    }
  }
}
console.log(
  `inherited parent apps: ${inherited} L6s | Outlook linked: ${outlookLinked} | Teams linked: ${teamsLinked} | DoDs app-grounded: ${dodUpdated}`,
);
await prisma.$disconnect();
