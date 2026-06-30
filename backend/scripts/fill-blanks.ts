// fill-blanks.ts — fill the visible blanks across the app surfaced by the
// June-2026 walkthrough. Idempotent: each section skips rows already populated.
//
//   1. Adoption by value stream — NodeAiAdoption for the 3 L2 streams that had
//      none (rendered a blank/"Not used" heat-map row); realistic mode levels +
//      use-case cards matching the existing JSON shape.
//   2. Third-Parties — ExternalInteraction.processNodeId for the 7 rows with a
//      blank value stream (derived from the owner role's dominant L2 stream) and
//      the 1 row with a blank internal owner.
//   3. Programs / Initiatives — PortfolioInitiative.sponsorRoleId for the 5 blank
//      sponsors (most-senior owner role in the initiative's value-stream subtree).
//   4. Status notes — Program / Workstream / PortfolioInitiative statusNote text.
//
// Run from backend/:  npx tsx scripts/fill-blanks.ts        (apply)
//                     npx tsx scripts/fill-blanks.ts --dry   (report only)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const log = (...a: unknown[]) => console.log(...a);
const rank = (n: string) => /\bchief\b|\bceo\b|\bcfo\b|\bcto\b|\bcoo\b/i.test(n) ? 0 : /officer|head|director|\bvp\b|president/i.test(n) ? 1 : /manager|lead|principal|owner/i.test(n) ? 2 : 3;

// ── adoption levels + use cases for the 3 uncovered L2 value streams ────────
type UC = { title: string; detail: string; persona: string };
const ADOPTION: Record<string, { assist: string; augment: string; workflow: string; autonomous: string; useCases: { agent: UC[]; workflow: UC[]; assistant: UC[]; augmented: UC[] } }> = {
  'Call Center': {
    assist: 'embedded', augment: 'scaling', workflow: 'emerging', autonomous: 'pilot',
    useCases: {
      assistant: [
        { title: 'Live call summarization', detail: 'AI transcribes and summarizes each call, drafting the wrap-up note and disposition for the agent to confirm.', persona: 'Customer Service Reps' },
        { title: 'Next-best-action prompts', detail: 'Surfaces policy facts and recommended responses in real time from the knowledge base.', persona: 'Service Agents' },
      ],
      augmented: [{ title: 'Sentiment-aware QA scoring', detail: 'AI scores 100% of calls for compliance and sentiment, routing only outliers to a human QA reviewer.', persona: 'Quality Manager' }],
      workflow: [{ title: 'Self-service deflection', detail: 'A scoped agent resolves routine status/billing queries end-to-end and hands off complex cases at a human gate.', persona: 'Contact Center Ops' }],
      agent: [{ title: 'Autonomous callback scheduling', detail: 'Agent detects abandoned calls and arranges callbacks within SLA without human dispatch.', persona: 'Service Operations' }],
    },
  },
  'Corporate Operations': {
    assist: 'scaling', augment: 'emerging', workflow: 'pilot', autonomous: 'not_used',
    useCases: {
      assistant: [
        { title: 'Board & exec briefing drafts', detail: 'Drafts board packs and operating reviews from source metrics and prior narratives for executive sign-off.', persona: 'Chief of Staff · Strategy' },
        { title: 'Policy & procedure Q&A', detail: 'Answers questions about corporate policy and delegated authority straight from the governance library.', persona: 'Corporate Staff' },
      ],
      augmented: [{ title: 'Strategic-plan synthesis', detail: 'AI consolidates divisional plans into a single portfolio view, highlighting conflicts and gaps for planners.', persona: 'Strategic Planning' }],
      workflow: [{ title: 'Management-reporting assembly', detail: 'A scoped agent assembles the monthly operating report from system feeds and routes it for review.', persona: 'Business Operations' }],
      agent: [],
    },
  },
  'Technology & Engineering': {
    assist: 'embedded', augment: 'embedded', workflow: 'scaling', autonomous: 'emerging',
    useCases: {
      assistant: [
        { title: 'In-IDE code assistance', detail: 'AI pair-programmer generates, explains and reviews code against internal standards as engineers work.', persona: 'Software Engineers' },
        { title: 'Incident copilot', detail: 'Summarizes alerts, correlates logs and proposes remediation steps during incidents for the on-call engineer.', persona: 'SRE · DevOps' },
      ],
      augmented: [{ title: 'Automated test generation', detail: 'AI drafts unit and integration tests from the change set for the engineer to approve before merge.', persona: 'Engineering' }],
      workflow: [{ title: 'PR triage & dependency bumps', detail: 'A scoped agent opens, validates and merges low-risk dependency PRs at a human gate.', persona: 'Platform Engineering' }],
      agent: [{ title: 'Autonomous build remediation', detail: 'Agent detects flaky/broken builds, opens a fix branch and re-runs CI without human kickoff.', persona: 'Developer Experience' }],
    },
  },
};

// fallback owner role per party type when no role is set.
const PARTY_OWNER: Record<string, string> = { Vendor: 'Chief Technology Officer', Broker: 'Distribution Manager', Insured: 'Product Owner', Regulator: 'Chief Compliance Officer' };

// value-stream override by party name where the owner role's domain is a poor
// proxy for where the party actually touches the business.
const EXT_VS_OVERRIDE: Record<string, string> = {
  'Individual Policyholder': 'Sales, Distribution & Marketing',
  'Data Protection Authority': 'Risk, Compliance & Audit',
};

// synthesized status-note text by status token.
const NOTE: Record<string, (n: string) => string> = {
  ON_TRACK: (n) => `${n} is progressing to plan; milestones and spend are within tolerance this period.`,
  AT_RISK: (n) => `${n} is trending at risk — schedule pressure on key milestones is being actively managed with the sponsor.`,
  OFF_TRACK: (n) => `${n} is off track; a recovery plan is in place and under weekly review with the steering group.`,
};

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('no company');
  const companyId = company.id;
  log(`\n=== fill-blanks ${DRY ? '(DRY RUN)' : '(APPLY)'} — ${company.name} ===`);
  const counts = { adoption: 0, extNode: 0, extRole: 0, sponsor: 0, notes: 0 };

  const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, displayValue: true } });
  const roleByName = new Map(roles.map((r) => [r.displayValue, r]));
  const l2 = await prisma.processNode.findMany({ where: { companyId, processLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true } });
  const vsByName = new Map(l2.map((n) => [n.displayValue, n.id]));

  // dominant L2 value-stream id for a role (most NodeRole ties under an L2 subtree).
  const domVsForRole = async (roleId: string): Promise<string | null> => {
    const rows = await prisma.$queryRawUnsafe<{ id: string; n: bigint }[]>(
      `SELECT anc.id, count(*) n FROM "NodeRole" nr
       JOIN "ProcessNodeClosure" c ON c."descendantId"=nr."processNodeId"
       JOIN "ProcessNode" anc ON anc.id=c."ancestorId"
       JOIN "ProcessLevelType" plt ON plt.id=anc."processLevelTypeId" AND plt."levelNumber"=2
       WHERE nr."roleId"=$1 GROUP BY 1 ORDER BY 2 DESC LIMIT 1`, roleId);
    return rows[0]?.id ?? null;
  };

  // ── 1. ADOPTION — NodeAiAdoption for the 3 uncovered streams ───────────
  for (const [vsName, a] of Object.entries(ADOPTION)) {
    const nodeId = vsByName.get(vsName);
    if (!nodeId) { log(`  ! no L2 node "${vsName}"`); continue; }
    const exists = await prisma.nodeAiAdoption.findUnique({ where: { processNodeId: nodeId } });
    if (exists) continue;
    log(`  + NodeAiAdoption "${vsName}" (assist=${a.assist} augment=${a.augment} workflow=${a.workflow} autonomous=${a.autonomous})`);
    counts.adoption++;
    if (!DRY) await prisma.nodeAiAdoption.create({ data: { processNodeId: nodeId, aiAssist: a.assist, aiAugment: a.augment, aiWorkflow: a.workflow, aiAutonomous: a.autonomous, useCases: a.useCases } });
  }

  // ── 2. THIRD-PARTIES — fill blank value stream + blank owner ───────────
  const exts = await prisma.externalInteraction.findMany({
    where: { externalParty: { companyId }, OR: [{ processNodeId: null }, { roleId: null }] },
    select: { id: true, roleId: true, processNodeId: true, externalParty: { select: { name: true, partyType: true } }, role: { select: { displayValue: true } } },
  });
  for (const e of exts) {
    let roleId = e.roleId;
    if (!roleId) { // blank owner → owner by party type
      const owner = roleByName.get(PARTY_OWNER[e.externalParty.partyType] ?? '');
      if (owner) { roleId = owner.id; counts.extRole++; log(`  owner "${e.externalParty.name}" → ${owner.displayValue}`); if (!DRY) await prisma.externalInteraction.update({ where: { id: e.id }, data: { roleId } }); }
    }
    if (!e.processNodeId && roleId) { // blank value stream → override, else owner role's dominant L2 stream
      const vsId = vsByName.get(EXT_VS_OVERRIDE[e.externalParty.name] ?? '') ?? await domVsForRole(roleId);
      if (vsId) { counts.extNode++; log(`  vs "${e.externalParty.name}" → ${l2.find((n) => n.id === vsId)?.displayValue}`); if (!DRY) await prisma.externalInteraction.update({ where: { id: e.id }, data: { processNodeId: vsId } }); }
    }
  }

  // ── 3. PROGRAMS — sponsor for blank PortfolioInitiative sponsors ───────
  const pinits = await prisma.portfolioInitiative.findMany({ where: { companyId, sponsorRoleId: null }, select: { id: true, name: true, ownerRoleId: true, valueStreamNodeId: true } });
  for (const pi of pinits) {
    if (!pi.valueStreamNodeId) continue;
    const rows = await prisma.$queryRawUnsafe<{ roleId: string; name: string }[]>(
      `SELECT DISTINCT nr."roleId", r."displayValue" name FROM "NodeRole" nr
       JOIN "ProcessNodeClosure" c ON c."descendantId"=nr."processNodeId"
       JOIN "Role" r ON r.id=nr."roleId"
       WHERE c."ancestorId"=$1 AND nr."roleId" <> COALESCE($2,'')`, pi.valueStreamNodeId, pi.ownerRoleId ?? '');
    const sponsor = rows.map((r) => ({ ...r, rk: rank(r.name) })).sort((a, b) => a.rk - b.rk)[0];
    if (!sponsor) continue;
    log(`  sponsor "${pi.name}" → ${sponsor.name}`);
    counts.sponsor++;
    if (!DRY) await prisma.portfolioInitiative.update({ where: { id: pi.id }, data: { sponsorRoleId: sponsor.roleId } });
  }

  // ── 4. STATUS NOTES — Program / Workstream / PortfolioInitiative ───────
  for (const model of ['program', 'workstream', 'portfolioInitiative'] as const) {
    const rows = await (prisma[model] as any).findMany({ where: { companyId, statusNote: null }, select: { id: true, name: true, status: true } });
    for (const r of rows) {
      const note = (NOTE[r.status] ?? NOTE.ON_TRACK)(r.name);
      counts.notes++;
      if (!DRY) await (prisma[model] as any).update({ where: { id: r.id }, data: { statusNote: note } });
    }
  }

  log('\n--- summary ---');
  console.table(counts);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
