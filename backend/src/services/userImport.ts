// Pure spreadsheet-import parsing/resolution for user bulk upload. No multipart
// handling and no Prisma here — routes/users/import.ts reads the workbook,
// builds the lookup Maps from the DB, and feeds this module.
//
// Column contract (headers case-insensitive, values trimmed):
//   email (required) · name (required) · userType (USER_TYPES value) ·
//   orgUnit (name/dbValue) · geography (NORTH_AMERICA|UK_EUROPE|APAC|LATAM) ·
//   operatingRole (name/dbValue) · isManager / isApprover (yes/no/true/false/1/0) ·
//   reportsTo (email — may reference another row in the same file; resolved in
//   a second pass) · valueStreams (semicolon-separated L2 names).
import { GEOGRAPHIES, isUserType, type Geography, type UserType } from '@cascade/shared';

export type ParsedUserRow = {
  email: string;
  name: string;
  userType: UserType;
  orgUnitName?: string;
  geography?: Geography;
  operatingRoleName?: string;
  isManager?: boolean;
  isApprover?: boolean;
  reportsToEmail?: string;
  valueStreamNames: string[];
};

export type ParsedRow = {
  /** 1-based spreadsheet row (header is row 1, first data row is 2). */
  rowNumber: number;
  data?: ParsedUserRow;
  errors: string[];
};

export type ResolvedUserRow = {
  email: string;
  name: string;
  role: UserType;
  orgUnitId?: string;
  geography?: Geography;
  operatingRoleId?: string;
  isManager?: boolean;
  isApprover?: boolean;
  /** Set when reportsTo matched an already-existing user. */
  reportsToId?: string;
  /** Set when reportsTo references another row in this file — resolve in pass 2. */
  deferredReportsToEmail?: string;
  valueStreamIds: string[];
};

export type ResolvedRow = {
  rowNumber: number;
  data?: ResolvedUserRow;
  errors: string[];
};

/** Lookup Maps, keyed by LOWERCASED trimmed name (or email). */
export type ImportLookups = {
  orgUnitsByName: Map<string, string>;
  rolesByName: Map<string, string>;
  valueStreamsByName: Map<string, string>;
  usersByEmail: Map<string, string>;
};

const CANONICAL_HEADERS = [
  'email',
  'name',
  'usertype',
  'orgunit',
  'geography',
  'operatingrole',
  'ismanager',
  'isapprover',
  'reportsto',
  'valuestreams',
] as const;
type CanonicalHeader = (typeof CANONICAL_HEADERS)[number];

/** "User Type " / "user_type" / "userType" → "usertype". */
function canonicalHeader(raw: string): CanonicalHeader | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (CANONICAL_HEADERS as readonly string[]).includes(key) ? (key as CanonicalHeader) : null;
}

function cellString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Pragmatic email shape check (local@domain.tld) without regex backtracking. */
function isEmailShaped(v: string): boolean {
  const at = v.indexOf('@');
  if (at <= 0 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1 && !/\s/.test(v);
}

const TRUE_TOKENS = new Set(['yes', 'true', '1', 'y']);
const FALSE_TOKENS = new Set(['no', 'false', '0', 'n']);

function parseBoolean(raw: string): boolean | undefined | 'invalid' {
  if (raw === '') return undefined;
  const t = raw.toLowerCase();
  if (TRUE_TOKENS.has(t)) return true;
  if (FALSE_TOKENS.has(t)) return false;
  return 'invalid';
}

function parseGeography(raw: string): Geography | undefined | 'invalid' {
  if (raw === '') return undefined;
  const t = raw.toUpperCase().replace(/[\s/-]+/g, '_');
  return (GEOGRAPHIES as readonly string[]).includes(t) ? (t as Geography) : 'invalid';
}

/** Parse raw sheet_to_json rows into typed rows + per-row errors. */
export function parseRows(sheetRows: Record<string, unknown>[]): ParsedRow[] {
  return sheetRows.map((raw, i) => {
    const rowNumber = i + 2; // header occupies row 1
    const errors: string[] = [];

    // Re-key by canonical header so "Email", "USER TYPE", "reports_to" all land.
    const cells = new Map<CanonicalHeader, string>();
    for (const [header, value] of Object.entries(raw)) {
      const key = canonicalHeader(header);
      if (key && !cells.has(key)) cells.set(key, cellString(value));
    }

    const email = (cells.get('email') ?? '').toLowerCase();
    if (email === '') errors.push('email is required');
    else if (!isEmailShaped(email)) errors.push(`invalid email "${email}"`);

    const name = cells.get('name') ?? '';
    if (name === '') errors.push('name is required');

    const userTypeRaw = (cells.get('usertype') ?? '').toUpperCase().replace(/[\s-]+/g, '_');
    let userType: UserType | undefined;
    if (userTypeRaw === '') errors.push('userType is required');
    else if (!isUserType(userTypeRaw)) errors.push(`unknown userType "${cells.get('usertype')}"`);
    else userType = userTypeRaw;

    const geography = parseGeography(cells.get('geography') ?? '');
    if (geography === 'invalid') errors.push(`unknown geography "${cells.get('geography')}"`);

    const isManager = parseBoolean(cells.get('ismanager') ?? '');
    if (isManager === 'invalid') errors.push(`invalid isManager "${cells.get('ismanager')}"`);
    const isApprover = parseBoolean(cells.get('isapprover') ?? '');
    if (isApprover === 'invalid') errors.push(`invalid isApprover "${cells.get('isapprover')}"`);

    const reportsToRaw = (cells.get('reportsto') ?? '').toLowerCase();
    if (reportsToRaw !== '' && !isEmailShaped(reportsToRaw)) {
      errors.push(`reportsTo must be an email, got "${cells.get('reportsto')}"`);
    }

    const valueStreamNames = (cells.get('valuestreams') ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    if (errors.length > 0) return { rowNumber, errors };

    const data: ParsedUserRow = {
      email,
      name,
      userType: userType as UserType,
      valueStreamNames,
    };
    const orgUnitName = cells.get('orgunit') ?? '';
    if (orgUnitName !== '') data.orgUnitName = orgUnitName;
    if (geography !== undefined && geography !== 'invalid') data.geography = geography;
    const operatingRoleName = cells.get('operatingrole') ?? '';
    if (operatingRoleName !== '') data.operatingRoleName = operatingRoleName;
    if (isManager !== undefined && isManager !== 'invalid') data.isManager = isManager;
    if (isApprover !== undefined && isApprover !== 'invalid') data.isApprover = isApprover;
    if (reportsToRaw !== '') data.reportsToEmail = reportsToRaw;

    return { rowNumber, data, errors };
  });
}

/**
 * Convert names to ids using the caller-built lookup Maps, collecting per-row
 * errors for misses. reportsTo is two-pass: an email matching another row in
 * the same file is deferred (deferredReportsToEmail) instead of erroring.
 */
export function resolveRefs(rows: ParsedRow[], lookups: ImportLookups): ResolvedRow[] {
  const inFileEmails = new Set(
    rows.filter((r) => r.data).map((r) => (r.data as ParsedUserRow).email),
  );

  return rows.map((row) => {
    if (!row.data) return { rowNumber: row.rowNumber, errors: [...row.errors] };
    const p = row.data;
    const errors = [...row.errors];

    const data: ResolvedUserRow = {
      email: p.email,
      name: p.name,
      role: p.userType,
      valueStreamIds: [],
    };
    if (p.geography !== undefined) data.geography = p.geography;
    if (p.isManager !== undefined) data.isManager = p.isManager;
    if (p.isApprover !== undefined) data.isApprover = p.isApprover;

    if (p.orgUnitName) {
      const id = lookups.orgUnitsByName.get(p.orgUnitName.toLowerCase());
      if (id) data.orgUnitId = id;
      else errors.push(`unknown org unit "${p.orgUnitName}"`);
    }

    if (p.operatingRoleName) {
      const id = lookups.rolesByName.get(p.operatingRoleName.toLowerCase());
      if (id) data.operatingRoleId = id;
      else errors.push(`unknown operating role "${p.operatingRoleName}"`);
    }

    for (const vs of p.valueStreamNames) {
      const id = lookups.valueStreamsByName.get(vs.toLowerCase());
      if (id) data.valueStreamIds.push(id);
      else errors.push(`unknown value stream "${vs}"`);
    }

    if (p.reportsToEmail) {
      const id = lookups.usersByEmail.get(p.reportsToEmail);
      if (id) data.reportsToId = id;
      else if (inFileEmails.has(p.reportsToEmail)) data.deferredReportsToEmail = p.reportsToEmail;
      else errors.push(`unknown reportsTo user "${p.reportsToEmail}"`);
    }

    if (errors.length > 0) return { rowNumber: row.rowNumber, errors };
    return { rowNumber: row.rowNumber, data, errors };
  });
}
