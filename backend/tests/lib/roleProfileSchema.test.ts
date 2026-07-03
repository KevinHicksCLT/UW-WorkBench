// lib/roleProfileSchema — the zod gate between research output and the seed.
import { describe, expect, it } from 'vitest';
import { roleProfileSchema, roleProfilesFileSchema } from '../../src/lib/roleProfileSchema.js';

const valid = {
  roleName: 'Reserving Actuary',
  description:
    'Owns the mortality and longevity experience-study pipeline, extracting in-force and claims data, calibrating assumptions, and booking the resulting reserves each quarter.',
  roleFamily: 'Actuarial',
  roleLevel: 'Individual Contributor',
  sources: [
    {
      title: 'SOA — Reserving Actuary',
      url: 'https://www.soa.org/example',
      supports: 'description',
    },
    { title: 'Carrier posting', url: 'https://careers.example.com/reserving', supports: 'level' },
  ],
  proposedOrgUnit: null,
  classificationFlags: [],
  confidence: 'high',
};

describe('roleProfileSchema', () => {
  it('accepts a complete profile', () => {
    expect(roleProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a stub description', () => {
    expect(
      roleProfileSchema.safeParse({ ...valid, description: 'Does actuarial work.' }).success,
    ).toBe(false);
  });

  it('rejects missing sources', () => {
    expect(roleProfileSchema.safeParse({ ...valid, sources: [] }).success).toBe(false);
  });

  it('rejects a non-URL source', () => {
    expect(
      roleProfileSchema.safeParse({
        ...valid,
        sources: [{ title: 'x', url: 'recalled from memory', supports: 'description' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an off-vocab roleLevel', () => {
    expect(roleProfileSchema.safeParse({ ...valid, roleLevel: 'Management' }).success).toBe(false);
  });

  it('accepts a proposedOrgUnit with rationale and rejects one without', () => {
    const withOrg = {
      ...valid,
      proposedOrgUnit: {
        division: 'Actuarial',
        department: 'Reserving',
        rationale: 'Core reserving work.',
      },
    };
    expect(roleProfileSchema.safeParse(withOrg).success).toBe(true);
    const noRationale = { ...valid, proposedOrgUnit: { division: 'Actuarial' } };
    expect(roleProfileSchema.safeParse(noRationale).success).toBe(false);
  });

  it('caps classificationFlags at 5 and validates their shape', () => {
    const flag = {
      scope: 'NodeRole',
      item: 'Validate death certificate',
      current: 'Owner',
      proposed: 'Participant',
      rationale: 'Claims task per O*NET.',
      confidence: 'medium',
    };
    expect(roleProfileSchema.safeParse({ ...valid, classificationFlags: [flag] }).success).toBe(
      true,
    );
    expect(
      roleProfileSchema.safeParse({ ...valid, classificationFlags: Array(6).fill(flag) }).success,
    ).toBe(false);
    expect(
      roleProfileSchema.safeParse({
        ...valid,
        classificationFlags: [{ ...flag, scope: 'Standard' }],
      }).success,
    ).toBe(false);
  });

  it('validates the merged file envelope', () => {
    expect(
      roleProfilesFileSchema.safeParse({
        version: 1,
        generatedAt: '2026-07-03T00:00:00Z',
        profiles: [valid],
      }).success,
    ).toBe(true);
    expect(roleProfilesFileSchema.safeParse({ profiles: [valid] }).success).toBe(false);
  });
});
