// mergeSheetColumns — the pure declared-columns × persisted-preference merge
// behind per-user Sheet column personalization (order, hidden, widths).
import { describe, expect, it } from 'vitest';
import {
  isFluidTrack,
  mergeSheetColumns,
  readSheetColumnsPref,
  type ColumnSpec,
} from '../../../src/components/sheet/useSheetColumns';

const col = (key: string, width: string, extra?: Partial<ColumnSpec>): ColumnSpec => ({
  key,
  width,
  ...extra,
});

const keys = (cols: ColumnSpec[]) => cols.map((c) => c.key);

describe('mergeSheetColumns — order', () => {
  const declared = [col('a', '100px'), col('b', '100px'), col('c', 'minmax(0,1fr)')];

  it('passes declared columns through untouched with no preference', () => {
    const m = mergeSheetColumns(declared, undefined);
    expect(keys(m.visible)).toEqual(['a', 'b', 'c']);
    expect(m.tracks).toEqual(['100px', '100px', 'minmax(0,1fr)']);
    expect(m.template).toBe('100px 100px minmax(0,1fr)');
    expect(m.filler).toBe(false);
    expect(m.hiddenKeys).toEqual([]);
  });

  it('applies a persisted order', () => {
    const m = mergeSheetColumns(declared, { order: ['c', 'a', 'b'] });
    expect(keys(m.visible)).toEqual(['c', 'a', 'b']);
  });

  it('slots a newly-declared column in at its declared index', () => {
    // Pref was saved when cols were [a, b, c] and reversed; dev then adds
    // "d" at declared index 3 and "x" at declared index 0.
    const withNew = [
      col('x', '80px'),
      col('a', '100px'),
      col('b', '100px'),
      col('c', '1fr'),
      col('d', '90px'),
    ];
    const m = mergeSheetColumns(withNew, { order: ['c', 'b', 'a'] });
    expect(keys(m.visible)).toEqual(['x', 'c', 'b', 'a', 'd']);
  });

  it('ignores unknown persisted order keys', () => {
    const m = mergeSheetColumns(declared, { order: ['zzz', 'b', 'a'] });
    expect(keys(m.visible)).toEqual(['b', 'a', 'c']);
  });
});

describe('mergeSheetColumns — hidden', () => {
  const declared = [col('a', '100px', { hideable: false }), col('b', '100px'), col('c', '1fr')];

  it('filters hidden columns out of the visible set but keeps them in ordered', () => {
    const m = mergeSheetColumns(declared, { hidden: ['b'] });
    expect(keys(m.visible)).toEqual(['a', 'c']);
    expect(keys(m.ordered)).toEqual(['a', 'b', 'c']);
    expect(m.hiddenKeys).toEqual(['b']);
  });

  it('never hides a hideable:false column, even when persisted', () => {
    const m = mergeSheetColumns(declared, { hidden: ['a', 'b'] });
    expect(keys(m.visible)).toEqual(['a', 'c']);
    expect(m.hiddenKeys).toEqual(['b']);
  });

  it('ignores unknown hidden keys', () => {
    const m = mergeSheetColumns(declared, { hidden: ['zzz'] });
    expect(keys(m.visible)).toEqual(['a', 'b', 'c']);
    expect(m.hiddenKeys).toEqual([]);
  });

  it('ignores a preference that would hide every column', () => {
    const allHideable = [col('a', '100px'), col('b', '100px')];
    const m = mergeSheetColumns(allHideable, { hidden: ['a', 'b'] });
    expect(keys(m.visible)).toEqual(['a', 'b']);
    expect(m.hiddenKeys).toEqual([]);
  });
});

describe('mergeSheetColumns — widths and tracks', () => {
  it('renders a resized fixed-px column as ${px}px', () => {
    const m = mergeSheetColumns([col('a', '170px'), col('b', 'minmax(0,1fr)')], {
      widths: { a: 220 },
    });
    expect(m.tracks).toEqual(['220px', 'minmax(0,1fr)']);
    expect(m.filler).toBe(false);
  });

  it('renders a resized fluid column as minmax(${px}px,1fr)', () => {
    const m = mergeSheetColumns([col('a', '170px'), col('b', 'minmax(0,1fr)')], {
      widths: { b: 300 },
    });
    expect(m.tracks).toEqual(['170px', 'minmax(300px,1fr)']);
  });

  it('appends the phantom 1fr filler only when EVERY fluid column is resized', () => {
    const declared = [col('a', '100px'), col('b', 'minmax(0,1fr)'), col('c', 'minmax(0,2fr)')];
    const partial = mergeSheetColumns(declared, { widths: { b: 200 } });
    expect(partial.filler).toBe(false);
    expect(partial.template).toBe('100px minmax(200px,1fr) minmax(0,2fr)');

    const full = mergeSheetColumns(declared, { widths: { b: 200, c: 240 } });
    expect(full.filler).toBe(true);
    expect(full.template).toBe('100px minmax(200px,1fr) minmax(240px,1fr) 1fr');
  });

  it('never adds a filler when the sheet has no fluid columns', () => {
    const m = mergeSheetColumns([col('a', '100px'), col('b', '80px')], {
      widths: { a: 150, b: 90 },
    });
    expect(m.filler).toBe(false);
    expect(m.template).toBe('150px 90px');
  });

  it('ignores a hidden fluid column when deciding on the filler', () => {
    const declared = [col('a', '100px'), col('b', 'minmax(0,1fr)'), col('c', 'minmax(0,1fr)')];
    const m = mergeSheetColumns(declared, { hidden: ['c'], widths: { b: 200 } });
    expect(m.filler).toBe(true);
    expect(m.template).toBe('100px minmax(200px,1fr) 1fr');
  });

  it('clamps widths to the minPx floor (default 60) and the 2000px ceiling', () => {
    const declared = [col('a', '100px'), col('b', '100px', { minPx: 120 }), col('c', '100px')];
    const m = mergeSheetColumns(declared, { widths: { a: 10, b: 80, c: 9999 } });
    expect(m.tracks).toEqual(['60px', '120px', '2000px']);
  });

  it('ignores width entries for unknown columns', () => {
    const m = mergeSheetColumns([col('a', '100px')], { widths: { zzz: 300 } });
    expect(m.tracks).toEqual(['100px']);
  });
});

describe('mergeSheetColumns — reset (null/absent preference)', () => {
  it('an empty preference object behaves like no preference', () => {
    const declared = [col('a', '100px'), col('b', 'minmax(0,1fr)')];
    const withPref = mergeSheetColumns(declared, {
      order: ['b', 'a'],
      hidden: ['a'],
      widths: { b: 300 },
    });
    expect(keys(withPref.visible)).toEqual(['b']);

    const reset = mergeSheetColumns(declared, {});
    expect(keys(reset.visible)).toEqual(['a', 'b']);
    expect(reset.template).toBe('100px minmax(0,1fr)');
    expect(reset.filler).toBe(false);
  });
});

describe('readSheetColumnsPref', () => {
  it('returns undefined for non-object values', () => {
    expect(readSheetColumnsPref(undefined)).toBeUndefined();
    expect(readSheetColumnsPref('nope')).toBeUndefined();
    expect(readSheetColumnsPref(42)).toBeUndefined();
    expect(readSheetColumnsPref(null)).toBeUndefined();
  });

  it('drops malformed entries but keeps well-formed ones', () => {
    const pref = readSheetColumnsPref({
      order: ['a', 7, 'b'],
      hidden: 'not-an-array',
      widths: { a: 120, b: 'wide', c: Number.NaN },
    });
    expect(pref?.order).toEqual(['a', 'b']);
    expect(pref?.hidden).toBeUndefined();
    expect(pref?.widths).toEqual({ a: 120 });
  });
});

describe('isFluidTrack', () => {
  it('treats plain px as fixed and everything else as fluid', () => {
    expect(isFluidTrack('170px')).toBe(false);
    expect(isFluidTrack('62.5px')).toBe(false);
    expect(isFluidTrack('minmax(0,1fr)')).toBe(true);
    expect(isFluidTrack('1fr')).toBe(true);
    expect(isFluidTrack('auto')).toBe(true);
  });
});
