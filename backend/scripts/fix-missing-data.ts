// fix-missing-data.ts — resolve the missing/unassociated data surfaced by the
// June-2026 data audit. Idempotent: every section skips rows already wired, so
// re-running only fills what is still empty.
//
//   1. Standard owners        — leaf Standard.ownerRoleId from relatedRole/ownerLabel
//                               text (abbrev-aware role match); create + fully wire
//                               any owner role that genuinely does not exist yet.
//   2. Standard → value stream — NodeStandard from Standard.department → its L2
//                               value-stream node (the structural source).
//   3. Role → deliverable      — RoleDeliverable (Contributor) derived from the
//                               role's NodeRole + the node's NodeDeliverable.
//   4. Exec role → value stream— NodeRole for the 6 strategy/exec roles that sat on
//                               no process node.
//   5. Portfolio init owners   — ownerRoleId from the dominant owner role under the
//                               initiative's value-stream subtree.
//   6. Applications            — drop 5 unused generic duplicates; enrich the rest
//                               with realistic vendor/category/criticality and an
//                               owning org derived from dominant value-stream usage.
//
// Run from backend/:  npx tsx scripts/fix-missing-data.ts          (apply)
//                     npx tsx scripts/fix-missing-data.ts --dry     (report only)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const log = (...a: unknown[]) => console.log(...a);

// ── role-name normalization (abbrev-aware; mirrors lib/roleMatch ABBR set) ──
const ABBR: [RegExp, string][] = [
  [/\bops\b/g, 'operations'], [/\bmgmt\b/g, 'management'], [/\bmgr\b/g, 'manager'],
  [/\buw\b/g, 'underwriting'], [/\bdev\b/g, 'development'], [/\badmin\b/g, 'administration'],
  [/\bintel\b/g, 'intelligence'], [/\bauto\b/g, 'automation'], [/\beng\b/g, 'engineering'],
  [/\bsec\b/g, 'security'], [/\binfo\b/g, 'information'], [/\bri\b/g, 'reinsurance'],
  [/\biam\b/g, 'identity access management'], [/\bcat\b/g, 'catastrophe'],
  [/\bhr\b/g, 'human resources'], [/\bbi\b/g, 'business intelligence'],
  [/\bl&d\b/g, 'learning development'], [/\bap\b/g, 'accounts payable'],
  [/\bsre\b/g, 'site reliability engineer'], [/\bpmo\b/g, 'program management office'],
  [/\brte\b/g, 'release train engineer'], [/\biso\b/g, 'information security officer'],
  [/\bip\b/g, 'intellectual property'],
  [/\bciso\b/g, 'chief information security officer'], [/\bdpo\b/g, 'data protection officer'],
  [/\bcro\b/g, 'chief risk officer'], [/\bchro\b/g, 'chief human resources officer'],
  [/\bcoo\b/g, 'chief operating officer'], [/\bcio\b/g, 'chief information officer'],
  [/\bcfo\b/g, 'chief financial officer'], [/\bcto\b/g, 'chief technology officer'],
  [/\bceo\b/g, 'chief executive officer'],
];

// Owner labels in the privacy/cyber standards are multi-party ("CISO / DPO",
// "Highest-Ranking Executive + CISO"). Take the PRIMARY (first) accountable party
// so the resolved/created owner is a single clean role, never a slash-compound.
const primaryLabel = (v: unknown): string =>
  String(v ?? '').split(/\s*[\/+;,]\s*|\s+and\s+|\s+&\s+/i)[0].trim();
// free-text governance phrases → a real role.
const OWNER_ALIAS: Record<string, string> = {
  'highest ranking executive': 'Chief Executive Officer',
  'senior governing body': 'Chief Executive Officer',
  'vendor security': 'Vendor Risk Manager',
};
const norm = (v: unknown): string =>
  String(v ?? '').toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9& ]/g, ' ').replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const expand = (s: string): string => { for (const [re, r] of ABBR) s = s.replace(re, r); return s.replace(/\s+/g, ' ').trim(); };
const keyOf = (v: unknown): string => expand(norm(v));

// ── department → value-stream L2 node name, and → org-unit division name ────
const DEPT_TO_VS: Record<string, string> = {
  'Information Security': 'Cybersecurity & IAM',
  'Actuarial': 'Actuarial',
  'Claims Operations': 'Claims',
  'Underwriting': 'Underwriting',
  'Human Resources': 'Human Resources & Talent',
  'Finance & Accounting': 'Finance & Investments',
  'Compliance & Risk Management': 'Risk, Compliance & Audit',
  'Legal & Governance': 'Legal & Corporate Governance',
  'Data & Analytics': 'Data & AI',
  'Engineering & Development': 'Technology & Engineering',
  'Enterprise & Solution Architecture': 'Technology & Engineering',
  'PMO & Agile Delivery': 'Program Management Office',
  'Operations & Customer Service': 'Business Operations',
};
// org-unit division name per department (matches VS naming except where noted).
const DEPT_TO_ORG: Record<string, string> = { ...DEPT_TO_VS };

// owner labels whose natural domain differs from their standard's department —
// home the created role by its real domain, not the filing department.
const LABEL_HOME: Record<string, string> = {
  'IT Security Manager': 'Cybersecurity & IAM',
  'Access Administrator': 'Cybersecurity & IAM',
  'Records Manager': 'Legal & Corporate Governance',
};

// ── realistic app catalog: name → {vendor, category, criticality, ownership} ─
// internal/external SaaS & systems-of-record for a mid/large P&C+L&A insurer.
const APP_CATALOG: Record<string, { vendor: string; category: string; criticality: string; ownership: string }> = {
  'ADP Payroll': { vendor: 'ADP', category: 'HR', criticality: 'High', ownership: 'SaaS' },
  'Anaplan (Planning)': { vendor: 'Anaplan', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'Archer GRC': { vendor: 'Archer', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'AuditBoard': { vendor: 'AuditBoard', category: 'Security', criticality: 'Medium', ownership: 'SaaS' },
  'Azure DevOps': { vendor: 'Microsoft', category: 'Infra', criticality: 'High', ownership: 'SaaS' },
  'Azure ML / MLflow': { vendor: 'Microsoft', category: 'Data', criticality: 'Medium', ownership: 'SaaS' },
  'BlackLine (Close)': { vendor: 'BlackLine', category: 'Finance', criticality: 'High', ownership: 'SaaS' },
  'BlackRock Aladdin': { vendor: 'BlackRock', category: 'Finance', criticality: 'High', ownership: 'SaaS' },
  'Bloomberg Terminal': { vendor: 'Bloomberg', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'Broker & Agent Portal': { vendor: 'In-house', category: 'Distribution', criticality: 'High', ownership: 'In-house' },
  'CCC / Mitchell Estimating': { vendor: 'CCC Intelligent Solutions', category: 'Claims', criticality: 'Medium', ownership: 'SaaS' },
  'Catastrophe Data Provider': { vendor: 'Verisk', category: 'Data', criticality: 'Medium', ownership: 'SaaS' },
  'Confluence': { vendor: 'Atlassian', category: 'Infra', criticality: 'Low', ownership: 'SaaS' },
  'Cornerstone LMS': { vendor: 'Cornerstone OnDemand', category: 'HR', criticality: 'Low', ownership: 'SaaS' },
  'Coupa / SAP Ariba (Procurement)': { vendor: 'Coupa', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'Credit Bureau & Data Services': { vendor: 'Experian', category: 'Data', criticality: 'Medium', ownership: 'SaaS' },
  'CrowdStrike Falcon': { vendor: 'CrowdStrike', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'Customer Self-Service Portal': { vendor: 'In-house', category: 'Distribution', criticality: 'High', ownership: 'In-house' },
  'CyberArk (PAM)': { vendor: 'CyberArk', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'Databricks Lakehouse': { vendor: 'Databricks', category: 'Data', criticality: 'High', ownership: 'SaaS' },
  'DocuSign': { vendor: 'DocuSign', category: 'Distribution', criticality: 'Medium', ownership: 'SaaS' },
  'Duck Creek Distribution': { vendor: 'Duck Creek', category: 'Distribution', criticality: 'High', ownership: 'SaaS' },
  'Earnix Rating & Pricing': { vendor: 'Earnix', category: 'Policy', criticality: 'High', ownership: 'SaaS' },
  'FIS Prophet': { vendor: 'FIS', category: 'Actuarial', criticality: 'High', ownership: 'SaaS' },
  'FRISS Fraud Detection': { vendor: 'FRISS', category: 'Claims', criticality: 'Medium', ownership: 'SaaS' },
  'Genesys Cloud (Contact Center)': { vendor: 'Genesys', category: 'Distribution', criticality: 'High', ownership: 'SaaS' },
  'Greenhouse (Recruiting)': { vendor: 'Greenhouse', category: 'HR', criticality: 'Low', ownership: 'SaaS' },
  'Guidewire BillingCenter': { vendor: 'Guidewire', category: 'Billing', criticality: 'High', ownership: 'SaaS' },
  'Guidewire ClaimCenter': { vendor: 'Guidewire', category: 'Claims', criticality: 'High', ownership: 'SaaS' },
  'Guidewire PolicyCenter': { vendor: 'Guidewire', category: 'Policy', criticality: 'High', ownership: 'SaaS' },
  'Icertis CLM (Contracts)': { vendor: 'Icertis', category: 'Legal', criticality: 'Medium', ownership: 'SaaS' },
  'Jira': { vendor: 'Atlassian', category: 'Infra', criticality: 'Medium', ownership: 'SaaS' },
  'Jira Align / Rally': { vendor: 'Atlassian', category: 'Infra', criticality: 'Medium', ownership: 'SaaS' },
  'LexisNexis Risk': { vendor: 'LexisNexis', category: 'Data', criticality: 'Medium', ownership: 'SaaS' },
  'Marketo (Marketing)': { vendor: 'Adobe', category: 'Distribution', criticality: 'Low', ownership: 'SaaS' },
  'Medical Bill Review (Coventry)': { vendor: 'Coventry / Mitchell', category: 'Claims', criticality: 'Medium', ownership: 'SaaS' },
  'Microsoft 365 / SharePoint': { vendor: 'Microsoft', category: 'Infra', criticality: 'High', ownership: 'SaaS' },
  'Microsoft Excel': { vendor: 'Microsoft', category: 'Infra', criticality: 'Medium', ownership: 'SaaS' },
  'Microsoft Teams / Email': { vendor: 'Microsoft', category: 'Infra', criticality: 'High', ownership: 'SaaS' },
  'Milliman Arius (Reserving)': { vendor: 'Milliman', category: 'Actuarial', criticality: 'High', ownership: 'SaaS' },
  "Moody's RMS (Cat Model)": { vendor: "Moody's RMS", category: 'Actuarial', criticality: 'High', ownership: 'SaaS' },
  'NICE Actimize (AML)': { vendor: 'NICE', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'NIPR (Producer Licensing)': { vendor: 'NIPR', category: 'Distribution', criticality: 'Medium', ownership: 'SaaS' },
  'Okta / IAM Platform': { vendor: 'Okta', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'OneStream (FP&A)': { vendor: 'OneStream', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'OpenText Document Mgmt': { vendor: 'OpenText', category: 'Infra', criticality: 'Medium', ownership: 'SaaS' },
  'Oracle EPM': { vendor: 'Oracle', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'Payment Gateway': { vendor: 'Stripe / Fiserv', category: 'Billing', criticality: 'High', ownership: 'SaaS' },
  'Policy Administration Platform': { vendor: 'In-house', category: 'Policy', criticality: 'High', ownership: 'In-house' },
  'Power BI': { vendor: 'Microsoft', category: 'Data', criticality: 'Medium', ownership: 'SaaS' },
  'Qualys / Tenable (Vuln)': { vendor: 'Qualys', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'Regulatory Filing Portal (SERFF)': { vendor: 'NAIC', category: 'Policy', criticality: 'Medium', ownership: 'SaaS' },
  'Reinsurer Exchange': { vendor: 'In-house', category: 'Finance', criticality: 'Medium', ownership: 'In-house' },
  'SAP S/4HANA (GL)': { vendor: 'SAP', category: 'Finance', criticality: 'High', ownership: 'SaaS' },
  'SAS Actuarial Platform': { vendor: 'SAS', category: 'Actuarial', criticality: 'High', ownership: 'SaaS' },
  'SailPoint IGA': { vendor: 'SailPoint', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'Salesforce FSC': { vendor: 'Salesforce', category: 'Distribution', criticality: 'High', ownership: 'SaaS' },
  'Sapiens ReinsurancePro': { vendor: 'Sapiens', category: 'Finance', criticality: 'High', ownership: 'SaaS' },
  'ServiceNow ITSM': { vendor: 'ServiceNow', category: 'Infra', criticality: 'High', ownership: 'SaaS' },
  'Snowflake Data Cloud': { vendor: 'Snowflake', category: 'Data', criticality: 'High', ownership: 'SaaS' },
  'Splunk SIEM': { vendor: 'Splunk', category: 'Security', criticality: 'High', ownership: 'SaaS' },
  'Statutory Reporting (NAIC)': { vendor: 'NAIC', category: 'Finance', criticality: 'Medium', ownership: 'SaaS' },
  'Surplus Lines / SLIP Portal': { vendor: 'SLA', category: 'Policy', criticality: 'Medium', ownership: 'SaaS' },
  'Workday HCM': { vendor: 'Workday', category: 'HR', criticality: 'High', ownership: 'SaaS' },
  'iManage (Legal Docs)': { vendor: 'iManage', category: 'Legal', criticality: 'Medium', ownership: 'SaaS' },
};
// generic placeholder apps that duplicate a named system above and carry zero
// usage/metrics/regs — removed so the catalog has a single source of truth.
const APP_DUPLICATES = ['Broker / Distribution Portal', 'Claims Management Platform', 'Data Analytics Platform', 'Finance ERP', 'IAM Platform'];
// app category → owning org-unit division (fallback when usage can't decide).
const CATEGORY_TO_ORG: Record<string, string> = {
  Policy: 'Underwriting', Claims: 'Claims', Billing: 'Finance & Investments', Distribution: 'Sales, Distribution & Marketing',
  Data: 'Data & AI', Finance: 'Finance & Investments', Security: 'Cybersecurity & IAM', Infra: 'Technology & Engineering',
  HR: 'Human Resources & Talent', Actuarial: 'Actuarial', Legal: 'Legal & Corporate Governance',
};

// exec roles (sat on no node) → value-stream node + tie.
const EXEC_NODE: Record<string, { vs: string; role_: string; level: string }> = {
  'Chief Executive Officer': { vs: 'Corporate Operations', role_: 'Owner', level: 'Oversight' },
  'Chief of Staff': { vs: 'Corporate Operations', role_: 'Participant', level: 'Oversight' },
  'Chief Strategy Officer': { vs: 'Corporate Operations', role_: 'Owner', level: 'Oversight' },
  'Strategic Planning Analyst': { vs: 'Corporate Operations', role_: 'Participant', level: 'Contributor' },
  'Corporate Development Manager': { vs: 'Finance & Investments', role_: 'Owner', level: 'Lead' },
  'Investor Relations Director': { vs: 'Finance & Investments', role_: 'Owner', level: 'Lead' },
};

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('no company');
  const companyId = company.id;
  log(`\n=== fix-missing-data ${DRY ? '(DRY RUN)' : '(APPLY)'} — company ${company.name} ===`);

  // lookups -----------------------------------------------------------------
  const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, dbValue: true, displayValue: true, orgUnitId: true } });
  const roleIndex = new Map<string, { id: string; name: string }>();
  for (const r of roles) for (const k of [keyOf(r.displayValue), keyOf(r.dbValue)]) if (k && !roleIndex.has(k)) roleIndex.set(k, { id: r.id, name: r.displayValue });
  // contains-fallback list (sorted longest-first so the most specific wins).
  const roleKeys = [...roleIndex.entries()].sort((a, b) => b[0].length - a[0].length);
  const matchRole = (label: string | null): { id: string; name: string } | null => {
    const k = keyOf(label);
    if (!k) return null;
    if (roleIndex.has(k)) return roleIndex.get(k)!;
    const lw = k.split(' ');
    // multi-word: the label's words all appear in a role key, or vice-versa.
    for (const [rk, rv] of roleKeys) {
      const rw = rk.split(' ');
      const labelInRole = lw.every((w) => rw.includes(w)) && lw.length >= 2;
      const roleInLabel = rw.every((w) => lw.includes(w)) && rw.length >= 2;
      if (labelInRole || roleInLabel) return rv;
    }
    // single significant word (e.g. "underwriter") → shortest ≤3-word role title
    // that contains it as a whole token ("senior underwriter"). roleKeys is sorted
    // longest-first, so scan ascending to take the most generic match.
    if (lw.length === 1 && lw[0].length >= 5) {
      for (let i = roleKeys.length - 1; i >= 0; i--) {
        const rw = roleKeys[i][0].split(' ');
        if (rw.length <= 3 && rw.includes(lw[0])) return roleKeys[i][1];
      }
    }
    return null;
  };

  const vsNodes = await prisma.processNode.findMany({
    where: { companyId, processLevelType: { levelNumber: 2 } },
    select: { id: true, displayValue: true },
  });
  const vsByName = new Map(vsNodes.map((n) => [n.displayValue, n.id]));
  const orgUnits = await prisma.orgUnit.findMany({ where: { companyId, orgLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true } });
  const orgByName = new Map(orgUnits.map((o) => [o.displayValue, o.id]));

  const counts = { ownerSet: 0, rolesCreated: 0, nodeStandard: 0, roleDeliv: 0, execNode: 0, pinitOwner: 0, appsDeleted: 0, appsEnriched: 0, appOrg: 0 };
  const unresolvedOwners = new Map<string, { dept: string; n: number }>();

  // ── 1. STANDARD OWNERS ────────────────────────────────────────────────
  const unowned = await prisma.standard.findMany({ where: { companyId, isArea: false, ownerRoleId: null }, select: { id: true, ownerLabel: true, relatedRole: true, department: true } });
  type Pending = { stdId: string; label: string; dept: string };
  const needRole: Pending[] = [];
  // resolve a raw owner cell to its PRIMARY clean role label + a match (if any).
  const resolveOwner = (raw: string | null) => {
    const prim = primaryLabel(raw);
    if (!prim) return { label: '', match: null as { id: string; name: string } | null };
    const aliased = OWNER_ALIAS[norm(prim)] ?? prim;
    return { label: aliased, match: matchRole(aliased) };
  };
  for (const s of unowned) {
    let res = resolveOwner(s.relatedRole);
    if (!res.match) { const alt = resolveOwner(s.ownerLabel); res = alt.match ? alt : (res.label ? res : alt); }
    if (res.match) {
      if (!DRY) await prisma.standard.update({ where: { id: s.id }, data: { ownerRoleId: res.match.id } });
      counts.ownerSet++;
    } else if (res.label) {
      needRole.push({ stdId: s.id, label: res.label, dept: s.department || '' });
    }
  }
  // create + fully wire the genuinely-absent owner roles, then assign.
  const byLabel = new Map<string, Pending[]>();
  for (const p of needRole) { const k = p.label; (byLabel.get(k) || byLabel.set(k, []).get(k)!).push(p); }
  const rank = (n: string) => /\bchief\b|\bceo\b/i.test(n) ? 0 : /officer|head|director|\bvp\b/i.test(n) ? 1 : /manager|lead|principal/i.test(n) ? 2 : 3;
  for (const [label, pend] of byLabel) {
    const dept = pend[0].dept;
    const orgName = LABEL_HOME[label] || DEPT_TO_ORG[dept];     // domain override wins
    const vsName = LABEL_HOME[label] || DEPT_TO_VS[dept];
    const orgId = orgName ? orgByName.get(orgName) : undefined;
    const vsId = vsName ? vsByName.get(vsName) : undefined;
    // manager = most-senior existing role homed in that org (rank-ordered), else CEO.
    const senior = roles.filter((r) => r.orgUnitId === orgId).sort((a, b) => rank(a.displayValue) - rank(b.displayValue))[0];
    const ceo = roles.find((r) => /chief executive officer/i.test(r.displayValue));
    const managerRoleId = (senior && rank(senior.displayValue) < 3 ? senior.id : null) || ceo?.id || null;
    if (!orgId) { unresolvedOwners.set(label, { dept, n: pend.length }); continue; } // no home → don't create an orphan
    log(`  + create role "${label}" → org ${orgName}, mgr ${roles.find(r=>r.id===managerRoleId)?.displayValue || '—'}, +NodeRole ${vsName || '—'} (${pend.length} standards)`);
    counts.rolesCreated++;
    if (!DRY) {
      const created = await prisma.role.create({ data: { companyId, dbValue: label, displayValue: label, orgUnitId: orgId, managerRoleId } });
      await prisma.roleOrgAssignment.create({ data: { roleId: created.id, orgUnitId: orgId, isPrimary: true } });
      if (vsId) await prisma.nodeRole.create({ data: { companyId, processNodeId: vsId, roleId: created.id, role_: 'Participant', ownerLevel: 'Oversight' } });
      roleIndex.set(keyOf(label), { id: created.id, name: label }); // so re-matches reuse it
      for (const p of pend) await prisma.standard.update({ where: { id: p.stdId }, data: { ownerRoleId: created.id } });
      counts.ownerSet += pend.length;
    } else { counts.ownerSet += pend.length; }
  }

  // ── 2. STANDARD → VALUE STREAM (NodeStandard via department) ───────────
  const leafStds = await prisma.standard.findMany({ where: { companyId, isArea: false }, select: { id: true, department: true, nodeStandards: { select: { id: true } } } });
  for (const s of leafStds) {
    if (s.nodeStandards.length) continue;
    const vsName = DEPT_TO_VS[s.department || ''];
    const vsId = vsName ? vsByName.get(vsName) : undefined;
    if (!vsId) continue;
    counts.nodeStandard++;
    if (!DRY) await prisma.nodeStandard.create({ data: { companyId, processNodeId: vsId, standardId: s.id } });
  }

  // ── 3. ROLE → DELIVERABLE (Contributor, derived from NodeRole) ─────────
  const rolesNoDeliv = await prisma.role.findMany({
    where: { companyId, roleDeliverables: { none: {} } },
    select: { id: true, displayValue: true, nodeRoles: { select: { processNode: { select: { nodeDeliverables: { select: { deliverableId: true }, take: 8 } } } } } },
  });
  for (const r of rolesNoDeliv) {
    const delivIds = [...new Set(r.nodeRoles.flatMap((nr) => nr.processNode.nodeDeliverables.map((d) => d.deliverableId)))].slice(0, 8);
    for (const deliverableId of delivIds) {
      counts.roleDeliv++;
      if (!DRY) await prisma.roleDeliverable.create({ data: { companyId, roleId: r.id, deliverableId, role_: 'Contributor' } }).catch(() => {});
    }
  }

  // ── 4. EXEC ROLE → VALUE STREAM (NodeRole) ─────────────────────────────
  for (const [name, cfg] of Object.entries(EXEC_NODE)) {
    const role = roles.find((r) => r.displayValue === name);
    const vsId = vsByName.get(cfg.vs);
    if (!role || !vsId) continue;
    const exists = await prisma.nodeRole.findFirst({ where: { processNodeId: vsId, roleId: role.id } });
    if (exists) continue;
    counts.execNode++;
    if (!DRY) await prisma.nodeRole.create({ data: { companyId, processNodeId: vsId, roleId: role.id, role_: cfg.role_, ownerLevel: cfg.level } });
  }

  // ── 5. PORTFOLIO INITIATIVE OWNERS ─────────────────────────────────────
  const pinits = await prisma.portfolioInitiative.findMany({ where: { companyId, ownerRoleId: null }, select: { id: true, name: true, valueStreamNodeId: true } });
  for (const pi of pinits) {
    if (!pi.valueStreamNodeId) continue;
    // dominant owner role among tasks in this VS node's subtree.
    const rows = await prisma.$queryRawUnsafe<{ roleId: string; n: bigint }[]>(
      `SELECT nr."roleId", count(*) n FROM "NodeRole" nr
       JOIN "ProcessNodeClosure" c ON c."descendantId"=nr."processNodeId"
       WHERE c."ancestorId"=$1 AND nr."role_"='Owner' GROUP BY 1 ORDER BY 2 DESC LIMIT 1`, pi.valueStreamNodeId);
    const ownerRoleId = rows[0]?.roleId;
    if (!ownerRoleId) continue;
    log(`  pinit "${pi.name}" → owner ${roles.find(r=>r.id===ownerRoleId)?.displayValue}`);
    counts.pinitOwner++;
    if (!DRY) await prisma.portfolioInitiative.update({ where: { id: pi.id }, data: { ownerRoleId } });
  }

  // ── 6. APPLICATIONS — drop duplicates, enrich, set owning org ──────────
  for (const name of APP_DUPLICATES) {
    const dup = await prisma.application.findFirst({ where: { companyId, name, nodeAppUsages: { none: {} }, metrics: { none: {} }, regulationApplications: { none: {} } } });
    if (!dup) continue;
    log(`  - delete duplicate app "${name}"`);
    counts.appsDeleted++;
    if (!DRY) await prisma.application.delete({ where: { id: dup.id } });
  }
  const apps = await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true, category: true, vendor: true, orgUnitId: true } });
  for (const a of apps) {
    const cat = APP_CATALOG[a.name];
    if (cat && (!a.category || !a.vendor)) {
      counts.appsEnriched++;
      if (!DRY) await prisma.application.update({ where: { id: a.id }, data: { category: cat.category, vendor: cat.vendor, criticality: cat.criticality, ownershipModel: cat.ownership, isInternal: cat.ownership === 'In-house' } });
    }
    if (!a.orgUnitId) {
      // dominant value-stream of usage → its division org; else category fallback.
      const rows = await prisma.$queryRawUnsafe<{ vs: string; n: bigint }[]>(
        `SELECT anc."displayValue" vs, count(*) n FROM "NodeAppUsage" na
         JOIN "ProcessNodeClosure" c ON c."descendantId"=na."processNodeId"
         JOIN "ProcessNode" anc ON anc.id=c."ancestorId"
         JOIN "ProcessLevelType" plt ON plt.id=anc."processLevelTypeId" AND plt."levelNumber"=2
         WHERE na."applicationId"=$1 GROUP BY 1 ORDER BY 2 DESC LIMIT 1`, a.id);
      const orgName = (rows[0] && orgByName.has(rows[0].vs)) ? rows[0].vs : (cat ? CATEGORY_TO_ORG[cat.category] : undefined);
      const orgId = orgName ? orgByName.get(orgName) : undefined;
      if (orgId) { counts.appOrg++; if (!DRY) await prisma.application.update({ where: { id: a.id }, data: { orgUnitId: orgId } }); }
    }
  }

  log('\n--- summary ---');
  console.table(counts);
  if (unresolvedOwners.size) {
    log(`\n${unresolvedOwners.size} owner labels still unresolved (no department→org home; left for manual review):`);
    console.table([...unresolvedOwners.entries()].map(([label, v]) => ({ label, dept: v.dept, standards: v.n })));
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
