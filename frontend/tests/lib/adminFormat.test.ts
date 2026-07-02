// adminFormat — Data Admin display helpers (pure).
import { describe, expect, it } from 'vitest';
import { cellText, fieldLabel, humanize, pickColumns } from '../../src/lib/adminFormat';
import type { AdminEntity, AdminField } from '../../src/lib/adminTypes';

describe('humanize', () => {
  it('splits camelCase, drops the Id suffix, and capitalizes', () => {
    expect(humanize('valueStreamId')).toBe('Value Stream');
    expect(humanize('email')).toBe('Email');
    expect(humanize('sortOrder2')).toBe('Sort Order2');
  });
});

describe('fieldLabel', () => {
  it('uses the per-entity override where the raw column reads poorly', () => {
    expect(fieldLabel('checklistItem', 'text')).toBe('Description');
    expect(fieldLabel('roleTask', 'text')).toBe('Description');
  });

  it('falls back to humanize for everything else', () => {
    expect(fieldLabel('role', 'orgUnitId')).toBe('Org Unit');
  });
});

describe('cellText', () => {
  it('renders empties as the em-dash', () => {
    expect(cellText({ kind: 'string' }, null)).toBe('—');
    expect(cellText({ kind: 'string' }, undefined)).toBe('—');
    expect(cellText({ kind: 'string' }, '')).toBe('—');
  });

  it('renders booleans as check / dash glyphs', () => {
    expect(cellText({ kind: 'boolean' }, true)).toBe('✓');
    expect(cellText({ kind: 'boolean' }, false)).toBe('–');
  });

  it('renders datetimes via toLocaleDateString, falling back to the raw string', () => {
    const d = new Date(2026, 6, 1);
    expect(cellText({ kind: 'datetime' }, d.toISOString())).toBe(d.toLocaleDateString());
    expect(cellText({ kind: 'datetime' }, 'not-a-date')).toBe('not-a-date');
  });

  it('truncates long strings at 48 chars with an ellipsis', () => {
    const long = 'x'.repeat(60);
    expect(cellText({ kind: 'string' }, long)).toBe('x'.repeat(47) + '…');
    expect(cellText({ kind: 'string' }, 'short')).toBe('short');
  });
});

describe('pickColumns', () => {
  const field = (name: string, over: Partial<AdminField> = {}): AdminField => ({
    name,
    kind: 'string',
    required: false,
    multiline: false,
    ...over,
  });

  it('puts the label field first, then up to 4 short scalar columns', () => {
    const entity: AdminEntity = {
      slug: 'role',
      model: 'Role',
      label: 'Roles',
      labelField: 'name',
      fields: [
        field('a'),
        field('name'),
        field('b'),
        field('notes', { multiline: true }), // multiline → dropped
        field('orgUnitId', { relation: { entity: 'orgUnit', labelField: 'name' } }), // relation → dropped
        field('c'),
        field('d'),
        field('e'), // 5th scalar → beyond the slice(0, 4)
      ],
    };
    expect(pickColumns(entity).map((f) => f.name)).toEqual(['name', 'a', 'b', 'c', 'd']);
  });

  it('hides per-entity hidden list columns', () => {
    const entity: AdminEntity = {
      slug: 'checklistItem',
      model: 'ChecklistItem',
      label: 'Checklist items',
      labelField: 'text',
      fields: [field('text'), field('crossRole'), field('sortOrder')],
    };
    expect(pickColumns(entity).map((f) => f.name)).toEqual(['text', 'sortOrder']);
  });
});
