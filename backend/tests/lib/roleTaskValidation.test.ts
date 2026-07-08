// lib/roleTaskValidation — the attestation rules: sparse-target invariant
// (REASSIGNED carries exactly one target FK, other statuses none), reviewer
// stamping, UNREVIEWED reset, and the view fold every read surface renders.
import { describe, expect, it } from 'vitest';
import {
  validationUpdateData,
  validationView,
  type ValidationInput,
} from '../../src/lib/roleTaskValidation.js';

const NOW = new Date('2026-07-07T12:00:00Z');
const compute = (input: ValidationInput) => validationUpdateData(input, 'kelly@abc.example', NOW);

describe('validationUpdateData', () => {
  it('CONFIRMED stamps the reviewer and clears every reassignment target', () => {
    const r = compute({ status: 'CONFIRMED', note: '  Yes, I run this weekly.  ' });
    if ('error' in r) throw new Error(r.error);
    expect(r.data).toEqual({
      validationStatus: 'CONFIRMED',
      validationNote: 'Yes, I run this weekly.',
      validatedByEmail: 'kelly@abc.example',
      validatedAt: NOW,
      reassignedToRoleId: null,
      reassignedToApplicationId: null,
      reassignedToExternalPartyId: null,
    });
  });

  it('NOT_PERFORMED needs no target and keeps the reviewer stamp', () => {
    const r = compute({ status: 'NOT_PERFORMED' });
    if ('error' in r) throw new Error(r.error);
    expect(r.data.validationStatus).toBe('NOT_PERFORMED');
    expect(r.data.validatedByEmail).toBe('kelly@abc.example');
    expect(r.data.reassignedToRoleId).toBeNull();
  });

  it('REASSIGNED requires a target and sets exactly the matching FK', () => {
    expect(compute({ status: 'REASSIGNED' })).toHaveProperty('error');

    for (const [kind, field] of [
      ['role', 'reassignedToRoleId'],
      ['application', 'reassignedToApplicationId'],
      ['externalParty', 'reassignedToExternalPartyId'],
    ] as const) {
      const r = compute({ status: 'REASSIGNED', reassignTo: { kind, id: 'x1' } });
      if ('error' in r) throw new Error(r.error);
      expect(r.data[field]).toBe('x1');
      const others = [
        'reassignedToRoleId',
        'reassignedToApplicationId',
        'reassignedToExternalPartyId',
      ].filter((f) => f !== field) as (keyof typeof r.data)[];
      for (const f of others) expect(r.data[f]).toBeNull();
    }
  });

  it('rejects a target on any non-REASSIGNED status', () => {
    const r = compute({ status: 'CONFIRMED', reassignTo: { kind: 'role', id: 'x1' } });
    expect(r).toHaveProperty('error');
  });

  it('UNREVIEWED resets the stamp, note, and targets', () => {
    const r = compute({ status: 'UNREVIEWED', note: 'stale' });
    if ('error' in r) throw new Error(r.error);
    expect(r.data).toMatchObject({
      validationStatus: 'UNREVIEWED',
      validationNote: null,
      validatedByEmail: null,
      validatedAt: null,
    });
  });
});

describe('validationView', () => {
  const base = {
    validationStatus: 'UNREVIEWED',
    validationNote: null,
    validatedByEmail: null,
    validatedAt: null,
    reassignedToRole: null,
    reassignedToApplication: null,
    reassignedToExternalParty: null,
  };

  it('folds an unreviewed row to the default view', () => {
    expect(validationView(base)).toEqual({
      status: 'UNREVIEWED',
      note: null,
      validatedBy: null,
      validatedAt: null,
      reassignedTo: null,
    });
  });

  it('surfaces the reassignment target with its display name', () => {
    const v = validationView({
      ...base,
      validationStatus: 'REASSIGNED',
      validatedByEmail: 'kelly@abc.example',
      validatedAt: new Date('2026-07-07T00:00:00Z'),
      reassignedToRole: { id: 'r2', displayValue: 'Underwriting Assistant' },
    });
    expect(v.status).toBe('REASSIGNED');
    expect(v.validatedAt).toBe('2026-07-07T00:00:00.000Z');
    expect(v.reassignedTo).toEqual({ kind: 'role', id: 'r2', name: 'Underwriting Assistant' });
  });

  it('normalizes an unknown stored status to UNREVIEWED', () => {
    expect(validationView({ ...base, validationStatus: 'LEGACY' }).status).toBe('UNREVIEWED');
  });
});
