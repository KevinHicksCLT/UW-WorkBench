// transform-workbook.ts — IT_Roles_Analytics_v13.xlsx → normalized spine.json
//
// v13 broadens the model: value-stream DOMAINS, 243 real KPI definitions,
// 256 E2E process steps, 835 inputs/outputs, 84 extended roles + a reporting
// hierarchy, and department standards — on top of the v12 org/value-stream spine.
// Isolates workbook quirks (title/helper rows, role-name variants) from the
// schema. The seed reads the committed spine.json, never the .xlsx.
//
// Run from repo root: npx tsx backend/scripts/transform-workbook.ts
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const WORKBOOK = process.argv[2] || 'IT_Roles_Analytics_v13.xlsx';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/spine.json');

const wb = XLSX.read(readFileSync(WORKBOOK), { cellDates: true });
const grid = (name: string): unknown[][] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
};

const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));
const orNull = (v: unknown): string | null => str(v) || null;
const intOrNull = (v: unknown): number | null => { const n = parseInt(str(v), 10); return Number.isFinite(n) ? n : null; };

// Consolidate the workbook's 13–15 noisy value-stream domains (six are
// single-stream; several are compound "A / B" labels) into a clean, legible set
// of 6 primary domains. Faithful to the source streams, just regrouped.
const CLEAN_DOMAIN: Record<string, string> = {
  'Core Insurance': 'Core Insurance',
  'Product & Growth': 'Distribution & Customer',
  'Operations / Customer': 'Distribution & Customer',
  'Technology': 'Technology & Data',
  'Technology / Data': 'Technology & Data',
  'Technology / Risk': 'Technology & Data',
  'Operations / Technology': 'Technology & Data',
  'Finance': 'Finance & Actuarial',
  'Risk & Finance': 'Finance & Actuarial',
  'Risk & Control': 'Risk, Compliance & Audit',
  'Operations / Control': 'Risk, Compliance & Audit',
  'Corporate Services': 'Corporate & Enterprise',
  'Corporate Functions': 'Corporate & Enterprise',
  'Enterprise Management': 'Corporate & Enterprise',
  'Enterprise / Product': 'Corporate & Enterprise',
};
const DOMAIN_ORDER = ['Core Insurance', 'Distribution & Customer', 'Technology & Data', 'Finance & Actuarial', 'Risk, Compliance & Audit', 'Corporate & Enterprise'];
const cleanDomain = (raw: string | null): string | null => (raw ? (CLEAN_DOMAIN[raw] ?? raw) : null);

// ─── Role-name reconciliation (variants across sheets) ──────────────────
const ABBR: [RegExp, string][] = [
  [/\bops\b/g, 'operations'], [/\bmgmt\b/g, 'management'], [/\bmgr\b/g, 'manager'],
  [/\buw\b/g, 'underwriting'], [/\bdev\b/g, 'development'], [/\badmin\b/g, 'administration'],
  [/\bintel\b/g, 'intelligence'], [/\bauto\b/g, 'automation'], [/\beng\b/g, 'engineering'],
  [/\bsec\b/g, 'security'], [/\binfo\b/g, 'information'], [/\bri\b/g, 'reinsurance'],
  [/\biam\b/g, 'identity access management'], [/\bcat\b/g, 'catastrophe'],
];
const baseNorm = (v: unknown): string =>
  str(v).toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
const expand = (s: string): string => { for (const [re, r] of ABBR) s = s.replace(re, r); return s.replace(/\s+/g, ' ').trim(); };
const candidates = (v: unknown): string[] => {
  const b = baseNorm(v);
  const full = expand(b.replace(/\//g, ' '));
  const first = expand(b.split('/')[0]);
  return [...new Set([full, first].filter(Boolean))];
};

// ─── Categories (canonical from Category_Totals) ────────────────────────
const normCat = (v: unknown): string => str(v).replace(/[‑–—]/g, '-');
const catRows = grid('Category_Totals');
const canonicalCategories: string[] = [];
const catIndex = new Map<string, string>();
for (let i = 1; i < catRows.length; i++) {
  const name = normCat(catRows[i][0]);
  if (!name || /total/i.test(name)) continue;
  if (!catIndex.has(name.toLowerCase())) { canonicalCategories.push(name); catIndex.set(name.toLowerCase(), name); }
}
const matchCategory = (v: unknown): string | null => catIndex.get(normCat(v).toLowerCase()) ?? null;

// ─── Org Chart View → divisions, departments, roles (the roster) ────────
type RoleRec = {
  name: string; itemRole: string | null; roleFamily: string | null; sourceSheet: string | null;
  divisionName: string | null; departmentName: string | null;
  roleLevel: string | null; description: string | null; responsibilities: string | null;
  status: string | null; primaryDomain: string | null; primaryValueStream: string | null;
  managerRoleName: string | null; matrixRoles: string | null; sourceRow: number;
};
const og = grid('Org Chart View'); // header row 0; cols 9 Div,10 Dept,11 Role,12 Source,13 ItemRole
const divisionNames: string[] = [];
const departments: { divisionName: string; name: string; sourceRow: number }[] = [];
const roles: RoleRec[] = [];
const seenDiv = new Set<string>(), seenDept = new Set<string>(), seenRole = new Set<string>();

const blankRole = (name: string, over: Partial<RoleRec> = {}): RoleRec => ({
  name, itemRole: null, roleFamily: null, sourceSheet: null, divisionName: null, departmentName: null,
  roleLevel: null, description: null, responsibilities: null, status: null, primaryDomain: null,
  primaryValueStream: null, managerRoleName: null, matrixRoles: null, sourceRow: -1, ...over,
});

for (let i = 1; i < og.length; i++) {
  const division = str(og[i][9]), department = str(og[i][10]), role = str(og[i][11]);
  if (!division || !role) continue;
  if (!seenDiv.has(division)) { seenDiv.add(division); divisionNames.push(division); }
  const deptKey = `${division}␟${department}`;
  if (department && !seenDept.has(deptKey)) { seenDept.add(deptKey); departments.push({ divisionName: division, name: department, sourceRow: i }); }
  const roleKey = `${division}␟${role}`;
  if (!seenRole.has(roleKey)) {
    seenRole.add(roleKey);
    roles.push(blankRole(role, {
      itemRole: orNull(og[i][13]), roleFamily: og[i][4] != null ? orNull(og[i][4]) : null,
      sourceSheet: orNull(og[i][12]), divisionName: division, departmentName: department || null, sourceRow: i,
    }));
  }
}

// Match index: every normalized candidate of every roster alias → canonical name.
const roleIndex = new Map<string, string>();
const indexRole = (r: RoleRec) => {
  for (const alias of [r.name, r.itemRole, r.sourceSheet]) {
    if (!alias) continue;
    for (const c of candidates(alias)) if (!roleIndex.has(c)) roleIndex.set(c, r.name);
  }
};
roles.forEach(indexRole);
const byName = new Map(roles.map((r) => [r.name, r] as const));
const matchRole = (v: unknown): string | null => { for (const c of candidates(v)) { const m = roleIndex.get(c); if (m) return m; } return null; };

const autoAdded: string[] = [];
const ensureRole = (v: unknown, fromSheet: string): string | null => {
  const name = str(v);
  if (!name) return null;
  const m = matchRole(v);
  if (m) return m;
  const rec = blankRole(name, { itemRole: name, sourceSheet: fromSheet });
  roles.push(rec); indexRole(rec); byName.set(name, rec); autoAdded.push(name);
  return name;
};

// ─── Extended Role Inventory → 84 lower-level roles (+ reporting/desc) ───
const eri = grid('Extended Role Inventory'); // header row 3; data 4+
let extendedCount = 0;
for (let i = 4; i < eri.length; i++) {
  const name = str(eri[i][0]);
  if (!name) continue;
  const canonical = matchRole(name);
  const target = canonical ? byName.get(canonical)! : (() => { const r = blankRole(name, { itemRole: name, sourceSheet: 'Extended Role Inventory' }); roles.push(r); indexRole(r); byName.set(name, r); extendedCount++; return r; })();
  // enrich (don't clobber org-chart placement)
  target.roleFamily ??= orNull(eri[i][1]);
  target.roleLevel ??= orNull(eri[i][2]);
  target.primaryDomain ??= orNull(eri[i][3]);
  target.primaryValueStream ??= orNull(eri[i][4]);
  target.managerRoleName ??= orNull(eri[i][5]);
  target.matrixRoles ??= orNull(eri[i][6]);
  target.description ??= orNull(eri[i][8]);
  target.responsibilities ??= orNull(eri[i][9]);
  target.status ??= orNull(eri[i][10]);
}

// ─── Role Hierarchy Map → reporting (directReport → manager) ────────────
const rhm = grid('Role Hierarchy Map'); // header row 2; data 3+
const roleHierarchy: any[] = [];
for (let i = 3; i < rhm.length; i++) {
  const manager = str(rhm[i][0]), report = str(rhm[i][2]);
  if (!manager || !report) continue;
  const mgr = matchRole(manager), rep = ensureRole(report, 'Role Hierarchy Map');
  if (!rep) continue;
  roleHierarchy.push({ managerRole: mgr, directReportRole: rep, reportLevel: orNull(rhm[i][3]), domain: orNull(rhm[i][4]), primaryValueStream: orNull(rhm[i][5]), projectMatrixRoles: orNull(rhm[i][6]), notes: orNull(rhm[i][7]), sourceRow: i });
  const rr = byName.get(rep);
  if (rr && !rr.managerRoleName && mgr) rr.managerRoleName = mgr;
}

// Resolve managerRoleName → canonical; inherit division/department from manager
// for roles the org chart never placed (the 84 extended roles).
for (const r of roles) if (r.managerRoleName) r.managerRoleName = matchRole(r.managerRoleName) ?? r.managerRoleName;
for (let pass = 0; pass < 4; pass++) {
  for (const r of roles) {
    if (r.divisionName) continue;
    const mgr = r.managerRoleName ? byName.get(r.managerRoleName) : undefined;
    if (mgr?.divisionName) { r.divisionName = mgr.divisionName; r.departmentName ??= mgr.departmentName; }
  }
}

// ─── Value Streams → domains, streams, role participation links ─────────
const vs = grid('Value Streams'); // header row 3; data 4+
const domainSet = new Set<string>();
const valueStreams: { name: string; domain: string | null; sourceRow: number }[] = [];
const seenVs = new Set<string>();
const roleValueStreams: any[] = [];
for (let i = 4; i < vs.length; i++) {
  const name = str(vs[i][1]); if (!name) continue;
  const domain = cleanDomain(orNull(vs[i][0]));
  if (domain) domainSet.add(domain);
  if (!seenVs.has(name)) { seenVs.add(name); valueStreams.push({ name, domain, sourceRow: i }); }
  const role = str(vs[i][3]); if (!role) continue;
  const roleName = ensureRole(role, 'Value Streams'); if (!roleName) continue;
  roleValueStreams.push({
    roleName, valueStreamName: name, subStream: orNull(vs[i][2]), participationType: str(vs[i][5]) || 'Support',
    inputs: orNull(vs[i][6]), outputs: orNull(vs[i][7]), upstream: orNull(vs[i][8]), downstream: orNull(vs[i][9]),
    notes: orNull(vs[i][10]), externalParticipants: orNull(vs[i][11]), sourceRow: i,
  });
}

// ─── Sub-Value Streams → L3/L4 nodes ────────────────────────────────────
const svs = grid('Sub-Value Streams'); // header row 3; data 4+
const subValueStreams: any[] = [];
for (let i = 4; i < svs.length; i++) {
  const l2 = str(svs[i][1]); if (!l2) continue;
  subValueStreams.push({
    valueStreamName: l2, l3: orNull(svs[i][2]), l4: orNull(svs[i][3]), keyRoles: orNull(svs[i][4]),
    inputs: orNull(svs[i][6]), outputs: orNull(svs[i][7]), upstream: orNull(svs[i][8]), downstream: orNull(svs[i][9]),
    notes: orNull(svs[i][10]), externalParticipants: orNull(svs[i][11]), sourceRow: i,
  });
}

// ─── Value Stream Metrics → 243 real KPI definitions ────────────────────
const vsm = grid('Value Stream Metrics'); // header row 3; data 4+
const metrics: any[] = [];
for (let i = 4; i < vsm.length; i++) {
  const valueStreamName = str(vsm[i][1]); const name = str(vsm[i][4]);
  if (!valueStreamName || !name) continue;
  metrics.push({
    domain: orNull(vsm[i][0]), valueStreamName, l3: orNull(vsm[i][2]), category: orNull(vsm[i][3]), name,
    description: orNull(vsm[i][5]), formula: orNull(vsm[i][6]), target: orNull(vsm[i][7]), measurementLevel: orNull(vsm[i][8]),
    frequency: orNull(vsm[i][9]), ownerRole: orNull(vsm[i][10]), upstreamMetric: orNull(vsm[i][11]),
    downstreamImpact: orNull(vsm[i][12]), framework: orNull(vsm[i][13]), notes: orNull(vsm[i][14]), sourceRow: i,
  });
}

// ─── E2E Process Flows → 256 sequenced steps ────────────────────────────
// The E2E sheet uses abbreviated value-stream names that differ from the
// canonical names in the Value Streams sheet. This map reconciles them.
const PROCESS_VS_MAP: Record<string, string> = {
  'Submission-to-Bind': 'Submission-to-Bind / Underwriting',
  'Reinsurance Management': 'Reinsurance & Retrocession Management',
  'Product Design & Management': 'Product & Proposition Management',
  'Distribution Management': 'Distribution & Channel Management',
  'Actuarial & Reserving': 'Actuarial Pricing, Reserving & Capital Modeling',
  'Financial Planning & Reporting': 'Finance, Treasury & Capital Management',
  'Human Capital Management': 'Talent & Workforce Management',
  'Risk & Compliance Management': 'Risk, Compliance & Regulatory Management',
  'Customer Service & Experience': 'Customer Service, Complaints & Experience',
  'Vendor & Third-Party Management': 'Third-Party & Vendor Management',
  'Data & Analytics': 'Data, Analytics & AI Management',
  'Enterprise Risk Management': 'Risk, Compliance & Regulatory Management',
  'Investment Management': 'Investment & Asset Management',
  'Capital & Treasury Management': 'Finance, Treasury & Capital Management',
  'Legal & Compliance': 'Legal, Governance & Privacy Management',
};
const canonicalVS = (name: string) => PROCESS_VS_MAP[name] ?? name;

const e2e = grid('E2E Process Flows'); // header row 3; data 4+
const processSteps: any[] = [];
for (let i = 4; i < e2e.length; i++) {
  const rawVS = str(e2e[i][1]); const name = str(e2e[i][5]);
  if (!rawVS || !name) continue;
  const valueStreamName = canonicalVS(rawVS);
  processSteps.push({
    valueStreamName, l3: orNull(e2e[i][2]), l4: orNull(e2e[i][3]), stepNumber: intOrNull(e2e[i][4]) ?? 0, name,
    description: orNull(e2e[i][6]), leads: orNull(e2e[i][7]), supporting: orNull(e2e[i][8]),
    inputs: orNull(e2e[i][9]), outputs: orNull(e2e[i][10]), notes: orNull(e2e[i][11]), externalParticipants: orNull(e2e[i][12]), sourceRow: i,
  });
}

// ─── Inputs & Outputs Inventory → 835 I/O + data elements ───────────────
const ioi = grid('Inputs & Outputs Inventory'); // header row 3; data 4+
const ioItems: any[] = [];
for (let i = 4; i < ioi.length; i++) {
  const valueStreamName = str(ioi[i][1]); const name = str(ioi[i][5]);
  if (!valueStreamName || !name) continue;
  ioItems.push({
    valueStreamName, l3: orNull(ioi[i][2]), l4: orNull(ioi[i][3]), type: str(ioi[i][4]) || 'Input', name,
    keyRoles: orNull(ioi[i][6]), dataElements: orNull(ioi[i][7]), sourceRow: i,
  });
}

// ─── Items → checklist items ────────────────────────────────────────────
const items = grid('Items'); // header row 0; col0 Role,3 Category,4 Canonical,5 Item
const checklistItems: any[] = [];
for (let i = 1; i < items.length; i++) {
  const roleName = ensureRole(items[i][0], 'Items');
  const text = str(items[i][5]) || str(items[i][4]);
  if (!roleName || !text) continue;
  checklistItems.push({ roleName, category: matchCategory(items[i][3]), text, crossRole: /\*/.test(String(items[i][5] ?? '')), sourceRow: i });
}

// ─── Aligned Role Tasks → role tasks ────────────────────────────────────
const art = grid('Aligned Role Tasks'); // header row 0; col2 Role,4 ItemRole,5 Category,6 Canonical
const roleTasks: any[] = [];
for (let i = 1; i < art.length; i++) {
  const roleName = ensureRole(art[i][4] ?? art[i][2], 'Aligned Role Tasks');
  const text = str(art[i][6]);
  if (!roleName || !text) continue;
  roleTasks.push({ roleName, category: matchCategory(art[i][5]), text, sourceRow: i });
}

// ─── External Interactions ──────────────────────────────────────────────
const ei = grid('External Interactions'); // header row 2; data 3+
const externalInteractions: any[] = [];
for (let i = 3; i < ei.length; i++) {
  const partyType = str(ei[i][0]), externalRole = str(ei[i][1]);
  if (!partyType && !externalRole) continue;
  externalInteractions.push({
    partyType, externalRole, internalRoleOwner: orNull(ei[i][2]), internalRoleName: matchRole(ei[i][2]),
    divisionFunction: orNull(ei[i][3]), interactionType: orNull(ei[i][4]), inputs: orNull(ei[i][5]), outputs: orNull(ei[i][6]),
    relatedValueStream: orNull(ei[i][7]), dependencyType: orNull(ei[i][8]), frequency: orNull(ei[i][9]), notes: orNull(ei[i][10]), sourceRow: i,
  });
}

// ─── Standards Index → department standards summary ─────────────────────
const si = grid('Standards Index'); // header row 3; data 4+
const standards: any[] = [];
for (let i = 4; i < si.length; i++) {
  const dept = str(si[i][1]); if (!dept) continue;
  standards.push({ department: dept, count: intOrNull(si[i][2]) ?? 0, charterIncluded: /yes/i.test(str(si[i][3])), link: orNull(si[i][4]), owner: orNull(si[i][5]), sourceRow: i });
}

// CEO-facing top-level grouping derived from Org Chart View 2 "Higher-Level Category".
// Source of truth: IT_Roles_Analytics_v15.xlsx, Org Chart View 2, column A.
const HIGHER_CAT: Record<string, string> = {
  'Actuarial': 'Core Business', 'Claims': 'Core Business',
  'Operations & Customer Service': 'Core Business', 'Reinsurance': 'Core Business',
  'Sales, Distribution & Marketing': 'Core Business', 'Underwriting': 'Core Business',
  'Cybersecurity & IAM': 'IT', 'Data & AI': 'IT',
  'Product, Delivery & PMO': 'IT', 'Technology & Engineering': 'IT',
  'Finance & Investments': 'Corporate Function', 'Human Resources & Talent': 'Corporate Function',
  'Legal & Corporate Governance': 'Corporate Function', 'Risk, Compliance & Audit': 'Corporate Function',
};

const codeFor = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 6);

const domains = [...domainSet].sort((a, b) => {
  const ia = DOMAIN_ORDER.indexOf(a), ib = DOMAIN_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
}).map((name, idx) => ({ name, sourceRow: idx }));

const out = {
  generatedFrom: WORKBOOK,
  company: { name: 'Meridian Insurance Group', slug: 'meridian' },
  domains,
  divisions: divisionNames.map((name, idx) => ({ code: codeFor(name), name, higherCategory: HIGHER_CAT[name] ?? null, sourceRow: idx })),
  departments,
  roles,
  roleHierarchy,
  categories: canonicalCategories,
  valueStreams,
  subValueStreams,
  metrics,
  processSteps,
  ioItems,
  standards,
  checklistItems,
  roleTasks,
  roleValueStreams,
  externalInteractions,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log('Normalized spine written to', OUT);
console.table({
  domains: out.domains.length, divisions: out.divisions.length, departments: out.departments.length,
  roles: out.roles.length, extendedRolesAdded: extendedCount, roleHierarchy: out.roleHierarchy.length,
  categories: out.categories.length, valueStreams: out.valueStreams.length, subValueStreams: out.subValueStreams.length,
  metrics: out.metrics.length, processSteps: out.processSteps.length, ioItems: out.ioItems.length,
  standards: out.standards.length, checklistItems: out.checklistItems.length, roleTasks: out.roleTasks.length,
  roleValueStreams: out.roleValueStreams.length, externalInteractions: out.externalInteractions.length,
});
const placed = roles.filter((r) => r.divisionName).length;
console.log(`Roles placed in a division: ${placed}/${roles.length}; with manager: ${roles.filter((r) => r.managerRoleName).length}`);
if (autoAdded.length) console.log(`ℹ ${new Set(autoAdded).size} referenced role(s) auto-added (not in Org Chart).`);
