// SUPERSEDED — DO NOT RUN. Review rejected blanket keyword linking: AWS is
// assigned SURGICALLY, only where a user actually works in AWS, with the
// service called out (AWS IAM, AWS VPC, AWS Organizations …) and in-AWS
// steps. See scripts/aws-candidates.json + scripts/aws-rewrites.json and the
// runbook. Original (superseded) approach below for reference.
// Cloud grounding — review caught that cloud work references Terraform/Okta
// but never the hyperscaler itself: no AWS (or any cloud platform) existed in
// the application catalog, so landing zones, accounts, VPCs and guardrails
// floated app-less. This adds Amazon Web Services (AWS) to the catalog, links
// it to every L6 whose actions are clearly cloud-platform work, and grounds
// those actions' DoDs ("Done when in Amazon Web Services (AWS) …") where the
// DoD names no app yet.
// Run: npx tsx --env-file=.env scripts/aaa-cloud-aws.ts <l2Id> [...]
import { prisma } from '../src/db/prisma.js';

const streams = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'bb67119f-5481-4e4b-9314-0a46acae47e6',
      '17cb3453-4288-4970-bfd0-925a71ee174a',
      'a4afae36-3189-4957-8eee-f435c3fa6fe2',
    ];

const CLOUD_RE =
  /landing zone|cloud account|cloud platform|cloud environment|cloud resource|cloud role|cloud cost|cloud posture|cloud network|cloud iam|cloud tenant|cloud subscription|cloud guardrail|\bVPC\b|hub-and-spoke|\bS3\b|\bEC2\b|cloud storage|compute cluster|cloud workspace|CSPM|cloud spend|cloud budget|cloud migration|cloud provider/i;

const first = await prisma.processNode.findFirst({
  where: { id: streams[0] },
  select: { companyId: true },
});
const companyId = first!.companyId;

let aws = await prisma.application.findFirst({
  where: { companyId, name: 'Amazon Web Services (AWS)' },
  select: { id: true },
});
aws ??= await prisma.application.create({
  data: {
    companyId,
    name: 'Amazon Web Services (AWS)',
    kind: 'SystemOfRecord',
    isInternal: false,
    description:
      'The cloud platform. Accounts, landing zones, VPCs, IAM roles and guardrails, compute and storage, cost and posture data all live here — the console and APIs cloud work is performed against.',
  },
  select: { id: true },
});

let linked = 0;
let grounded = 0;
for (const L2 of streams) {
  const d4 = (
    await prisma.processNodeClosure.findMany({
      where: { ancestorId: L2, depth: 4 },
      select: { descendantId: true },
    })
  ).map((c) => c.descendantId);
  const rows = await prisma.nodeTemplateAnswer.findMany({
    where: { processNodeId: { in: d4 }, templateKeyId: null, NOT: { customKey: null } },
    select: { id: true, processNodeId: true, customKey: true, value: true },
  });
  const cloudTasks = new Set<string>();
  for (const r of rows) {
    const text = `${r.customKey}\n${r.value ?? ''}`;
    if (!CLOUD_RE.test(text)) continue;
    cloudTasks.add(r.processNodeId);
    if (r.value && /^Done when (?!in )/im.test(r.value)) {
      const nv = r.value.replace(/^Done when (?!in )/im, 'Done when in Amazon Web Services (AWS) ');
      await prisma.nodeTemplateAnswer.update({ where: { id: r.id }, data: { value: nv } });
      grounded += 1;
    }
  }
  for (const id of cloudTasks) {
    const has = await prisma.nodeAppUsage.findFirst({
      where: { processNodeId: id, applicationId: aws.id },
      select: { id: true },
    });
    if (!has) {
      await prisma.nodeAppUsage.create({
        data: { companyId, processNodeId: id, applicationId: aws.id, usageType: 'performed' },
      });
      linked += 1;
    }
  }
}
console.log(`AWS linked to ${linked} L6 tasks; ${grounded} DoDs grounded in AWS`);
await prisma.$disconnect();
