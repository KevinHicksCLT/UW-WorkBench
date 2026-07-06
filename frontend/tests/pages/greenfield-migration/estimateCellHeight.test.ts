// cellGeometry — the deterministic cell-height estimator behind WR-10's
// variable slot heights, plus the slot height/offset math.
import { describe, expect, it } from 'vitest';
import {
  CELL_BASE_H,
  CHIP_ROW_H,
  DIVIDER_H,
  EMPTY_CELL_H,
  ITEM_FLAG_H,
  ITEM_H,
  ITEM_SCREEN_H,
  SLOT_H,
  SLOT_MARGIN,
  estimateCellHeight,
  slotHeightFor,
  slotOffsets,
} from '../../../src/pages/greenfield-migration/cellGeometry';
import type { CategoryTag, Finding } from '../../../src/lib/rationalization';

let seq = 0;
const finding = (over: Partial<Finding> = {}): Finding => ({
  id: `fixture-${seq++}`,
  appId: 'app1',
  layer: 'UI',
  category: 'Forms',
  view: 'COMPONENT',
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  capdan: 'Common',
  targetLayer: null,
  name: 'f',
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  ...over,
});

const tag = (
  category: string,
  findings: Finding[],
  over: Partial<CategoryTag> = {},
): CategoryTag => ({
  appId: 'app1',
  layer: 'UI',
  category,
  capdan: 'Common',
  targetLayer: null,
  count: findings.length,
  findings,
  ...over,
});

describe('estimateCellHeight', () => {
  it('returns the empty-cell height when the cell has no tags', () => {
    expect(estimateCellHeight([], [])).toBe(EMPTY_CELL_H);
  });

  it('collapsed-only: base + one chip row per tag', () => {
    const tags = [
      tag('Forms', [finding(), finding()]),
      tag('Grids', [finding({ category: 'Grids' })]),
    ];
    expect(estimateCellHeight(tags, [])).toBe(CELL_BASE_H + 2 * CHIP_ROW_H);
  });

  it('adds the "Doesn\'t belong here" divider when a red tag is present', () => {
    const tags = [
      tag('Forms', [finding()]),
      tag('Reports', [finding({ capdan: 'Eliminate' })], { capdan: 'Eliminate' }),
    ];
    expect(estimateCellHeight(tags, [])).toBe(CELL_BASE_H + DIVIDER_H + 2 * CHIP_ROW_H);
  });

  it('one expanded category with n items adds an item row per finding', () => {
    const tags = [
      tag('Forms', [finding(), finding(), finding()]),
      tag('Grids', [finding({ category: 'Grids' })]),
    ];
    expect(estimateCellHeight(tags, ['Forms'])).toBe(CELL_BASE_H + 2 * CHIP_ROW_H + 3 * ITEM_H);
  });

  it('adds screen-chip rows and red flag lines to expanded items', () => {
    const red = tag(
      'Business logic',
      [
        finding({ capdan: 'Relocate', screenRef: 'User Admin › Users' }),
        finding({ capdan: 'Relocate' }),
      ],
      { capdan: 'Relocate', targetLayer: 'Business Service' },
    );
    expect(estimateCellHeight([red], ['Business logic'])).toBe(
      CELL_BASE_H + DIVIDER_H + CHIP_ROW_H + 2 * (ITEM_H + ITEM_FLAG_H) + ITEM_SCREEN_H,
    );
  });

  it('ignores expanded categories that are not among the tags', () => {
    const tags = [tag('Forms', [finding()])];
    expect(estimateCellHeight(tags, ['Not here'])).toBe(estimateCellHeight(tags, []));
  });

  it('is deterministic for the same inputs', () => {
    const tags = [tag('Forms', [finding({ screenRef: 'Home' })])];
    expect(estimateCellHeight(tags, ['Forms'])).toBe(estimateCellHeight(tags, ['Forms']));
  });
});

describe('slotHeightFor / slotOffsets', () => {
  it('never returns less than the base SLOT_H contribution', () => {
    expect(slotHeightFor([])).toBe(SLOT_H);
    expect(slotHeightFor([EMPTY_CELL_H, CELL_BASE_H + CHIP_ROW_H])).toBe(SLOT_H);
  });

  it('grows to the tallest estimated box plus the margin', () => {
    const tall = SLOT_H + 200;
    expect(slotHeightFor([EMPTY_CELL_H, tall])).toBe(tall + SLOT_MARGIN);
  });

  it('accumulates offsets so each slot starts where the previous ends', () => {
    expect(slotOffsets([SLOT_H, SLOT_H + 40, SLOT_H])).toEqual([0, SLOT_H, 2 * SLOT_H + 40]);
  });
});
