// cellGeometry — the deterministic cell-height estimator behind the v3
// legacy-panel item rows (visible cap + "+N more" fold + WHY-THIS-MOVES
// expansion), the Normalize comparison-table estimator, the dead-lane math and
// slot height/offsets.
import { describe, expect, it } from 'vitest';
import {
  CELL_BASE_H,
  CELL_HEADER_H,
  DEAD_LANE_H,
  EMPTY_CELL_H,
  EXPAND_ALL,
  ITEM_ROW_H,
  ITEM_WHY_H,
  MORE_ROW_H,
  NORM_BASE_H,
  NORM_CARD_BASE_H,
  NORM_CARD_LINE_H,
  NORM_ENTRY_H,
  NORM_HELD_EXTRA,
  SLOT_H,
  SLOT_MARGIN,
  STAY_CAP,
  deadLaneHeight,
  estimateCellHeight,
  estimateNormalizeHeight,
  slotHeightFor,
  slotOffsets,
  whyToken,
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
  it('returns the empty-cell height when the cell has no findings', () => {
    expect(estimateCellHeight([], [])).toBe(EMPTY_CELL_H);
  });

  it('charges the section header, base and one row per visible finding', () => {
    const tags = [
      tag('Forms', [finding(), finding()]),
      tag('Grids', [finding({ category: 'Grids' })]),
    ];
    expect(estimateCellHeight(tags, [])).toBe(CELL_HEADER_H + CELL_BASE_H + 3 * ITEM_ROW_H);
  });

  it('folds stays past STAY_CAP but always shows every mover', () => {
    const stays = tag(
      'Forms',
      Array.from({ length: STAY_CAP + 4 }, () => finding()),
    );
    const movers = tag(
      'Rules',
      Array.from({ length: 2 }, () => finding({ capdan: 'Relocate' })),
      { capdan: 'Relocate' },
    );
    expect(estimateCellHeight([stays, movers], [])).toBe(
      CELL_HEADER_H + CELL_BASE_H + (STAY_CAP + 2) * ITEM_ROW_H + MORE_ROW_H,
    );
  });

  it('EXPAND_ALL shows every row (collapse row still charged)', () => {
    const many = tag(
      'Forms',
      Array.from({ length: STAY_CAP + 3 }, () => finding()),
    );
    expect(estimateCellHeight([many], [EXPAND_ALL])).toBe(
      CELL_HEADER_H + CELL_BASE_H + (STAY_CAP + 3) * ITEM_ROW_H + MORE_ROW_H,
    );
  });

  it('adds a WHY THIS MOVES panel only for open why-tokens on movers', () => {
    const why = { captured: 'age, state', lands: 'FNOL Intake Domain Service' };
    const mover = finding({ capdan: 'Relocate', whyThisMoves: why });
    const red = tag('Rules', [mover], { capdan: 'Relocate' });
    const base = estimateCellHeight([red], []);
    expect(estimateCellHeight([red], [whyToken(mover.id)])).toBe(base + ITEM_WHY_H);
    expect(estimateCellHeight([red], [whyToken('someone-else')])).toBe(base);
  });

  it('is deterministic for the same inputs', () => {
    const tags = [tag('Forms', [finding({ screenRef: 'Home' })])];
    expect(estimateCellHeight(tags, [EXPAND_ALL])).toBe(estimateCellHeight(tags, [EXPAND_ALL]));
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

  it('charges compact rows for card-less entries and HELD/REVIEW extra', () => {
    expect(
      estimateNormalizeHeight([
        entry(),
        entry({ matchStatus: 'REVIEW' }),
        entry({ matchStatus: 'HELD' }),
      ]),
    ).toBe(NORM_BASE_H + 3 * NORM_ENTRY_H + 2 * NORM_HELD_EXTRA);
  });

  it('charges comparison-card entries by their tallest card', () => {
    const cards = [
      { source: 'A', title: 'Loss capture form', lines: ['a', 'b', 'c', 'd', 'e'] },
      { source: 'B', title: 'Loss capture form', lines: ['a', 'b'] },
    ];
    expect(estimateNormalizeHeight([entry({ sourceCards: cards })])).toBe(
      NORM_BASE_H + NORM_CARD_BASE_H + 5 * NORM_CARD_LINE_H,
    );
  });
});

describe('deadLaneHeight', () => {
  it('is the wireframe single-line band regardless of count', () => {
    expect(deadLaneHeight(0)).toBe(DEAD_LANE_H);
    expect(deadLaneHeight(7)).toBe(DEAD_LANE_H);
  });
});

describe('slotHeightFor / slotOffsets', () => {
  it('never returns less than the base SLOT_H contribution', () => {
    expect(slotHeightFor([])).toBe(SLOT_H);
    expect(slotHeightFor([EMPTY_CELL_H, CELL_HEADER_H])).toBe(SLOT_H);
  });

  it('grows to the tallest estimated box plus the margin', () => {
    const tall = SLOT_H + 200;
    expect(slotHeightFor([EMPTY_CELL_H, tall])).toBe(tall + SLOT_MARGIN);
  });

  it('accumulates offsets so each slot starts where the previous ends', () => {
    expect(slotOffsets([SLOT_H, SLOT_H + 40, SLOT_H])).toEqual([0, SLOT_H, 2 * SLOT_H + 40]);
  });
});
