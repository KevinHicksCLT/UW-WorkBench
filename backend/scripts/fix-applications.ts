// fix-applications.ts — applications cleanup, no invented data:
//   (1) enrich the workbook-derived apps: vendor ← parenthetical text in the name
//       (real vendor names from the workbook), category ← keyword of the name.
//   (2) delete orphan apps (0 NodeAppUsage, not referenced by Metric/Regulation) —
//       leftover curated rows the reseed superseded; these are the "not tied to a
//       value stream" apps. Removing dead data, not creating any.
// Run (cwd=backend): npx tsx scripts/fix-applications.ts
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

const CAT: [RegExp, string][] = [
  [/iam|sso|okta|sailpoint|azure ad|edr|siem|soc|waf|pam|cyberark|vulnerab|firewall|secur|threat|endpoint/i, 'Security'],
  [/grc|compliance|audit|regulat|fraud|sanction|aml|kyc/i, 'Risk & Compliance'],
  [/claim|subrogation|estimating|fnol/i, 'Claims'],
  [/policy|underwrit|issuance|rating|bind|quote/i, 'Policy'],
  [/billing|commission|payment|premium|collection/i, 'Billing'],
  [/crm|marketing|lead|campaign|producer|distribution|salesforce|dynamics/i, 'Distribution'],
  [/erp|general ledger|\bgl\b|close|consolidat|financial|treasury|\btax\b|payroll|expense|blackline|aladdin/i, 'Finance'],
  [/data|warehouse|lakehouse|\blake\b|\bbi\b|reporting|catalog|\bml\b|mlflow|databricks|analytics|model/i, 'Data'],
  [/hris|workday|hr |learning|\blms\b|talent|recruit|cornerstone/i, 'HR'],
];
const categoryOf = (name: string) => { for (const [re, cat] of CAT) if (re.test(name)) return cat; return 'Infra'; };
const vendorOf = (name: string) => { const m = name.match(/\(([^)]+)\)/); if (!m) return null; const v = m[1].trim(); return v.length > 60 ? v.slice(0, 60) : v; };

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const apps = await prisma.application.findMany({ where: { companyId: c }, select: { id: true, name: true, vendor: true, category: true } });
  const used = new Set((await prisma.nodeAppUsage.findMany({ where: { companyId: c }, select: { applicationId: true }, distinct: ['applicationId'] })).map((x) => x.applicationId));

  // (1) enrich blanks
  let vSet = 0, cSet = 0;
  for (const a of apps) {
    if (!used.has(a.id)) continue; // only enrich apps actually in use
    const data: any = {};
    if (!a.vendor || !a.vendor.trim()) { const v = vendorOf(a.name); if (v) { data.vendor = v; vSet++; } }
    if (!a.category || !a.category.trim()) { data.category = categoryOf(a.name); cSet++; }
    if (Object.keys(data).length) await prisma.application.update({ where: { id: a.id }, data });
  }
  console.log(`Enriched: vendor set ${vSet}, category set ${cSet}`);

  // (2) delete orphans (unused + not referenced)
  const orphans = apps.filter((a) => !used.has(a.id)).map((a) => a.id);
  const mRef = new Set((await prisma.metric.findMany({ where: { applicationId: { in: orphans } }, select: { applicationId: true } })).map((x) => x.applicationId!));
  const rRef = new Set((await prisma.regulationApplication.findMany({ where: { applicationId: { in: orphans } }, select: { applicationId: true } })).map((x) => x.applicationId));
  const deletable = orphans.filter((id) => !mRef.has(id) && !rRef.has(id));
  await prisma.application.deleteMany({ where: { id: { in: deletable } } });
  console.log(`Deleted ${deletable.length} orphan apps (kept ${orphans.length - deletable.length} referenced by metric/regulation)`);

  // verify
  const rem = await prisma.application.findMany({ where: { companyId: c }, select: { id: true, vendor: true, category: true } });
  const used2 = new Set((await prisma.nodeAppUsage.findMany({ where: { companyId: c }, select: { applicationId: true }, distinct: ['applicationId'] })).map((x) => x.applicationId));
  console.log(`Apps now ${rem.length}; blank category ${rem.filter((a) => !a.category).length}; blank vendor ${rem.filter((a) => !a.vendor).length}; not tied to value stream ${rem.filter((a) => !used2.has(a.id)).length}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
