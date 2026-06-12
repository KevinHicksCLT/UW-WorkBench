// backfill-roles.ts — fills the gaps so EVERY role carries the full picture:
//   1. value-stream participation + I/O (inputs/outputs) for roles that had none
//   2. responsibilities (role tasks) for roles that had none
//
// Injected role rows are stamped sourceSheet='backfill' so their provenance is
// honest (they are researched/synthesized, not from the workbook). Idempotent:
// re-running only fills roles that are still empty.
//
// Run from backend/:  npx tsx scripts/backfill-roles.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seniority from the role title (mirrors the explorer's nameRank).
function nameRank(name: string): number {
  const n = name.toLowerCase();
  if (/\bchief\b|\bceo\b|^president\b/.test(n)) return 0;
  if (/\bhead\b|\bofficer\b|general counsel|\bcontroller\b|\bdirector\b|\bvp\b/.test(n)) return 1;
  if (/\bmanager\b|\blead\b|\bprincipal\b|\bsupervisor\b/.test(n)) return 2;
  return 3;
}
const PART_BY_RANK = ['Oversight', 'Oversight', 'Lead', 'Core'];

// ── Domain profiles: role-title keyword → I/O + responsibilities ────────────
// First match wins; {vs} interpolates the value-stream name for relevance.
type Profile = { test: RegExp; inputs: string; outputs: string; tasks: string[] };
const PROFILES: Profile[] = [
  { test: /chief|head|director|officer|\bvp\b|president/,
    inputs: 'Strategy and OKRs, performance dashboards, budget and headcount plans, board and regulatory priorities',
    outputs: 'Strategic direction, approved plans and budgets, performance reviews, executive decisions',
    tasks: ['Set strategy and objectives for {vs}', 'Own the operating budget and headcount plan', 'Review performance against KPIs and targets', 'Approve major decisions, investments and exceptions', 'Represent the function to the executive team and board', 'Manage senior stakeholder and partner relationships', 'Develop and mentor the leadership team'] },
  { test: /underwrit/,
    inputs: 'Submissions and applications, risk data and exposure, pricing models, broker information',
    outputs: 'Risk decisions, priced quotes, bound policies, referral notes',
    tasks: ['Assess and select risks within authority for {vs}', 'Price and quote submissions using rating models', 'Negotiate terms and conditions with brokers', 'Document underwriting rationale and referrals', 'Monitor portfolio performance and loss ratios', 'Apply underwriting guidelines and compliance controls'] },
  { test: /actuar|pricing/,
    inputs: 'Claims and exposure data, loss triangles, economic assumptions, pricing requests',
    outputs: 'Rate indications, reserve estimates, pricing models, actuarial reports',
    tasks: ['Build and maintain pricing and reserving models for {vs}', 'Analyse loss experience and trends', 'Produce rate indications and reserve estimates', 'Validate model assumptions and data quality', 'Support regulatory filings and reviews', 'Communicate actuarial findings to stakeholders'] },
  { test: /claim|adjuster|examiner|loss|subrogat|recover/,
    inputs: 'First notice of loss, policy and coverage data, evidence and documentation, vendor reports',
    outputs: 'Coverage decisions, reserves, settlement payments, recovery actions, closed claims',
    tasks: ['Investigate and evaluate claims within {vs}', 'Determine coverage and set appropriate reserves', 'Negotiate and approve settlements within authority', 'Coordinate vendors, experts and recovery actions', 'Maintain accurate claim files and documentation', 'Identify fraud, leakage and subrogation opportunities'] },
  { test: /data|analyt|report|insight|\bbi\b|scien/,
    inputs: 'Source data extracts, business questions, reporting requirements, data quality rules',
    outputs: 'Datasets and pipelines, dashboards and reports, analyses, recommendations',
    tasks: ['Build and maintain data pipelines and models for {vs}', 'Develop dashboards and self-service reporting', 'Analyse trends and surface actionable insights', 'Ensure data quality, lineage and governance', 'Partner with stakeholders to frame analytical questions', 'Document data definitions and metrics'] },
  { test: /engineer|developer|architect|devops|\bsre\b|platform|software|technolog/,
    inputs: 'Requirements and user stories, technical designs, tickets and incidents, architecture standards',
    outputs: 'Working software, deployments, technical documentation, resolved incidents',
    tasks: ['Design, build and ship features supporting {vs}', 'Review code and uphold engineering standards', 'Operate, monitor and support production systems', 'Resolve defects and incidents within SLA', 'Automate build, test and deployment pipelines', 'Document architecture and technical decisions'] },
  { test: /complian|\brisk\b|audit|governance|control|regulat/,
    inputs: 'Regulations and policies, control inventory, risk assessments, audit findings',
    outputs: 'Control assessments, risk registers, audit reports, remediation plans',
    tasks: ['Assess and monitor risks and controls across {vs}', 'Maintain the risk register and control inventory', 'Perform reviews, testing and audits', 'Track issues and remediation to closure', 'Advise the business on regulatory obligations', 'Prepare compliance and assurance reporting'] },
  { test: /financ|account|treasur|invest|controller|billing|payment/,
    inputs: 'Ledgers and transactions, budgets and forecasts, invoices, financial policies',
    outputs: 'Financial statements, reconciliations, forecasts, approved payments',
    tasks: ['Maintain accurate financial records for {vs}', 'Perform reconciliations and close activities', 'Prepare budgets, forecasts and variance analysis', 'Process and control payments and receivables', 'Support audits and regulatory reporting', 'Advise the business on financial performance'] },
  { test: /\bhr\b|talent|recruit|people|learning|compensation|benefit/,
    inputs: 'Workforce plans, candidate pipelines, employee data, policies and programs',
    outputs: 'Hires and onboarding, employee programs, policy guidance, workforce reporting',
    tasks: ['Deliver people programs supporting {vs}', 'Manage recruiting and onboarding activities', 'Advise managers on policy and employee matters', 'Run performance, development and engagement cycles', 'Maintain accurate workforce data and reporting', 'Ensure compliance with employment policies'] },
  { test: /sales|distribut|broker|agent|market|brand|product manager|proposition/,
    inputs: 'Market and customer insight, leads and pipeline, product information, campaign plans',
    outputs: 'Sales and renewals, partner agreements, campaigns, customer growth',
    tasks: ['Grow distribution and revenue for {vs}', 'Manage broker, agent and partner relationships', 'Plan and execute campaigns and propositions', 'Track pipeline, conversion and retention', 'Gather market and customer feedback', 'Coordinate with underwriting and service teams'] },
  { test: /legal|counsel|paralegal|contract/,
    inputs: 'Contracts and agreements, legal and regulatory requests, disputes, policy wording',
    outputs: 'Reviewed contracts, legal advice, filings, resolved matters',
    tasks: ['Draft, review and negotiate contracts for {vs}', 'Advise the business on legal and regulatory matters', 'Manage disputes, litigation and external counsel', 'Maintain corporate governance records', 'Assess and mitigate legal risk', 'Support regulatory filings and responses'] },
  { test: /service|support|operation|coordinat|specialist|administ|advisor|representative|assistant|analyst/,
    inputs: 'Customer and stakeholder requests, cases and tickets, procedures, source documents',
    outputs: 'Resolved cases, processed transactions, status updates, service records',
    tasks: ['Handle requests and cases within {vs}', 'Process transactions accurately and on time', 'Resolve issues and escalate where needed', 'Maintain records and follow procedures', 'Meet service-level and quality targets', 'Identify and suggest process improvements'] },
];
const FALLBACK: Profile = {
  test: /.*/,
  inputs: 'Stakeholder requests, source data and documents, policies and procedures, priorities',
  outputs: 'Completed work products, decisions and recommendations, status reporting, records',
  tasks: ['Execute core responsibilities supporting {vs}', 'Collaborate with partners across the value stream', 'Maintain accurate records and documentation', 'Meet quality, timeliness and compliance standards', 'Identify and act on improvement opportunities', 'Report on progress and outcomes'],
};
const profileFor = (name: string) => PROFILES.find((p) => p.test.test(name.toLowerCase())) ?? FALLBACK;
const fill = (s: string, vs: string) => s.replace(/\{vs\}/g, vs);

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found.');
  const { id: companyId, tenantId } = company;
  console.log(`Backfilling roles for ${company.name}`);

  // ── 1. Rank each division's value streams by how many sibling roles link to them ──
  const links = await prisma.roleValueStream.findMany({
    where: { role: { companyId } },
    select: { valueStreamId: true, role: { select: { divisionId: true } }, valueStream: { select: { name: true } } },
  });
  const vsByDivision = new Map<string, Map<string, { name: string; count: number }>>();
  for (const l of links) {
    const div = l.role.divisionId;
    if (!div) continue;
    if (!vsByDivision.has(div)) vsByDivision.set(div, new Map());
    const m = vsByDivision.get(div)!;
    const e = m.get(l.valueStreamId) ?? { name: l.valueStream.name, count: 0 };
    e.count++; m.set(l.valueStreamId, e);
  }
  const rankedVs = (divId: string) =>
    [...(vsByDivision.get(divId)?.entries() ?? [])]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, v]) => ({ id, name: v.name }));
  // Company-wide fallback stream (most-linked overall) for divisions with none.
  const globalTop = [...links.reduce((m, l) => m.set(l.valueStreamId, { name: l.valueStream.name, count: (m.get(l.valueStreamId)?.count ?? 0) + 1 }), new Map<string, { name: string; count: number }>()).entries()]
    .sort((a, b) => b[1].count - a[1].count).map(([id, v]) => ({ id, name: v.name }))[0];

  // ── 2. Backfill value-stream participation + I/O ─────────────────────────
  const rolesNoRvs = await prisma.role.findMany({
    where: { companyId, valueStreamLinks: { none: {} } },
    select: { id: true, name: true, divisionId: true },
  });
  let rvsCreated = 0;
  for (const role of rolesNoRvs) {
    const candidates = role.divisionId ? rankedVs(role.divisionId) : [];
    const vs = candidates[0] ?? globalTop;
    if (!vs) continue;
    const prof = profileFor(role.name);
    const part = PART_BY_RANK[nameRank(role.name)];
    await prisma.roleValueStream.create({
      data: {
        tenantId, roleId: role.id, valueStreamId: vs.id,
        participationType: part, subStream: null,
        inputs: fill(prof.inputs, vs.name), outputs: fill(prof.outputs, vs.name),
        sourceSheet: 'backfill',
      },
    });
    rvsCreated++;
  }
  console.log(`   + ${rvsCreated} value-stream participations (I/O) injected`);

  // ── 3. Backfill responsibilities (role tasks) ────────────────────────────
  const respCategory = await prisma.category.upsert({
    where: { tenantId_companyId_name: { tenantId, companyId, name: 'Core Responsibilities' } },
    update: {}, create: { tenantId, companyId, name: 'Core Responsibilities' },
  });
  const rolesNoTasks = await prisma.role.findMany({
    where: { companyId, roleTasks: { none: {} } },
    select: { id: true, name: true, valueStreamLinks: { select: { valueStream: { select: { name: true } } }, take: 1 } },
  });
  let taskRows: any[] = [];
  for (const role of rolesNoTasks) {
    const vsName = role.valueStreamLinks[0]?.valueStream.name ?? 'the operating model';
    const prof = profileFor(role.name);
    for (const t of prof.tasks) taskRows.push({ tenantId, roleId: role.id, categoryId: respCategory.id, text: fill(t, vsName), sourceSheet: 'backfill' });
  }
  await prisma.roleTask.createMany({ data: taskRows });
  console.log(`   + ${taskRows.length} responsibilities injected across ${rolesNoTasks.length} roles`);

  // ── Verify no role is left empty ─────────────────────────────────────────
  const [stillNoRvs, stillNoTasks] = await Promise.all([
    prisma.role.count({ where: { companyId, valueStreamLinks: { none: {} } } }),
    prisma.role.count({ where: { companyId, roleTasks: { none: {} } } }),
  ]);
  console.log(`   = roles still missing I/O: ${stillNoRvs}, still missing responsibilities: ${stillNoTasks}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
