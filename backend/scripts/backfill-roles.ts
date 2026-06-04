// backfill-roles.ts — fills the gaps so EVERY role carries the full picture:
//   1. value-stream participation + I/O (inputs/outputs) for roles that had none
//   2. responsibilities (role tasks) for roles that had none
//   3. regenerates each person's performance metrics so they're drawn from the
//      REAL value-stream KPIs the person's role participates in (was generic
//      Throughput/Quality/Utilization/Cycle-time).
//
// Injected role rows are stamped sourceSheet='backfill' so their provenance is
// honest (they are researched/synthesized, not from the workbook). Idempotent:
// re-running only fills roles that are still empty, and always rebuilds person
// metrics deterministically.
//
// Run from backend/:  npx tsx scripts/backfill-roles.ts
import { PrismaClient } from '@prisma/client';
import { metricReading } from '../src/seed/illustrative.js';

const prisma = new PrismaClient();

// Deterministic hash so re-runs are stable.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pick = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];

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

  // ── 4. Regenerate person performance metrics from the role's real KPIs ───
  const PERIODS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
  // Individual-relevant categories first; cap per person for a focused view.
  const CAT_ORDER: Record<string, number> = { Operational: 0, Quality: 1, Customer: 2, Financial: 3, DORA: 1 };
  const PER_PERSON = 5;

  const assignments = await prisma.assignment.findMany({
    select: { personId: true, roleId: true,
      role: { select: { valueStreamLinks: { select: { valueStreamId: true } } } } },
  });
  // person -> set of value-stream ids (across their roles)
  const vsByPerson = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = vsByPerson.get(a.personId) ?? new Set<string>();
    for (const l of a.role.valueStreamLinks) set.add(l.valueStreamId);
    vsByPerson.set(a.personId, set);
  }
  // KPI definitions per value stream.
  const kpis = await prisma.metric.findMany({
    where: { companyId, valueStreamId: { not: null } },
    select: { valueStreamId: true, name: true, targetText: true, category: true, notes: true, direction: true },
  });
  const kpisByVs = new Map<string, typeof kpis>();
  for (const k of kpis) { const a = kpisByVs.get(k.valueStreamId!) ?? []; a.push(k); kpisByVs.set(k.valueStreamId!, a); }

  const GENERIC = [
    { name: 'Throughput', unit: '/mo', target: null as number | null, direction: 'up', lo: 8, hi: 40 },
    { name: 'Quality', unit: '%', target: 95, direction: 'up', lo: 80, hi: 99 },
    { name: 'Utilization', unit: '%', target: 85, direction: 'up', lo: 60, hi: 98 },
    { name: 'Cycle time', unit: 'days', target: 5, direction: 'down', lo: 2, hi: 15 },
  ];

  const metricRows: any[] = [];
  for (const [personId, vsSet] of vsByPerson) {
    // Gather candidate KPIs from all the person's value streams, dedupe by name.
    const seen = new Set<string>();
    let cand = [...vsSet].flatMap((id) => kpisByVs.get(id) ?? []).filter((k) => (seen.has(k.name) ? false : (seen.add(k.name), true)));
    // Prefer individual-relevant categories; deterministic stable order.
    cand.sort((a, b) => (CAT_ORDER[a.category ?? ''] ?? 5) - (CAT_ORDER[b.category ?? ''] ?? 5) || a.name.localeCompare(b.name));
    const chosen = cand.slice(0, PER_PERSON);

    if (chosen.length === 0) {
      // Fallback: keep the generic four for people whose role maps to no KPI.
      for (const period of PERIODS) {
        const mh = hash(`${personId}:${period}`);
        for (let i = 0; i < GENERIC.length; i++) {
          const g = GENERIC[i];
          const v = g.lo + (((mh >> (i * 3)) % 1000) / 1000) * (g.hi - g.lo);
          metricRows.push({ tenantId, personId, period, name: g.name, value: Math.round(v * 10) / 10, unit: g.unit, target: g.target, direction: g.direction, illustrative: true });
        }
      }
      continue;
    }

    for (const k of chosen) {
      const base = metricReading({ name: k.name, target: k.targetText, notes: k.notes, category: k.category });
      for (const period of PERIODS) {
        // Monthly jitter around the KPI's illustrative reading.
        const mh = hash(`${personId}:${k.name}:${period}`);
        const jit = ((mh % 1000) / 1000 - 0.4) * 0.3; // ~ -12% .. +18%
        let value = base.target != null && base.value === 0 ? mh % 5 : Math.round(base.value * (1 + jit) * 10) / 10;
        if (base.unit === '%') value = Math.max(0, Math.min(100, value));
        if (value < 0) value = 0;
        metricRows.push({ tenantId, personId, period, name: k.name, value, unit: base.unit, target: base.target, direction: base.direction, illustrative: true });
      }
    }
  }

  await prisma.personMetric.deleteMany({});
  for (let i = 0; i < metricRows.length; i += 1000) await prisma.personMetric.createMany({ data: metricRows.slice(i, i + 1000) });
  console.log(`   + ${metricRows.length} person metrics rebuilt from value-stream KPIs (${vsByPerson.size} people)`);

  // ── 5. Digital-productivity signals + app usage (ILLUSTRATIVE) ───────────
  // The workbook has no individual telemetry, so these are synthesized: time
  // online, code activity, collaboration volume, and the app-usage mix.
  type AppDef = [string, string]; // [appName, category]
  const APP_PROFILES: { test: RegExp; apps: AppDef[] }[] = [
    { test: /engineer|developer|architect|devops|\bsre\b|platform|software|\bdba\b|cloud|technolog|tech lead/, apps: [['VS Code', 'IDE'], ['GitHub', 'IDE'], ['Jira', 'Productivity'], ['Microsoft Teams', 'Comms'], ['Datadog', 'Domain']] },
    { test: /data|analyt|scien|\bbi\b|steward|governance/, apps: [['Databricks', 'Analytics'], ['Power BI', 'Analytics'], ['Snowflake', 'Analytics'], ['Microsoft Teams', 'Comms'], ['Jupyter', 'IDE']] },
    { test: /security|\bsoc\b|\biam\b|identity|cyber/, apps: [['CrowdStrike Falcon', 'Domain'], ['SailPoint', 'Domain'], ['Splunk', 'Analytics'], ['Microsoft Teams', 'Comms'], ['ServiceNow', 'Productivity']] },
    { test: /claim|adjuster|examiner|siu|loss/, apps: [['Guidewire ClaimCenter', 'Domain'], ['Outlook', 'Comms'], ['Microsoft Teams', 'Comms'], ['DocuSign', 'Productivity']] },
    { test: /underwrit|wordings|exposure|delegated|risk engineer/, apps: [['Guidewire PolicyCenter', 'Domain'], ['Earnix', 'Domain'], ['Excel', 'Productivity'], ['Outlook', 'Comms']] },
    { test: /actuar|pricing|reserv|capital|\bcat\b/, apps: [['SAS', 'Analytics'], ['Excel', 'Productivity'], ['Moody’s RMS', 'Domain'], ['Outlook', 'Comms']] },
    { test: /financ|account|treasur|invest|controller|billing|receivable|premium audit/, apps: [['SAP S/4HANA', 'Domain'], ['Excel', 'Productivity'], ['Power BI', 'Analytics'], ['Outlook', 'Comms']] },
    { test: /\bhr\b|talent|recruit|people|learning|compensation|benefit/, apps: [['Workday', 'Domain'], ['Outlook', 'Comms'], ['Microsoft Teams', 'Comms'], ['LinkedIn Recruiter', 'Domain']] },
    { test: /sales|distribut|broker|agent|market|brand|account exec|producer|digital channel|affinity/, apps: [['Salesforce', 'Domain'], ['Outlook', 'Comms'], ['Microsoft Teams', 'Comms'], ['LinkedIn', 'Domain']] },
    { test: /legal|counsel|complian|\brisk\b|audit|regulat/, apps: [['Archer GRC', 'Domain'], ['iManage', 'Productivity'], ['Outlook', 'Comms'], ['Microsoft Teams', 'Comms']] },
    { test: /service|support|operation|coordinat|customer|contact center|complaint|policy admin|vendor|continuity|recovery/, apps: [['Salesforce FSC', 'Domain'], ['ServiceNow', 'Productivity'], ['Outlook', 'Comms'], ['Microsoft Teams', 'Comms']] },
    { test: /chief|head|director|officer|president|\bvp\b|lead|manager/, apps: [['Outlook', 'Comms'], ['Microsoft Teams', 'Comms'], ['Power BI', 'Analytics'], ['Excel', 'Productivity']] },
  ];
  const APP_FALLBACK: AppDef[] = [['Outlook', 'Comms'], ['Microsoft Teams', 'Comms'], ['Excel', 'Productivity'], ['SharePoint', 'Productivity']];
  const TECH = /engineer|developer|architect|devops|\bsre\b|platform|software|\bdba\b|cloud|data|analyt|scien|security|\bsoc\b|\biam\b|cyber|technolog|test|\bqa\b/;
  const LEADER = /chief|head|director|officer|president|\bvp\b|lead|manager|principal/;

  // One representative role per person (primary assignment preferred).
  const peopleRoles = await prisma.assignment.findMany({
    orderBy: [{ isPrimary: 'desc' }],
    select: { personId: true, role: { select: { name: true, roleFamily: true } } },
  });
  const roleByPerson = new Map<string, { name: string; roleFamily: string | null }>();
  for (const a of peopleRoles) if (!roleByPerson.has(a.personId)) roleByPerson.set(a.personId, a.role);

  const signalRows: any[] = [];
  const appRows: any[] = [];
  for (const [personId, role] of roleByPerson) {
    const key = `${role.name} ${role.roleFamily ?? ''}`.toLowerCase();
    const isTech = TECH.test(key);
    const isLeader = LEADER.test(key);

    // App-usage mix (snapshot): pick the matching profile, weight by rank.
    const apps = (APP_PROFILES.find((p) => p.test.test(key))?.apps ?? APP_FALLBACK);
    const ph = hash(personId);
    const weights = apps.map((_, i) => 100 - i * 22 + (ph >> (i * 2)) % 12); // descending, jittered
    const tot = weights.reduce((a, b) => a + b, 0);
    apps.forEach(([appName, category], i) => {
      appRows.push({ tenantId, personId, appName, category, usagePct: Math.max(3, Math.round((weights[i] / tot) * 100)), rank: i + 1, illustrative: true });
    });

    // Monthly signals.
    for (const period of PERIODS) {
      const h = hash(`${personId}:${period}`);
      const r = (lo: number, hi: number, salt: number) => Math.round((lo + (((h >> (salt % 24)) % 1000) / 1000) * (hi - lo)) * 10) / 10;
      const push = (name: string, value: number, unit: string) => signalRows.push({ tenantId, personId, period, name, value, unit, illustrative: true });
      push('Time online', r(6.8, 8.8, 1), 'hrs/day');
      push('GitHub activity', isTech ? Math.round(r(25, 110, 5)) : Math.round(r(0, 4, 5)), 'commits/mo');
      push('Team messages', Math.round(r(35, 175, 9)), 'msgs/wk');
      push('Focus hours', r(9, 26, 13), 'hrs/wk');
      push('Meetings', r(isLeader ? 12 : 4, isLeader ? 24 : 14, 17), 'hrs/wk');
    }
  }
  await prisma.personSignal.deleteMany({});
  await prisma.personAppUsage.deleteMany({});
  for (let i = 0; i < signalRows.length; i += 1000) await prisma.personSignal.createMany({ data: signalRows.slice(i, i + 1000) });
  for (let i = 0; i < appRows.length; i += 1000) await prisma.personAppUsage.createMany({ data: appRows.slice(i, i + 1000) });
  console.log(`   + ${signalRows.length} productivity signals + ${appRows.length} app-usage rows (${roleByPerson.size} people)`);

  // ── Verify no role is left empty ─────────────────────────────────────────
  const [stillNoRvs, stillNoTasks] = await Promise.all([
    prisma.role.count({ where: { companyId, valueStreamLinks: { none: {} } } }),
    prisma.role.count({ where: { companyId, roleTasks: { none: {} } } }),
  ]);
  console.log(`   = roles still missing I/O: ${stillNoRvs}, still missing responsibilities: ${stillNoTasks}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
