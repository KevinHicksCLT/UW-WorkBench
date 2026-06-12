// fix-roles-2.ts — second corrective pass on the role catalog (2026-06-11):
//   1. Merge semantic duplicates (role + department level), aliases preserved.
//   2. Rename sloppy/abbreviated names (old name kept as alias).
//   3. Add 8 missing standard roles (incl. the requested API Developer).
//   4. Weave every role that had ZERO process-step/IO matches into its value
//      stream's steps (supporting/leads) so the role drawer shows real tasks.
// Idempotent: merges/renames skip when the source is gone; weaving checks
// membership before appending; creates are guarded by existence checks.
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { roleMatcher, splitRoleRefs } from '../src/lib/roleMatch.js';

const log = (...a: unknown[]) => console.log('•', ...a);

const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
if (!company) throw new Error('no company');
const c = company.id;
const t = company.tenantId;

const divisions = new Map(
  (await prisma.division.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((x) => [x.name, x.id]),
);
const allDepts = await prisma.department.findMany({ where: { companyId: c }, select: { id: true, name: true, divisionId: true } });
const dept = (divName: string, deptName: string) =>
  allDepts.find((d) => d.divisionId === divisions.get(divName) && d.name === deptName) ?? null;
const nodeByCode = async (code: string) => prisma.node.findFirst({ where: { companyId: c, code } });

const categories = new Map(
  (await prisma.category.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((x) => [x.name, x.id]),
);
const cat = (name: string) => categories.get(name) ?? null;

// ── helpers ──────────────────────────────────────────────────────────────────
function aliasUnion(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) for (const a of (p ?? '').split(';')) {
    const v = a.trim();
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out.join('; ');
}

async function mergeRole(dupName: string, survivorName: string) {
  const dup = await prisma.role.findFirst({ where: { companyId: c, name: dupName } });
  const survivor = await prisma.role.findFirst({ where: { companyId: c, name: survivorName } });
  if (!dup) { log(`skip merge (gone): ${dupName}`); return; }
  if (!survivor) { log(`!! merge target missing: ${survivorName}`); return; }
  await prisma.checklistItem.updateMany({ where: { roleId: dup.id }, data: { roleId: survivor.id } });
  await prisma.roleTask.updateMany({ where: { roleId: dup.id }, data: { roleId: survivor.id } });
  const taken = new Set(
    (await prisma.roleValueStream.findMany({ where: { roleId: survivor.id }, select: { valueStreamId: true, subStream: true } }))
      .map((x) => `${x.valueStreamId}|${x.subStream ?? ''}`),
  );
  for (const row of await prisma.roleValueStream.findMany({ where: { roleId: dup.id } })) {
    if (taken.has(`${row.valueStreamId}|${row.subStream ?? ''}`)) await prisma.roleValueStream.delete({ where: { id: row.id } });
    else await prisma.roleValueStream.update({ where: { id: row.id }, data: { roleId: survivor.id } });
  }
  await prisma.stepDeliverable.updateMany({ where: { approverRoleId: dup.id }, data: { approverRoleId: survivor.id } });
  await prisma.standardItem.updateMany({ where: { ownerRoleId: dup.id }, data: { ownerRoleId: survivor.id } });
  await prisma.risk.updateMany({ where: { ownerRoleId: dup.id }, data: { ownerRoleId: survivor.id } });
  await prisma.raidItem.updateMany({ where: { ownerRoleId: dup.id }, data: { ownerRoleId: survivor.id } });
  await prisma.role.updateMany({ where: { managerRoleId: dup.id }, data: { managerRoleId: survivor.id } });
  await prisma.node.deleteMany({ where: { companyId: c, typeKey: 'role', code: dup.id } });
  await prisma.role.delete({ where: { id: dup.id } });
  await prisma.role.update({
    where: { id: survivor.id },
    data: { itemRole: aliasUnion(survivor.name, survivor.itemRole, dup.name, dup.itemRole) },
  });
  log(`merged: ${dupName} → ${survivorName}`);
}

async function renameRole(oldName: string, newName: string) {
  const r = await prisma.role.findFirst({ where: { companyId: c, name: oldName } });
  if (!r) { log(`skip rename (gone): ${oldName}`); return; }
  await prisma.role.update({ where: { id: r.id }, data: { name: newName, itemRole: aliasUnion(oldName, r.itemRole === oldName ? null : r.itemRole) } });
  await prisma.node.updateMany({ where: { companyId: c, typeKey: 'role', code: r.id }, data: { name: newName } });
  log(`renamed: ${oldName} → ${newName}`);
}

async function moveRole(roleName: string, divName: string, deptName: string) {
  const r = await prisma.role.findFirst({ where: { companyId: c, name: roleName } });
  const d = dept(divName, deptName);
  if (!r || !d || r.departmentId === d.id) return;
  await prisma.role.update({ where: { id: r.id }, data: { departmentId: d.id, divisionId: divisions.get(divName) } });
  const dn = await nodeByCode(d.id);
  if (dn) await prisma.node.updateMany({ where: { companyId: c, typeKey: 'role', code: r.id }, data: { parentId: dn.id } });
  log(`moved: ${roleName} → ${divName} / ${deptName}`);
}

async function dropDeptIfEmpty(divName: string, deptName: string) {
  const d = dept(divName, deptName);
  if (!d) return;
  const left = await prisma.role.count({ where: { departmentId: d.id } });
  if (left > 0) { log(`!! ${deptName} still has ${left} roles — kept`); return; }
  await prisma.node.deleteMany({ where: { companyId: c, typeKey: 'department', code: d.id } });
  await prisma.department.delete({ where: { id: d.id } });
  log(`deleted empty department: ${divName} / ${deptName}`);
}

// ── 1 · duplicate merges ─────────────────────────────────────────────────────
// New role first so Service Developer can merge into it (the requested API dev).
const engDelivery = dept('Technology & Engineering', 'Engineering Delivery');
const existingNames = new Set((await prisma.role.findMany({ where: { companyId: c }, select: { name: true } })).map((r) => r.name));

type NewRole = {
  name: string; div: string; dep: string; level: string; family: string; itemRole?: string;
  description: string; responsibilities: string;
  checklists: [string, string | null][]; tasks: string[];
  vs: { name: string; participation: string };
};
const NEW_ROLES: NewRole[] = [
  {
    name: 'API Developer', div: 'Technology & Engineering', dep: 'Engineering Delivery', level: 'Individual Contributor', family: 'Engineering',
    itemRole: 'Backend Developer; Service Developer',
    description: 'Designs and builds the APIs and backend services the UI and integration layers consume — the server-side counterpart to the UI Developer.',
    responsibilities: 'Designs, builds, and maintains REST/event APIs and backend services; owns API contracts and versioning; writes automated tests; supports consumers (UI, integration, partners) of the services.',
    checklists: [
      ['Review and version every API contract change', 'Integration/APIs'],
      ['Write automated tests for each endpoint before release', 'Testing/Validation'],
      ['Document APIs in the service catalog', 'Documentation'],
      ['Complete code review before merge', 'Reviews/Audits'],
      ['Verify security and access controls on new endpoints', 'Security'],
    ],
    tasks: ['Build and maintain backend services and APIs', 'Design API contracts with consuming teams', 'Tune service performance and reliability', 'Support production issues with the SRE/operations team'],
    vs: { name: 'Technology Delivery & Change', participation: 'Core' },
  },
  {
    name: 'Mobile Developer', div: 'Technology & Engineering', dep: 'Engineering Delivery', level: 'Individual Contributor', family: 'Engineering',
    description: 'Builds and maintains the carrier’s mobile applications (policyholder self-service, claims FNOL photo capture, agent tools).',
    responsibilities: 'Develops iOS/Android features; integrates with backend APIs; manages app-store releases; monitors crash and adoption metrics.',
    checklists: [
      ['Test releases on target devices before store submission', 'Testing/Validation'],
      ['Complete code review before merge', 'Reviews/Audits'],
      ['Verify secure storage and transport of customer data', 'Security'],
      ['Update release notes for each app-store release', 'Documentation'],
    ],
    tasks: ['Build mobile features against backend APIs', 'Manage app-store submissions and releases', 'Monitor crash analytics and fix regressions', 'Pair with UX on mobile design patterns'],
    vs: { name: 'Technology Delivery & Change', participation: 'Core' },
  },
  {
    name: 'Data Scientist', div: 'Data & AI', dep: 'Architecture & Analytics', level: 'Individual Contributor', family: 'Data',
    description: 'Builds statistical and machine-learning models on operating, claims, and underwriting data — the hands-on counterpart to the Data Science Lead.',
    responsibilities: 'Frames analytical problems with the business; engineers features; trains and validates models; partners with ML Engineer to productionize; documents model assumptions and limitations.',
    checklists: [
      ['Validate training data quality and lineage', 'Data Governance & Quality'],
      ['Document model assumptions, features, and limitations', 'Documentation'],
      ['Peer-review model methodology before deployment', 'Reviews/Audits'],
      ['Register models with model risk management', 'Risk & Compliance'],
    ],
    tasks: ['Explore and prepare datasets', 'Train and validate predictive models', 'Present findings to business stakeholders', 'Hand models to ML engineering for production'],
    vs: { name: 'Data, Analytics & AI Management', participation: 'Core' },
  },
  {
    name: 'ML Engineer', div: 'Data & AI', dep: 'Data Engineering', level: 'Individual Contributor', family: 'Data',
    itemRole: 'Machine Learning Engineer; MLOps Engineer',
    description: 'Productionizes and operates machine-learning models — pipelines, deployment, monitoring, and retraining (the MLOps lifecycle).',
    responsibilities: 'Builds training/inference pipelines; deploys models to production; monitors drift and performance; automates retraining; owns the ML platform tooling.',
    checklists: [
      ['Version every deployed model and its training data', 'Data Governance & Quality'],
      ['Set drift and performance monitors before go-live', 'Monitoring/Alerting'],
      ['Document deployment and rollback runbooks', 'Runbooks'],
      ['Review model access controls with security', 'Security'],
    ],
    tasks: ['Build and operate ML pipelines', 'Deploy and monitor models in production', 'Automate retraining and evaluation', 'Maintain the feature store and ML tooling'],
    vs: { name: 'MLOps / ML Lifecycle Management', participation: 'Core' },
  },
  {
    name: 'UX Designer', div: 'Product, Delivery & PMO', dep: 'Product Delivery', level: 'Individual Contributor', family: 'Product',
    itemRole: 'Product Designer',
    description: 'Designs the user experience of customer, agent, and employee applications — research, journeys, wireframes, and design systems.',
    responsibilities: 'Runs user research; maps journeys; produces wireframes and prototypes; maintains the design system; validates designs with usability testing before build.',
    checklists: [
      ['Validate designs with usability testing before build', 'Testing Support'],
      ['Keep the design system components current', 'Documentation'],
      ['Review accessibility on every new screen', 'Reviews/Audits'],
      ['Hand off specs to UI/mobile developers', 'Operational Handoff'],
    ],
    tasks: ['Conduct user research and synthesize findings', 'Produce wireframes and interactive prototypes', 'Maintain the design system', 'Pair with product owners on requirements'],
    vs: { name: 'Product & Proposition Management', participation: 'Core' },
  },
  {
    name: 'Payroll Specialist', div: 'Human Resources & Talent', dep: 'Rewards', level: 'Individual Contributor', family: 'HR',
    itemRole: 'Payroll Administrator',
    description: 'Runs the payroll cycle — processing, deductions, tax withholding, and reconciliation — alongside benefits administration.',
    responsibilities: 'Processes payroll on schedule; maintains deductions and tax withholding; reconciles payroll to the GL; resolves employee pay inquiries; supports year-end tax forms.',
    checklists: [
      ['Run the payroll-cycle checklist each pay period', 'SOPs'],
      ['Reconcile payroll output to the general ledger', 'Financial/Budget'],
      ['Verify tax withholding and remittances', 'Governance/Compliance'],
      ['Obtain approval before off-cycle payments', 'Approvals/Sign-offs'],
    ],
    tasks: ['Process scheduled payroll runs', 'Maintain deduction and withholding setups', 'Resolve employee pay inquiries', 'Prepare year-end tax documents'],
    vs: { name: 'Talent & Workforce Management', participation: 'Core' },
  },
  {
    name: 'Commercial Lines Underwriter', div: 'Underwriting', dep: 'Field Underwriting', level: 'Individual Contributor', family: 'Underwriting',
    description: 'Underwrites commercial P&C risks — evaluates submissions, prices and structures coverage, and decides acceptance within authority (O*NET 13-2053.00).',
    responsibilities: 'Reviews commercial applications to evaluate risk and determine acceptance; examines exposures, loss history, and financials; declines excessive risks; structures terms, conditions, and pricing within authority.',
    checklists: [
      ['Examine submission documents for risk factors before quoting', 'SOPs'],
      ['Verify loss runs and exposure schedules', 'Reviews/Audits'],
      ['Decline risks outside appetite or authority', 'Governance/Compliance'],
      ['Document the underwriting rationale in the file', 'Documentation'],
      ['Refer risks above authority for approval', 'Approvals/Sign-offs'],
    ],
    tasks: ['Evaluate commercial submissions and quote terms', 'Negotiate coverage with brokers', 'Order and review loss-control reports', 'Manage renewal book profitability'],
    vs: { name: 'Submission-to-Bind / Underwriting', participation: 'Core' },
  },
  {
    name: 'Personal Lines Underwriter', div: 'Underwriting', dep: 'Field Underwriting', level: 'Individual Contributor', family: 'Underwriting',
    description: 'Underwrites personal auto/property risks — applies guidelines and judgment to applications outside straight-through processing (O*NET 13-2053.00).',
    responsibilities: 'Reviews personal-lines applications referred out of automated rules; evaluates applicant risk factors; approves, modifies, or declines within authority; feeds rule improvements back to product.',
    checklists: [
      ['Work the referral queue within service standards', 'SOPs'],
      ['Examine applicant risk factors per guidelines', 'Reviews/Audits'],
      ['Document decisions and guideline exceptions', 'Documentation'],
      ['Escalate exceptions above authority', 'Approvals/Sign-offs'],
    ],
    tasks: ['Underwrite referred personal-lines applications', 'Review inspection and verification reports', 'Handle agent inquiries on eligibility', 'Suggest automation-rule improvements'],
    vs: { name: 'Submission-to-Bind / Underwriting', participation: 'Core' },
  },
];

const legacyVsByName = new Map(
  (await prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((v) => [v.name, v.id]),
);
async function ensureLegacyVs(name: string): Promise<string> {
  let id = legacyVsByName.get(name);
  if (!id) {
    const v = await prisma.valueStream.create({ data: { tenantId: t, companyId: c, name } });
    legacyVsByName.set(name, v.id);
    id = v.id;
    log(`created legacy ValueStream row for canonical stream "${name}"`);
  }
  return id;
}

for (const nr of NEW_ROLES) {
  if (existingNames.has(nr.name)) { log(`skip (exists): ${nr.name}`); continue; }
  const d = dept(nr.div, nr.dep);
  if (!d) { log(`!! no department ${nr.div}/${nr.dep} — skipped ${nr.name}`); continue; }
  const role = await prisma.role.create({
    data: {
      tenantId: t, companyId: c, divisionId: divisions.get(nr.div), departmentId: d.id,
      name: nr.name, itemRole: nr.itemRole ?? nr.name, roleFamily: nr.family, roleLevel: nr.level,
      description: nr.description, responsibilities: nr.responsibilities, status: 'New',
      sourceSheet: 'external-research-2026-06',
    },
  });
  await prisma.checklistItem.createMany({
    data: nr.checklists.map(([text, catName]) => ({ tenantId: t, roleId: role.id, text, categoryId: catName ? cat(catName) : null, sourceSheet: 'external-research-2026-06' })),
  });
  await prisma.roleTask.createMany({
    data: nr.tasks.map((text) => ({ tenantId: t, roleId: role.id, text, sourceSheet: 'external-research-2026-06' })),
  });
  await prisma.roleValueStream.create({
    data: { tenantId: t, roleId: role.id, valueStreamId: await ensureLegacyVs(nr.vs.name), participationType: nr.vs.participation, sourceSheet: 'external-research-2026-06' },
  });
  const dn = await nodeByCode(d.id);
  await prisma.node.create({
    data: { companyId: c, typeKey: 'role', parentId: dn?.id ?? null, name: nr.name, code: role.id, provenance: 'real', attributes: { status: 'New', roleLevel: nr.level, roleFamily: nr.family } },
  });
  log(`added role: ${nr.name} (${nr.div} / ${nr.dep})`);
}
if (!engDelivery) log('!! Engineering Delivery dept not found');

// Role-level merges (after API Developer exists).
await mergeRole('Service Developer', 'API Developer');
await mergeRole('Policy Issue Specialist', 'Policy Issuance Specialist');
await mergeRole('Policy Issuance / Document Fulfillment Specialist', 'Policy Issuance Specialist');
await mergeRole('Cash Application / Billing Specialist', 'Cash Application Specialist');
await mergeRole('Subrogation Specialist', 'Subrogation / Litigation Specialist');
await mergeRole('Collections Recovery Specialist', 'Collections Specialist');
await mergeRole('Billing Collections Manager', 'Receivables Manager');

// Department-level consolidation.
await moveRole('Billing Operations Manager', 'Operations & Customer Service', 'Billing & Receivables');
await dropDeptIfEmpty('Operations & Customer Service', 'Billing Operations');
await dropDeptIfEmpty('Operations & Customer Service', 'Policy Issuance & Fulfillment');

// ── 2 · renames (details correct; old names preserved as aliases) ───────────
await renameRole('Prod Support', 'Production Support Analyst');
await renameRole('Talent Acquisition Spec', 'Talent Acquisition Specialist');
await renameRole('Comp Benefits Manager', 'Compensation & Benefits Manager');
await renameRole('Business Dev Manager', 'Business Development Manager');
await renameRole('Broker Relationship Mgr', 'Broker Relationship Manager');
await renameRole('Affinity Embedded Ins Mgr', 'Affinity & Embedded Insurance Manager');
await renameRole('Exposure Mgmt Manager', 'Exposure Management Manager');
await renameRole('Head Broker Distribution', 'Head of Broker Distribution');

// Misfiled: Commission Analyst sat under Distribution Leadership.
await moveRole('Commission Analyst', 'Sales, Distribution & Marketing', 'Distribution Operations');

// ── 3 · weave zero-match roles into their stream's process steps ────────────
// role name → { stream, step-name keyword hints, lead? }. Up to 3 matching
// steps get the role appended to `supporting` (or `leads`); if no step matches
// the hints, the first 2 steps of the stream are used; if the stream has no
// steps, up to 2 IO items get the role appended to keyRoles.
const WEAVE: Record<string, { stream: string; hints: string[]; lead?: boolean }> = {
  'Accounts Payable Specialist': { stream: 'Finance, Treasury & Capital Management', hints: ['payment', 'invoice', 'payab', 'disburse', 'close'] },
  'Actuarial Associate': { stream: 'Actuarial Pricing, Reserving & Capital Modeling', hints: ['pricing', 'rate', 'model', 'analysis'] },
  'Auto Claims Specialist': { stream: 'Claims Intake-to-Settlement', hints: ['auto', 'vehicle', 'appraisal', 'estimate', 'settle'] },
  'Business Continuity Analyst': { stream: 'Cybersecurity, Identity & Resilience', hints: ['continuity', 'resilience', 'recovery', 'test'] },
  'Chief Audit Executive': { stream: 'Audit & Assurance', hints: ['plan', 'report', 'committee', 'audit'], lead: true },
  'Chief HR Officer': { stream: 'Talent & Workforce Management', hints: ['strategy', 'workforce', 'plan'], lead: true },
  'Chief Strategy Officer': { stream: 'Enterprise Strategy & Portfolio Management', hints: ['strategy', 'plan', 'portfolio'], lead: true },
  'Chief of Staff': { stream: 'Enterprise Strategy & Portfolio Management', hints: ['governance', 'review', 'operating', 'cadence'] },
  'Claims Processor': { stream: 'Claims Intake-to-Settlement', hints: ['payment', 'process', 'data', 'document', 'set up'] },
  'Competitive Intelligence Analyst': { stream: 'Marketing, Growth & Customer Insights', hints: ['research', 'market', 'insight', 'competitor'] },
  'Corporate Development Manager': { stream: 'Enterprise Strategy & Portfolio Management', hints: ['business case', 'evaluate', 'investment', 'develop'] },
  'Coverage Analyst': { stream: 'Product & Proposition Management', hints: ['coverage', 'wording', 'form', 'product'] },
  'Coverholder Coordinator': { stream: 'Delegated Authority Management', hints: ['coverholder', 'delegated', 'bordereau', 'audit'] },
  'Disaster Recovery Analyst': { stream: 'Cybersecurity, Identity & Resilience', hints: ['recovery', 'disaster', 'restore', 'test'] },
  'Distribution Specialist': { stream: 'Distribution & Channel Management', hints: ['onboard', 'appoint', 'producer', 'support'] },
  'ETL Developer': { stream: 'Data, Analytics & AI Management', hints: ['pipeline', 'etl', 'integration', 'ingest', 'transform'] },
  'Endorsement Processor': { stream: 'Policy Administration & Servicing', hints: ['endorsement', 'change', 'amend', 'mid-term'] },
  'Executive Assistant': { stream: 'Enterprise Strategy & Portfolio Management', hints: ['meeting', 'communication', 'prepare', 'coordinate'] },
  'Executive Communications Manager': { stream: 'Marketing, Growth & Customer Insights', hints: ['communication', 'content', 'brand', 'message'] },
  'Field Claims Adjuster': { stream: 'Claims Intake-to-Settlement', hints: ['inspect', 'investigat', 'field', 'estimate', 'evaluat'] },
  'IAM Engineer / PAM Engineer': { stream: 'Cybersecurity, Identity & Resilience', hints: ['access', 'identity', 'privilege', 'provision'] },
  'Investor Relations Director': { stream: 'Finance, Treasury & Capital Management', hints: ['investor', 'disclosure', 'report', 'earnings'] },
  'Legal Secretary': { stream: 'Legal, Governance & Privacy Management', hints: ['document', 'filing', 'record', 'prepare'] },
  'Liability Claims Specialist': { stream: 'Claims Intake-to-Settlement', hints: ['liability', 'negotiat', 'settle', 'litigation'] },
  'Litigation Manager': { stream: 'Legal, Governance & Privacy Management', hints: ['litigation', 'dispute', 'counsel', 'matter'], lead: true },
  'Loss Reserving Analyst': { stream: 'Actuarial Pricing, Reserving & Capital Modeling', hints: ['reserve', 'reserving', 'triangle', 'ibnr'] },
  'Marketing Manager': { stream: 'Marketing, Growth & Customer Insights', hints: ['campaign', 'marketing', 'brand', 'launch'], lead: true },
  'People Analytics / HR Operations Manager': { stream: 'Talent & Workforce Management', hints: ['analytics', 'report', 'data', 'metric'] },
  'Policy Issuance Specialist': { stream: 'Policy Administration & Servicing', hints: ['issue', 'issuance', 'document', 'fulfill'] },
  'Pricing Analyst': { stream: 'Actuarial Pricing, Reserving & Capital Modeling', hints: ['pricing', 'rate', 'indication'] },
  'Procurement Manager': { stream: 'Third-Party & Vendor Management', hints: ['sourcing', 'contract', 'vendor', 'rfp', 'negotiat'], lead: true },
  'Product Filing Specialist': { stream: 'Product & Proposition Management', hints: ['filing', 'regulatory', 'rate', 'approve'] },
  'QA Automation Engineer': { stream: 'Technology Delivery & Change', hints: ['test', 'automation', 'quality'] },
  'Release / Environment Manager': { stream: 'Technology Delivery & Change', hints: ['release', 'deploy', 'environment'] },
  'Renewal Coordinator': { stream: 'Policy Administration & Servicing', hints: ['renewal'] },
  'Renewal Underwriter': { stream: 'Submission-to-Bind / Underwriting', hints: ['renewal', 'review'] },
  'SIU Field Investigator': { stream: 'Claims Intake-to-Settlement', hints: ['fraud', 'investigat', 'siu'] },
  'SIU Manager': { stream: 'Claims Intake-to-Settlement', hints: ['fraud', 'referral', 'siu'], lead: true },
  'Strategic Planning Analyst': { stream: 'Enterprise Strategy & Portfolio Management', hints: ['plan', 'analysis', 'strategy'] },
  'Territory Manager': { stream: 'Distribution & Channel Management', hints: ['agency', 'territory', 'producer', 'performance'] },
  'Trader': { stream: 'Investment & Asset Management', hints: ['trade', 'execution', 'portfolio', 'invest'] },
  'Training Developer': { stream: 'Change Management & Adoption', hints: ['training', 'content', 'develop', 'material'] },
  'Underwriting Quality / Audit Manager': { stream: 'Submission-to-Bind / Underwriting', hints: ['audit', 'quality', 'review'], lead: true },
  'Workforce Analyst': { stream: 'Customer Service, Complaints & Experience', hints: ['schedule', 'forecast', 'workforce', 'staffing'] },
  // New roles from this pass:
  'API Developer': { stream: 'Technology Delivery & Change', hints: ['api', 'integration', 'develop', 'build', 'code'] },
  'Mobile Developer': { stream: 'Technology Delivery & Change', hints: ['mobile', 'develop', 'build'] },
  'Data Scientist': { stream: 'Data, Analytics & AI Management', hints: ['model', 'analys', 'insight', 'science'] },
  'ML Engineer': { stream: 'MLOps / ML Lifecycle Management', hints: ['model', 'deploy', 'pipeline', 'monitor'] },
  'UX Designer': { stream: 'Product & Proposition Management', hints: ['design', 'experience', 'journey', 'prototype'] },
  'Payroll Specialist': { stream: 'Talent & Workforce Management', hints: ['payroll', 'pay', 'compensation'] },
  'Commercial Lines Underwriter': { stream: 'Submission-to-Bind / Underwriting', hints: ['risk', 'quote', 'bind', 'submission', 'evaluat'] },
  'Personal Lines Underwriter': { stream: 'Submission-to-Bind / Underwriting', hints: ['risk', 'quote', 'bind', 'submission', 'referral'] },
};

let woven = 0, ioFallback = 0, missing = 0;
for (const [roleName, w] of Object.entries(WEAVE)) {
  const role = await prisma.role.findFirst({ where: { companyId: c, name: roleName }, select: { id: true, name: true, itemRole: true } });
  if (!role) { log(`!! weave: role gone: ${roleName}`); missing++; continue; }
  const m = roleMatcher(role);
  const vsId = legacyVsByName.get(w.stream);
  if (!vsId) { log(`!! weave: stream missing: ${w.stream} (${roleName})`); missing++; continue; }
  const steps = await prisma.processStep.findMany({ where: { valueStreamId: vsId }, select: { id: true, name: true, leads: true, supporting: true }, orderBy: { stepNumber: 'asc' } });

  // Already matched somewhere in this stream? Then nothing to do.
  const already = steps.some((s) => [s.leads, s.supporting].some((cell) => splitRoleRefs(cell).some((tok) => m(tok))));
  if (already) continue;

  let targets = steps.filter((s) => w.hints.some((h) => s.name.toLowerCase().includes(h))).slice(0, 3);
  if (targets.length === 0) targets = steps.slice(0, 2);
  if (targets.length > 0) {
    for (const s of targets) {
      const field = w.lead ? 'leads' : 'supporting';
      const cur = (w.lead ? s.leads : s.supporting) ?? '';
      await prisma.processStep.update({ where: { id: s.id }, data: { [field]: cur ? `${cur}, ${role.name}` : role.name } });
    }
    woven++;
    log(`wove ${roleName} into ${targets.length} step(s) of "${w.stream}"${w.lead ? ' as lead' : ''}`);
  } else {
    // Stream has no steps — attach via IO items instead.
    const ios = await prisma.ioItem.findMany({ where: { valueStreamId: vsId }, take: 2 });
    if (ios.length === 0) {
      await prisma.ioItem.create({
        data: { tenantId: t, valueStreamId: vsId, type: 'Output', name: `${w.stream} deliverable`, keyRoles: role.name, illustrative: true },
      });
      log(`created IO item for ${roleName} ("${w.stream}" has no steps)`);
    } else {
      for (const io of ios) {
        if (splitRoleRefs(io.keyRoles).some((tok) => m(tok))) continue;
        await prisma.ioItem.update({ where: { id: io.id }, data: { keyRoles: io.keyRoles ? `${io.keyRoles}, ${role.name}` : role.name } });
      }
      log(`attached ${roleName} to ${ios.length} IO item(s) of "${w.stream}"`);
    }
    ioFallback++;
  }
}
log(`weave summary: ${woven} step-woven, ${ioFallback} io-fallback, ${missing} skipped`);

// ── 4 · sanity: every canonical stream should have ≥1 participating role ────
const vsNodes = await prisma.node.findMany({ where: { companyId: c, typeKey: 'value_stream' }, select: { name: true } });
const rvs = await prisma.roleValueStream.findMany({ where: { valueStream: { companyId: c } }, select: { valueStream: { select: { name: true } } } });
const streamsWithRoles = new Set(rvs.map((x) => x.valueStream.name));
for (const v of vsNodes) if (!streamsWithRoles.has(v.name)) log(`!! canonical stream with NO participating roles: ${v.name}`);

console.log('\ndone.');
await prisma.$disconnect();
