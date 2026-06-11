// transform-workbook.ts — IT_Roles_Analytics_v16.xlsx → normalized spine.json
//
// v13 broadened the model: value-stream DOMAINS, 243 real KPI definitions,
// 256 E2E process steps, 835 inputs/outputs, 84 extended roles + a reporting
// hierarchy, and department standards — on top of the v12 org/value-stream spine.
// v15 added the L5 process-step decomposition plus Scenario Inputs / Application TCO.
// v16 normalizes the process model: "Sub-Value Streams" + "E2E Process Flows" are
// archived and replaced by "L4 Process Master" (one row per L4, stable Process ID)
// and "L5 Process Steps" (one row per L5 step, full lead/support/IO detail). It
// also introduces 3 new value streams — FinOps, AIOps, MLOps — in the process
// model that the Value Streams roster doesn't yet map roles to.
// Isolates workbook quirks (title/helper rows, role-name variants) from the
// schema. The seed reads the committed spine.json, never the .xlsx.
//
// Run from repo root: npx tsx backend/scripts/transform-workbook.ts
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const WORKBOOK = process.argv[2] || 'IT_Roles_Analytics_v16.xlsx';
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
const numOrNull = (v: unknown): number | null => { if (v == null || str(v) === '') return null; const n = Number(String(v).replace(/[$,]/g, '')); return Number.isFinite(n) ? n : null; };

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
const DOMAIN_ORDER = ['Core Insurance', 'Life, Disability & Retirement', 'Distribution & Customer', 'Technology & Data', 'Finance & Actuarial', 'Risk, Compliance & Audit', 'Corporate & Enterprise'];
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
// The Bridge Input workbook appends ~900 derived L4/L5 coverage rows below the
// roster (same columns, comma-separated role lists, no Role Family). Those rows
// duplicate L4 Process Master Key Roles / L5 step leads, so only roster rows
// (Role Family present, one role per row) are parsed here — step-level role
// detail stays sourced from the L4/L5 sheets.
const vs = grid('Value Streams'); // header row 3; data 4+
const domainSet = new Set<string>();
const valueStreams: { name: string; domain: string | null; sourceRow: number }[] = [];
const seenVs = new Set<string>();
const roleValueStreams: any[] = [];
for (let i = 4; i < vs.length; i++) {
  const name = str(vs[i][1]); if (!name) continue;
  if (!str(vs[i][4])) continue; // derived coverage row, not roster
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

// ─── L4 Process Master → L3/L4 nodes (one row per L4 sub-process) ───────
// v16 replaces the old "Sub-Value Streams" sheet (archived as ZZ_ARCHIVE_*) with a
// normalized master carrying a stable Process ID per L4. A few value streams
// (FinOps / AIOps / MLOps) appear here but not yet in the Value Streams roster —
// register them so their process detail isn't lost (they carry no role links
// until the roster maps roles to them).
// Value streams present in the roster (Value Streams sheet) already carry role
// participation; ones that exist ONLY in the L4 master (FinOps / AIOps / MLOps) do
// not — so we derive their role↔stream links from each L4's Key Roles +
// Participation Focus below, so they surface in the division flow like any other.
const rosterVs = new Set(seenVs);
const l4m = grid('L4 Process Master'); // header row 2; data 3+
const subValueStreams: any[] = [];
let derivedRvs = 0;
for (let i = 3; i < l4m.length; i++) {
  const l2 = str(l4m[i][2]); const l4 = str(l4m[i][4]);
  if (!l2 || !l4) continue;
  if (!/^[A-Z]{1,4}-\d/.test(str(l4m[i][0]))) continue; // header text in a data row

  const l3 = orNull(l4m[i][3]);
  const domain = cleanDomain(orNull(l4m[i][1]));
  if (!seenVs.has(l2)) { seenVs.add(l2); valueStreams.push({ name: l2, domain, sourceRow: i }); if (domain) domainSet.add(domain); }
  subValueStreams.push({
    processId: orNull(l4m[i][0]), valueStreamName: l2, l3, l4, keyRoles: orNull(l4m[i][5]),
    inputs: orNull(l4m[i][7]), outputs: orNull(l4m[i][8]), upstream: orNull(l4m[i][9]), downstream: orNull(l4m[i][10]),
    notes: orNull(l4m[i][11]), externalParticipants: orNull(l4m[i][12]), sourceRow: i,
  });
  // Non-roster value stream → synthesize role participation from this L4 so the
  // division(s) whose roles do this work lead/participate in it on the map. The
  // "L3 — L4" subStream matches the flow endpoint's role-ownership convention.
  if (!rosterVs.has(l2)) {
    const focus = str(l4m[i][6]) || 'Support';
    const subStream = l3 ? `${l3} — ${l4}` : l4;
    for (const raw of str(l4m[i][5]).split(',')) {
      const roleName = ensureRole(raw, 'L4 Process Master');
      if (!roleName) continue;
      roleValueStreams.push({
        roleName, valueStreamName: l2, subStream, participationType: focus,
        inputs: orNull(l4m[i][7]), outputs: orNull(l4m[i][8]), upstream: orNull(l4m[i][9]), downstream: orNull(l4m[i][10]),
        notes: null, externalParticipants: orNull(l4m[i][12]), sourceRow: i,
      });
      derivedRvs++;
    }
  }
}

// ─── L5 Process Steps → ordered L5 steps within each L4 sub-process ──────
// v16 unifies the old "Sheet2" / "L5 for Select L4's" / "E2E Process Flows" into
// one normalized sheet — one row per L5 step, linked to its L4 via Parent Process
// ID and carrying the full L4 Sub-Process name. We key L5 steps back to their L4
// by that name (globally unique in the L4 Process Master). The same sheet also
// feeds the ProcessStep (E2E) table below.
const l4Canon: string[] = [...new Set(subValueStreams.map((s) => s.l4).filter((x): x is string => !!x))];
const l4Norm = (v: unknown): string => str(v).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const l4NormMap = new Map<string, string>(l4Canon.map((n) => [l4Norm(n), n] as const));
const resolveL4 = (raw: unknown): string | null => {
  const sn = l4Norm(raw);
  if (!sn) return null;
  const exact = l4NormMap.get(sn);
  if (exact) return exact;
  // Tolerate truncated / depluralized source names by prefix match.
  const pref = l4Canon.find((n) => l4Norm(n).startsWith(sn));
  return pref ?? null;
};
const l5g = grid('L5 Process Steps'); // header row 2; data 3+
const l5Steps: any[] = [];
const l5Unmatched = new Set<string>();
for (let i = 3; i < l5g.length; i++) {
  const rawL4 = str(l5g[i][5]); const name = str(l5g[i][7]);
  if (!rawL4 || !name) continue;
  if (!/-S\d+$/i.test(str(l5g[i][0]))) continue; // embedded duplicate header row
  const l4Name = resolveL4(rawL4);
  if (!l4Name) { l5Unmatched.add(rawL4); continue; }
  l5Steps.push({
    code: str(l5g[i][0]), parentProcessId: orNull(l5g[i][1]),
    l4Name, stepNumber: intOrNull(l5g[i][6]) ?? 0, name,
    description: orNull(l5g[i][8]), sourceSheet: 'L5 Process Steps', sourceRow: i,
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

// ─── Process steps (E2E) → derived from the unified L5 Process Steps sheet ──
// v16 archived the standalone "E2E Process Flows" sheet; the same sequenced step
// detail (lead / supporting / inputs / outputs) now lives in "L5 Process Steps",
// keyed by canonical L2 value-stream name (no abbreviation map needed). We keep
// the ProcessStep table populated so step counts + the node explorer keep working,
// while the L5 tree (l5Steps above) drives the visual drill-down.
const processSteps: any[] = [];
for (let i = 3; i < l5g.length; i++) {
  const valueStreamName = str(l5g[i][3]); const name = str(l5g[i][7]);
  if (!valueStreamName || !name) continue;
  if (!/-S\d+$/i.test(str(l5g[i][0]))) continue; // embedded duplicate header row
  processSteps.push({
    code: str(l5g[i][0]), parentProcessId: orNull(l5g[i][1]),
    valueStreamName, l3: orNull(l5g[i][4]), l4: orNull(l5g[i][5]), stepNumber: intOrNull(l5g[i][6]) ?? 0, name,
    description: orNull(l5g[i][8]), leads: orNull(l5g[i][9]), supporting: orNull(l5g[i][10]),
    inputs: orNull(l5g[i][11]), outputs: orNull(l5g[i][12]), notes: orNull(l5g[i][13]), externalParticipants: orNull(l5g[i][14]), sourceRow: i,
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
  // A real standards-index row has a numeric count in column C. Rows below the
  // table (legend / notes that also use column B) lack one — skip them so the
  // legend text doesn't leak in as bogus "standards".
  const count = intOrNull(si[i][2]); if (count == null) continue;
  standards.push({ department: dept, count, charterIncluded: /yes/i.test(str(si[i][3])), link: orNull(si[i][4]), owner: orNull(si[i][5]), mission: null as string | null, scope: null as string | null, sourceRow: i });
}

// ─── Per-department Standards sheets → individual standards + charter ────
// One sheet per area (named exactly as the Standards-Index `link`, e.g.
// "Cybersecurity Standards"). Each has a charter block (MISSION / SCOPE) above a
// table: Category | Standard / Guideline | Description | Build/Run | Owner Role |
// Related Items (Role) | Related Items (Category) | Items Link. We pull every
// standard and fold the mission/scope back onto its area.
const STANDARD_SHEETS = [
  'Cybersecurity Standards', 'Architecture Standards', 'Claims Standards', 'Underwriting Standards',
  'Engineering Standards', 'Finance Standards', 'Data & Analytics Standards', 'HR Standards',
  'Compliance & Risk Standards', 'PMO & Delivery Standards', 'Operations Standards', 'Legal Standards',
  'Actuarial Standards',
];
const standardItems: any[] = [];
for (const sheetName of STANDARD_SHEETS) {
  const g = grid(sheetName);
  let mission: string | null = null;
  const scopeBullets: string[] = [];
  let hdr = -1;
  for (let i = 0; i < g.length; i++) {
    const a = str(g[i][0]);
    if (a.toUpperCase() === 'MISSION') mission = orNull(g[i + 1]?.[0]);
    if (a.toUpperCase() === 'SCOPE') {
      for (let j = i + 1; j < g.length && str(g[j][0]).startsWith('•'); j++) {
        scopeBullets.push(str(g[j][0]).replace(/^•\s*/, ''));
      }
    }
    if (a === 'Category' && /standard/i.test(str(g[i][1]))) { hdr = i; break; }
  }
  const area = standards.find((s) => s.link === sheetName);
  if (area) { area.mission = mission; area.scope = scopeBullets.length ? scopeBullets.join('\n') : null; }
  if (hdr < 0) throw new Error(`No standards table header found in sheet: ${sheetName}`);
  for (let i = hdr + 1; i < g.length; i++) {
    const category = str(g[i][0]); const name = str(g[i][1]);
    if (!category || !name) continue;
    standardItems.push({
      areaLink: sheetName, category, name,
      description: str(g[i][2]), buildRun: orNull(g[i][3]),
      ownerRole: orNull(g[i][4]), relatedRole: orNull(g[i][5]),
      relatedCategory: orNull(g[i][6]), itemsLink: orNull(g[i][7]), sourceRow: i,
    });
  }
}

// ─── Scenario Inputs → change-impact economics (initiatives) ────────────
// Header row index 2; data 3+. One row per modeled operating-model change.
const sc = grid('Scenario Inputs');
const scenarios: any[] = [];
for (let i = 3; i < sc.length; i++) {
  const name = str(sc[i][0]); if (!name) continue;
  scenarios.push({
    name, changeType: orNull(sc[i][1]), impactScope: orNull(sc[i][2]),
    divisionName: orNull(sc[i][3]), valueStreamName: orNull(sc[i][4]),
    application: orNull(sc[i][5]), roleImpact: orNull(sc[i][6]),
    oneTimeCost: numOrNull(sc[i][7]), annualBenefit: numOrNull(sc[i][8]),
    annualAddedCost: numOrNull(sc[i][9]), annualNetImpact: numOrNull(sc[i][10]),
    confidence: orNull(sc[i][11]), sourceRow: i,
  });
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
  l5Steps,
  metrics,
  processSteps,
  ioItems,
  standards,
  standardItems,
  checklistItems,
  roleTasks,
  roleValueStreams,
  externalInteractions,
  scenarios,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log('Normalized spine written to', OUT);
console.table({
  domains: out.domains.length, divisions: out.divisions.length, departments: out.departments.length,
  roles: out.roles.length, extendedRolesAdded: extendedCount, roleHierarchy: out.roleHierarchy.length,
  categories: out.categories.length, valueStreams: out.valueStreams.length, subValueStreams: out.subValueStreams.length,
  l5Steps: out.l5Steps.length, metrics: out.metrics.length, processSteps: out.processSteps.length, ioItems: out.ioItems.length,
  standards: out.standards.length, standardItems: out.standardItems.length, checklistItems: out.checklistItems.length, roleTasks: out.roleTasks.length,
  roleValueStreams: out.roleValueStreams.length, externalInteractions: out.externalInteractions.length,
  scenarios: out.scenarios.length,
});
const placed = roles.filter((r) => r.divisionName).length;
console.log(`Roles placed in a division: ${placed}/${roles.length}; with manager: ${roles.filter((r) => r.managerRoleName).length}`);
console.log(`L5 steps: ${l5Steps.length} across ${new Set(l5Steps.map((s) => s.l4Name)).size}/${l4Canon.length} L4 sub-processes.`);
console.log(`Derived ${derivedRvs} role↔stream links from L4 Process Master for non-roster value streams (FinOps/AIOps/MLOps).`);
if (l5Unmatched.size) console.log(`⚠ ${l5Unmatched.size} L5 row L4-name(s) could not be matched: ${[...l5Unmatched].join('; ')}`);
if (autoAdded.length) console.log(`ℹ ${new Set(autoAdded).size} referenced role(s) auto-added (not in Org Chart).`);
