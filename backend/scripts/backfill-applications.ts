// E-01 — make the application catalog complete: every app tied to a Category,
// Vendor, Division and annual TCO; plus add the core developer-tooling apps the
// reviewer flagged as missing (VS Code, IntelliJ, Postman, Docker, SonarQube).
//
// Backfill rules (non-destructive — only fills NULLs, never overwrites):
//   • category / vendor — set for the few rows still missing them.
//   • primaryDivisionName — mapped from the app's category (catalog → org unit).
//   • totalTco — illustrative annual TCO from a category base × criticality
//     factor (deterministic, so re-runs are stable). Tagged illustrative via the
//     existing Application.illustrative flag.
// Steps (StepAppUsage) are a DERIVED count of real process-step usage — not
// fabricated here. Apps with 0 steps are reported, not invented.
//
// NOTE: the catalog still contains duplicate rows (an older illustrative set
// overlapping the APP-### Bridge catalog by name). They are flagged at the end,
// not merged/deleted — that is a separate data-cleanup decision.
//
// Idempotent. Run from backend/:  npx tsx scripts/backfill-applications.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// category → owning division (division names must match Division rows)
const CATEGORY_DIVISION: Record<string, string> = {
  Claims: 'Claims',
  Billing: 'Operations & Customer Service',
  Policy: 'Operations & Customer Service',
  'Policy Admin': 'Operations & Customer Service',
  'Document Mgmt': 'Operations & Customer Service',
  Underwriting: 'Underwriting',
  Pricing: 'Underwriting',
  Actuarial: 'Actuarial',
  'CAT Modeling': 'Actuarial',
  Reinsurance: 'Reinsurance',
  Distribution: 'Sales, Distribution & Marketing',
  CRM: 'Sales, Distribution & Marketing',
  Finance: 'Finance & Investments',
  'ERP / Finance': 'Finance & Investments',
  'FP&A': 'Finance & Investments',
  Treasury: 'Finance & Investments',
  Data: 'Data & AI',
  'Data & Analytics': 'Data & AI',
  BI: 'Data & AI',
  Analytics: 'Data & AI',
  Security: 'Cybersecurity & IAM',
  IAM: 'Cybersecurity & IAM',
  GRC: 'Risk, Compliance & Audit',
  Procurement: 'Risk, Compliance & Audit',
  Infra: 'Technology & Engineering',
  DevOps: 'Technology & Engineering',
  Development: 'Technology & Engineering',
  Delivery: 'Technology & Engineering',
  ITSM: 'Technology & Engineering',
  Productivity: 'Technology & Engineering',
  Collaboration: 'Technology & Engineering',
  'E-Signature': 'Technology & Engineering',
  'HR / HCM': 'Human Resources & Talent',
  Learning: 'Human Resources & Talent',
  'Legal / CLM': 'Legal & Corporate Governance',
};

// category → high-criticality annual TCO base (illustrative). Criticality scales it.
const CATEGORY_TCO_BASE: Record<string, number> = {
  Claims: 900000, Billing: 900000, Policy: 900000, 'Policy Admin': 900000,
  Underwriting: 900000, Pricing: 850000,
  Actuarial: 700000, 'CAT Modeling': 700000, Reinsurance: 700000,
  Distribution: 600000, CRM: 600000,
  Finance: 800000, 'ERP / Finance': 850000, 'FP&A': 600000, Treasury: 650000,
  Data: 750000, 'Data & Analytics': 750000, BI: 500000, Analytics: 500000,
  Security: 650000, IAM: 650000, GRC: 600000, Procurement: 400000,
  Infra: 600000, DevOps: 450000, Development: 200000, Delivery: 400000,
  ITSM: 500000, Productivity: 350000, Collaboration: 300000, 'E-Signature': 250000,
  'HR / HCM': 500000, Learning: 300000, 'Legal / CLM': 350000, 'Document Mgmt': 500000,
};
const CRIT_FACTOR: Record<string, number> = { High: 1.0, Medium: 0.6, Low: 0.35 };
const round5k = (n: number) => Math.round(n / 5000) * 5000;

// category/vendor for the rows that still have NULLs.
const NULL_FIXES: Record<string, { category?: string; vendor?: string }> = {
  'IAM Platform': { category: 'IAM', vendor: 'Okta' },
  'Data Analytics Platform': { category: 'Data & Analytics', vendor: 'Databricks' },
  'Finance ERP': { category: 'ERP / Finance', vendor: 'SAP' },
  'Customer Self-Service Portal': { category: 'Distribution', vendor: 'Salesforce Experience Cloud' },
};

// E-01 — core developer-tooling apps the reviewer flagged as missing.
const DEV_APPS = [
  { name: 'Visual Studio Code', vendor: 'Microsoft', criticality: 'Medium', tco: 60000, description: 'Primary code editor / IDE for engineering teams (policy, claims, data, integration development).' },
  { name: 'IntelliJ IDEA', vendor: 'JetBrains', criticality: 'Medium', tco: 120000, description: 'JVM IDE used by backend / integration engineers.' },
  { name: 'Postman', vendor: 'Postman', criticality: 'Medium', tco: 90000, description: 'API design, testing and collaboration across integration teams.' },
  { name: 'Docker', vendor: 'Docker', criticality: 'Medium', tco: 150000, description: 'Containerization for local development and CI build images.' },
  { name: 'SonarQube', vendor: 'SonarSource', criticality: 'Medium', tco: 110000, description: 'Static code quality and security scanning in the delivery pipeline.' },
];
const DEV_VS = 'Technology Delivery & Change'; // link dev apps to this value stream

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;
  console.log(`Company: ${company.name}`);

  const divNames = new Set((await prisma.division.findMany({ where: { companyId }, select: { name: true } })).map((d) => d.name));

  // ── 0) fix NULL category/vendor ─────────────────────────────────────────────
  for (const [name, fix] of Object.entries(NULL_FIXES)) {
    const app = await prisma.application.findFirst({ where: { companyId, name }, select: { id: true, category: true, vendor: true } });
    if (!app) continue;
    const data: Record<string, string> = {};
    if (!app.category && fix.category) data.category = fix.category;
    if (!app.vendor && fix.vendor) data.vendor = fix.vendor;
    if (Object.keys(data).length) await prisma.application.update({ where: { id: app.id }, data });
  }

  // ── 1) add the missing developer-tooling apps ───────────────────────────────
  const devVs = await prisma.valueStream.findFirst({ where: { companyId, name: DEV_VS }, select: { id: true } });
  let added = 0;
  for (const d of DEV_APPS) {
    const app = await prisma.application.upsert({
      where: { tenantId_companyId_name: { tenantId, companyId, name: d.name } },
      update: {}, // don't clobber if it already exists
      create: {
        tenantId, companyId, name: d.name, kind: 'Platform', category: 'Development',
        vendor: d.vendor, criticality: d.criticality, description: d.description,
        primaryDivisionName: 'Technology & Engineering', totalTco: d.tco, illustrative: true,
      },
      select: { id: true, createdAt: true },
    });
    // only count freshly-created ones
    if (Date.now() - app.createdAt.getTime() < 60000) added++;
    if (devVs) {
      await prisma.applicationValueStream.upsert({
        where: { applicationId_valueStreamId: { applicationId: app.id, valueStreamId: devVs.id } },
        update: {}, create: { tenantId, applicationId: app.id, valueStreamId: devVs.id },
      }).catch(() => {});
    }
  }
  console.log(`E-01 dev apps: ${added} added (of ${DEV_APPS.length}; existing left intact).`);

  // ── 2) backfill division + TCO on every app ─────────────────────────────────
  const apps = await prisma.application.findMany({
    where: { companyId },
    select: { id: true, name: true, category: true, vendor: true, criticality: true, primaryDivisionName: true, totalTco: true, _count: { select: { stepUsages: true } } },
  });
  let divSet = 0, tcoSet = 0;
  const noDivMap = new Set<string>(), noCategory: string[] = [], noVendor: string[] = [], zeroSteps: string[] = [];
  for (const a of apps) {
    const data: Record<string, unknown> = {};
    // division from category
    if (!a.primaryDivisionName) {
      const div = a.category ? CATEGORY_DIVISION[a.category] : undefined;
      if (div && divNames.has(div)) { data.primaryDivisionName = div; divSet++; }
      else if (a.category) noDivMap.add(a.category);
    }
    // illustrative TCO from category base × criticality
    if (a.totalTco == null) {
      const base = a.category ? CATEGORY_TCO_BASE[a.category] : undefined;
      const factor = CRIT_FACTOR[a.criticality] ?? 0.6;
      if (base) { data.totalTco = round5k(base * factor); tcoSet++; }
    }
    if (Object.keys(data).length) await prisma.application.update({ where: { id: a.id }, data });
    if (!a.category) noCategory.push(a.name);
    if (!a.vendor) noVendor.push(a.name);
    if (a._count.stepUsages === 0) zeroSteps.push(a.name);
  }
  console.log(`E-01 backfill: set division on ${divSet} apps, TCO on ${tcoSet} apps (${apps.length} total).`);
  if (noDivMap.size) console.log('  categories with no division mapping:', [...noDivMap].join(', '));

  // ── completeness + duplicate report ─────────────────────────────────────────
  const after = await prisma.application.findMany({ where: { companyId }, select: { name: true, code: true, category: true, vendor: true, primaryDivisionName: true, totalTco: true } });
  const missing = after.filter((a) => !a.category || !a.vendor || !a.primaryDivisionName || a.totalTco == null);
  console.log(`\nCompleteness: ${after.length - missing.length}/${after.length} apps have Category+Vendor+Division+TCO.`);
  if (missing.length) for (const m of missing) console.log('  INCOMPLETE:', m.name, JSON.stringify({ cat: m.category, vendor: m.vendor, div: m.primaryDivisionName, tco: m.totalTco }));

  // duplicate detection: a no-code row whose name is contained in / contains a coded row's vendor or name.
  const coded = after.filter((a) => a.code);
  const noCode = after.filter((a) => !a.code);
  const dupes = noCode.filter((n) => coded.some((c) =>
    (c.vendor && n.name && (c.vendor.includes(n.name) || n.name.includes(c.vendor))) ||
    (c.name && n.name && (c.name.includes(n.name) || n.name.includes(c.name)))));
  if (dupes.length) {
    console.log(`\nDUPLICATE FLAG: ${dupes.length} no-code rows overlap a coded app by name/vendor (left in place):`);
    for (const d of dupes) console.log('  ·', d.name);
  }
  if (zeroSteps.length) console.log(`\n${zeroSteps.length} apps have 0 process-step usages (steps are derived, not fabricated): ${zeroSteps.join(', ')}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
