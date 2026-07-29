import { describe, expect, it } from 'vitest';
import {
  buildGridModel,
  groupGridRows,
  recOf,
} from '../../../src/pages/workspace-map/product/gridModel';
import type {
  ComponentElement,
  LobOption,
  SpineNode,
  VersionColumn,
} from '../../../src/pages/workspace-map/product/spine';

// The Products GRID derivation: per-version deltas against the LOB's
// canonical version, match %, recommendations and grouping.

let nodeSeq = 0;
const node = (name: string, elements: ComponentElement[]): SpineNode => {
  nodeSeq += 1;
  return {
    id: `n${nodeSeq}`,
    name,
    levelNumber: 5,
    description: null,
    status: null,
    sortOrder: nodeSeq,
    attributes: { elements },
    rollup: {},
    children: [],
  };
};

const el = (element: string): ComponentElement => ({
  element,
  description: `${element} detail`,
  livesIn: 'PAS product master',
  format: null,
});

const version = (
  id: string,
  name: string,
  lob: { id: string; name: string; segment: string },
  comps: Record<string, string[]>,
): VersionColumn => ({
  id,
  name,
  status: null,
  productName: 'Homeowners',
  lobId: lob.id,
  lobName: lob.name,
  segmentName: lob.segment,
  components: new Map(
    Object.entries(comps).map(([comp, els]) => {
      const elements = els.map(el);
      return [comp, { node: node(comp, elements), elements }];
    }),
  ),
});

const lobDef = { id: 'lob1', name: 'Property', segment: 'Personal Lines' };
const lob: LobOption = {
  id: lobDef.id,
  name: lobDef.name,
  segmentName: lobDef.segment,
  versions: [
    version('v1', 'US-CA', lobDef, {
      Coverages: ['Dwelling', 'Contents', 'Loss of use'],
      Rating: ['Territory factor', 'Protection class'],
    }),
    version('v2', 'US-OH', lobDef, {
      Coverages: ['Dwelling', 'Contents', 'Wind deductible'],
      Rating: ['Territory factor', 'Protection class'],
    }),
  ],
};

describe('buildGridModel', () => {
  it('scores each version against the canonical and shares one component axis', () => {
    const model = buildGridModel([lob]);
    expect(model.components).toEqual(['Coverages', 'Rating']);
    expect(model.rows).toHaveLength(2);

    const canonical = model.rows.find((r) => r.version.id === 'v1');
    expect(canonical?.canonical).toBe(true);
    expect(canonical?.match).toBe(100);
    expect(canonical?.rec).toBe('canonical');
    expect(canonical?.deltas).toBe(0);

    const other = model.rows.find((r) => r.version.id === 'v2');
    // "Loss of use" only in canonical + "Wind deductible" only in v2 → Δ2 on
    // Coverages, Rating identical.
    expect(other?.cells.find((c) => c.component === 'Coverages')?.delta).toBe(2);
    expect(other?.cells.find((c) => c.component === 'Rating')?.delta).toBe(0);
    expect(other?.deltas).toBe(2);
    expect(other?.match).toBeLessThan(100);
  });

  it('marks components a version does not carry as null cells', () => {
    const partial: LobOption = {
      ...lob,
      versions: [
        lob.versions[0],
        version('v3', 'US-TX', lobDef, { Coverages: ['Dwelling', 'Contents', 'Loss of use'] }),
      ],
    };
    const model = buildGridModel([partial]);
    const tx = model.rows.find((r) => r.version.id === 'v3');
    expect(tx?.cells.find((c) => c.component === 'Rating')?.delta).toBeNull();
  });
});

describe('recOf / groupGridRows', () => {
  it('buckets recommendations by match band', () => {
    expect(recOf(true, 100)).toBe('canonical');
    expect(recOf(false, 92)).toBe('merge');
    expect(recOf(false, 70)).toBe('decide');
    expect(recOf(false, 30)).toBe('retire');
  });

  it('groups by segment › LOB on the spine and by band on variance', () => {
    const model = buildGridModel([lob]);
    const spine = groupGridRows(model.rows, 'spine');
    expect(spine).toHaveLength(1);
    expect(spine[0].name).toBe('Personal Lines');
    expect(spine[0].subs[0].name).toBe('Property');
    expect(spine[0].canonNote).toContain('canonical');

    const variance = groupGridRows(model.rows, 'variance');
    expect(variance.length).toBeGreaterThanOrEqual(1);
    // Lowest match sorts first in variance mode.
    const flat = variance.flatMap((g) => g.subs.flatMap((s) => s.rows));
    expect(flat[0].match).toBeLessThanOrEqual(flat[flat.length - 1].match);
  });
});
