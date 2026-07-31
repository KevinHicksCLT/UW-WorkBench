// Server-side Products board derivation — comparison grouping, heat-map
// counting, and the product-fold column axis. Pure functions over synthetic
// versions; prisma is mocked and never touched.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/prisma.js', () => ({ prisma: {} }));

import {
  buildComparison,
  buildHeatmap,
  decisionKey,
  elementSignature,
  PRODUCT_FOLD_THRESHOLD,
  scopeLobs,
  stateOf,
  versionTokenOf,
  type DecisionLite,
  type SpineElement,
  type SpineLob,
  type SpineVersion,
} from '../../../src/lib/resolvers/productBoard.js';

const el = (element: string): SpineElement => ({
  element,
  description: `${element} detail`,
  livesIn: 'PAS product master',
  format: null,
});

let seq = 0;
const nextSeq = (): number => {
  seq += 1;
  return seq;
};
const version = (
  id: string,
  name: string,
  lob: { id: string; name: string; segment: string },
  comps: Record<string, string[]>,
  productName = 'Homeowners',
): SpineVersion => ({
  id,
  name,
  status: null,
  sortOrder: nextSeq(),
  productName,
  productCode: null,
  lobId: lob.id,
  lobName: lob.name,
  segmentName: lob.segment,
  components: new Map(
    Object.entries(comps).map(([comp, els], i) => [
      comp,
      { name: comp, sortOrder: i, elements: els.map(el) },
    ]),
  ),
});

const lobDef = { id: 'lob1', name: 'Property', segment: 'Personal Lines' };

const twoVersionLob = (): SpineLob => ({
  id: lobDef.id,
  name: lobDef.name,
  segmentName: lobDef.segment,
  versions: [
    version('v1', 'v1 — US-CA', lobDef, {
      Coverages: ['Dwelling', 'Contents', 'Loss of use'],
      Rating: ['Territory factor', 'Protection class'],
    }),
    version('v2', 'v2 — US-OH', lobDef, {
      Coverages: ['Dwelling', 'Contents', 'Wind deductible'],
      Rating: ['Territory factor', 'Protection class'],
    }),
  ],
});

describe('elementSignature / name parsing', () => {
  it('meets jurisdiction-suffixed elements on one signature', () => {
    const tokens = new Set(['us', 'ca', 'oh', 'v1', 'v2']);
    expect(elementSignature('Product code PPA-CA', tokens)).toBe(
      elementSignature('Product code PPA-OH', tokens),
    );
    expect(elementSignature('Dwelling', tokens)).not.toBe(elementSignature('Contents', tokens));
  });

  it('parses the state and version tokens the filter bar uses', () => {
    expect(stateOf('v1 — US-CA')).toBe('CA');
    expect(stateOf('v1 — Countrywide')).toBe('__none__');
    expect(versionTokenOf('v9 — US-CA')).toBe('v9');
  });
});

describe('buildComparison', () => {
  it('classifies COMMON / UNIQUE across two versions and counts reviews', () => {
    const lob = twoVersionLob();
    const cmp = buildComparison(lob.versions);
    expect(cmp.axis).toEqual(['Coverages', 'Rating']);
    const cov = cmp.rows.find((r) => r.component === 'Coverages');
    const byName = new Map(cov?.groups.map((g) => [g.name, g.status]));
    expect(byName.get('Dwelling')).toBe('COMMON');
    expect(byName.get('Loss of use')).toBe('UNIQUE');
    expect(byName.get('Wind deductible')).toBe('UNIQUE');
    // 2 uniques need review; Rating is fully common.
    expect(cmp.reviewCount).toBe(2);
    expect(cmp.rawCount).toBe(10);
  });

  it('keeps perVersion sparse — only present versions appear', () => {
    const cmp = buildComparison(twoVersionLob().versions);
    const unique = cmp.rows.flatMap((r) => r.groups).find((g) => g.name === 'Loss of use');
    expect(Object.keys(unique?.perVersion ?? {})).toEqual(['v1']);
  });
});

describe('buildHeatmap', () => {
  it('counts the status mix so common+similar+unique === total, and merges decisions', () => {
    const lob = twoVersionLob();
    const cmp = buildComparison(lob.versions);
    const uniqueKey = cmp.rows.flatMap((r) => r.groups).find((g) => g.name === 'Loss of use')!.key;
    const decisions = new Map<string, DecisionLite>([
      [
        decisionKey(lob.id, uniqueKey),
        {
          lobNodeId: lob.id,
          component: 'Coverages',
          groupKey: uniqueKey,
          status: 'APPROVED',
          comment: 'standardize',
          decidedBy: null,
        },
      ],
    ]);
    const heat = buildHeatmap([lob], decisions);
    expect(heat.columnMode).toBe('version');
    expect(heat.columns).toHaveLength(2);
    expect(heat.totals.common + heat.totals.similar + heat.totals.unique).toBe(heat.totals.total);
    expect(heat.totals.need).toBe(2);
    expect(heat.totals.decided).toBe(1);
    const covRow = heat.rows.find((r) => r.component === 'Coverages')!;
    expect(covRow.note).toBe('standardize');
    // Review rows carry presence against the column axis.
    const unique = covRow.reviewRows.find((r) => r.group.name === 'Loss of use')!;
    expect(unique.presence).toEqual([true, false]);
    expect(unique.decision?.status).toBe('APPROVED');
  });

  it('folds the column axis to one per product past the threshold and keeps sums', () => {
    // One LOB, one product, THRESHOLD+1 versions with an identical component —
    // must fold to a single product column whose counts do not inflate.
    const many: SpineLob = {
      id: 'lobW',
      name: 'WC',
      segmentName: 'SMB',
      versions: Array.from({ length: PRODUCT_FOLD_THRESHOLD + 1 }, (_, i) =>
        version(
          `w${i}`,
          `v1 — US-S${i}`,
          { id: 'lobW', name: 'WC', segment: 'SMB' },
          {
            Forms: [`State policy form — Alabama`],
          },
          'Workers Comp',
        ),
      ),
    };
    const heat = buildHeatmap([many], new Map());
    expect(heat.columnMode).toBe('product');
    expect(heat.columns).toHaveLength(1);
    expect(heat.columns[0].members).toBe(PRODUCT_FOLD_THRESHOLD + 1);
    const forms = heat.rows.find((r) => r.component === 'Forms')!;
    // One shared concern → the folded cell counts it once.
    expect(forms.cells[0].total).toBe(forms.total);
    expect(forms.cells[0].na).toBe(false);
  });
});

describe('scopeLobs', () => {
  it('applies the cascade filters and drops emptied LOBs', () => {
    const lob = twoVersionLob();
    const scoped = scopeLobs([lob], {
      segments: [],
      lobIds: [],
      offerings: [],
      states: ['CA'],
      versionTokens: [],
      versionIds: [],
    });
    expect(scoped).toHaveLength(1);
    expect(scoped[0].versions.map((v) => v.id)).toEqual(['v1']);
    const none = scopeLobs([lob], {
      segments: ['Commercial'],
      lobIds: [],
      offerings: [],
      states: [],
      versionTokens: [],
      versionIds: [],
    });
    expect(none).toHaveLength(0);
  });
});
