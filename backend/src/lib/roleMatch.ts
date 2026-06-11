// roleMatch.ts — resolve free-text role references (the "Key Roles" / "Leads" /
// "Supporting" columns in the workbook's I/O inventory and process steps) back to
// a specific operating-model Role. Mirrors the normalization used by
// scripts/transform-workbook.ts so runtime matching agrees with seed-time matching.
//
// The I/O inventory (IoItem) and process steps (ProcessStep) tie to roles ONLY by
// these comma-separated name strings — there is no role FK — so the role
// drill-down resolves them on read.

const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));

// Abbreviation expansion table (same set the transform uses, plus the bare
// C-suite abbreviations the workbook uses standalone — "CFO", "CEO").
const ABBR: [RegExp, string][] = [
  [/\bops\b/g, 'operations'], [/\bmgmt\b/g, 'management'], [/\bmgr\b/g, 'manager'],
  [/\buw\b/g, 'underwriting'], [/\bdev\b/g, 'development'], [/\badmin\b/g, 'administration'],
  [/\bintel\b/g, 'intelligence'], [/\bauto\b/g, 'automation'], [/\beng\b/g, 'engineering'],
  [/\bsec\b/g, 'security'], [/\binfo\b/g, 'information'], [/\bri\b/g, 'reinsurance'],
  [/\biam\b/g, 'identity access management'], [/\bcat\b/g, 'catastrophe'],
  [/\bcfo\b/g, 'chief financial officer'], [/\bceo\b/g, 'chief executive officer'],
];
const baseNorm = (v: unknown): string =>
  str(v).toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
const expand = (s: string): string => { for (const [re, r] of ABBR) s = s.replace(re, r); return s.replace(/\s+/g, ' ').trim(); };

// Normalized candidate forms for one name: the full expanded form and (when the
// name is a "A / B" variant) the first segment. De-duplicated, empties dropped.
export function candidates(v: unknown): string[] {
  const b = baseNorm(v);
  const full = expand(b.replace(/\//g, ' '));
  const first = expand(b.split('/')[0]);
  return [...new Set([full, first].filter(Boolean))];
}

// Split a workbook role-reference cell ("A, B; C") into its individual tokens.
export function splitRoleRefs(cell: string | null | undefined): string[] {
  return str(cell).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}

// A role's alias list: its canonical name plus its `itemRole`. itemRole holds
// one alias or a semicolon-separated list ("Old Name; Other Known Title").
function roleAliases(role: { name: string; itemRole?: string | null }): string[] {
  return [role.name, ...(role.itemRole ? role.itemRole.split(';') : [])]
    .map((a) => a.trim())
    .filter(Boolean);
}

// Build a fast membership test for a single role: returns true when a workbook
// role-reference token resolves to this role. Aliases come from the role's
// canonical name and its Items-sheet `itemRole`.
export function roleMatcher(role: { name: string; itemRole?: string | null }) {
  const aliasSet = new Set<string>();
  for (const alias of roleAliases(role)) {
    for (const c of candidates(alias)) aliasSet.add(c);
  }
  return (token: string): boolean => {
    for (const c of candidates(token)) if (aliasSet.has(c)) return true;
    return false;
  };
}

// True when any token in a comma/semicolon-separated cell resolves to the role.
export function cellMentionsRole(cell: string | null | undefined, matches: (t: string) => boolean): boolean {
  for (const tok of splitRoleRefs(cell)) if (matches(tok)) return true;
  return false;
}

// Build a token → Role resolver over a set of roles (the inverse of roleMatcher):
// given a free-text role reference, return the canonical Role it points to. Used
// to turn `keyRoles` / `leads` / `supporting` cells into linkable role records.
export function buildRoleResolver(roles: { id: string; name: string; itemRole?: string | null }[]) {
  const index = new Map<string, { id: string; name: string }>();
  for (const r of roles) {
    for (const alias of roleAliases(r)) {
      for (const c of candidates(alias)) if (!index.has(c)) index.set(c, { id: r.id, name: r.name });
    }
  }
  return (token: string): { id: string; name: string } | null => {
    for (const c of candidates(token)) { const m = index.get(c); if (m) return m; }
    return null;
  };
}

// Resolve a cell ("A, B; C") into matched roles (linkable) + leftover raw names
// that didn't resolve to any role. De-duplicated, order-preserving.
export function resolveRoleCell(
  cell: string | null | undefined,
  resolve: (t: string) => { id: string; name: string } | null,
): { roles: { id: string; name: string }[]; unresolved: string[] } {
  const roles: { id: string; name: string }[] = [];
  const unresolved: string[] = [];
  const seenIds = new Set<string>();
  const seenRaw = new Set<string>();
  for (const tok of splitRoleRefs(cell)) {
    const m = resolve(tok);
    if (m) { if (!seenIds.has(m.id)) { seenIds.add(m.id); roles.push(m); } }
    else { const k = tok.toLowerCase(); if (!seenRaw.has(k)) { seenRaw.add(k); unresolved.push(tok); } }
  }
  return { roles, unresolved };
}
