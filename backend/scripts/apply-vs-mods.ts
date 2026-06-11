// apply-vs-mods.ts — applies the adversarially-verified MODIFICATION findings
// from the external value-stream research (vs-mods.json is the evidence trail;
// the rules below are the hand-encoded, reviewed translation of each finding).
//
// Every ProcessStep change is mirrored where the step renders:
//   step Node.attributes (and name on renames), SubValueStream L5 names,
//   Work-tab Task titles. Deletions unwire ProcessStep + Node + SVS5 + Task +
//   StepDeliverable/StepAppUsage and close the stepNumber gap.
//
// Idempotent: token replacements no-op once applied; deletes/renames skip
// already-applied state. Run from backend/:  npx tsx scripts/apply-vs-mods.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Rule tables (translation of vs-mods.json findings) ──────────────────────
// Token remaps: applied to leads+supporting of every step whose code starts
// with one of the scope prefixes. Tokens match case-insensitively after
// splitting on , ; /.
const TOKEN_RULES: { scopes: string[]; map: Record<string, string> }[] = [
  { scopes: ['RF-21-03'], map: { 'capital modeling actuary': 'Capital Model Actuary', 'catastrophe (cat) modeler': 'CAT Modeler' } },
  { scopes: ['RF-21-02-S06'], map: { 'statutory accountant': 'Statutory Reporting Analyst' } },
  { scopes: ['RF-21-02-S05'], map: { 'cfo': 'Chief Financial Officer' } },
  { scopes: ['RF-21-02-S01'], map: { 'data analyst': 'Actuarial Technician' } },
  { scopes: ['RC-19-01', 'RC-19-02', 'RC-19-03', 'RC-19-04'], map: { 'premium auditor': 'Audit Associate', 'none': 'Audit Associate' } },
  { scopes: ['TD-28-03'], map: { 'site reliability engineer': 'IT Service Delivery Manager' } },
  { scopes: ['TD-28-07'], map: { 'site reliability engineer': 'Platform Engineering Lead' } },
  { scopes: ['TR-25-02'], map: { 'requesting manager': 'Operations Manager', 'data owner': 'Data Steward', 'it support': 'IT Service Desk Analyst', 'internal auditor': 'Internal Audit' } },
  { scopes: ['TR-25-03'], map: { 'soc analyst': 'Security Analyst', 'it operations': 'Infrastructure / Network Engineer' } },
  { scopes: ['TD-24-02-S02'], map: {} }, // handled via SETS below
  { scopes: ['CI-03-03-S02', 'CI-03-03-S01', 'CI-03-02-S04'], map: { 'data analyst': 'Bordereaux Analyst' } },
  { scopes: ['CI-03-04', 'CI-03-02-S03'], map: { 'internal auditor': 'Internal Audit' } },
  { scopes: ['PG-16-03'], map: { 'producer relations manager': 'Agency Relations Manager', 'territory manager': 'Sales / Distribution Analyst', 'marketing manager': 'Marketing Coordinator', 'training manager': 'Training Coordinator', 'product manager': 'Insurance Product Manager', 'it support': 'IT Service Desk Analyst' } },
  { scopes: ['F-11'], map: { 'cfo': 'Chief Financial Officer', 'bu heads': 'Chief Underwriting Officer, Chief Operating Officer', 'business unit heads': 'Chief Underwriting Officer, Chief Operating Officer', 'statutory accountant': 'Statutory Reporting Analyst' } },
  { scopes: ['F-12'], map: { 'chief investment officer (cio)': 'Chief Investment Officer', 'cfo': 'Chief Financial Officer', 'board': 'Board Governance Lead', 'trader': 'Portfolio Manager', 'custodian': 'Investment Operations Manager', 'statutory accountant': 'Statutory Reporting Analyst' } },
  { scopes: ['CI-05'], map: { 'reinsurance broker': 'Broker Relationship Mgr', 'cfo': 'Chief Financial Officer', 'ar/ap specialist': 'AR Reconciliation Analyst', 'statutory accountant': 'Statutory Reporting Analyst' } },
  { scopes: ['CI-05-03-S04'], map: { 'data analyst': 'Data Steward' } },
  { scopes: ['OT-15'], map: { 'production support': 'Prod Support', 'underwriting operations manager': 'UW Operations Manager' } },
  { scopes: ['RC-20-01'], map: { 'risk analysts': 'Risk Analyst', 'internal auditor': 'Internal Audit' } },
  { scopes: ['RC-20-04'], map: { 'chief risk officer (cro)': 'Operational Risk Manager' } },
  { scopes: ['OC-13-01'], map: { 'business requestor': 'Business Analyst', 'it security': 'Security Analyst', 'legal counsel': 'General Counsel', 'ap specialist': 'Vendor Coordinator', 'it support': 'IT Service Desk Analyst', 'procurement manager': 'Vendor Manager' } },
  { scopes: ['OC-14'], map: { 'customer service representative': 'Customer Service Rep', 'csr': 'Customer Service Rep', 'supervisor': 'Contact Center Ops Manager', 'ops manager': 'Contact Center Ops Manager', 'escalation specialist': 'Senior Contact Center Agent', 'qa analyst': 'Quality Assurance Analyst (Service)', 'cx lead': 'Customer Experience Lead', 'claims specialist': 'Claims Analyst', 'billing specialist': 'Billing Analyst', 'uw specialist': 'Underwriting Assistant', 'underwriting specialist': 'Underwriting Assistant', 'subject matter expert': 'Senior Contact Center Agent' } },
  { scopes: ['CI-26-04'], map: { 'reinsurance manager': 'Collections Recovery Specialist' } },
  { scopes: ['CI-02'], map: { 'claims intake representative': 'Claims Intake Rep', 'customer service representative': 'Customer Service Rep', 'claims adjuster / examiner': 'Claims Adjuster', 'chief claims officer (cco)': 'Chief Claims Officer', 'field investigator': 'SIU Investigator', 'forensics specialist': 'SIU Investigator', 'field adjuster': 'Claims Adjuster', 'outside counsel': 'Litigation Counsel', 'siu manager': 'SIU Investigator, Claims Director / Manager' } },
  { scopes: ['CI-01'], map: { 'billing & collections manager': 'Billing Collections Manager', 'collections manager': 'Billing Collections Manager' } },
  { scopes: ['CS-07'], map: { 'learning & development manager': 'Learning Development Manager', 'training manager': 'Training Coordinator', 'change manager': 'Program Mgmt Office', 'pmo': 'Program Mgmt Office' } },
  { scopes: ['PG-18-02', 'PG-18-04'], map: { 'product manager': 'Insurance Product Manager', 'marketing manager': 'Marketing Coordinator', 'business development manager': 'Business Dev Manager', 'senior underwriter / underwriter': 'Senior Underwriter', 'legal counsel': 'Coverage Counsel', 'training manager': 'Learning Development Manager', 'policy administration operations lead': 'Policy Admin Ops Lead' } },
  { scopes: ['CI-04'], map: { 'policy administration operations lead': 'Policy Admin Ops Lead', 'distribution specialist': 'Policy Issuance / Document Fulfillment Specialist', 'customer service representative': 'Customer Service Rep', 'csr': 'Customer Service Rep', 'contact center operations manager': 'Contact Center Ops Manager', 'producer': 'Broker Support Specialist' } },
  { scopes: ['PG-17'], map: { 'contact center operations manager': 'Contact Center Ops Manager', 'customer service representative': 'Customer Service Rep' } },
  { scopes: ['CI-06'], map: { 'senior underwriter / underwriter': 'Senior Underwriter', 'loss control specialist': 'Risk Engineer', 'chief underwriting officer (cuo)': 'Chief Underwriting Officer', 'underwriting analyst': 'Underwriting Analyst / Associate' } },
  { scopes: ['CS-09'], map: { 'compensation & benefits manager': 'Comp Benefits Manager', 'learning & development manager': 'Learning Development Manager', 'training manager': 'Training Coordinator', 'hiring manager': 'HR Business Partner', 'interview panel': 'Recruiter' } },
  { scopes: ['T-22-04'], map: { 'change manager': 'Change Coordinator', 'devops engineer': 'DevOps / Platform Automation Engineer', 'project manager': 'Technical Project Manager', 'cab members': 'IT Service Delivery Manager', 'it leadership': 'Head of IT', 'smes': '' } },
];

// Wholesale lead/supporting sets for specific codes (or code prefixes with @all).
const SETS: { code: string; allInPrefix?: boolean; lead?: string; supporting?: string }[] = [
  { code: 'RF-21-04', allInPrefix: true, lead: 'Pricing Actuary', supporting: 'Appointed Actuary, Chief Actuary' },
  { code: 'TR-25-01', allInPrefix: true, lead: 'ISO Architect', supporting: 'Application Security Lead, Chief Info Security Officer' },
  { code: 'TD-24-01-S01', lead: 'Data Architect', supporting: 'Data Steward, BI / Analytics Manager' },
  { code: 'TD-24-01-S02', lead: 'Data Architect', supporting: 'Data Steward, BI / Analytics Manager' },
  { code: 'TD-24-01-S03', lead: 'Data Architect', supporting: 'Data Steward, BI / Analytics Manager' },
  { code: 'TD-24-01-S04', lead: 'Data Architect', supporting: 'Data Steward, BI / Analytics Manager' },
  { code: 'TD-24-01-S05', lead: 'Chief Data Officer', supporting: 'Data Architect, Data Steward' },
  { code: 'TD-24-02-S02', supporting: 'Data Governance, Data Steward' },
  { code: 'TD-24-02-S03', supporting: 'Data Steward, BI / Analytics Manager' },
  { code: 'TD-24-02-S04', supporting: 'Data Engineer, Data Steward' },
  { code: 'TD-24-02-S06', supporting: 'Data Governance' },
  { code: 'CI-03-03-S04', lead: 'Delegated Authority Analyst', supporting: 'Compliance Analyst, Delegated Authority Manager' },
  { code: 'PG-16-03-S06', lead: 'Commission Analyst', supporting: 'Distribution Operations Manager, Channel Operations Coordinator' },
  { code: 'F-11-01-S04', lead: 'Statutory Reporting Analyst', supporting: 'Statutory Reporting Manager' },
  { code: 'F-11-01-S06', lead: 'Statutory Reporting Analyst', supporting: 'Statutory Reporting Manager' },
  { code: 'F-11-04-S06', lead: 'Statutory Reporting Analyst', supporting: 'Statutory Reporting Manager' },
  { code: 'F-11-02-S02', lead: 'FP&A Manager', supporting: 'Operations Manager, Financial Analyst' },
  { code: 'F-11-02-S06', lead: 'Chief Financial Officer', supporting: 'Chief Operating Officer, Board Governance Lead' },
  { code: 'EM-10-02', allInPrefix: true, lead: 'Program Mgmt Office', supporting: 'Chief Product Officer, Chief Technology Officer, Chief Operating Officer' },
  { code: 'F-12-04-S01', lead: 'Chief Financial Officer', supporting: 'Chief Investment Officer, Board Governance Lead' },
  { code: 'F-12-04-S04', supporting: 'Investment Operations Manager' },
  { code: 'F-12-04-S05', supporting: 'Statutory Reporting Analyst, Senior Accountant' },
  { code: 'CS-08-02-S01', lead: 'Contract Administrator', supporting: 'Contracts Manager' },
  { code: 'CS-08-02-S03', lead: 'General Counsel', supporting: 'Contracts Manager, Paralegal' },
  { code: 'CS-08-02-S04', supporting: 'General Counsel, Chief Financial Officer' },
  { code: 'CS-08-02-S05', supporting: 'Corporate Secretary' },
  { code: 'CS-08-02-S06', supporting: 'Contract Administrator' },
  { code: 'RC-20-04', allInPrefix: true, lead: 'Operational Risk Manager', supporting: 'Chief Risk Officer, Model Risk Manager' },
  { code: 'RC-20-01-S04', lead: 'Enterprise Risk Manager' },
  { code: 'RC-20-01-S06', lead: 'Chief Risk Officer', supporting: 'Corporate Secretary, Board Governance Lead' },
  { code: 'CI-05-02-S03', supporting: 'Broker Relationship Mgr, Ceded Reinsurance Analyst' },
  { code: 'CI-05-02-S04', supporting: 'Broker Relationship Mgr, Ceded Reinsurance Analyst' },
  { code: 'CI-05-02-S05', supporting: 'Contracts Manager, General Counsel' },
  { code: 'CI-05-02-S06', supporting: 'Reinsurance Manager, Data Steward' },
  { code: 'OC-13-01-S01', lead: 'Vendor Manager' },
  { code: 'OC-13-01-S02', lead: 'Vendor Manager' },
  { code: 'OC-13-01-S05', lead: 'Vendor Manager', supporting: 'Vendor Coordinator, IT Service Desk Analyst' },
  { code: 'PG-17-01', allInPrefix: true, lead: 'Market Research Analyst', supporting: 'Chief Marketing Officer, Customer Insights Lead' },
  { code: 'PG-17-02', allInPrefix: true, lead: 'Customer Insights Lead', supporting: 'Chief Marketing Officer, Market Research Analyst' },
  { code: 'PG-17-03', allInPrefix: true, lead: 'Digital Marketing Specialist', supporting: 'Marketing Coordinator, Contact Center Ops Manager' },
];

// Supporting-role appends (keep current cast, add the named role).
const APPENDS: { code: string; addSupporting: string }[] = [
  { code: 'CS-07-02-S03', addSupporting: 'Communications Specialist' },
  { code: 'CS-07-02-S05', addSupporting: 'Communications Specialist' },
  { code: 'CS-09-02-S05', addSupporting: 'Compliance Analyst' },
];

// Output appends (keep current outputs, add a traceable handoff).
const OUT_APPENDS: { code: string; append: string }[] = [
  { code: 'CI-04-04-S05', append: 'escalation to formal complaint process (OC-14-03)' },
];

// Move a step to the end of its L4 (every path terminates in close).
const MOVES: { l4: string; nameContains: string }[] = [
  { l4: 'CI-02-04', nameContains: 'Close Claim' },
];

// Step renames (name [+ description/io]) — node + SVS5 + Task titles follow.
const RENAMES: { code: string; name: string; inputs?: string; outputs?: string; description?: string }[] = [
  { code: 'RC-19-01-S02', name: 'Assess Audit Universe & Risks' },
  { code: 'RC-19-01-S03', name: 'Prioritize Engagements & Resources' },
  { code: 'RC-19-01-S04', name: 'Draft Annual Audit Plan' },
  { code: 'RC-19-01-S05', name: 'Publish Audit Plan & Schedule' },
  { code: 'OC-14-02-S01', name: 'Review Routed Case & Confirm Scope', inputs: 'Routed case, service priority (from OC-14-01)', outputs: 'Confirmed service request' },
  { code: 'T-27-04-S01', name: 'Analyze Usage & Coverage' },
  { code: 'T-27-04-S02', name: 'Model Commitment Options' },
  { code: 'T-27-04-S03', name: 'Approve Commitment Purchase' },
  { code: 'T-27-04-S04', name: 'Execute Purchase' },
  { code: 'T-27-04-S05', name: 'Track Coverage & Utilization' },
  { code: 'OT-15-04-S01', name: 'Assess Release & Support Readiness' },
  { code: 'OT-15-04-S02', name: 'Plan Hypercare & Cutover Support' },
  { code: 'OT-15-04-S03', name: 'Execute Hypercare Support' },
  { code: 'OT-15-04-S04', name: 'Verify Stability & Exit Criteria' },
  { code: 'OT-15-04-S05', name: 'Accept Service & Hand Over' },
  { code: 'T-23-03-S01', name: 'Define Requirements' },
  { code: 'T-23-03-S02', name: 'Develop Approach' },
  { code: 'T-23-03-S03', name: 'Build & Configure' },
  { code: 'T-23-03-S04', name: 'Validate & Review' },
  { code: 'T-23-03-S05', name: 'Approve & Publish' },
  { code: 'PG-16-03-S02', name: 'Refer Producer to Onboarding', outputs: 'Producer referral package, handoff to broker/MGA onboarding (PG-16-02)' },
  { code: 'F-11-04-S05', name: 'Execute Capital Actions', inputs: 'Capital plan, dividend capacity, holding-company act notice requirements, surplus position', outputs: 'Executed dividends/capital contributions/surplus notes, regulator notices, capital action records', description: 'Plan and execute shareholder/parent dividends (including 30-day prior notice or approval for extraordinary dividends under the state Holding Company Act), capital contributions and surplus notes.' },
  { code: 'CI-02-04-S11', name: 'Negotiate Pre-Trial Resolution' },
  { code: 'PG-18-02-S01', name: 'Confirm Opportunity & Define Design Scope', inputs: 'Opportunity statement, target segment, value hypothesis, decision backlog (from PG-18-01)', outputs: 'Confirmed design scope and product charter' },
  { code: 'T-22-02-S06', name: 'Promote to Test/Staging Environment', outputs: 'Release candidate handed to Quality & Release (T-22-03)' },
  { code: 'T-22-04-S06', name: 'Verify, Review & Close', inputs: 'Implemented change, post-deployment validation and monitoring results', outputs: 'Closed change, post-implementation review findings, CMDB update' },
];
const RENAME_SETS: { code: string; lead?: string; supporting?: string }[] = [
  { code: 'F-11-04-S05', lead: 'Treasury Manager', supporting: 'Capital Management Manager, Chief Financial Officer' },
];

// IO-only extensions.
const IO_UPDATES: { code: string; inputs?: string; outputs?: string }[] = [
  { code: 'CI-03-01-S02', inputs: 'Licensing status, state requirements, E&O/professional indemnity certificates, premium trust account details', outputs: 'License verification report, E&O cover confirmation, bank/trust account verification' },
  { code: 'PG-18-04-S05', outputs: 'Regulatory filings, regulator objections resolved, filing approvals' },
  { code: 'T-22-02-S01', inputs: 'Prioritized backlog, requirements, scope statement, dependency list (from T-22-01)' },
  { code: 'CS-09-02-S05', outputs: 'Cleared candidate, §1033 attestation/screening result, waiver application where required' },
];

// Verified duplicate steps to remove (full unwire + renumber the gap closed).
const DELETES: string[] = [
  'RC-20-02-S07', 'RC-20-02-S08', 'RC-20-02-S09', 'RC-20-02-S10', 'RC-20-02-S11', 'RC-20-02-S12', // audit lifecycle duplicated inside compliance control monitoring (lives in RC-19)
  'F-12-04-S01',  // 'Set Investment Policy' duplicates F-12-01
  'PG-16-03-S03', // 'Train on Products' duplicates PG-16-02 enablement
  'OC-13-01-S03', 'OC-13-01-S04', // contracting duplicated (lives in OC-13-02)
  'OC-13-01-S06', // SLA monitoring duplicated (lives in OC-13-03)
];

// L4 retitles (ProcessStep.l4 + SVS4 + sub_process node + step-node attrs + IoItem.l4).
const L4_RENAMES: { activityCode: string; newName: string }[] = [
  { activityCode: 'F-12-04', newName: 'Trade execution, settlement, valuation and investment reporting' },
  { activityCode: 'CI-04-04', newName: 'Servicing complaint triage and first-tier resolution' },
];

// L4 reorder: registry & versioning before deployment & serving.
const L4_SWAPS: { a: string; b: string }[] = [{ a: 'TD-29-05', b: 'TD-29-04' }];

// ─────────────────────────────────────────────────────────────────────────────
const splitTokens = (cell: string | null) => (cell ? cell.split(/[,;]+/).map((t) => t.trim()).filter(Boolean) : []);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;
  const roles = await prisma.role.findMany({ where: { companyId }, select: { name: true } });
  const roleNames = new Set(roles.map((r) => r.name.toLowerCase()));

  const nodeFor = (stepId: string) => prisma.node.findFirst({ where: { companyId, typeKey: 'step', code: stepId }, select: { id: true, attributes: true } });
  async function mirrorNode(stepId: string, patch: Record<string, unknown>, name?: string) {
    const n = await nodeFor(stepId);
    if (!n) return;
    await prisma.node.update({ where: { id: n.id }, data: { ...(name ? { name } : {}), attributes: { ...(n.attributes as object ?? {}), ...patch } } });
  }

  // 1. Token remaps
  let tokenChanges = 0;
  for (const rule of TOKEN_RULES) {
    if (!Object.keys(rule.map).length) continue;
    const steps = await prisma.processStep.findMany({
      where: { OR: rule.scopes.map((s) => ({ code: { startsWith: s } })) },
      select: { id: true, code: true, leads: true, supporting: true },
    });
    for (const s of steps) {
      const fix = (cell: string | null) => {
        const out: string[] = [];
        for (const t of splitTokens(cell)) {
          const mapped = rule.map[t.toLowerCase()];
          for (const piece of splitTokens(mapped ?? t)) if (!out.some((x) => x.toLowerCase() === piece.toLowerCase())) out.push(piece);
        }
        return out.length ? out.join(', ') : null;
      };
      const leads = fix(s.leads), supporting = fix(s.supporting);
      if (leads !== s.leads || supporting !== s.supporting) {
        await prisma.processStep.update({ where: { id: s.id }, data: { leads, supporting } });
        await mirrorNode(s.id, { leads, supporting });
        tokenChanges++;
      }
    }
  }

  // 2. Wholesale sets
  let setChanges = 0;
  for (const r of [...SETS, ...RENAME_SETS]) {
    const steps = await prisma.processStep.findMany({
      where: (r as any).allInPrefix ? { code: { startsWith: r.code } } : { code: r.code },
      select: { id: true, leads: true, supporting: true },
    });
    for (const s of steps) {
      const data: any = {};
      if (r.lead && r.lead !== s.leads) data.leads = r.lead;
      if (r.supporting && r.supporting !== s.supporting) data.supporting = r.supporting;
      if (!Object.keys(data).length) continue;
      await prisma.processStep.update({ where: { id: s.id }, data });
      await mirrorNode(s.id, data);
      setChanges++;
    }
  }

  // 3. Renames (+ optional io/description) — node name, SVS5 name, Task titles follow.
  // Mirrors are scoped to the step's OWN L4 / a single task row: same-named
  // template steps exist in sibling L4s, and an unscoped updateMany steals
  // their mirrors (found by the 2026-06-11 audit; repair-audit-gaps.mjs).
  let renames = 0;
  for (const r of RENAMES) {
    const s = await prisma.processStep.findFirst({ where: { code: r.code }, select: { id: true, name: true, valueStreamId: true, l4: true } });
    if (!s || s.name === r.name) continue;
    const data: any = { name: r.name };
    if (r.inputs) data.inputs = r.inputs;
    if (r.outputs) data.outputs = r.outputs;
    if (r.description) data.description = r.description;
    await prisma.processStep.update({ where: { id: s.id }, data });
    await mirrorNode(s.id, { ...(r.inputs ? { inputs: r.inputs } : {}), ...(r.outputs ? { outputs: r.outputs } : {}) }, r.name);
    const svs4 = s.l4 ? await prisma.subValueStream.findFirst({ where: { valueStreamId: s.valueStreamId, level: 4, name: s.l4 }, select: { id: true } }) : null;
    await prisma.subValueStream.updateMany({ where: { valueStreamId: s.valueStreamId, level: 5, name: s.name, ...(svs4 ? { parentId: svs4.id } : {}) }, data: { name: r.name } });
    const task = await prisma.task.findFirst({ where: { companyId, title: s.name, source: 'process', deliverable: { valueStreamId: s.valueStreamId } }, select: { id: true } });
    if (task) await prisma.task.update({ where: { id: task.id }, data: { title: r.name } });
    renames++;
  }

  // 4. IO updates
  for (const u of IO_UPDATES) {
    const s = await prisma.processStep.findFirst({ where: { code: u.code }, select: { id: true } });
    if (!s) continue;
    await prisma.processStep.update({ where: { id: s.id }, data: { inputs: u.inputs, outputs: u.outputs } });
    await mirrorNode(s.id, { inputs: u.inputs, outputs: u.outputs });
  }

  // 4b. Supporting-role appends + output appends + move-to-end.
  for (const ap of APPENDS) {
    const s = await prisma.processStep.findFirst({ where: { code: ap.code }, select: { id: true, supporting: true } });
    if (!s || splitTokens(s.supporting).some((t) => t.toLowerCase() === ap.addSupporting.toLowerCase())) continue;
    const supporting = [...splitTokens(s.supporting), ap.addSupporting].join(', ');
    await prisma.processStep.update({ where: { id: s.id }, data: { supporting } });
    await mirrorNode(s.id, { supporting });
  }
  for (const oa of OUT_APPENDS) {
    const s = await prisma.processStep.findFirst({ where: { code: oa.code }, select: { id: true, outputs: true } });
    if (!s || s.outputs?.includes(oa.append)) continue;
    const outputs = s.outputs ? `${s.outputs}, ${oa.append}` : oa.append;
    await prisma.processStep.update({ where: { id: s.id }, data: { outputs } });
    await mirrorNode(s.id, { outputs });
  }
  for (const mv of MOVES) {
    const steps = await prisma.processStep.findMany({ where: { parentProcessId: mv.l4 }, orderBy: { stepNumber: 'asc' }, select: { id: true, name: true, stepNumber: true } });
    const target = steps.find((s) => s.name.includes(mv.nameContains));
    if (!target || target.stepNumber === steps.length) continue;
    for (const s of steps) {
      const newNum = s.id === target.id ? steps.length : s.stepNumber > target.stepNumber ? s.stepNumber - 1 : s.stepNumber;
      if (newNum === s.stepNumber) continue;
      await prisma.processStep.update({ where: { id: s.id }, data: { stepNumber: newNum } });
      await mirrorNode(s.id, { stepNumber: newNum });
      const n = await nodeFor(s.id);
      if (n) await prisma.node.update({ where: { id: n.id }, data: { sortOrder: newNum } });
    }
    console.log(`   ~ moved "${target.name}" to the end of ${mv.l4}`);
  }

  // 5. Deletes — unwire everywhere, then close stepNumber gaps per L4.
  let deletes = 0;
  const touchedL4s = new Set<string>();
  for (const code of DELETES) {
    const s = await prisma.processStep.findFirst({ where: { code }, select: { id: true, name: true, valueStreamId: true, parentProcessId: true } });
    if (!s) continue;
    await prisma.stepDeliverable.deleteMany({ where: { processStepId: s.id } });
    await prisma.stepAppUsage.deleteMany({ where: { processStepId: s.id } });
    const n = await nodeFor(s.id);
    if (n) await prisma.node.delete({ where: { id: n.id } });
    await prisma.subValueStream.deleteMany({ where: { valueStreamId: s.valueStreamId, level: 5, name: s.name } });
    await prisma.task.deleteMany({ where: { companyId, title: s.name, source: 'process', deliverable: { valueStreamId: s.valueStreamId } } });
    await prisma.processStep.delete({ where: { id: s.id } });
    if (s.parentProcessId) touchedL4s.add(s.parentProcessId);
    deletes++;
  }
  for (const l4 of touchedL4s) {
    const steps = await prisma.processStep.findMany({ where: { parentProcessId: l4 }, orderBy: { stepNumber: 'asc' }, select: { id: true, stepNumber: true } });
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].stepNumber !== i + 1) {
        await prisma.processStep.update({ where: { id: steps[i].id }, data: { stepNumber: i + 1 } });
        await mirrorNode(steps[i].id, { stepNumber: i + 1 });
        const n = await nodeFor(steps[i].id);
        if (n) await prisma.node.update({ where: { id: n.id }, data: { sortOrder: i + 1 } });
      }
    }
  }

  // 6. L4 retitles
  for (const r of L4_RENAMES) {
    const steps = await prisma.processStep.findMany({ where: { parentProcessId: r.activityCode }, select: { id: true, l4: true, valueStreamId: true } });
    if (!steps.length || steps[0].l4 === r.newName) continue;
    const oldName = steps[0].l4!;
    await prisma.processStep.updateMany({ where: { parentProcessId: r.activityCode }, data: { l4: r.newName } });
    await prisma.subValueStream.updateMany({ where: { valueStreamId: steps[0].valueStreamId, level: 4, name: oldName }, data: { name: r.newName } });
    await prisma.node.updateMany({ where: { companyId, typeKey: 'sub_process', name: oldName }, data: { name: r.newName } });
    await prisma.ioItem.updateMany({ where: { valueStreamId: steps[0].valueStreamId, l4: oldName }, data: { l4: r.newName } });
    for (const s of steps) await mirrorNode(s.id, { l4: r.newName });
  }

  // 7. L4 reorders (map ordering = sub_process node sortOrder)
  for (const sw of L4_SWAPS) {
    const findSub = async (code: string) => {
      const st = await prisma.processStep.findFirst({ where: { parentProcessId: code }, select: { id: true } });
      const sn = st ? await nodeFor(st.id) : null;
      const pid = sn ? (await prisma.node.findFirst({ where: { id: (await prisma.node.findFirst({ where: { id: sn.id }, select: { parentId: true } }))!.parentId! }, select: { id: true, sortOrder: true } })) : null;
      return pid;
    };
    const a = await findSub(sw.a), b = await findSub(sw.b);
    if (a && b && a.sortOrder > b.sortOrder) {
      await prisma.node.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } });
      await prisma.node.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } });
      console.log(`   ~ reordered L4s ${sw.a} before ${sw.b}`);
    }
  }

  // 8. Report any remaining role tokens that don't resolve to the inventory in touched scopes.
  const allScopes = [...new Set([...TOKEN_RULES.flatMap((r) => r.scopes), ...SETS.map((s) => s.code)])];
  const unresolved = new Map<string, number>();
  for (const sc of allScopes) {
    const steps = await prisma.processStep.findMany({ where: { code: { startsWith: sc } }, select: { leads: true, supporting: true } });
    for (const s of steps) for (const t of [...splitTokens(s.leads), ...splitTokens(s.supporting)])
      if (!roleNames.has(t.toLowerCase())) unresolved.set(t, (unresolved.get(t) ?? 0) + 1);
  }
  if (unresolved.size) console.log('   ! still-unresolved tokens in touched scopes:', JSON.stringify([...unresolved.entries()]));
  console.log(`Done: ${tokenChanges} token remaps, ${setChanges} role sets, ${renames} renames, ${deletes} deletions.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
