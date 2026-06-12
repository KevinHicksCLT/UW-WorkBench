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
    // No parseable number in the target text (qualitative goal like "Downward
    // trend" / "Within tolerance"). Synthesize a numeric target near the reading
    // using the same jitter family, so every KPI has a computable target.
    target = Math.round((value / (1 + jitter)) * 10) / 10;
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

// ─── Deep levels: initiatives, risks ────────────────────────────────────────

const INITIATIVES = [
  { code: 'CLM-TX', name: 'Claims Transformation', stage: 'Build', health: 'Amber', budget: 14_000_000, vs: ['Claims'], div: ['Claims'] },
  { code: 'UW-MOD', name: 'Underwriting Modernization', stage: 'Pilot', health: 'Green', budget: 9_500_000, vs: ['Submission-to-Bind', 'Actuarial Pricing'], div: ['Underwriting'] },
  { code: 'BILL-1', name: 'Billing Consolidation', stage: 'Rollout', health: 'Green', budget: 4_200_000, vs: ['Billing'], div: ['Finance'] },
  { code: 'DATA-PLT', name: 'Data & AI Platform Build-out', stage: 'Build', health: 'Amber', budget: 11_000_000, vs: ['Data, Analytics'], div: ['Data'] },
  { code: 'CYBER', name: 'Cyber Resilience Program', stage: 'Build', health: 'Red', budget: 7_800_000, vs: ['Cybersecurity'], div: ['Cybersecurity'] },
  { code: 'DIST-SS', name: 'Distribution Self-Service', stage: 'Discovery', health: 'Green', budget: 3_600_000, vs: ['Distribution', 'Customer Service'], div: ['Sales'] },
];

const pickFrom = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];

export async function seedDeepLevels(prisma: PrismaClient, ctx: { tenantId: string; companyId: string; clear?: boolean }) {
  const { tenantId, companyId, clear = true } = ctx;

  // Idempotent rebuild: clear this company's deep levels first. Deleting
  // initiatives cascades to value-stream/division links. Harmless no-op
  // during a full re-seed (the company was just recreated, so these are empty).
  // Pass clear:false to run as a purely additive fill onto empty tables.
  if (clear) {
    await prisma.risk.deleteMany({ where: { companyId } });
    await prisma.initiative.deleteMany({ where: { companyId } });
  }

  const [divisions, roles, valueStreams] = await Promise.all([
    prisma.division.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, roleFamily: true, divisionId: true } }),
    prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);

  // Initiatives + value-stream/division links.
  const initRows: any[] = [], ivsRows: any[] = [], idivRows: any[] = [];
  for (const ini of INITIATIVES) {
    const id = `init_${ini.code}`;
    const matchDivs = divisions.filter((d) => ini.div.some((s) => d.name.toLowerCase().includes(s.toLowerCase())));
    const matchVs = valueStreams.filter((v) => ini.vs.some((s) => v.name.toLowerCase().includes(s.toLowerCase())));
    const home = matchDivs[0];
    const sponsor = home && (roles.find((r) => r.divisionId === home.id && /chief|head|director/i.test(r.name)) ?? roles.find((r) => r.divisionId === home.id));
    initRows.push({ id, tenantId, companyId, name: ini.name, code: ini.code, status: 'In Progress', stage: ini.stage, health: ini.health, budget: ini.budget, sponsorRoleId: sponsor?.id ?? null, illustrative: true });
    for (const v of matchVs) ivsRows.push({ tenantId, initiativeId: id, valueStreamId: v.id, impactType: 'Transforms', illustrative: true });
    for (const d of matchDivs) idivRows.push({ tenantId, initiativeId: id, divisionId: d.id, role: 'Sponsoring', illustrative: true });
  }
  await prisma.initiative.createMany({ data: initRows });
  await prisma.initiativeValueStream.createMany({ data: ivsRows, skipDuplicates: true });
  await prisma.initiativeDivision.createMany({ data: idivRows, skipDuplicates: true });

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

  console.log(`   + ${initRows.length} initiatives, ${risks.length} risks`);
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
