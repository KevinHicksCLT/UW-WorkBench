// cellGeometry — the deterministic cell-height estimator behind WR-10's
// variable slot heights (now with v3 WHY-THIS-MOVES panels + anatomy rows),
// the Normalize-box estimator, the dead-lane math and slot height/offsets.
import { describe, expect, it } from 'vitest';
import {
  ANATOMY_ROW_H,
  CELL_BASE_H,
  CHIP_ROW_H,
  DEAD_BASE_H,
  DEAD_ROW_H,
  DIVIDER_H,
  EMPTY_CELL_H,
  ITEM_FLAG_H,
  ITEM_H,
  ITEM_SCREEN_H,
  ITEM_WHY_H,
  NORM_BASE_H,
  NORM_ENTRY_H,
  NORM_HELD_H,
  SLOT_H,
  SLOT_MARGIN,
  deadLaneHeight,
  estimateCellHeight,
  estimateNormalizeHeight,
  slotHeightFor,
  slotOffsets,
} from '../../../src/pages/greenfield-migration/cellGeometry';
import {
  defaultStays,
  type CategoryTag,
  type Finding,
  type NormalizationEntry,
} from '../../../src/lib/rationalization';

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
  sharedServiceId: null,
  name: 'f',
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
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
  stays: defaultStays(over.capdan ?? 'Common'),
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

  it('adds a WHY THIS MOVES panel only to expanded misplaced items that carry one', () => {
    const why = { captured: 'age, state', lands: 'FNOL Intake Domain Service' };
    const red = tag('Rules', [finding({ capdan: 'Relocate', whyThisMoves: why })], {
      capdan: 'Relocate',
    });
    const green = tag('Forms', [finding({ whyThisMoves: why })]); // stays → panel hidden
    expect(estimateCellHeight([red], ['Rules'])).toBe(
      CELL_BASE_H + DIVIDER_H + CHIP_ROW_H + ITEM_H + ITEM_FLAG_H + ITEM_WHY_H,
    );
    expect(estimateCellHeight([green], ['Forms'])).toBe(CELL_BASE_H + CHIP_ROW_H + ITEM_H);
  });

  it('adds one line per matched anatomy sub-category via the callback', () => {
    const tags = [tag('Forms', [finding()])];
    const base = estimateCellHeight(tags, ['Forms']);
    expect(estimateCellHeight(tags, ['Forms'], () => 4)).toBe(base + 4 * ANATOMY_ROW_H);
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

describe('estimateNormalizeHeight', () => {
  const entry = (over: Partial<NormalizationEntry> = {}): NormalizationEntry => ({
    id: `e-${seq++}`,
    layer: 'UI',
    notation: 'N-101',
    name: 'Loss Capture Form',
    matchStatus: 'AUTO',
    matchBasis: null,
    differenceNote: null,
    proposedResolution: null,
    componentId: null,
    findingIds: [],
    ...over,
  });

  it('is the base height for an empty box', () => {
    expect(estimateNormalizeHeight([])).toBe(NORM_BASE_H);
  });

  it('charges AUTO entries the row height and HELD/REVIEW the card height', () => {
    expect(
      estimateNormalizeHeight([
        entry(),
        entry({ matchStatus: 'REVIEW' }),
        entry({ matchStatus: 'HELD' }),
      ]),
    ).toBe(NORM_BASE_H + NORM_ENTRY_H + 2 * NORM_HELD_H);
  });
});

describe('deadLaneHeight', () => {
  it('charges the heading plus one row per dead finding', () => {
    expect(deadLaneHeight(0)).toBe(DEAD_BASE_H);
    expect(deadLaneHeight(7)).toBe(DEAD_BASE_H + 7 * DEAD_ROW_H);
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
