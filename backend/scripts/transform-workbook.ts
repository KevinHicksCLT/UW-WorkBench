// transform-workbook.ts — IT_Roles_Analytics_v12.xlsx → normalized spine.json
//
// Isolates the workbook's quirks (title/helper rows, __EMPTY columns,
// role-name variants across sheets) from the schema. The seed reads the
// committed spine.json, never the .xlsx, so deploys don't need the workbook.
//
// Run from repo root: npx tsx backend/scripts/transform-workbook.ts
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const WORKBOOK = process.argv[2] || 'IT_Roles_Analytics_v12.xlsx';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/spine.json');

const wb = XLSX.read(readFileSync(WORKBOOK), { cellDates: true });
const grid = (name: string): unknown[][] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
};

const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));
const orNull = (v: unknown): string | null => str(v) || null;

// ─── Role-name reconciliation ───────────────────────────────────────────
// Sheets name the same role differently: "(CCO)" suffixes, "A / B" forms, and
// abbreviations (UW↔Underwriting, Ops↔Operations, Mgmt↔Management). We build a
// set of normalized candidate keys per name and match against the Org Chart
// roster's aliases (display name, item-role name, source-sheet name).
const ABBR: [RegExp, string][] = [
  [/\bops\b/g, 'operations'],
  [/\bmgmt\b/g, 'management'],
  [/\bmgr\b/g, 'manager'],
  [/\buw\b/g, 'underwriting'],
  [/\bdev\b/g, 'development'],
  [/\badmin\b/g, 'administration'],
  [/\bintel\b/g, 'intelligence'],
  [/\bauto\b/g, 'automation'],
  [/\beng\b/g, 'engineering'],
  [/\bsec\b/g, 'security'],
  [/\binfo\b/g, 'information'],
];
const baseNorm = (v: unknown): string =>
  str(v).toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ') // strip "(CCO)" etc.
    .replace(/[^a-z0-9/ ]/g, ' ')     // keep '/' to split compound names
    .replace(/\s+/g, ' ').trim();
const expand = (s: string): string => {
  for (const [re, r] of ABBR) s = s.replace(re, r);
  return s.replace(/\s+/g, ' ').trim();
};
// Candidate keys: full (slash→space) and the segment before the first slash.
const candidates = (v: unknown): string[] => {
  const b = baseNorm(v);
  const full = expand(b.replace(/\//g, ' '));
  const first = expand(b.split('/')[0]);
  return [...new Set([full, first].filter(Boolean))];
};

// ─── Categories (canonical 19 from Category_Totals) ─────────────────────
const normCat = (v: unknown): string => str(v).replace(/[‑–—]/g, '-'); // unify dashes
const catRows = grid('Category_Totals');
const canonicalCategories: string[] = [];
const catIndex = new Map<string, string>();
for (let i = 1; i < catRows.length; i++) {
  const name = normCat(catRows[i][0]);
  if (!name || /total/i.test(name)) continue;
  if (!catIndex.has(name.toLowerCase())) {
    canonicalCategories.push(name);
    catIndex.set(name.toLowerCase(), name);
  }
}
const matchCategory = (v: unknown): string | null => catIndex.get(normCat(v).toLowerCase()) ?? null;

// ─── Org Chart View → divisions, departments, roles (the roster) ────────
type RoleRec = {
  name: string;
  itemRole: string | null;
  roleFamily: string | null;
  sourceSheet: string | null;
  divisionName: string | null;
  departmentName: string | null;
  sourceRow: number;
};
const og = grid('Org Chart View'); // header row 0; cols: 9 Div,10 Dept,11 Role,12 SourceSheet,13 ItemRole
const divisionNames: string[] = [];
const departments: { divisionName: string; name: string; sourceRow: number }[] = [];
const roles: RoleRec[] = [];
const seenDiv = new Set<string>();
const seenDept = new Set<string>();
const seenRole = new Set<string>();

for (let i = 1; i < og.length; i++) {
  const division = str(og[i][9]);
  const department = str(og[i][10]);
  const role = str(og[i][11]);
  if (!division || !role) continue;
  if (!seenDiv.has(division)) { seenDiv.add(division); divisionNames.push(division); }
  const deptKey = `${division}␟${department}`;
  if (department && !seenDept.has(deptKey)) {
    seenDept.add(deptKey);
    departments.push({ divisionName: division, name: department, sourceRow: i });
  }
  const roleKey = `${division}␟${role}`;
  if (!seenRole.has(roleKey)) {
    seenRole.add(roleKey);
    roles.push({
      name: role,
      itemRole: orNull(og[i][13]),
      roleFamily: null,
      sourceSheet: orNull(og[i][12]),
      divisionName: division,
      departmentName: department || null,
      sourceRow: i,
    });
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

const matchRole = (v: unknown): string | null => {
  for (const c of candidates(v)) { const m = roleIndex.get(c); if (m) return m; }
  return null;
};

// Resolve a referenced role to a canonical name, adding it as a checklist-only
// role if the Org Chart roster never placed it (e.g. Solution Architect).
const autoAdded: string[] = [];
const ensureRole = (v: unknown, fromSheet: string): string | null => {
  const name = str(v);
  if (!name) return null;
  const m = matchRole(v);
  if (m) return m;
  const rec: RoleRec = {
    name, itemRole: name, roleFamily: null, sourceSheet: fromSheet,
    divisionName: null, departmentName: null, sourceRow: -1,
  };
  roles.push(rec);
  indexRole(rec);
  autoAdded.push(name);
  return name;
};

// ─── Value Streams → value streams + role participation links ───────────
const vs = grid('Value Streams'); // header row 3; data rows 4+
const valueStreams: { name: string; domain: string | null; sourceRow: number }[] = [];
const seenVs = new Set<string>();
const roleValueStreams: any[] = [];
for (let i = 4; i < vs.length; i++) {
  const name = str(vs[i][1]);
  const role = str(vs[i][3]);
  if (!name) continue;
  if (!seenVs.has(name)) { seenVs.add(name); valueStreams.push({ name, domain: orNull(vs[i][0]), sourceRow: i }); }
  if (!role) continue;
  const roleName = ensureRole(role, 'Value Streams');
  if (!roleName) continue;
  roleValueStreams.push({
    roleName,
    valueStreamName: name,
    subStream: orNull(vs[i][2]),
    participationType: str(vs[i][5]) || 'Support',
    inputs: orNull(vs[i][6]),
    outputs: orNull(vs[i][7]),
    upstream: orNull(vs[i][8]),
    downstream: orNull(vs[i][9]),
    notes: orNull(vs[i][10]),
    sourceRow: i,
  });
}

// ─── Sub-Value Streams → L3/L4 nodes ────────────────────────────────────
const svs = grid('Sub-Value Streams'); // header row 3; data rows 4+
const subValueStreams: any[] = [];
for (let i = 4; i < svs.length; i++) {
  const l2 = str(svs[i][1]);
  if (!l2) continue;
  subValueStreams.push({
    valueStreamName: l2,
    l3: orNull(svs[i][2]),
    l4: orNull(svs[i][3]),
    inputs: orNull(svs[i][6]),
    outputs: orNull(svs[i][7]),
    upstream: orNull(svs[i][8]),
    downstream: orNull(svs[i][9]),
    notes: orNull(svs[i][10]),
    sourceRow: i,
  });
}

// ─── Items → checklist items ────────────────────────────────────────────
const items = grid('Items'); // header row 0; col0 Role,1 Family,3 Category,5 Item
const checklistItems: any[] = [];
for (let i = 1; i < items.length; i++) {
  const roleName = ensureRole(items[i][0], 'Items');
  const text = str(items[i][5]) || str(items[i][4]);
  if (!roleName || !text) continue;
  checklistItems.push({
    roleName,
    category: matchCategory(items[i][3]),
    text,
    crossRole: /\*/.test(String(items[i][5] ?? '')),
    sourceRow: i,
  });
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
const ei = grid('External Interactions'); // header row 2; data rows 3+
const externalInteractions: any[] = [];
for (let i = 3; i < ei.length; i++) {
  const partyType = str(ei[i][0]);
  const externalRole = str(ei[i][1]);
  if (!partyType && !externalRole) continue;
  externalInteractions.push({
    partyType,
    externalRole,
    internalRoleOwner: orNull(ei[i][2]),
    internalRoleName: matchRole(ei[i][2]), // best-effort (owner text may name several)
    divisionFunction: orNull(ei[i][3]),
    interactionType: orNull(ei[i][4]),
    inputs: orNull(ei[i][5]),
    outputs: orNull(ei[i][6]),
    relatedValueStream: orNull(ei[i][7]),
    dependencyType: orNull(ei[i][8]),
    frequency: orNull(ei[i][9]),
    notes: orNull(ei[i][10]),
    sourceRow: i,
  });
}

// Derive a short division code from the name.
const codeFor = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 6);

const out = {
  generatedFrom: WORKBOOK,
  company: { name: 'Meridian Insurance Group', slug: 'meridian' },
  divisions: divisionNames.map((name, idx) => ({ code: codeFor(name), name, sourceRow: idx })),
  departments,
  roles,
  categories: canonicalCategories,
  valueStreams,
  subValueStreams,
  checklistItems,
  roleTasks,
  roleValueStreams,
  externalInteractions,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log('Normalized spine written to', OUT);
console.table({
  divisions: out.divisions.length,
  departments: out.departments.length,
  roles: out.roles.length,
  categories: out.categories.length,
  valueStreams: out.valueStreams.length,
  subValueStreams: out.subValueStreams.length,
  checklistItems: out.checklistItems.length,
  roleTasks: out.roleTasks.length,
  roleValueStreams: out.roleValueStreams.length,
  externalInteractions: out.externalInteractions.length,
});
if (autoAdded.length) {
  console.log(`\nℹ ${new Set(autoAdded).size} checklist-only role(s) referenced but not placed in the Org Chart (added, division unset):`);
  console.log('  ', [...new Set(autoAdded)].join(' | '));
}
