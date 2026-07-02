// roleMatch — free-text role-reference normalization and resolution (pure).
import { describe, expect, it } from 'vitest';
import {
  buildRoleResolver,
  candidates,
  cellMentionsRole,
  resolveRoleCell,
  roleMatcher,
  splitRoleRefs,
} from '../../src/lib/roleMatch.js';

describe('candidates', () => {
  it('normalizes case, punctuation, and whitespace and expands abbreviations', () => {
    expect(candidates('  UW   Ops  Mgr ')).toEqual(['underwriting operations manager']);
    expect(candidates('CFO')).toEqual(['chief financial officer']);
  });

  it('strips parenthetical qualifiers', () => {
    expect(candidates('Claims Manager (interim)')).toEqual(['claims manager']);
  });

  it('adds the first segment of an "A / B" variant as a second candidate', () => {
    expect(candidates('Data Eng / Ops')).toEqual(['data engineering operations', 'data engineering']);
  });

  it('drops empties and dedupes identical forms', () => {
    expect(candidates('')).toEqual([]);
    expect(candidates(null)).toEqual([]);
    expect(candidates('Ops/Ops')).toEqual(['operations operations', 'operations']);
  });
});

describe('splitRoleRefs', () => {
  it('splits on commas and semicolons, trimming and dropping empties', () => {
    expect(splitRoleRefs('A, B; C ,, ;')).toEqual(['A', 'B', 'C']);
    expect(splitRoleRefs(null)).toEqual([]);
    expect(splitRoleRefs(undefined)).toEqual([]);
  });
});

describe('roleMatcher', () => {
  const matches = roleMatcher({ name: 'Underwriting Operations Manager', itemRole: 'UW Ops Mgr; Ops Manager' });

  it('matches the canonical name and every itemRole alias (normalized)', () => {
    expect(matches('underwriting operations manager')).toBe(true);
    expect(matches('UW OPS MGR')).toBe(true);
    expect(matches('Ops Manager')).toBe(true);
  });

  it('rejects unrelated tokens', () => {
    expect(matches('Chief Actuary')).toBe(false);
  });
});

describe('cellMentionsRole', () => {
  const matches = roleMatcher({ name: 'Claims Manager' });

  it('is true when any token in the cell resolves to the role', () => {
    expect(cellMentionsRole('Chief Actuary, claims mgr', matches)).toBe(true);
    expect(cellMentionsRole('Chief Actuary; CFO', matches)).toBe(false);
    expect(cellMentionsRole(null, matches)).toBe(false);
  });
});

describe('buildRoleResolver', () => {
  const resolve = buildRoleResolver([
    { id: 'r1', name: 'Claims Manager', itemRole: 'Claims Mgr' },
    { id: 'r2', name: 'Claims Manager (Legacy)' }, // normalizes to the same key as r1
    { id: 'r3', name: 'Chief Financial Officer' },
  ]);

  it('resolves aliases to the canonical role', () => {
    expect(resolve('claims mgr')).toEqual({ id: 'r1', name: 'Claims Manager' });
    expect(resolve('CFO')).toEqual({ id: 'r3', name: 'Chief Financial Officer' });
  });

  it('keeps the FIRST role registered for a colliding normalized key', () => {
    expect(resolve('Claims Manager (Legacy)')).toEqual({ id: 'r1', name: 'Claims Manager' });
  });

  it('returns null for unresolvable tokens', () => {
    expect(resolve('Chief Cook')).toBeNull();
  });
});

describe('resolveRoleCell', () => {
  const resolve = buildRoleResolver([
    { id: 'r1', name: 'Claims Manager', itemRole: 'Claims Mgr' },
    { id: 'r2', name: 'Actuary' },
  ]);

  it('splits a cell into deduped matched roles and deduped unresolved leftovers', () => {
    const out = resolveRoleCell('Claims Mgr, Actuary; claims manager, Mystery Role; mystery role', resolve);
    expect(out.roles).toEqual([
      { id: 'r1', name: 'Claims Manager' },
      { id: 'r2', name: 'Actuary' },
    ]);
    expect(out.unresolved).toEqual(['Mystery Role']);
  });

  it('handles empty cells', () => {
    expect(resolveRoleCell(null, resolve)).toEqual({ roles: [], unresolved: [] });
  });
});
