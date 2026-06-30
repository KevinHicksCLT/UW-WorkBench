// User 2026-06-17 (composite insurer) — replace the single over-stuffed
// "Reinsurance & Retrocession Management" value stream with the THREE accurate
// streams a composite (writes primary, buys outward, assumes inward) actually
// runs, per the reinsurance operating-model research (APQC PCF, ACORD GRLC/EBOT-
// ECOT, NAIC Schedule F, Lloyd's/Bermuda practice):
//   VS-1  Outward (Ceded) Reinsurance Management      — buying protection (cedant)
//   VS-2  Assumed (Inward) Reinsurance Underwriting   — acting AS a reinsurer
//   VS-3  Retrocession Management                     — ceding the assumed book on
//
// CRITICAL (connected-additions rule): nothing is added orphaned. Every L4/L5 is
// wired to ALL surrounding entities:
//   • Tasks         ProcessStep (l3/l4/name/leads/supporting)
//   • Roles         RoleValueStream (subStream=L3) + leads/supporting + IoItem.keyRoles
//                   + StepDeliverable.approverRole — using REAL roster role names so
//                   roleMatch resolves them (missing specialists are created first).
//   • Deliverables  IoItem (Input + Output / Deliverable) + StepDeliverable
//   • Applications  StepAppUsage (per step; Execution + a System-of-Record link)
// All three models the UI reads are written: SubValueStream (VS page), ProcessStep
// (Work tab), Node graph value_stream/sub_process/step (map + Home counts), plus
// the Level lvl-3 row per stream.
//
// Idempotent: re-running rebuilds to the same end state. Run from backend/:
//   npx tsx scripts/build-reinsurance-streams.ts
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_STREAM = 'Reinsurance & Retrocession Management';
const DOMAIN = 'Core Insurance';

// Roster roles to ensure exist (reuse if present, else create). The first block
// already exists on the roster; the second block is the missing specialists the
// research flagged (shared across streams). create-if-missing, never duplicate.
const ENSURE_ROLES = [
  'Head of Reinsurance', 'Reinsurance Manager', 'Reinsurance Ops Manager',
  'Ceded Reinsurance Analyst', 'Reinsurance Analyst', 'Retrocession Manager',
  'Reinsurance Accounting Specialist', 'Reinsurance Claims / Recoveries Specialist',
  'Facultative Reinsurance Specialist / Underwriter', 'Bordereaux Analyst',
  'Pricing Actuary', 'Reserving Actuary',
  // created specialists (shared job families):
  'Reinsurance Underwriter', 'Catastrophe & Exposure Manager',
  'Reinsurance Credit & Security Analyst', 'Treaty Analyst',
];

type L4 = { name: string; deliverable: string; l5s: string[] };
type L3 = { name: string; lead: string; support: string; exec: string; sor: string; l4s: L4[] };
type VS = { name: string; l3s: L3[] };

const TREE: VS[] = [
  // ── VS-1 Outward (Ceded) Reinsurance Management ───────────────────────────
  { name: 'Outward (Ceded) Reinsurance Management', l3s: [
    { name: 'Reinsurance Strategy & Program Design', lead: 'Head of Reinsurance', support: 'Catastrophe & Exposure Manager', exec: 'Catastrophe Modeling', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Net-Retention & Risk-Appetite Setting', deliverable: 'Net-retention & risk-appetite statement', l5s: ['Analyze Gross Exposure & Aggregations', 'Determine Net Retention & Tolerance', 'Quantify Capital & Solvency Relief', 'Approve Retention Strategy'] },
      { name: 'Program Structuring (Treaty vs Facultative)', deliverable: 'Reinsurance program structure', l5s: ['Design Proportional Layers (Quota Share / Surplus)', 'Design Non-Proportional Layers (Per-Risk / Cat XoL / Stop-Loss)', 'Optimize Coverage vs Cost & Capital', 'Document Program Structure & Rationale'] },
      { name: 'Cat & Exposure Modelling / Optimization Analytics', deliverable: 'PML & layer-optimization analysis', l5s: ['Prepare & Cleanse Exposure Data', 'Run Cat Models & Compute PML / AAL', 'Model Layer Options & Net Volatility', 'Recommend Optimal Program'] },
      { name: 'Reinsurance Budgeting & Cost Allocation', deliverable: 'Cost-of-cover allocation', l5s: ['Forecast Reinsurance Spend', 'Allocate Cost-of-Cover to Business Units', 'Monitor Budget vs Actual', 'Report Reinsurance Cost'] },
    ] },
    { name: 'Placement & Broking', lead: 'Reinsurance Manager', support: 'Ceded Reinsurance Analyst', exec: 'Reinsurer Exchange', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Submission Preparation', deliverable: 'Broker submission pack', l5s: ['Compile Exposure & Loss-History Data', 'Prepare Underwriting Submission Pack', 'Validate Data Quality & Completeness', 'Issue Submission to Brokers / Market'] },
      { name: 'Quoting, Negotiation & Line Setting', deliverable: 'Firm order terms & signed lines', l5s: ['Evaluate Quotes, Terms & Pricing', 'Negotiate Firm-Order Terms', 'Set & Sign Down Lines', 'Obtain Internal Authority Approval'] },
      { name: 'Binding & Contract Documentation', deliverable: 'Bound treaty slip & wording', l5s: ['Confirm Firm Order & Bind Coverage', 'Execute Slip & Collect Signed Lines', 'Finalize Wording & Endorsements', 'Hand Off to Ceded Administration'] },
      { name: 'Facultative Placement', deliverable: 'Facultative certificate', l5s: ['Identify Risks Requiring Facultative Cover', 'Place & Negotiate Facultative Cessions', 'Issue Facultative Certificates', 'Record Facultative Cessions'] },
    ] },
    { name: 'Ceded Cession Administration & Technical Accounting', lead: 'Reinsurance Accounting Specialist', support: 'Bordereaux Analyst', exec: 'Sapiens ReinsuranceMaster', sor: 'SAP S/4HANA Finance', l4s: [
      { name: 'Cession Calculation & Ceded-Premium Booking', deliverable: 'Ceded premium booking', l5s: ['Identify Cedable Policies & Risks', 'Calculate Ceded Premium & Commissions', 'Apply Proportional & XoL Cessions', 'Book Ceded Premium & Reinstatements'] },
      { name: 'Bordereaux & Statements of Account (EBOT)', deliverable: 'Premium & claims bordereaux', l5s: ['Prepare Premium & Claims Bordereaux', 'Validate Bordereaux Data', 'Produce Technical Accounts (EBOT)', 'Submit to Reinsurers / Brokers'] },
      { name: 'Premium Settlement & Cash Management', deliverable: 'Settled reinsurer balances', l5s: ['Process Cash Settlements & Offsets', 'Match Payments to Statements', 'Manage Multicurrency & FX', 'Resolve Settlement Queries'] },
      { name: 'Reconciliation & Data Governance', deliverable: 'Ceded-to-GL reconciliation', l5s: ['Reconcile Ceded System to GL & Policy', 'Investigate & Clear Leakage', 'Maintain Cession Data Quality', 'Report Reconciliation Status'] },
    ] },
    { name: 'Ceded Claims & Recoveries', lead: 'Reinsurance Claims / Recoveries Specialist', support: 'Ceded Reinsurance Analyst', exec: 'Sapiens ReinsuranceMaster', sor: 'SAP S/4HANA Finance', l4s: [
      { name: 'Loss Notification & Claim Advices', deliverable: 'Reinsurer loss advice', l5s: ['Identify Reportable Losses vs Treaty Triggers', 'Notify Reinsurers of Large & Cat Losses', 'Maintain Cat Event Coding & Aggregation', 'Track Notification Compliance'] },
      { name: 'Recoverable Identification & Cash Calls', deliverable: 'Recovery billing & cash call', l5s: ['Calculate Recoverable Amounts by Layer', 'Raise Recovery Billings & Cash Calls', 'Submit Claim Bordereaux (ECOT) & Proofs', 'Process Reinsurer Claim Payments'] },
      { name: 'Recovery Collection & Ageing Control', deliverable: 'Recoverable ageing report', l5s: ['Monitor Recoverable Ageing', 'Follow Up Outstanding Collections', 'Match Recoveries to Cash', 'Escalate Disputed & Slow Balances'] },
      { name: 'Commutations of Ceded Contracts', deliverable: 'Commutation agreement', l5s: ['Evaluate Commutation Opportunity', 'Value Commutation & Negotiate Terms', 'Execute Commutation Agreement', 'Settle & Close Commuted Contract'] },
    ] },
    { name: 'Reinsurer Security, Collateral & Regulatory Reporting', lead: 'Reinsurance Credit & Security Analyst', support: 'Reinsurance Accounting Specialist', exec: 'Archer', sor: 'Regulatory Filing Portal', l4s: [
      { name: 'Counterparty Credit & Approved-Reinsurer List', deliverable: 'Approved-reinsurer security list', l5s: ['Assess Reinsurer Financial Strength & Ratings', 'Classify Authorized / Certified / Reciprocal', 'Set Counterparty & Concentration Limits', 'Maintain Approved Reinsurer Panel'] },
      { name: 'Collateral Management (LOC / Trust / Funds-Withheld)', deliverable: 'Collateral adequacy position', l5s: ['Determine Collateral Requirements', 'Manage LOCs, Reg-114 Trusts & Funds-Withheld', 'Monitor Collateral Adequacy', 'Release & Adjust Collateral'] },
      { name: 'Statutory & Regulatory Reporting (Schedule F)', deliverable: 'Schedule F / provision for reinsurance', l5s: ['Compile Ceded & Recoverable Data', 'Prepare Schedule F & Provision for Reinsurance', 'Assess Solvency II Net & IFRS 17 Reinsurance-Held', 'Validate & File Regulatory Reports'] },
      { name: 'Dispute & Arbitration Management', deliverable: 'Dispute resolution record', l5s: ['Identify & Log Reinsurance Disputes', 'Assemble Position & Evidence', 'Manage Arbitration / Mediation', 'Resolve & Record Outcome'] },
    ] },
  ] },
  // ── VS-2 Assumed (Inward) Reinsurance Underwriting ────────────────────────
  { name: 'Assumed (Inward) Reinsurance Underwriting', l3s: [
    { name: 'Submission Intake & Risk Selection', lead: 'Reinsurance Underwriter', support: 'Treaty Analyst', exec: 'Reinsurer Exchange', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Submission / Clearance Intake & Triage', deliverable: 'Cleared submission record', l5s: ['Receive Submission from Cedant / Broker', 'Clear & De-Duplicate Submission', 'Triage Against Appetite & Strategy', 'Assign to Underwriter'] },
      { name: 'Treaty Underwriting & Cedant Due Diligence', deliverable: 'Cedant due-diligence assessment', l5s: ['Review Cedant Underwriting Philosophy', 'Analyze Portfolio Experience & Exposure', 'Assess Cedant Financial & Operational Strength', 'Document Underwriting Assessment'] },
      { name: 'Facultative Individual-Risk Appraisal', deliverable: 'Facultative risk appraisal', l5s: ['Appraise Individual Risk Submission', 'Evaluate Coverage & Loss Potential', 'Negotiate Facultative Terms', 'Record Facultative Decision'] },
      { name: 'Exposure Data Ingestion & Accumulation Check', deliverable: 'Accumulation check result', l5s: ['Ingest & Map Cedant Exposure Data', 'Run Accumulation vs Appetite Check', 'Flag Peak-Peril Concentrations', 'Confirm Capacity Availability'] },
    ] },
    { name: 'Pricing, Structuring & Capacity', lead: 'Reinsurance Underwriter', support: 'Pricing Actuary', exec: 'Catastrophe Modeling', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Proportional Pricing & Terms', deliverable: 'Proportional pricing & commission terms', l5s: ['Set Ceding & Profit / Contingent Commission', 'Model Expected Loss & Combined Ratio', 'Define Proportional Terms & Conditions', 'Review Pricing with Actuary'] },
      { name: 'Non-Proportional Pricing (XoL / Cat)', deliverable: 'XoL / cat pricing indication', l5s: ['Perform Experience & Exposure Rating', 'Price Reinstatement Premiums & Layers', 'Apply Cat Load & Capital Cost', 'Finalize Non-Proportional Price'] },
      { name: 'Cat / Peril Modelling & Capital-Cost Loading', deliverable: 'Cat-modelled capital load', l5s: ['Run Peril Models on Submission', 'Quantify Modelled Loss & Volatility', 'Apply Capital-Cost Loading', 'Document Modelling Basis'] },
      { name: 'Quote, Authorization & Line Setting', deliverable: 'Authorized quote & signed line', l5s: ['Prepare Quote within Authority', 'Obtain Referral / Authorization', 'Set Line (Lead vs Follow)', 'Issue Quote to Cedant / Broker'] },
    ] },
    { name: 'Binding & Treaty / Contract Management', lead: 'Reinsurance Underwriter', support: 'Treaty Analyst', exec: 'Sapiens ReinsuranceMaster', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Acceptance / Binding & Signed-Line Confirmation', deliverable: 'Bound inward treaty', l5s: ['Confirm Acceptance & Bind Risk', 'Confirm Signed Line & Order', 'Trigger Inward Premium Recognition', 'Notify Technical Accounting'] },
      { name: 'Contract Wording, Slips & Endorsements', deliverable: 'Executed treaty wording', l5s: ['Draft & Review Treaty Wording', 'Align Slip & Wording', 'Process Endorsements', 'Execute & Store Contract'] },
      { name: 'Treaty Register & Contract Data Setup', deliverable: 'Treaty register entry', l5s: ['Set Up Treaty in RI Admin System', 'Configure Cession & Accounting Rules', 'Validate Setup Against Wording', 'Publish Treaty to Operations'] },
    ] },
    { name: 'Assumed Cession Administration & Technical Accounting', lead: 'Reinsurance Accounting Specialist', support: 'Bordereaux Analyst', exec: 'Sapiens ReinsuranceMaster', sor: 'SAP S/4HANA Finance', l4s: [
      { name: 'Inward Bordereaux Intake & Validation', deliverable: 'Validated inward bordereaux', l5s: ['Receive Premium / Risk Bordereaux from Cedants', 'Validate & Normalize Bordereaux Data', 'Resolve Bordereaux Exceptions', 'Load Bordereaux to RI System'] },
      { name: 'Assumed Premium & Commission Booking', deliverable: 'Assumed premium & technical account', l5s: ['Book Assumed Premium & Commission', 'Produce Technical / Financial Accounts (EBOT)', 'Post to General Ledger (Multicurrency)', 'Reconcile Assumed Balances'] },
      { name: 'Profit-Commission & Adjustment Calculation', deliverable: 'Profit-commission statement', l5s: ['Compile Treaty Result Data', 'Calculate Profit / Sliding-Scale Commission', 'Process Adjustment Premiums', 'Issue Adjustment Statements'] },
      { name: 'Cash Collection & Reconciliation', deliverable: 'Collected inward balances', l5s: ['Issue Accounts to Cedants', 'Collect & Match Inward Cash', 'Reconcile Cedant Balances', 'Escalate Aged Inward Receivables'] },
    ] },
    { name: 'Assumed Claims & Portfolio Management', lead: 'Reinsurance Claims / Recoveries Specialist', support: 'Reserving Actuary', exec: 'Sapiens ReinsuranceMaster', sor: 'SAP S/4HANA Finance', l4s: [
      { name: 'Loss Advice Intake, Reserving & IBNR', deliverable: 'Assumed claim reserve & IBNR', l5s: ['Receive Loss Advices / Loss Bordereaux', 'Set Case Reserves on Assumed Claims', 'Assess IBNR & Reserve Adequacy', 'Report Assumed Claims Position'] },
      { name: 'Claims Payment & Cash-Call Handling', deliverable: 'Assumed claim payment', l5s: ['Validate Cedant Claim & Cash Call', 'Authorize Assumed Claim Payment', 'Handle Large-Loss & Cat Claims', 'Settle & Record Payment'] },
      { name: 'Commutations of Assumed Contracts', deliverable: 'Assumed commutation agreement', l5s: ['Evaluate Assumed Commutation', 'Value & Negotiate Commutation Terms', 'Execute Commutation Agreement', 'Settle & Close Contract'] },
      { name: 'Portfolio Steering & Renewal (1/1)', deliverable: 'Renewal & portfolio steering plan', l5s: ['Monitor Accumulation, PML & Profitability', 'Identify Remediation & Growth Actions', 'Plan 1/1 Renewal Strategy', 'Execute Renewal Decisions'] },
    ] },
  ] },
  // ── VS-3 Retrocession Management ──────────────────────────────────────────
  { name: 'Retrocession Management', l3s: [
    { name: 'Retro Strategy & Program Design', lead: 'Retrocession Manager', support: 'Catastrophe & Exposure Manager', exec: 'Catastrophe Modeling', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Assumed-Book Accumulation & Net-PML Analysis', deliverable: 'Net-PML & gross-to-net analysis', l5s: ['Aggregate Assumed-Book Exposure', 'Analyze Peak-Peril Accumulation', 'Quantify Net PML & IFRS-17 Volatility', 'Define Retro Objectives'] },
      { name: 'Retro Structuring (Proportional / Cat / Whole-Account)', deliverable: 'Retrocession program structure', l5s: ['Design Proportional vs Non-Proportional Retro', 'Structure Whole-Account & Cat Retro', 'Optimize Net Position vs Cost', 'Approve Retro Structure'] },
      { name: 'Alternative-Capital Design (ILS / Sidecars / Cat Bonds)', deliverable: 'Alternative-capital structure', l5s: ['Assess ILS & Collateralized Options', 'Design Sidecar / Cat-Bond / ILW Structure', 'Model Capital & Basis Risk', 'Approve Alternative-Capital Plan'] },
    ] },
    { name: 'Retro Placement & Broking', lead: 'Retrocession Manager', support: 'Reinsurance Credit & Security Analyst', exec: 'Reinsurer Exchange', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Submission to Retrocessionaires / ILS Funds', deliverable: 'Retro submission pack', l5s: ['Prepare Retro Submission & Modelling', 'Market to Retrocessionaires & ILS Funds', 'Manage Q&A & Capital-Markets Process', 'Track Indications & Capacity'] },
      { name: 'Quoting, Negotiation, Binding & Wording', deliverable: 'Bound retro contract', l5s: ['Evaluate Retro Quotes & Terms', 'Negotiate & Bind Retro Coverage', 'Finalize Retro Wording', 'Hand Off to Technical Accounting'] },
      { name: 'Collateral / Trust Structuring (Collateralized & Sidecar)', deliverable: 'Retro collateral / trust setup', l5s: ['Determine Collateral & Trust Needs', 'Establish Trust / Ring-Fenced Collateral', 'Confirm Funding & Documentation', 'Validate Collateral Adequacy'] },
    ] },
    { name: 'Retro Technical Accounting & Recoveries', lead: 'Reinsurance Accounting Specialist', support: 'Reinsurance Claims / Recoveries Specialist', exec: 'Sapiens ReinsuranceMaster', sor: 'SAP S/4HANA Finance', l4s: [
      { name: 'Retro Cession Calculation & Premium Booking', deliverable: 'Retro ceded-premium booking', l5s: ['Calculate Retro Cessions', 'Book Retro Ceded Premium & Commission', 'Apply Cession Rules by Layer', 'Reconcile Retro Cessions'] },
      { name: 'Retro Statements of Account & Settlement', deliverable: 'Retro statement & settlement', l5s: ['Produce Retro Technical Accounts', 'Process Retro Cash Settlements', 'Reconcile Retrocessionaire Balances', 'Resolve Retro Settlement Queries'] },
      { name: 'Retro Loss Recoveries, Cash Calls & Commutations', deliverable: 'Retro recovery & commutation', l5s: ['Calculate Retro Recoverables & Cash Calls', 'Bill & Collect Retro Recoveries', 'Manage Retro Commutations', 'Settle & Close Retro Recoveries'] },
    ] },
    { name: 'Retro Security & Aggregation Control', lead: 'Reinsurance Credit & Security Analyst', support: 'Catastrophe & Exposure Manager', exec: 'Archer', sor: 'Sapiens ReinsuranceMaster', l4s: [
      { name: 'Retrocessionaire Credit & Collateral Monitoring', deliverable: 'Retro counterparty security position', l5s: ['Assess Retrocessionaire Security & Ratings', 'Monitor Collateral, LOC, Trust & ILS Ring-Fencing', 'Set & Track Counterparty Limits', 'Report Retro Credit Risk'] },
      { name: 'Spiral / Concentration Control & Net-Aggregation Reporting', deliverable: 'Post-retro net-aggregation report', l5s: ['Detect Spiral & Counterparty Concentration', 'Compute Post-Retro Net Aggregation', 'Report Net Cat Capacity to ERM / Capital', 'Trigger Corrective Actions'] },
    ] },
  ] },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  // ── Resolve applications (must exist in the catalog).
  const appNames = [...new Set(TREE.flatMap((vs) => vs.l3s.flatMap((l3) => [l3.exec, l3.sor])))];
  const apps = await prisma.application.findMany({ where: { companyId, name: { in: appNames } }, select: { id: true, name: true } });
  const appId = new Map(apps.map((a) => [a.name, a.id]));
  const missingApps = appNames.filter((n) => !appId.has(n));
  if (missingApps.length) throw new Error(`apps not found: ${missingApps.join(', ')}`);

  await prisma.$transaction(async (tx) => {
    // ── Ensure roles (reuse existing; create missing specialists).
    const roleId = new Map<string, string>();
    for (const name of ENSURE_ROLES) {
      const existing = await tx.role.findFirst({ where: { companyId, name }, select: { id: true } });
      if (existing) { roleId.set(name, existing.id); continue; }
      const created = await tx.role.create({ data: {
        tenantId, companyId, name, roleFamily: 'Reinsurance', roleLevel: 'Individual Contributor',
        primaryDomain: DOMAIN, status: 'New', sourceSheet: 'reinsurance-split',
      } });
      roleId.set(name, created.id);
      console.log(`  + role ${name}`);
    }

    // ── Tear down the old bundle AND any prior build of the 3 targets across
    //    every model (makes the rebuild idempotent — ValueStream.name is unique).
    for (const name of [OLD_STREAM, ...TREE.map((t) => t.name)]) {
      const ex = await tx.valueStream.findFirst({ where: { companyId, name }, select: { id: true } });
      if (!ex) continue;
      const exNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: ex.id }, select: { id: true } });
      if (exNode) await tx.node.delete({ where: { id: exNode.id } }); // cascades sub_process + step
      await tx.subValueStream.deleteMany({ where: { valueStreamId: ex.id } });
      await tx.processStep.deleteMany({ where: { valueStreamId: ex.id } }); // cascades StepAppUsage/StepDeliverable via processStepId
      await tx.ioItem.deleteMany({ where: { valueStreamId: ex.id } });
      await tx.roleValueStream.deleteMany({ where: { valueStreamId: ex.id } });
      await tx.level.deleteMany({ where: { companyId, levelNumber: 3, name } });
      await tx.valueStream.delete({ where: { id: ex.id } });
      console.log(`removed stream "${name}"`);
    }

    // Parent for new value_stream nodes / Level rows: borrow from a sibling Core
    // Insurance stream so the new streams land in the same division/segment.
    const sibling = await tx.valueStream.findFirst({ where: { companyId, name: 'Claims Intake-to-Settlement' }, select: { id: true, domainId: true } });
    const sibNode = sibling ? await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: sibling.id }, select: { parentId: true } }) : null;
    const sibLevel = await tx.level.findFirst({ where: { companyId, levelNumber: 3, name: 'Claims Intake-to-Settlement' }, select: { parentId: true } });

    let vsCount = 0, l4Count = 0, l5Count = 0;
    for (const vs of TREE) {
      const nv = await tx.valueStream.create({ data: { tenantId, companyId, name: vs.name, domain: DOMAIN, domainId: sibling?.domainId ?? null, sourceSheet: 'reinsurance-split' } });
      const lastVsNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', parentId: sibNode?.parentId ?? undefined }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      const vsNode = await tx.node.create({ data: { companyId, typeKey: 'value_stream', name: vs.name, code: nv.id, parentId: sibNode?.parentId ?? null, provenance: 'real', sortOrder: (lastVsNode?.sortOrder ?? -1) + 1 } });
      await tx.level.create({ data: { tenantId, companyId, levelNumber: 3, name: vs.name, parentId: sibLevel?.parentId ?? null, sourceType: 'catalog' } });
      vsCount++;

      let spSort = 0;
      for (const l3 of vs.l3s) {
        const keyRoles = `${l3.lead}, ${l3.support}`;
        const l3row = await tx.subValueStream.create({ data: { tenantId, valueStreamId: nv.id, parentId: null, level: 3, name: l3.name, sourceSheet: 'reinsurance-split' } });

        // RoleValueStream: lead (Lead) + support (Core), subStream = L3 name.
        for (const [rn, pt] of [[l3.lead, 'Lead'], [l3.support, 'Core']] as const) {
          await tx.roleValueStream.create({ data: { tenantId, roleId: roleId.get(rn)!, valueStreamId: nv.id, subStream: l3.name, participationType: pt, notes: 'reinsurance-split', sourceSheet: 'reinsurance-split' } }).catch((e: any) => { if (e.code !== 'P2002') throw e; });
        }

        for (const l4 of l3.l4s) {
          const l4row = await tx.subValueStream.create({ data: { tenantId, valueStreamId: nv.id, parentId: l3row.id, level: 4, name: l4.name, sourceSheet: 'reinsurance-split' } });
          const l4node = await tx.node.create({ data: { companyId, typeKey: 'sub_process', name: l4.name, code: l4row.id, parentId: vsNode.id, provenance: 'real', sortOrder: spSort++ } });
          l4Count++;

          // Deliverables/inputs at the L4 (IoItem): one Input + the L4's Output.
          await tx.ioItem.create({ data: { tenantId, valueStreamId: nv.id, l3: l3.name, l4: l4.name, type: 'Input', name: `${l4.name} inputs`, keyRoles, illustrative: true } });
          await tx.ioItem.create({ data: { tenantId, valueStreamId: nv.id, l3: l3.name, l4: l4.name, type: 'Output / Deliverable', name: l4.deliverable, keyRoles, illustrative: true } });

          let stepNo = 1, stepSort = 0;
          let lastPsId = '';
          for (const l5 of l4.l5s) {
            await tx.subValueStream.create({ data: { tenantId, valueStreamId: nv.id, parentId: l4row.id, level: 5, name: l5, sourceSheet: 'reinsurance-split' } });
            const ps = await tx.processStep.create({ data: { tenantId, valueStreamId: nv.id, l3: l3.name, l4: l4.name, stepNumber: stepNo++, name: l5, leads: l3.lead, supporting: l3.support, illustrative: true } });
            lastPsId = ps.id;
            await tx.node.create({ data: { companyId, typeKey: 'step', name: l5, code: ps.id, parentId: l4node.id, provenance: 'real', sortOrder: stepSort++ } });
            // Applications at the step: Execution (primary) on every step; SoR on the first.
            await tx.stepAppUsage.create({ data: { tenantId, companyId, activityCode: ps.id, processStepId: ps.id, applicationId: appId.get(l3.exec)!, usageType: 'Execution', isPrimary: true, illustrative: true } });
            if (stepSort === 1) {
              await tx.stepAppUsage.create({ data: { tenantId, companyId, activityCode: ps.id, processStepId: ps.id, applicationId: appId.get(l3.sor)!, usageType: 'System of Record', isPrimary: false, illustrative: true } });
            }
            l5Count++;
          }
          // StepDeliverable on the L4's terminal step: the L4 output, SoR app, approver = lead.
          await tx.stepDeliverable.create({ data: { tenantId, companyId, activityCode: lastPsId, processStepId: lastPsId, name: l4.deliverable, sorApplicationId: appId.get(l3.sor)!, approverRoleId: roleId.get(l3.lead)!, approvalType: 'Manual Sign-off', illustrative: true } });
        }
        console.log(`  ${vs.name} / ${l3.name} (${l3.l4s.length} L4)`);
      }
    }
    console.log(`\nBuilt ${vsCount} value streams, ${l4Count} L4, ${l5Count} L5 — all wired (tasks/roles/deliverables/apps).`);
  }, { timeout: 180000, maxWait: 30000 });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
