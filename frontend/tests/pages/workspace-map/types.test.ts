import { describe, expect, it } from 'vitest';
import { findingMoves, LAYERS, LAYER_ACCENT } from '../../../src/pages/workspace-map/types';
import type { Finding } from '../../../src/pages/workspace-map/types';

const base: Finding = {
  id: 'f1',
  appId: 'a1',
  layer: 'UI',
  category: null,
  view: null,
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  capdan: 'Common',
  targetLayer: null,
  sharedServiceId: null,
  name: 'x',
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
};

describe('findingMoves', () => {
  it('keeps a Common, non-dead finding in place', () => {
    expect(findingMoves(base)).toBe(false);
  });

  it.each(['Relocate', 'Eliminate', 'Different'] as const)('moves a %s finding', (capdan) => {
    expect(findingMoves({ ...base, capdan })).toBe(true);
  });

  it('moves dead code regardless of capdan', () => {
    expect(findingMoves({ ...base, deadCode: true })).toBe(true);
  });
});

describe('layer vocabulary', () => {
  it('has an accent for every layer', () => {
    for (const layer of LAYERS) expect(LAYER_ACCENT[layer]).toBeDefined();
  });
});
