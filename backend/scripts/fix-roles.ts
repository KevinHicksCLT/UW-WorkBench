// fix-roles.ts — apply the externally-researched role-catalog corrections
// (deep-research run wf_4dc8e9f1, 2026-06-11). Idempotent: every create is
// guarded by an existence check, so re-runs are safe.
//
// Sources behind the changes (all 3-0/2-0 adversarially verified):
//   O*NET 13-1031.00 (claims adjusters/examiners/investigators + Field Claims
//   Adjuster title; processors are a separate clerical occupation),
//   BLS OOH claims occupations (adjuster→examiner workflow, SIU/investigators),
//   O*NET 13-2053.00 (underwriter tasks), O*NET 15-2011.00 (actuary),
//   IIA Global Internal Audit Standards 2024 (mandatory Chief Audit Executive;
//   final-communication deliverable), NAIC Model 822 (appointed actuary).
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const log = (...a: unknown[]) => console.log('•', ...a);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const c = company.id;
  const t = company.tenantId;

  const categories = new Map(
    (await prisma.category.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((x) => [x.name, x.id]),
  );
  const cat = (name: string) => categories.get(name) ?? null;

  const divisions = new Map(
    (await prisma.division.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((x) => [x.name, x.id]),
  );
  const allDepts = await prisma.department.findMany({ where: { companyId: c }, select: { id: true, name: true, divisionId: true } });
  const dept = (divName: string, deptName: string) =>
    allDepts.find((d) => d.divisionId === divisions.get(divName) && d.name === deptName) ?? null;

  const valueStreams = await prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const vsByHint = (...hints: string[]) => {
    for (const h of hints) {
      const m = valueStreams.find((v) => v.name.toLowerCase().includes(h));
      if (m) return m;
    }
    return null;
  };

  // Node-graph helpers: role/department/division nodes carry code = legacy id.
  const nodeByCode = async (code: string) => prisma.node.findFirst({ where: { companyId: c, code } });
  const segmentNode = async (name: string) =>
    prisma.node.findFirst({ where: { companyId: c, typeKey: 'segment', name } });

  // ── 1 · New departments / division ─────────────────────────────────────────
  // Executive Office (CEO seat) under Corporate Function; Claims Operations for
  // the clerical claims family O*NET separates from adjusters/examiners.
  async function ensureDivision(name: string, higherCategory: string): Promise<string> {
    let id = divisions.get(name);
    if (!id) {
      const d = await prisma.division.create({ data: { tenantId: t, companyId: c, code: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, higherCategory } });
      divisions.set(name, d.id);
      id = d.id;
      const seg = await segmentNode(higherCategory);
      await prisma.node.create({ data: { companyId: c, typeKey: 'division', parentId: seg?.id ?? null, name, code: d.id, provenance: 'real' } });
      log(`created division "${name}" (+node)`);
    }
    return id;
  }
  async function ensureDept(divName: string, deptName: string): Promise<{ id: string }> {
    const existing = dept(divName, deptName);
    if (existing) return existing;
    const divisionId = divisions.get(divName)!;
    const d = await prisma.department.create({ data: { tenantId: t, companyId: c, divisionId, name: deptName } });
    allDepts.push({ id: d.id, name: deptName, divisionId });
    const divNode = await nodeByCode(divisionId);
    await prisma.node.create({ data: { companyId: c, typeKey: 'department', parentId: divNode?.id ?? null, name: deptName, code: d.id, provenance: 'real' } });
    log(`created department "${divName} / ${deptName}" (+node)`);
    return d;
  }

  await ensureDivision('Executive Office', 'Corporate Function');
  await ensureDept('Executive Office', 'Executive Leadership');
  await ensureDept('Claims', 'Claims Operations');

  // ── 2 · New base roles ──────────────────────────────────────────────────────
  type NewRole = {
    name: string; div: string; dep: string; level: string; family: string;
    itemRole?: string; description: string; responsibilities: string;
    checklists: [string, string | null][]; tasks: string[];
    vs?: { hints: string[]; participation: string };
  };
  const NEW_ROLES: NewRole[] = [
    {
      name: 'Chief Executive Officer', div: 'Executive Office', dep: 'Executive Leadership', level: 'Executive', family: 'Executive',
      itemRole: 'CEO',
      description: 'Chief executive of the carrier, accountable to the board for strategy and performance across all segments.',
      responsibilities: 'Sets enterprise strategy and risk appetite; allocates capital across segments; chairs the executive committee; accountable to the board for results. Administrative reporting line for the Chief Audit Executive per IIA leading practice.',
      checklists: [
        ['Approve the annual strategic plan and enterprise budget', 'Approvals/Sign-offs'],
        ['Review quarterly enterprise performance against plan', 'Metrics & Reporting'],
        ['Approve the risk appetite statement jointly with the board', 'Risk & Compliance'],
        ['Chair the executive committee and ratify major decisions', 'Governance/Compliance'],
        ['Review executive succession and talent plans annually', 'Other'],
      ],
      tasks: ['Prepare and present the board reporting pack', 'Sponsor major transformation initiatives', 'Approve executive hires and compensation', 'Represent the company with investors, regulators, and rating agencies'],
      vs: { hints: ['strategy', 'performance', 'governance'], participation: 'Oversight' },
    },
    {
      name: 'Chief Audit Executive', div: 'Risk, Compliance & Audit', dep: 'Internal Audit', level: 'Executive', family: 'Audit',
      itemRole: 'CAE; Head of Internal Audit',
      description: 'Leadership role responsible for managing all aspects of the internal audit function (IIA Global Internal Audit Standards definition).',
      responsibilities: 'Manages the internal audit function per the IIA Global Internal Audit Standards: functionally accountable to the board/audit committee, administratively to the CEO; owns the risk-based audit plan and approves every final engagement communication before issuance.',
      checklists: [
        ['Approve the risk-based annual internal audit plan', 'Reviews/Audits'],
        ['Review and approve each final engagement communication before issuance', 'Approvals/Sign-offs'],
        ['Report functionally to the audit committee each quarter', 'Governance/Compliance'],
        ['Maintain the quality assurance and improvement program (QAIP)', 'Reviews/Audits'],
        ['Confirm internal audit independence and objectivity annually', 'Governance/Compliance'],
      ],
      tasks: ['Present the audit plan and budget to the audit committee', 'Track remediation of audit findings to closure', 'Coordinate with external auditors and regulators', 'Staff and develop the internal audit team'],
      vs: { hints: ['audit', 'compliance', 'risk'], participation: 'Oversight' },
    },
    {
      name: 'Field Claims Adjuster', div: 'Claims', dep: 'Claims Handling', level: 'Individual Contributor', family: 'Claims',
      itemRole: 'Field Adjuster',
      description: 'Investigates claims in the field — inspects damage, gathers photos and statements, and compiles the claim report for examiner review (O*NET 13-1031.00 sample title).',
      responsibilities: 'Per BLS: gathers information (photographs, written/recorded statements) and compiles a report for claims examiners to review; once approved, negotiates with the policyholder and settles the claim.',
      checklists: [
        ['Verify policy coverage before the field inspection', 'SOPs'],
        ['Document damage with photographs and recorded statements', 'Documentation'],
        ['Compile the claim report for examiner review', 'Documentation'],
        ['Negotiate settlement within authority after examiner approval', 'Approvals/Sign-offs'],
        ['Refer suspected fraud indicators to the SIU', 'Risk & Compliance'],
      ],
      tasks: ['Inspect property and vehicle damage on site', 'Interview claimants and witnesses', 'Review police and medical records to determine liability', 'Estimate repair costs and set initial reserves', 'Authorize payments within settlement authority'],
      vs: { hints: ['claims intake', 'claims'], participation: 'Core' },
    },
    {
      name: 'Claims Examiner', div: 'Claims', dep: 'Claims Handling', level: 'Individual Contributor', family: 'Claims',
      description: 'Reviews submitted claims and adjuster reports to ensure guidelines were followed before settlement (BLS: examiners review claims after submission).',
      responsibilities: 'Per BLS: reviews claims after submission to ensure claimants and adjusters followed proper guidelines; confirms coverage and payment amounts; flags questionable claims for investigation; consults legal counsel when needed.',
      checklists: [
        ['Review each adjuster claim report against handling guidelines', 'Reviews/Audits'],
        ['Confirm policy coverage and the payment amount before approval', 'Approvals/Sign-offs'],
        ['Contact doctors or employers for additional information on questionable claims', 'SOPs'],
        ['Return non-compliant claims with documented rationale', 'Documentation'],
        ['Ensure reserves are updated to reflect examination conclusions', 'Financial/Budget'],
      ],
      tasks: ['Audit a sample of settled claims for guideline compliance', 'Consult legal counsel on claims requiring litigation', 'Document examination conclusions in the claim file', 'Monitor adjuster compliance trends and feed back to QA/training'],
      vs: { hints: ['claims intake', 'claims'], participation: 'Core' },
    },
    {
      name: 'SIU Manager', div: 'Claims', dep: 'Special Investigations', level: 'Manager', family: 'Claims',
      description: 'Leads the Special Investigations Unit — triages fraud referrals and directs investigations of suspected fraudulent or criminal claims activity (BLS).',
      responsibilities: 'Directs SIU investigations of suspected fraud (arson, staged accidents, fraud rings per BLS); manages investigator caseloads; owns the anti-fraud plan and liaises with law enforcement and state fraud bureaus.',
      checklists: [
        ['Triage and assign incoming fraud referrals', 'SOPs'],
        ['Review and approve investigation case files', 'Reviews/Audits'],
        ['Approve referrals to law enforcement and state fraud bureaus', 'Approvals/Sign-offs'],
        ['Report SIU metrics and trends to compliance', 'Metrics & Reporting'],
        ['Maintain the anti-fraud plan required by state regulation', 'Governance/Compliance'],
      ],
      tasks: ['Oversee surveillance operations and evidence handling', 'Coordinate complex cases with claims and legal', 'Train adjusters on fraud indicators and referral criteria', 'Manage investigator workloads and case quality'],
      vs: { hints: ['claims'], participation: 'Oversight' },
    },
    {
      name: 'SIU Field Investigator', div: 'Claims', dep: 'Special Investigations', level: 'Individual Contributor', family: 'Claims',
      itemRole: 'Field Investigator; Forensics Specialist',
      description: 'Performs field investigation of suspected fraudulent claims, including surveillance, scene examination, and evidence collection (BLS: investigators often do surveillance work).',
      responsibilities: 'Investigates claims the company suspects involve fraudulent or criminal activity; conducts surveillance, scene examinations, background checks, and recorded statements; prepares investigation reports and referral packages.',
      checklists: [
        ['Conduct surveillance and document findings', 'SOPs'],
        ['Collect and preserve evidence with chain of custody', 'Documentation'],
        ['Take recorded statements from claimants and witnesses', 'Documentation'],
        ['Prepare the investigation report for SIU manager review', 'Reviews/Audits'],
        ['Support legal proceedings and testimony as required', 'Governance/Compliance'],
      ],
      tasks: ['Run background and claims-database checks', 'Examine loss scenes and coordinate forensics', 'Maintain complete case documentation', 'Assemble referral packages for law enforcement'],
      vs: { hints: ['claims'], participation: 'Support' },
    },
    {
      name: 'Data Analyst', div: 'Data & AI', dep: 'Analytics Delivery', level: 'Individual Contributor', family: 'Data',
      description: 'Turns operating, claims, and underwriting data into analyses, dashboards, and ad-hoc insights for business decision-makers.',
      responsibilities: 'Builds and maintains reports and dashboards; performs ad-hoc analyses; defines metrics with business owners; validates data quality before publishing insights.',
      checklists: [
        ['Validate source data quality before analysis', 'Data Governance & Quality'],
        ['Document analysis assumptions and methodology', 'Documentation'],
        ['Publish dashboards and circulate to stakeholders', 'Metrics & Reporting'],
        ['Peer-review analytical outputs before distribution', 'Reviews/Audits'],
      ],
      tasks: ['Build and maintain recurring reports', 'Run ad-hoc data pulls for business requests', 'Define and document metrics with business owners', 'Monitor KPI trends and flag anomalies'],
      vs: { hints: ['insight', 'data', 'analytics'], participation: 'Support' },
    },
    {
      name: 'Legal Counsel', div: 'Legal & Corporate Governance', dep: 'Commercial Legal', level: 'Individual Contributor', family: 'Legal',
      itemRole: 'Staff Attorney',
      description: 'Provides day-to-day legal advice to business units, drafts and negotiates contracts, and manages matters with outside counsel.',
      responsibilities: 'Advises business units on legal questions; drafts and negotiates agreements; manages outside counsel engagements and budgets; escalates material legal risk to the General Counsel.',
      checklists: [
        ['Review contracts before signature', 'Approvals/Sign-offs'],
        ['Track regulatory and litigation deadlines', 'Governance/Compliance'],
        ['Escalate material legal risk to the General Counsel', 'Risk & Compliance'],
        ['Manage outside counsel budgets and billing review', 'Financial/Budget'],
      ],
      tasks: ['Draft and negotiate commercial agreements', 'Prepare legal research memoranda', 'Support litigation holds and discovery', 'Advise on new products and marketing materials'],
      vs: { hints: ['legal', 'governance', 'compliance'], participation: 'Support' },
    },
    {
      name: 'Procurement Manager', div: 'Operations & Customer Service', dep: 'Vendor & Resilience', level: 'Manager', family: 'Operations',
      itemRole: 'Sourcing Manager',
      description: 'Runs sourcing and purchasing — RFPs, vendor selection, contract negotiation, and renewals — in partnership with vendor management.',
      responsibilities: 'Owns the sourcing process end to end: competitive RFPs, commercial negotiation, vendor due diligence with third-party risk, renewal management, and spend/savings reporting.',
      checklists: [
        ['Run competitive RFPs for spend above threshold', 'Vendor/Third-party'],
        ['Verify vendor due diligence is complete before contract', 'Vendor/Third-party'],
        ['Negotiate pricing and commercial terms', 'Approvals/Sign-offs'],
        ['Track contract renewals and expirations', 'SOPs'],
        ['Report procurement savings quarterly', 'Financial/Budget'],
      ],
      tasks: ['Maintain the preferred-supplier list', 'Manage purchase approval workflows', 'Coordinate vendor risk reviews with third-party risk management', 'Consolidate spend analytics for the COO'],
      vs: { hints: ['vendor', 'procure', 'sourcing'], participation: 'Lead' },
    },
    {
      name: 'Territory Manager', div: 'Sales, Distribution & Marketing', dep: 'Broker Distribution', level: 'Manager', family: 'Distribution',
      description: 'Owns production and agency relationships in an assigned territory — recruits and develops agencies, drives premium growth and profitability.',
      responsibilities: 'Manages agency and broker relationships in a defined territory; recruits and appoints new agencies; drives territory production against plan; coordinates appetite with underwriting.',
      checklists: [
        ['Hold quarterly business reviews with key agencies', 'Reviews/Audits'],
        ['Review territory production against plan monthly', 'Metrics & Reporting'],
        ['Maintain a pipeline of prospective agency appointments', 'SOPs'],
        ['Create corrective plans for underperforming agencies', 'Documentation'],
      ],
      tasks: ['Recruit and appoint new agencies', 'Train producers on products and underwriting appetite', 'Coordinate territory appetite with underwriting', 'Represent the carrier at industry events'],
      vs: { hints: ['distribution'], participation: 'Core' },
    },
    {
      name: 'Contact Center Supervisor', div: 'Operations & Customer Service', dep: 'Customer Service', level: 'Manager', family: 'Service',
      description: 'Supervises a contact-center team — schedules, coaches, and quality-monitors agents against service-level targets.',
      responsibilities: 'Leads a team of contact-center agents: workforce scheduling, call-quality monitoring, coaching, escalation handling, and service-level reporting.',
      checklists: [
        ['Review service levels and queue health daily', 'Monitoring/Alerting'],
        ['Complete weekly call-quality evaluations per agent', 'Reviews/Audits'],
        ['Maintain coaching plans for every agent', 'Training/Comms'],
        ['Verify escalation-handling SOP adherence', 'SOPs'],
      ],
      tasks: ['Build workforce schedules with the workforce analyst', 'Handle escalated customer calls', 'Report CSAT and SLA metrics to operations leadership', 'Onboard and certify new agents'],
      vs: { hints: ['service', 'customer'], participation: 'Core' },
    },
    {
      name: 'Marketing Manager', div: 'Sales, Distribution & Marketing', dep: 'Marketing', level: 'Manager', family: 'Marketing',
      description: 'Plans and executes marketing campaigns across channels; manages budget, agencies, and brand standards.',
      responsibilities: 'Owns campaign planning and execution: briefs, channel mix, agency management, advertising-compliance review, budget tracking, and ROI reporting.',
      checklists: [
        ['Approve campaign briefs before launch', 'Approvals/Sign-offs'],
        ['Run brand and advertising-compliance review of materials', 'Governance/Compliance'],
        ['Report campaign ROI after each campaign', 'Metrics & Reporting'],
        ['Track marketing budget against plan monthly', 'Financial/Budget'],
      ],
      tasks: ['Maintain the campaign calendar', 'Manage agency and vendor relationships', 'Oversee content production', 'Hand qualified leads to distribution'],
      vs: { hints: ['marketing'], participation: 'Core' },
    },
    {
      name: 'Trader', div: 'Finance & Investments', dep: 'Investments', level: 'Individual Contributor', family: 'Investments',
      itemRole: 'Investment Trader',
      description: 'Executes fixed-income and other portfolio trades per portfolio-manager direction and the investment policy statement.',
      responsibilities: 'Executes trades within investment-policy limits; documents best execution; reconciles trade tickets daily; coordinates settlement with operations and the custodian.',
      checklists: [
        ['Confirm trades are within policy limits before execution', 'Risk & Compliance'],
        ['Document best execution for each trade', 'Documentation'],
        ['Reconcile trade tickets same day', 'SOPs'],
        ['Escalate limit breaches immediately', 'Monitoring/Alerting'],
      ],
      tasks: ['Execute portfolio trades per PM direction', 'Monitor markets and liquidity conditions', 'Coordinate settlement with investment operations and custodian', 'Maintain broker-dealer relationships'],
      vs: { hints: ['investment'], participation: 'Core' },
    },
    {
      name: 'Accounts Payable Specialist', div: 'Finance & Investments', dep: 'Financial Control', level: 'Individual Contributor', family: 'Finance',
      itemRole: 'AP Specialist; AR/AP Specialist',
      description: 'Processes supplier invoices and payment runs; maintains vendor master data and resolves payment exceptions.',
      responsibilities: 'Runs the accounts-payable cycle: invoice matching, payment runs, vendor master maintenance, exception resolution, and month-end AP reconciliation.',
      checklists: [
        ['Complete three-way match before payment', 'SOPs'],
        ['Obtain weekly payment-run approval', 'Approvals/Sign-offs'],
        ['Verify vendor master-data changes with a second approver', 'Governance/Compliance'],
        ['Reconcile AP at month end', 'Financial/Budget'],
      ],
      tasks: ['Process supplier invoices', 'Resolve invoice and payment exceptions', 'Prepare 1099 and tax documentation', 'Produce AP aging reports'],
      vs: { hints: ['billing', 'payab', 'finance'], participation: 'Support' },
    },
    {
      name: 'Distribution Specialist', div: 'Sales, Distribution & Marketing', dep: 'Distribution Operations', level: 'Individual Contributor', family: 'Distribution',
      description: 'Supports distribution channels day to day — onboarding producers, maintaining channel materials, and resolving channel inquiries.',
      responsibilities: 'Provides operational support across distribution channels: producer onboarding with licensing, channel documentation, inquiry resolution, and commission-discrepancy support.',
      checklists: [
        ['Complete the producer onboarding checklist for each appointment', 'SOPs'],
        ['Keep channel materials current', 'Documentation'],
        ['Meet inquiry-resolution SLAs', 'Metrics & Reporting'],
        ['Support commission-discrepancy resolution', 'Financial/Budget'],
      ],
      tasks: ['Process producer appointments and terminations with licensing', 'Maintain channel documentation', 'Support territory managers with channel data', 'Track channel performance metrics'],
      vs: { hints: ['distribution'], participation: 'Support' },
    },
  ];

  const existingNames = new Set((await prisma.role.findMany({ where: { companyId: c }, select: { name: true } })).map((r) => r.name));
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
    if (nr.vs) {
      const v = vsByHint(...nr.vs.hints);
      if (v) {
        await prisma.roleValueStream.create({
          data: { tenantId: t, roleId: role.id, valueStreamId: v.id, participationType: nr.vs.participation, sourceSheet: 'external-research-2026-06' },
        });
      }
    }
    const deptNode = await nodeByCode(d.id);
    await prisma.node.create({
      data: {
        companyId: c, typeKey: 'role', parentId: deptNode?.id ?? null, name: nr.name, code: role.id,
        provenance: 'real', attributes: { status: 'New', roleLevel: nr.level, roleFamily: nr.family },
      },
    });
    log(`added role: ${nr.name} (${nr.div} / ${nr.dep})`);
  }

  // ── 3 · Alias fixes (itemRole; ';' separates multiple aliases) ─────────────
  const ALIASES: [string, string][] = [
    ['Insurance Product Manager', 'Product Manager'],
    ['Commission Analyst', 'Commissions Analyst'],
    ['Organizational Change Manager', 'Change Manager'],
    ['Customer Experience Lead', 'Customer Experience Manager'],
    ['QA Analyst', 'Quality Analyst'],
    ['Technical Project Manager', 'Project Manager'],
    ['IT Service Desk Analyst', 'IT Support'],
    ['Security Analyst', 'SOC Analyst'],
    ['DevOps / Platform Automation Engineer', 'DevOps Engineer'],
    ['Statutory Reporting Analyst', 'Statutory Accountant'],
    ['Learning Development Manager', 'Training Manager; Learning & Development Manager'],
    ['Agency Relations Manager', 'Producer Relations Manager'],
    ['Risk Engineer', 'Risk Engineer / Loss Control Specialist; Loss Control Specialist'],
  ];
  for (const [name, alias] of ALIASES) {
    const r = await prisma.role.findFirst({ where: { companyId: c, name } });
    if (!r) { log(`!! alias target missing: ${name}`); continue; }
    if (r.itemRole !== alias) {
      await prisma.role.update({ where: { id: r.id }, data: { itemRole: alias } });
      log(`alias: ${name} ← "${alias}"`);
    }
  }

  // ── 4 · Renames (old name preserved as alias so existing refs keep resolving) ─
  const RENAMES: [string, string][] = [
    ['Internal Audit', 'Internal Auditor'],
    ['Sustainability stakeholder', 'Sustainability Risk Manager'],
    ['Capacity stakeholder', 'Capacity Planner'],
    ['Program Mgmt Office', 'PMO Manager'],
  ];
  for (const [oldName, newName] of RENAMES) {
    const r = await prisma.role.findFirst({ where: { companyId: c, name: oldName } });
    if (!r) { log(`skip rename (gone): ${oldName}`); continue; }
    await prisma.role.update({ where: { id: r.id }, data: { name: newName, itemRole: oldName } });
    await prisma.node.updateMany({ where: { companyId: c, typeKey: 'role', code: r.id }, data: { name: newName } });
    log(`renamed: ${oldName} → ${newName}`);
  }

  // ── 5 · Re-departmenting (O*NET: processors are clerical/ops, not leadership) ─
  const MOVES: [string, string, string][] = [
    ['Claims Analyst', 'Claims', 'Claims Operations'],
    ['Claims Coordinator', 'Claims', 'Claims Operations'],
    ['Claims Processor', 'Claims', 'Claims Operations'],
    ['Medical Claims Reviewer', 'Claims', 'Medical Claims Management'],
    ['Salvage Coordinator', 'Claims', 'Claims Recoveries & Litigation'],
    ['Subrogation Specialist', 'Claims', 'Claims Recoveries & Litigation'],
    ['Prod Support', 'Technology & Engineering', 'Operations'],
    ['Systems Administrator', 'Technology & Engineering', 'Operations'],
    ['Clearance Specialist', 'Underwriting', 'Operations & Governance'],
  ];
  for (const [roleName, divName, deptName] of MOVES) {
    const r = await prisma.role.findFirst({ where: { companyId: c, name: roleName } });
    const d = dept(divName, deptName);
    if (!r || !d) { log(`!! move skipped: ${roleName} → ${divName}/${deptName}`); continue; }
    if (r.departmentId === d.id) continue;
    await prisma.role.update({ where: { id: r.id }, data: { departmentId: d.id, divisionId: divisions.get(divName) } });
    const deptNode = await nodeByCode(d.id);
    if (deptNode) await prisma.node.updateMany({ where: { companyId: c, typeKey: 'role', code: r.id }, data: { parentId: deptNode.id } });
    log(`moved: ${roleName} → ${divName} / ${deptName}`);
  }

  // Production Readiness should now be empty — remove it (and its node).
  const prodReadiness = dept('Operations & Customer Service', 'Production Readiness');
  if (prodReadiness) {
    const left = await prisma.role.count({ where: { departmentId: prodReadiness.id } });
    if (left === 0) {
      await prisma.node.deleteMany({ where: { companyId: c, typeKey: 'department', code: prodReadiness.id } });
      await prisma.department.delete({ where: { id: prodReadiness.id } });
      log('deleted empty department: Operations & Customer Service / Production Readiness');
    } else log(`!! Production Readiness still has ${left} roles — not deleted`);
  }

  // ── 6 · Duplicate merges (survivor keeps both titles as aliases) ────────────
  const MERGES: [string, string][] = [
    ['SRE', 'Site Reliability Engineer'],
    ['DBA', 'Database Administrator'],
  ];
  for (const [dupName, survivorName] of MERGES) {
    const dup = await prisma.role.findFirst({ where: { companyId: c, name: dupName } });
    const survivor = await prisma.role.findFirst({ where: { companyId: c, name: survivorName } });
    if (!dup || !survivor) { log(`skip merge (missing): ${dupName} → ${survivorName}`); continue; }
    // Move children; RoleValueStream rows that would collide on the unique key are dropped.
    await prisma.checklistItem.updateMany({ where: { roleId: dup.id }, data: { roleId: survivor.id } });
    await prisma.roleTask.updateMany({ where: { roleId: dup.id }, data: { roleId: survivor.id } });
    await prisma.assignment.updateMany({ where: { roleId: dup.id }, data: { roleId: survivor.id } });
    const survivorVs = await prisma.roleValueStream.findMany({ where: { roleId: survivor.id }, select: { valueStreamId: true, subStream: true } });
    const taken = new Set(survivorVs.map((x) => `${x.valueStreamId}|${x.subStream ?? ''}`));
    const dupVs = await prisma.roleValueStream.findMany({ where: { roleId: dup.id } });
    for (const row of dupVs) {
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
    await prisma.role.update({ where: { id: survivor.id }, data: { itemRole: `${survivorName}; ${dupName}` } });
    log(`merged: ${dupName} → ${survivorName}`);
  }

  console.log('\ndone.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
