// rationalization — migration-status weighting + progress math (pure).
import { describe, expect, it } from 'vitest';
import { LAYERS, progressOf, STATUS_WEIGHT, statusWeight } from '../../src/lib/rationalization.js';

describe('vocabulary', () => {
  it('keeps the fixed ordered IT layer set', () => {
    expect(LAYERS).toEqual(['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure']);
  });

  it('treats both terminal statuses (Migrated, Retired) as 100% done', () => {
    expect(STATUS_WEIGHT.Migrated).toBe(1);
    expect(STATUS_WEIGHT.Retired).toBe(1);
  });
});

describe('statusWeight', () => {
  it('maps each lifecycle status to its weight', () => {
    expect(statusWeight('Identified')).toBe(0);
    expect(statusWeight('In Analysis')).toBeCloseTo(0.25);
    expect(statusWeight('Normalized')).toBeCloseTo(0.55);
    expect(statusWeight('In Migration')).toBeCloseTo(0.8);
  });

  it('returns 0 for unknown, null, and undefined statuses', () => {
    expect(statusWeight('Bogus')).toBe(0);
    expect(statusWeight(null)).toBe(0);
    expect(statusWeight(undefined)).toBe(0);
  });
});

describe('progressOf', () => {
  it('returns the mean completion of the statuses', () => {
    expect(progressOf(['Identified', 'Migrated'])).toBe(0.5);
    expect(progressOf(['In Analysis', 'In Migration', 'Retired'])).toBeCloseTo((0.25 + 0.8 + 1) / 3);
  });

  it('counts unknown/null statuses as 0 in the mean', () => {
    expect(progressOf(['Migrated', null, 'Bogus', undefined])).toBe(0.25);
  });

  it('returns 0 for an empty set', () => {
    expect(progressOf([])).toBe(0);
  });
});
