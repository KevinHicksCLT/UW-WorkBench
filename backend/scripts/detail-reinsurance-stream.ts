// User 2026-06-17 — "Reinsurance & Retrocession Management" was too high-level.
// Keep it as ONE stream but decompose it fine-grained (one-to-many): rebuild the
// whole PL3 → PL4 → PL5 tree with a detailed, accurate ceded-reinsurance lifecycle
// (strategy → placement → ceded administration → claims/recoveries → reporting),
// replacing the four high-level L3s and their generic L4/L5 rows.
//
// Writes the three models the live surfaces read (matches separate-process-areas.ts):
//   • SubValueStream  L3 (level 3) + L4 (level 4) + L5 (level 5)  → VS detail page
//   • ProcessStep     one per L5 (l3,l4,name,leads)               → Work tab tasks
//   • Node graph      sub_process node per L4 (parent=value_stream node) + step
//                     node per L5 (parent=L4 node)                → map + Home counts
//   (L3 process areas live only in SubValueStream/ProcessStep.l3 — the Node graph
//    hangs L4 sub_process nodes directly off the value_stream node, no L3 node.)
// Role links survive at stream level; re-attach to the new L3 names afterwards:
//   npx tsx scripts/detail-reinsurance-stream.ts && npx tsx scripts/backfill-l3-roles.ts
//
// Idempotent: re-running rebuilds to the same end state (old tree wiped, fresh
// tree written). Run from backend/.
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const STREAM = 'Reinsurance & Retrocession Management';

type L4 = { name: string; lead: string; l5s: string[] };
type L3 = { name: string; l4s: L4[] };

const TREE: L3[] = [
  {
    name: 'Reinsurance Strategy & Program Design',
    l4s: [
      { name: 'Risk Appetite & Retention Analysis', lead: 'Head of Reinsurance', l5s: [
        'Analyze Gross Exposure & Aggregations',
        'Determine Risk Tolerance & Net Retention',
        'Model Volatility, Capital Relief & Cost-Benefit',
        'Set Program Objectives & KPIs',
      ] },
      { name: 'Treaty Program Structuring', lead: 'Reinsurance Manager', l5s: [
        'Design Proportional Layers (Quota Share / Surplus)',
        'Design Non-Proportional Layers (XoL / Cat / Stop-Loss)',
        'Optimize Coverage vs Cost & Capital',
        'Document Program Structure & Rationale',
      ] },
      { name: 'Retrocession Strategy', lead: 'Reinsurance Manager', l5s: [
        'Assess Net Retained & Peak Exposures',
        'Design Retrocession & ILS Coverage',
        'Select Retrocessionaires & Capacity',
        'Approve Retrocession Plan',
      ] },
      { name: 'Reinsurer Security & Counterparty Framework', lead: 'Reinsurance Credit Analyst', l5s: [
        'Set Minimum Rating & Security Criteria',
        'Assess Reinsurer Financial Strength',
        'Set Counterparty & Concentration Limits',
        'Maintain Approved Reinsurer Panel',
      ] },
    ],
  },
  {
    name: 'Placement & Renewal',
    l4s: [
      { name: 'Submission & Exposure Data Preparation', lead: 'Reinsurance Analyst', l5s: [
        'Compile Exposure & Loss-History Data',
        'Prepare Underwriting Submission Pack',
        'Validate Data Quality & Completeness',
        'Define Renewal Timeline & Strategy',
      ] },
      { name: 'Broker Engagement & Marketing', lead: 'Reinsurance Manager', l5s: [
        'Appoint Reinsurance Broker & Set Mandate',
        'Market Program to Reinsurer Panel',
        'Manage Q&A & Information Requests',
        'Track Market Responses & Indications',
      ] },
      { name: 'Quote Evaluation & Reinsurer Selection', lead: 'Reinsurance Manager', l5s: [
        'Evaluate Quotes, Terms & Pricing',
        'Compare Capacity & Security',
        'Select Reinsurers & Allocate Signed Lines',
        'Obtain Internal Authority Approval',
      ] },
      { name: 'Terms Negotiation & Contract Wording', lead: 'Reinsurance Contracts Specialist', l5s: [
        'Negotiate Terms, Conditions & Exclusions',
        'Draft & Review Treaty Wording',
        'Align Wording with Inward Policy Terms',
        'Resolve Legal & Clause Issues',
      ] },
      { name: 'Binding, Signing & Placement Finalization', lead: 'Reinsurance Contracts Specialist', l5s: [
        'Confirm Firm Order & Bind Coverage',
        'Execute Slip & Collect Signed Lines',
        'Finalize Contract Documentation',
        'Hand Off to Ceded Administration',
      ] },
    ],
  },
  {
    name: 'Ceded Contract Administration',
    l4s: [
      { name: 'Contract Setup & Cession Configuration', lead: 'Ceded Reinsurance Administrator', l5s: [
        'Set Up Treaty in Ceded System',
        'Configure Cession Rules & Layers',
        'Load Reinsurer Shares & Security',
        'Validate Setup Against Wording',
      ] },
      { name: 'Cession Identification & Premium Calculation', lead: 'Ceded Reinsurance Administrator', l5s: [
        'Identify Cedable Policies & Risks',
        'Calculate Ceded Premium & Commissions',
        'Apply Proportional & XoL Cessions',
        'Reconcile Cessions to Inward Book',
      ] },
      { name: 'Bordereaux Preparation & Submission', lead: 'Reinsurance Technician', l5s: [
        'Prepare Premium & Claims Bordereaux',
        'Validate Bordereaux Data',
        'Submit Bordereaux to Reinsurers / Brokers',
        'Resolve Bordereaux Queries',
      ] },
      { name: 'Technical Accounting & Premium Settlement', lead: 'Reinsurance Accountant', l5s: [
        'Produce Technical Accounts & Statements',
        'Process Cash Settlements & Offsets',
        'Reconcile Reinsurer Balances',
        'Manage Premium Portfolio Transfers',
      ] },
      { name: 'Facultative Certificate Administration', lead: 'Facultative Reinsurance Specialist', l5s: [
        'Place & Bind Facultative Risks',
        'Issue & Track Facultative Certificates',
        'Administer Facultative Premiums & Claims',
        'Reconcile Facultative Recoveries',
      ] },
    ],
  },
  {
    name: 'Claims Cession & Recovery Management',
    l4s: [
      { name: 'Large-Loss & Catastrophe Notification', lead: 'Reinsurance Claims Analyst', l5s: [
        'Identify Reportable Losses vs Treaty Triggers',
        'Notify Reinsurers of Large & Cat Losses',
        'Maintain Cat Event Coding & Aggregation',
        'Track Notification Compliance',
      ] },
      { name: 'Claim Cession & Recovery Billing', lead: 'Reinsurance Claims Analyst', l5s: [
        'Calculate Recoverable Amounts by Layer',
        'Cede Claims & Raise Recovery Billings',
        'Submit Claim Bordereaux & Proofs of Loss',
        'Process Reinsurer Claim Payments',
      ] },
      { name: 'Collections & Aged-Balance Management', lead: 'Reinsurance Accountant', l5s: [
        'Monitor Recoverable Aging',
        'Follow Up Outstanding Collections',
        'Escalate Disputed & Slow-Paying Balances',
        'Resolve Recovery Disputes',
      ] },
      { name: 'Collateral, LOC & Trust Management', lead: 'Reinsurance Credit Analyst', l5s: [
        'Determine Collateral Requirements (Reg / Funds-Withheld)',
        'Manage Letters of Credit & Trust Accounts',
        'Monitor Collateral Adequacy',
        'Release & Adjust Collateral',
      ] },
      { name: 'Commutations & Disputes', lead: 'Reinsurance Manager', l5s: [
        'Evaluate Commutation Opportunities',
        'Value Commutation & Negotiate Terms',
        'Execute Commutation Agreements',
        'Manage Arbitration & Dispute Resolution',
      ] },
    ],
  },
  {
    name: 'Reporting, Reconciliation & Governance',
    l4s: [
      { name: 'Recoverable & Exposure Reporting', lead: 'Reinsurance Accountant', l5s: [
        'Track Recoverable Balances & Outwards Exposure',
        'Produce Ceded Reserve & IBNR Reporting',
        'Reconcile Ledger to Ceded System',
        'Report Outwards Exposure vs Limits',
      ] },
      { name: 'Statutory & Regulatory Reporting', lead: 'Reinsurance Reporting Manager', l5s: [
        'Prepare Schedule F & Statutory Returns',
        'Assess Risk-Transfer & Reinsurance Accounting',
        'Support Reinsurance Disclosures & Audits',
        'Validate & File Regulatory Reports',
      ] },
      { name: 'Program Performance & MI', lead: 'Reinsurance Reporting Manager', l5s: [
        'Measure Ceded Cost & Recovery Ratios',
        'Analyze Program Effectiveness vs Objectives',
        'Report Performance to Management',
        'Inform Next Renewal Strategy',
      ] },
      { name: 'Reinsurer Credit Risk Monitoring', lead: 'Reinsurance Credit Analyst', l5s: [
        'Monitor Reinsurer Ratings & Watchlists',
        'Reassess Counterparty Exposure',
        'Trigger Security & Collateral Actions',
        'Report Credit Risk to Governance',
      ] },
    ],
  },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  await prisma.$transaction(async (tx) => {
    const vs = await tx.valueStream.findFirst({ where: { companyId, name: STREAM }, select: { id: true } });
    if (!vs) throw new Error(`stream not found: ${STREAM}`);
    const vsNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: vs.id }, select: { id: true } });

    // ── Wipe the existing tree (SubValueStream L3 cascade L4/L5; ProcessStep;
    //    sub_process nodes under the value_stream node cascade their step kids).
    const oldL3 = await tx.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 3 }, select: { id: true } });
    if (oldL3.length) await tx.subValueStream.deleteMany({ where: { id: { in: oldL3.map((r) => r.id) } } });
    await tx.processStep.deleteMany({ where: { valueStreamId: vs.id } });
    if (vsNode) {
      const oldSp = await tx.node.findMany({ where: { companyId, typeKey: 'sub_process', parentId: vsNode.id }, select: { id: true } });
      if (oldSp.length) await tx.node.deleteMany({ where: { id: { in: oldSp.map((r) => r.id) } } });
    }

    // ── Build the fine-grained tree.
    let nodeSort = 0;
    let l4count = 0, l5count = 0;
    for (const l3 of TREE) {
      const l3row = await tx.subValueStream.create({ data: {
        tenantId, valueStreamId: vs.id, parentId: null, level: 3, name: l3.name, sourceSheet: 'reinsurance-detail',
      } });
      for (const l4 of l3.l4s) {
        const l4row = await tx.subValueStream.create({ data: {
          tenantId, valueStreamId: vs.id, parentId: l3row.id, level: 4, name: l4.name, sourceSheet: 'reinsurance-detail',
        } });
        l4count++;
        let l4node: { id: string } | null = null;
        if (vsNode) {
          l4node = await tx.node.create({ data: {
            companyId, typeKey: 'sub_process', name: l4.name, code: l4row.id,
            parentId: vsNode.id, provenance: 'real', sortOrder: nodeSort++,
          } });
        }
        let stepNo = 1, stepSort = 0;
        for (const l5 of l4.l5s) {
          await tx.subValueStream.create({ data: {
            tenantId, valueStreamId: vs.id, parentId: l4row.id, level: 5, name: l5, sourceSheet: 'reinsurance-detail',
          } });
          const ps = await tx.processStep.create({ data: {
            tenantId, valueStreamId: vs.id, l3: l3.name, l4: l4.name, stepNumber: stepNo++,
            name: l5, leads: l4.lead, illustrative: true,
          } });
          if (l4node) {
            await tx.node.create({ data: {
              companyId, typeKey: 'step', name: l5, code: ps.id, parentId: l4node.id, provenance: 'real', sortOrder: stepSort++,
            } });
          }
          l5count++;
        }
      }
      console.log(`L3 ${l3.name}  (${l3.l4s.length} L4)`);
    }
    console.log(`\nRebuilt "${STREAM}": ${TREE.length} L3, ${l4count} L4, ${l5count} L5.`);
  }, { timeout: 120000, maxWait: 20000 });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
