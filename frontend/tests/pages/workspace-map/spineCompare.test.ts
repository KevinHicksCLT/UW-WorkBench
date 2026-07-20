import { describe, expect, it } from 'vitest';
import {
  compareSpineColumns,
  spineKey,
  type SpineItem,
} from '../../../src/pages/workspace-map/spine/spineCompare';

const item = (id: string, name: string, column: string, group = 'G'): SpineItem => ({
  id,
  name,
  column,
  group,
});

describe('spineKey', () => {
  it('is case/punctuation-insensitive and collapses plurals', () => {
    expect(spineKey('Reconcile premium payments')).toBe(spineKey('reconcile Premium payment'));
    expect(spineKey('Log submission')).not.toBe(spineKey('Assign reference number'));
  });
});

describe('compareSpineColumns', () => {
  it('finds cross-column combinations and within-column duplicates', () => {
    const cmp = compareSpineColumns([
      item('a1', 'Reconcile payments', 'streamA'),
      item('a2', 'Reconcile payments', 'streamA', 'OtherL4'), // internal dup
      item('a3', 'Underwrite risk', 'streamA'),
      item('b1', 'Reconcile Payments', 'streamB'), // cross-stream match
      item('b2', 'File statutory report', 'streamB'),
    ]);
    // Reconcile appears in both columns → shared (its internal dup folds in).
    expect(cmp.shared).toHaveLength(1);
    expect(cmp.shared[0].columns).toBe(2);
    expect(cmp.shared[0].total).toBe(3);
    expect(cmp.markOf.get('a2')).toBe('shared');
    expect(cmp.markOf.get('a3')).toBe('unique');
    // 5 current steps normalize to 3 distinct ones.
    expect(cmp.current).toBe(5);
    expect(cmp.normalized).toBe(3);
  });

  it('reports duplicates confined to ONE column as consolidate-within', () => {
    const cmp = compareSpineColumns([
      item('a1', 'Validate FEIN', 'roleA'),
      item('a2', 'validate_fein', 'roleA'),
      item('b1', 'Approve invoice', 'roleB'),
    ]);
    expect(cmp.shared).toHaveLength(0);
    expect(cmp.withinDups).toHaveLength(1);
    expect(cmp.withinDups[0].column).toBe('roleA');
    expect(cmp.withinDups[0].items).toHaveLength(2);
    expect(cmp.markOf.get('a1')).toBe('dup');
    expect(cmp.markOf.get('b1')).toBe('unique');
    expect(cmp.stats.find((s) => s.column === 'roleA')?.withinDup).toBe(2);
  });

  it('handles fully disjoint columns — everything unique, nothing removed', () => {
    const cmp = compareSpineColumns([
      item('a1', 'Alpha', 'c1'),
      item('b1', 'Beta', 'c2'),
      item('c1x', 'Gamma', 'c3'),
    ]);
    expect(cmp.shared).toHaveLength(0);
    expect(cmp.withinDups).toHaveLength(0);
    expect(cmp.normalized).toBe(cmp.current);
  });
});
