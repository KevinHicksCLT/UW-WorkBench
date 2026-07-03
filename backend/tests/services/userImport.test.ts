// services/userImport — pure spreadsheet parsing/resolution: header
// case-insensitivity, required-field errors, boolean parsing, semicolon
// value-streams, two-pass reportsTo, and unknown-reference errors.
import { describe, expect, it } from 'vitest';
import { parseRows, resolveRefs, type ImportLookups } from '../../src/services/userImport.js';

const baseRow = {
  email: 'alice@example.com',
  name: 'Alice A',
  userType: 'MEMBER',
};

function lookups(overrides: Partial<ImportLookups> = {}): ImportLookups {
  return {
    orgUnitsByName: new Map([['claims department', 'org-1']]),
    rolesByName: new Map([['claims adjuster', 'role-1']]),
    valueStreamsByName: new Map([
      ['claims', 'vs-1'],
      ['underwriting', 'vs-2'],
    ]),
    usersByEmail: new Map([['boss@example.com', 'user-boss']]),
    ...overrides,
  };
}

describe('parseRows', () => {
  it('matches headers case-insensitively and with separators', () => {
    const [row] = parseRows([
      {
        'EMAIL ': ' Alice@Example.com ',
        Name: ' Alice A ',
        'User Type': 'member',
        'Org Unit': 'Claims Department',
        GEOGRAPHY: 'north america',
        operating_role: 'Claims Adjuster',
        'Is Manager': 'Yes',
        is_approver: '0',
        'Reports To': 'Boss@Example.com',
        'Value Streams': 'Claims; Underwriting',
      },
    ]);
    expect(row.errors).toEqual([]);
    expect(row.rowNumber).toBe(2);
    expect(row.data).toMatchObject({
      email: 'alice@example.com',
      name: 'Alice A',
      userType: 'MEMBER',
      orgUnitName: 'Claims Department',
      geography: 'NORTH_AMERICA',
      operatingRoleName: 'Claims Adjuster',
      isManager: true,
      isApprover: false,
      reportsToEmail: 'boss@example.com',
      valueStreamNames: ['Claims', 'Underwriting'],
    });
  });

  it('collects required-field errors (email, name, userType)', () => {
    const [row] = parseRows([{ email: '', name: '', userType: '' }]);
    expect(row.data).toBeUndefined();
    expect(row.errors).toEqual(
      expect.arrayContaining(['email is required', 'name is required', 'userType is required']),
    );
  });

  it('rejects an invalid email and an unknown userType', () => {
    const [row] = parseRows([{ email: 'not-an-email', name: 'X', userType: 'WIZARD' }]);
    expect(row.errors).toEqual(
      expect.arrayContaining(['invalid email "not-an-email"', 'unknown userType "WIZARD"']),
    );
  });

  it('parses booleans across yes/no/true/false/1/0 and flags garbage', () => {
    const rows = parseRows([
      { ...baseRow, isManager: 'TRUE', isApprover: 'no' },
      { ...baseRow, email: 'b@example.com', isManager: '1', isApprover: 'FALSE' },
      { ...baseRow, email: 'c@example.com', isManager: '', isApprover: 'maybe' },
    ]);
    expect(rows[0].data).toMatchObject({ isManager: true, isApprover: false });
    expect(rows[1].data).toMatchObject({ isManager: true, isApprover: false });
    expect(rows[2].errors).toEqual(['invalid isApprover "maybe"']);
    // blank booleans stay undefined (don't overwrite on update)
    expect(rows[0].data?.isManager).toBe(true);
  });

  it('splits semicolon-separated value streams and trims blanks', () => {
    const [row] = parseRows([{ ...baseRow, valueStreams: ' Claims ;; Underwriting ; ' }]);
    expect(row.data?.valueStreamNames).toEqual(['Claims', 'Underwriting']);
  });

  it('flags an unknown geography and a non-email reportsTo', () => {
    const [row] = parseRows([{ ...baseRow, geography: 'MOON', reportsTo: 'not-an-email' }]);
    expect(row.errors).toEqual(
      expect.arrayContaining([
        'unknown geography "MOON"',
        'reportsTo must be an email, got "not-an-email"',
      ]),
    );
  });

  it('numbers rows from 2 (header is row 1)', () => {
    const rows = parseRows([baseRow, { ...baseRow, email: 'b@example.com' }]);
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});

describe('resolveRefs', () => {
  it('resolves org unit, operating role, and value streams to ids', () => {
    const parsed = parseRows([
      {
        ...baseRow,
        orgUnit: 'Claims Department',
        operatingRole: 'Claims Adjuster',
        valueStreams: 'Claims;Underwriting',
      },
    ]);
    const [row] = resolveRefs(parsed, lookups());
    expect(row.errors).toEqual([]);
    expect(row.data).toMatchObject({
      email: 'alice@example.com',
      role: 'MEMBER',
      orgUnitId: 'org-1',
      operatingRoleId: 'role-1',
      valueStreamIds: ['vs-1', 'vs-2'],
    });
  });

  it('collects unknown org unit / role / value stream errors', () => {
    const parsed = parseRows([
      { ...baseRow, orgUnit: 'Nowhere', operatingRole: 'Ghost', valueStreams: 'Claims;Mystery' },
    ]);
    const [row] = resolveRefs(parsed, lookups());
    expect(row.data).toBeUndefined();
    expect(row.errors).toEqual(
      expect.arrayContaining([
        'unknown org unit "Nowhere"',
        'unknown operating role "Ghost"',
        'unknown value stream "Mystery"',
      ]),
    );
  });

  it('resolves reportsTo against existing users', () => {
    const parsed = parseRows([{ ...baseRow, reportsTo: 'boss@example.com' }]);
    const [row] = resolveRefs(parsed, lookups());
    expect(row.data?.reportsToId).toBe('user-boss');
    expect(row.data?.deferredReportsToEmail).toBeUndefined();
  });

  it('defers reportsTo that references another row in the same file (two-pass)', () => {
    const parsed = parseRows([
      { ...baseRow, reportsTo: 'manager@example.com' },
      { email: 'manager@example.com', name: 'Manager M', userType: 'SUPER_USER' },
    ]);
    const rows = resolveRefs(parsed, lookups());
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data?.reportsToId).toBeUndefined();
    expect(rows[0].data?.deferredReportsToEmail).toBe('manager@example.com');
    expect(rows[1].errors).toEqual([]);
  });

  it('errors when reportsTo is neither an existing user nor an in-file row', () => {
    const parsed = parseRows([{ ...baseRow, reportsTo: 'stranger@example.com' }]);
    const [row] = resolveRefs(parsed, lookups());
    expect(row.errors).toEqual(['unknown reportsTo user "stranger@example.com"']);
  });

  it('passes prior parse errors through untouched', () => {
    const parsed = parseRows([{ email: 'bad', name: 'X', userType: 'MEMBER' }]);
    const [row] = resolveRefs(parsed, lookups());
    expect(row.data).toBeUndefined();
    expect(row.errors).toEqual(['invalid email "bad"']);
  });
});
