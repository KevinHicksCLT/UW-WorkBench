// Defect: RAID heatmap is nearly empty — only 4 open risks across the demo
// portfolio. Adds the same 16 illustrative open risks that were added to
// src/seed/portfolio.ts, matched to existing PortfolioInitiatives by name.
// Severity = probability × impact (5×5 matrix), same as the seed. Idempotent:
// skips any (initiative, title) pair that already exists.
import { prisma } from '../src/db/prisma.js';

const NEW_RISKS: { initiative: string; title: string; probability: number; impact: number; mitigation: string }[] = [
  { initiative: 'Straight-Through Submission Intake', title: 'Broker portal security findings delay pilot', probability: 4, impact: 5, mitigation: 'Engage security architecture early; penetration test before the pilot gate.' },
  { initiative: 'Straight-Through Submission Intake', title: 'Integration vendor attrition on the squad', probability: 2, impact: 5, mitigation: 'Cross-train internal engineers; keep integration runbooks current.' },
  { initiative: 'Straight-Through Submission Intake', title: 'Clearance false positives frustrate brokers', probability: 3, impact: 2, mitigation: 'Tune match thresholds; manual review queue for borderline matches.' },
  { initiative: 'Real-Time Rating Engine', title: 'Rate-filing approvals lag in key states', probability: 3, impact: 5, mitigation: 'Stagger state rollout; file earliest in slow-approval states.' },
  { initiative: 'Real-Time Rating Engine', title: 'Quote latency under peak volume', probability: 3, impact: 3, mitigation: 'Load-test at 3× peak; cache common rating paths.' },
  { initiative: 'Real-Time Rating Engine', title: 'Legacy rater decommission slips, doubling run cost', probability: 5, impact: 2, mitigation: 'Tie decommission dates to cutover gates.' },
  { initiative: 'Automated FNOL Triage', title: 'Adjusters override auto-routing recommendations', probability: 4, impact: 3, mitigation: 'Explainable routing reasons; pilot feedback loop into the model.' },
  { initiative: 'Automated FNOL Triage', title: 'Catastrophe surge overwhelms triage queue', probability: 2, impact: 4, mitigation: 'CAT surge mode routes straight to senior adjusters.' },
  { initiative: 'Automated FNOL Triage', title: 'PII exposure in claim narratives', probability: 2, impact: 2, mitigation: 'Mask PII before model inference.' },
  { initiative: 'Unified Claims Data Platform', title: 'Source-system owners not staffed for onboarding', probability: 5, impact: 4, mitigation: 'Secure named data stewards before wave 1 starts.' },
  { initiative: 'Unified Claims Data Platform', title: 'Cloud egress costs exceed estimates', probability: 2, impact: 3, mitigation: 'Egress monitoring plus tiered storage policy.' },
  { initiative: 'Unified Claims Data Platform', title: 'Fraud-analytics scope creep into the MVP', probability: 4, impact: 2, mitigation: 'Gate scope changes through business-case re-approval.' },
  { initiative: 'Enterprise AI Assistant Rollout', title: 'Shadow-IT AI tools bypass the governed assistant', probability: 3, impact: 3, mitigation: 'Block unsanctioned tools; fast-track feature requests.' },
  { initiative: 'Enterprise AI Assistant Rollout', title: 'Vendor pricing changes erode the business case', probability: 1, impact: 4, mitigation: 'Multi-year contract with price-protection clause.' },
  { initiative: 'Enterprise AI Assistant Rollout', title: 'Hallucinated answers reach regulated communications', probability: 2, impact: 4, mitigation: 'Human review required for external-facing outputs.' },
];

async function main() {
  let created = 0, skipped = 0, missing = 0;
  for (const r of NEW_RISKS) {
    const initiatives = await prisma.portfolioInitiative.findMany({
      where: { name: r.initiative }, select: { id: true, companyId: true },
    });
    if (initiatives.length === 0) { console.warn(`no initiative named "${r.initiative}" — skipped`); missing++; continue; }
    for (const init of initiatives) {
      const exists = await prisma.raidItem.findFirst({ where: { initiativeId: init.id, title: r.title }, select: { id: true } });
      if (exists) { skipped++; continue; }
      await prisma.raidItem.create({
        data: {
          initiativeId: init.id, type: 'RISK', title: r.title,
          probability: r.probability, impact: r.impact, severity: r.probability * r.impact,
          mitigation: r.mitigation, status: 'OPEN',
        },
      });
      created++;
    }
  }
  console.log(`done: ${created} created, ${skipped} already present, ${missing} initiative names unmatched`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
