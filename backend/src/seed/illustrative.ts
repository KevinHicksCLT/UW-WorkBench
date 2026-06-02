import type { PrismaClient } from '@prisma/client';

// Illustrative systems + value-stream metrics — the "Where" (systems) and
// "How well" (metrics) lenses of the operating-model explorer. The v12 workbook
// has neither, so these are synthesized; every row carries illustrative=true and
// is badged in the UI. Replaced by real data via the Phase 8 connector framework.

type App = {
  name: string;
  kind: string;
  category: string;
  vendor?: string;
  criticality: string;
  systemRole: string;
  streams: string[]; // case-insensitive substrings matched against value-stream names
};

const APPS: App[] = [
  { name: 'Guidewire PolicyCenter', kind: 'Core', category: 'Policy', vendor: 'Guidewire', criticality: 'High', systemRole: 'System of Record', streams: ['Policy Administration', 'Submission-to-Bind'] },
  { name: 'Guidewire ClaimCenter', kind: 'Core', category: 'Claims', vendor: 'Guidewire', criticality: 'High', systemRole: 'System of Record', streams: ['Claims Intake', 'Claims Recoveries'] },
  { name: 'Guidewire BillingCenter', kind: 'Core', category: 'Billing', vendor: 'Guidewire', criticality: 'High', systemRole: 'System of Record', streams: ['Billing'] },
  { name: 'Earnix Rating & Pricing', kind: 'SaaS', category: 'Policy', vendor: 'Earnix', criticality: 'High', systemRole: 'Supporting', streams: ['Submission-to-Bind', 'Actuarial Pricing', 'Product & Proposition'] },
  { name: 'Salesforce FSC', kind: 'SaaS', category: 'Distribution', vendor: 'Salesforce', criticality: 'High', systemRole: 'Channel', streams: ['Distribution', 'Customer Service', 'Marketing'] },
  { name: 'Duck Creek Distribution', kind: 'SaaS', category: 'Distribution', vendor: 'Duck Creek', criticality: 'Medium', systemRole: 'Channel', streams: ['Distribution', 'Delegated Authority'] },
  { name: 'Customer Self-Service Portal', kind: 'Internal', category: 'Distribution', criticality: 'Medium', systemRole: 'Channel', streams: ['Customer Service', 'Policy Administration'] },
  { name: 'SAP S/4HANA (GL)', kind: 'Core', category: 'Finance', vendor: 'SAP', criticality: 'High', systemRole: 'System of Record', streams: ['Finance', 'Investment', 'Billing'] },
  { name: 'BlackRock Aladdin', kind: 'SaaS', category: 'Finance', vendor: 'BlackRock', criticality: 'Medium', systemRole: 'Supporting', streams: ['Investment'] },
  { name: 'Moody’s RMS (Cat Model)', kind: 'SaaS', category: 'Data', vendor: 'Moody’s', criticality: 'High', systemRole: 'Analytics', streams: ['Actuarial Pricing', 'Reinsurance'] },
  { name: 'SAS Actuarial Platform', kind: 'SaaS', category: 'Data', vendor: 'SAS', criticality: 'Medium', systemRole: 'Analytics', streams: ['Actuarial Pricing'] },
  { name: 'Reinsurance Management System', kind: 'Internal', category: 'Policy', criticality: 'Medium', systemRole: 'System of Record', streams: ['Reinsurance'] },
  { name: 'Snowflake Data Cloud', kind: 'SaaS', category: 'Data', vendor: 'Snowflake', criticality: 'High', systemRole: 'Analytics', streams: ['Data, Analytics', 'Marketing'] },
  { name: 'Databricks Lakehouse', kind: 'SaaS', category: 'Data', vendor: 'Databricks', criticality: 'Medium', systemRole: 'Analytics', streams: ['Data, Analytics'] },
  { name: 'OpenText Document Mgmt', kind: 'SaaS', category: 'Policy', vendor: 'OpenText', criticality: 'Medium', systemRole: 'Supporting', streams: ['Policy Administration', 'Claims Intake'] },
  { name: 'ServiceNow ITSM', kind: 'SaaS', category: 'Infra', vendor: 'ServiceNow', criticality: 'Medium', systemRole: 'Supporting', streams: ['Service Operations', 'Technology Delivery'] },
  { name: 'Azure Cloud Platform', kind: 'Platform', category: 'Infra', vendor: 'Microsoft', criticality: 'High', systemRole: 'Supporting', streams: ['Technology Delivery', 'Technology Strategy', 'Service Operations'] },
  { name: 'CrowdStrike Falcon', kind: 'SaaS', category: 'Security', vendor: 'CrowdStrike', criticality: 'High', systemRole: 'Supporting', streams: ['Cybersecurity'] },
  { name: 'SailPoint IGA', kind: 'SaaS', category: 'Security', vendor: 'SailPoint', criticality: 'Medium', systemRole: 'Supporting', streams: ['Cybersecurity'] },
  { name: 'Workday HCM', kind: 'SaaS', category: 'Finance', vendor: 'Workday', criticality: 'Medium', systemRole: 'System of Record', streams: ['Talent'] },
  { name: 'Archer GRC', kind: 'SaaS', category: 'Security', vendor: 'Archer', criticality: 'Medium', systemRole: 'Supporting', streams: ['Risk, Compliance', 'Audit & Assurance', 'Legal'] },
  { name: 'FRISS Fraud Detection', kind: 'SaaS', category: 'Claims', vendor: 'FRISS', criticality: 'Medium', systemRole: 'Analytics', streams: ['Claims Intake', 'Risk, Compliance'] },
  // External / third-party systems (dependencies outside the company boundary)
  { name: 'Broker & Agent Portal', kind: 'External', category: 'Distribution', vendor: 'Partner network', criticality: 'High', systemRole: 'Channel', streams: ['Distribution', 'Submission-to-Bind', 'Delegated Authority'] },
  { name: 'Payment Gateway', kind: 'External', category: 'Billing', vendor: 'Stripe/ACI', criticality: 'High', systemRole: 'Channel', streams: ['Billing'] },
  { name: 'Bank & Treasury Network', kind: 'External', category: 'Finance', vendor: 'SWIFT/Banks', criticality: 'High', systemRole: 'Supporting', streams: ['Finance', 'Investment', 'Billing'] },
  { name: 'Reinsurer Exchange', kind: 'External', category: 'Policy', vendor: 'RI markets', criticality: 'Medium', systemRole: 'Supporting', streams: ['Reinsurance'] },
  { name: 'Regulatory Filing Portal', kind: 'External', category: 'Security', vendor: 'Regulators', criticality: 'High', systemRole: 'Channel', streams: ['Risk, Compliance', 'Audit', 'Actuarial'] },
  { name: 'Credit Bureau & Data Services', kind: 'External', category: 'Data', vendor: 'Experian/LexisNexis', criticality: 'Medium', systemRole: 'Analytics', streams: ['Submission-to-Bind', 'Claims Intake'] },
  { name: 'Catastrophe Data Provider', kind: 'External', category: 'Data', vendor: 'Verisk/Moody’s', criticality: 'Medium', systemRole: 'Analytics', streams: ['Actuarial', 'Reinsurance'] },
];

// Deterministic pseudo-values, so re-seeds are stable.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// Turn a v13 KPI definition (real target text) into a numeric target + unit +
// direction + an illustrative current actual near the target. The DEFINITION is
// real; only the plotted reading is synthesized (illustrative=true).
export function metricReading(def: { name: string; target: string | null; notes: string | null; category: string | null }) {
  const t = (def.target ?? '').trim();
  const lower = `${def.target ?? ''} ${def.notes ?? ''} ${def.name}`.toLowerCase();
  const unit = /%|percent/.test(t) ? '%' : /day/.test(t) ? 'days' : /hour|hr/.test(t) ? 'hrs' : /\$|usd/.test(t) ? '$' : /month|\/mo/.test(t) ? '/mo' : /ratio|x\b/.test(t) ? 'x' : 'score';
  // numbers in the target (handles "30-45", ">99", "<5", "95%", "4.5")
  const nums = (t.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  let target: number | null = nums.length ? (nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]) : (/zero|0 /.test(lower) ? 0 : null);
  // direction: lower-is-better signals
  const down = /lower is better|<|reduce|days|cycle|time|cost|dso|backlog|defect|leakage|loss|turnover|breach|incident|outage|complaint|aging/.test(lower) && !/>|higher is better/.test(lower);
  const direction = down ? 'down' : 'up';
  // illustrative actual near target (some above, some below for insight)
  const h = hash(`${def.name}:${def.target}`);
  const jitter = ((h % 1000) / 1000 - 0.45) * 0.35; // ~ -16% .. +19%
  let value: number;
  if (target != null) {
    value = target === 0 ? Math.round((h % 5)) : Math.round(target * (1 + jitter) * 10) / 10;
  } else {
    value = Math.round((40 + (h % 60)) * 10) / 10; // unitless score 40-100
    target = null;
  }
  if (unit === '%') value = Math.max(0, Math.min(100, value));
  return { value, unit, target, direction };
}

export async function seedIllustrative(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; valueStreams: { id: string; name: string }[] }
) {
  const { tenantId, companyId, valueStreams } = ctx;

  for (const a of APPS) {
    const app = await prisma.application.create({
      data: { tenantId, companyId, name: a.name, kind: a.kind, category: a.category, vendor: a.vendor ?? null, criticality: a.criticality, illustrative: true },
    });
    const links = valueStreams.filter((vs) => a.streams.some((s) => vs.name.toLowerCase().includes(s.toLowerCase())));
    if (links.length > 0) {
      await prisma.applicationValueStream.createMany({
        data: links.map((vs) => ({ tenantId, applicationId: app.id, valueStreamId: vs.id, systemRole: a.systemRole, illustrative: true })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`   + ${APPS.length} illustrative systems`);
}

// ─── Deep levels: initiatives, people, assignments, tasks, metrics, risks ──

const FIRST = ['Alex', 'Priya', 'Wei', 'Maria', 'James', 'Aisha', 'Diego', 'Yuki', 'Omar', 'Sofia', 'Liam', 'Nina', 'Raj', 'Elena', 'Kwame', 'Hana', 'Tomas', 'Ivy', 'Noah', 'Zara', 'Mateo', 'Lena', 'Arjun', 'Mei', 'Caleb', 'Fatima', 'Pavel', 'Grace'];
const LAST = ['Chen', 'Patel', 'Garcia', 'Smith', 'Okoro', 'Kim', 'Nguyen', 'Singh', 'Rossi', 'Haddad', 'Muller', 'Silva', 'Khan', 'Ivanova', 'Mensah', 'Sato', 'Costa', 'Brown', 'Lee', 'Ali', 'Novak', 'Reyes', 'Dubois', 'Yilmaz', 'Walsh', 'Park', 'Adeyemi', 'Cohen'];
const VENDORS = ['Infosys', 'TCS', 'Accenture', 'Cognizant', 'Capgemini', 'Wipro'];
const OFFSHORE_LOC = ['Bengaluru, IN', 'Pune, IN', 'Hyderabad, IN', 'Manila, PH'];
const NEARSHORE_LOC = ['Krakow, PL', 'Lisbon, PT', 'San Jose, CR'];
const ONSHORE_LOC = ['London, UK', 'New York, US', 'Chicago, US', 'Toronto, CA'];
const PERIODS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
const CONTRACTOR_HEAVY = ['technology', 'data', 'claims', 'cybersecurity'];

const INITIATIVES = [
  { code: 'CLM-TX', name: 'Claims Transformation', stage: 'Build', health: 'Amber', budget: 14_000_000, vs: ['Claims'], div: ['Claims'] },
  { code: 'UW-MOD', name: 'Underwriting Modernization', stage: 'Pilot', health: 'Green', budget: 9_500_000, vs: ['Submission-to-Bind', 'Actuarial Pricing'], div: ['Underwriting'] },
  { code: 'BILL-1', name: 'Billing Consolidation', stage: 'Rollout', health: 'Green', budget: 4_200_000, vs: ['Billing'], div: ['Finance'] },
  { code: 'DATA-PLT', name: 'Data & AI Platform Build-out', stage: 'Build', health: 'Amber', budget: 11_000_000, vs: ['Data, Analytics'], div: ['Data'] },
  { code: 'CYBER', name: 'Cyber Resilience Program', stage: 'Build', health: 'Red', budget: 7_800_000, vs: ['Cybersecurity'], div: ['Cybersecurity'] },
  { code: 'DIST-SS', name: 'Distribution Self-Service', stage: 'Discovery', health: 'Green', budget: 3_600_000, vs: ['Distribution', 'Customer Service'], div: ['Sales'] },
];

const pickFrom = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];
async function chunked<T>(rows: T[], fn: (c: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export async function seedDeepLevels(prisma: PrismaClient, ctx: { tenantId: string; companyId: string }) {
  const { tenantId, companyId } = ctx;
  const [divisions, roles, valueStreams, roleTaskRows] = await Promise.all([
    prisma.division.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, roleFamily: true, divisionId: true } }),
    prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.roleTask.findMany({ where: { role: { companyId } }, select: { roleId: true, text: true } }),
  ]);
  const divName = new Map(divisions.map((d) => [d.id, d.name] as const));
  const tasksByRole = new Map<string, string[]>();
  for (const rt of roleTaskRows) {
    const a = tasksByRole.get(rt.roleId) ?? [];
    if (a.length < 8) a.push(rt.text);
    tasksByRole.set(rt.roleId, a);
  }

  // Initiatives + value-stream/division links.
  const initRows: any[] = [], ivsRows: any[] = [], idivRows: any[] = [];
  const initIdByDiv = new Map<string, string>();
  for (const ini of INITIATIVES) {
    const id = `init_${ini.code}`;
    const matchDivs = divisions.filter((d) => ini.div.some((s) => d.name.toLowerCase().includes(s.toLowerCase())));
    const matchVs = valueStreams.filter((v) => ini.vs.some((s) => v.name.toLowerCase().includes(s.toLowerCase())));
    const home = matchDivs[0];
    const sponsor = home && (roles.find((r) => r.divisionId === home.id && /chief|head|director/i.test(r.name)) ?? roles.find((r) => r.divisionId === home.id));
    initRows.push({ id, tenantId, companyId, name: ini.name, code: ini.code, status: 'In Progress', stage: ini.stage, health: ini.health, budget: ini.budget, sponsorRoleId: sponsor?.id ?? null, illustrative: true });
    for (const v of matchVs) ivsRows.push({ tenantId, initiativeId: id, valueStreamId: v.id, impactType: 'Transforms', illustrative: true });
    for (const d of matchDivs) { idivRows.push({ tenantId, initiativeId: id, divisionId: d.id, role: 'Sponsoring', illustrative: true }); initIdByDiv.set(d.id, id); }
  }
  await prisma.initiative.createMany({ data: initRows });
  await prisma.initiativeValueStream.createMany({ data: ivsRows, skipDuplicates: true });
  await prisma.initiativeDivision.createMany({ data: idivRows, skipDuplicates: true });

  // People + assignments + tasks + metrics.
  const people: any[] = [], assignments: any[] = [], tasks: any[] = [], metrics: any[] = [];
  const GENERIC = ['Refine backlog item', 'Implement feature', 'Peer code review', 'Resolve defects', 'Update runbook', 'Prepare release notes'];
  for (const role of roles) {
    const dName = role.divisionId ? divName.get(role.divisionId) ?? '' : '';
    const heavy = CONTRACTOR_HEAVY.some((s) => dName.toLowerCase().includes(s));
    const isUIDev = /ui developer/i.test(role.name);
    const count = 2 + (hash(role.name) % 3);
    for (let i = 0; i < count; i++) {
      const pid = `per_${role.id}_${i}`;
      const h = hash(`${role.id}:${i}`);
      const name = `${pickFrom(h, FIRST)} ${pickFrom(h >> 5, LAST)}`;
      let employmentType = (h % 100) < (heavy ? 65 : 15) ? (h % 7 === 0 ? 'si_partner' : 'contractor') : 'badged';
      let region = 'Onshore', vendor: string | null = null, location = pickFrom(h >> 7, ONSHORE_LOC);
      if (employmentType !== 'badged') {
        const r = h % 100;
        region = r < 60 ? 'Offshore' : r < 80 ? 'Nearshore' : 'Onshore';
        vendor = pickFrom(h >> 3, VENDORS);
        location = region === 'Offshore' ? pickFrom(h >> 7, OFFSHORE_LOC) : region === 'Nearshore' ? pickFrom(h >> 7, NEARSHORE_LOC) : pickFrom(h >> 7, ONSHORE_LOC);
      }
      if (isUIDev && i === 0) { employmentType = 'contractor'; region = 'Offshore'; vendor = pickFrom(h, VENDORS); location = pickFrom(h, OFFSHORE_LOC); }
      people.push({ id: pid, tenantId, companyId, name, email: `${name.replace(/[^a-z]+/gi, '.').toLowerCase()}@example.com`, employmentType, vendor, location, region, title: role.name, illustrative: true });

      let initiativeId: string | null = role.divisionId && (h % 100) < 30 ? initIdByDiv.get(role.divisionId) ?? null : null;
      if (isUIDev && i === 0) initiativeId = 'init_CLM-TX';
      assignments.push({ id: `asg_${pid}`, tenantId, personId: pid, roleId: role.id, initiativeId, employmentType, allocationPct: 50 + (h % 51), isPrimary: true, illustrative: true });

      const roleTexts = tasksByRole.get(role.id) ?? [];
      const tcount = 3 + (h % 4);
      for (let t = 0; t < tcount; t++) {
        const th = hash(`${pid}:t${t}`);
        const title = (roleTexts.length ? roleTexts[th % roleTexts.length] : GENERIC[th % GENERIC.length]).slice(0, 140);
        tasks.push({ tenantId, personId: pid, title, status: pickFrom(th, ['In Progress', 'In Progress', 'Done', 'Done', 'To Do', 'Blocked']), priority: pickFrom(th >> 3, ['High', 'Medium', 'Medium', 'Low']), illustrative: true });
      }
      for (const period of PERIODS) {
        const mh = hash(`${pid}:${period}`);
        const mp = (lo: number, hi: number, salt: number) => lo + (((mh >> (salt % 20)) % 1000) / 1000) * (hi - lo);
        metrics.push(
          { tenantId, personId: pid, period, name: 'Throughput', value: Math.round(mp(8, 40, 1)), unit: '/mo', target: null, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Quality', value: Math.round(mp(80, 99, 5)), unit: '%', target: 95, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Utilization', value: Math.round(mp(60, 98, 9)), unit: '%', target: 85, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Cycle time', value: Math.round(mp(2, 15, 13) * 10) / 10, unit: 'days', target: 5, direction: 'down', illustrative: true },
        );
      }
    }
  }
  await prisma.person.createMany({ data: people });
  await prisma.assignment.createMany({ data: assignments });
  await chunked(tasks, (c) => prisma.personTask.createMany({ data: c }));
  await chunked(metrics, (c) => prisma.personMetric.createMany({ data: c }));

  // Risks: per initiative + a few per value stream.
  const SEV = ['Critical', 'High', 'Medium', 'Low'], STATUS = ['Open', 'Mitigating', 'Accepted', 'Open'];
  const CAT = ['Delivery', 'Compliance', 'Security', 'Operational', 'Vendor', 'Financial'];
  const risks: any[] = [];
  for (const ini of INITIATIVES) {
    const n = 3 + (hash(ini.code) % 3);
    for (let i = 0; i < n; i++) {
      const h = hash(`risk_${ini.code}_${i}`);
      risks.push({ tenantId, companyId, initiativeId: `init_${ini.code}`, title: `${pickFrom(h, CAT)} risk on ${ini.name}`, category: pickFrom(h, CAT), severity: pickFrom(h >> 2, SEV), likelihood: pickFrom(h >> 4, ['Possible', 'Likely', 'Unlikely']), status: pickFrom(h >> 6, STATUS), illustrative: true });
    }
  }
  for (const v of valueStreams) {
    const h = hash(`vsr_${v.id}`);
    if (h % 3 !== 0) continue;
    risks.push({ tenantId, companyId, valueStreamId: v.id, title: `Control gap in ${v.name}`, category: 'Compliance', severity: pickFrom(h, SEV), likelihood: 'Possible', status: 'Open', illustrative: true });
  }
  await prisma.risk.createMany({ data: risks });

  console.log(`   + ${initRows.length} initiatives, ${people.length} people, ${assignments.length} assignments, ${tasks.length} tasks, ${metrics.length} person-metrics, ${risks.length} risks`);
}

// ─── Real Application TCO records (from v15 Application TCO sheet) ─────────
// 6 real apps with full 6-bucket TCO breakdown (illustrative=false).
// Each is upserted by name so re-seeding is idempotent.
// Division match via primaryDivisionName; value stream match by exact name.

type TcoApp = {
  name: string;
  ownershipModel: string;
  primaryDivisionName: string;
  linkedValueStreamName: string;
  licenseCost: number;
  laborCost: number;
  vendorServicesCost: number;
  infraCost: number;
  depreciationCost: number;
  overheadCost: number;
  totalTco: number;
  kind: string;
  criticality: string;
};

const REAL_APPS: TcoApp[] = [
  {
    name: 'Claims Management Platform',
    ownershipModel: 'Hybrid',
    primaryDivisionName: 'Claims',
    linkedValueStreamName: 'Claims',
    licenseCost: 210000, laborCost: 340000, vendorServicesCost: 180000,
    infraCost: 145000, depreciationCost: 60000, overheadCost: 50000,
    totalTco: 985000,
    kind: 'Core', criticality: 'High',
  },
  {
    name: 'Policy Administration Platform',
    ownershipModel: 'In-house',
    primaryDivisionName: 'Operations & Customer Service',
    linkedValueStreamName: 'Policy Administration',
    licenseCost: 0, laborCost: 620000, vendorServicesCost: 280000,
    infraCost: 215000, depreciationCost: 80000, overheadCost: 50000,
    totalTco: 1245000,
    kind: 'Core', criticality: 'High',
  },
  {
    name: 'Finance ERP',
    ownershipModel: 'Hybrid',
    primaryDivisionName: 'Finance & Investments',
    linkedValueStreamName: 'Finance',
    licenseCost: 320000, laborCost: 280000, vendorServicesCost: 160000,
    infraCost: 130000, depreciationCost: 45000, overheadCost: 50000,
    totalTco: 985000,
    kind: 'Core', criticality: 'High',
  },
  {
    name: 'IAM Platform',
    ownershipModel: 'SaaS',
    primaryDivisionName: 'Cybersecurity & IAM',
    linkedValueStreamName: 'Cybersecurity',
    licenseCost: 480000, laborCost: 80000, vendorServicesCost: 60000,
    infraCost: 45000, depreciationCost: 20000, overheadCost: 20000,
    totalTco: 705000,
    kind: 'SaaS', criticality: 'High',
  },
  {
    name: 'Data Analytics Platform',
    ownershipModel: 'Hybrid',
    primaryDivisionName: 'Data & AI',
    linkedValueStreamName: 'Data, Analytics',
    licenseCost: 290000, laborCost: 220000, vendorServicesCost: 130000,
    infraCost: 105000, depreciationCost: 40000, overheadCost: 30000,
    totalTco: 815000,
    kind: 'SaaS', criticality: 'High',
  },
  {
    name: 'Broker / Distribution Portal',
    ownershipModel: 'SaaS',
    primaryDivisionName: 'Sales, Distribution & Marketing',
    linkedValueStreamName: 'Distribution',
    licenseCost: 360000, laborCost: 80000, vendorServicesCost: 60000,
    infraCost: 50000, depreciationCost: 25000, overheadCost: 25000,
    totalTco: 600000,
    kind: 'SaaS', criticality: 'Medium',
  },
];

export async function seedRealApplications(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; valueStreams: { id: string; name: string }[] }
) {
  const { tenantId, companyId, valueStreams } = ctx;
  let created = 0;

  for (const a of REAL_APPS) {
    const app = await prisma.application.upsert({
      where: { tenantId_companyId_name: { tenantId, companyId, name: a.name } },
      update: {
        illustrative: false,
        ownershipModel: a.ownershipModel,
        primaryDivisionName: a.primaryDivisionName,
        licenseCost: a.licenseCost,
        laborCost: a.laborCost,
        vendorServicesCost: a.vendorServicesCost,
        infraCost: a.infraCost,
        depreciationCost: a.depreciationCost,
        overheadCost: a.overheadCost,
        totalTco: a.totalTco,
        kind: a.kind,
        criticality: a.criticality,
      },
      create: {
        tenantId, companyId, name: a.name, kind: a.kind, criticality: a.criticality,
        illustrative: false,
        ownershipModel: a.ownershipModel,
        primaryDivisionName: a.primaryDivisionName,
        licenseCost: a.licenseCost,
        laborCost: a.laborCost,
        vendorServicesCost: a.vendorServicesCost,
        infraCost: a.infraCost,
        depreciationCost: a.depreciationCost,
        overheadCost: a.overheadCost,
        totalTco: a.totalTco,
      },
    });
    created++;

    // Link to value stream by name (case-insensitive substring)
    const matchedStreams = valueStreams.filter((vs) =>
      vs.name.toLowerCase().includes(a.linkedValueStreamName.toLowerCase()) ||
      a.linkedValueStreamName.toLowerCase().includes(vs.name.toLowerCase())
    );
    if (matchedStreams.length > 0) {
      await prisma.applicationValueStream.createMany({
        data: matchedStreams.map((vs) => ({
          tenantId, applicationId: app.id, valueStreamId: vs.id,
          systemRole: 'System of Record', illustrative: false,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`   + ${created} real TCO application records (illustrative=false)`);
}
