// rationalization — migration-status weighting + progress math (pure), plus
// the v3 board roll-up math (column stats, Normalize stats, canonical status).
import { describe, expect, it } from 'vitest';
import {
  LAYERS,
  canonicalStatusOf,
  columnStatsOf,
  normalizeStatsOf,
  progressOf,
  STATUS_WEIGHT,
  statusWeight,
} from '../../src/lib/rationalization.js';

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
    expect(progressOf(['In Analysis', 'In Migration', 'Retired'])).toBeCloseTo(
      (0.25 + 0.8 + 1) / 3,
    );
  });

  it('counts unknown/null statuses as 0 in the mean', () => {
    expect(progressOf(['Migrated', null, 'Bogus', undefined])).toBe(0.25);
  });

  it('returns 0 for an empty set', () => {
    expect(progressOf([])).toBe(0);
  });
});

describe('columnStatsOf', () => {
  it('buckets each source row into correct / move / deadCode', () => {
    expect(
      columnStatsOf([
        { sourceId: 'a', moves: false, dead: false },
        { sourceId: 'a', moves: true, dead: false },
        { sourceId: 'a', moves: true, dead: true }, // dead wins over move
        { sourceId: 'b', moves: false, dead: false },
      ]),
    ).toEqual([
      { sourceId: 'a', rawSteps: 3, correct: 1, move: 1, deadCode: 1 },
      { sourceId: 'b', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
    ]);
  });

  it('returns an empty list for no findings', () => {
    expect(columnStatsOf([])).toEqual([]);
  });
});

describe('normalizeStatsOf', () => {
  it('counts REVIEW and HELD entries as awaiting review', () => {
    expect(normalizeStatsOf(102, ['AUTO', 'REVIEW', 'HELD', 'AUTO'])).toEqual({
      raw: 102,
      normalized: 4,
      awaitingReview: 2,
    });
  });
});

describe('canonicalStatusOf', () => {
  it('is Planned with no components or all Identified', () => {
    expect(canonicalStatusOf([])).toBe('Planned');
    expect(canonicalStatusOf(['Identified', 'Identified'])).toBe('Planned');
  });

  it('is Building once any component has started', () => {
    expect(canonicalStatusOf(['Identified', 'In Analysis'])).toBe('Building');
    expect(canonicalStatusOf(['Migrated', 'In Migration'])).toBe('Building');
  });

  it('is Live only when every component is terminal', () => {
    expect(canonicalStatusOf(['Migrated', 'Retired'])).toBe('Live');
  });
});
