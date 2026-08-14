import { describe, expect, it } from 'vitest';
import {
  buildComparison,
  elementSignature,
  elementsOf,
  groupCitations,
  lobOptions,
  versionTokensOf,
} from '../../../src/pages/workspace-map/product/spine';
import type {
  ComponentElement,
  ElementGroup,
  SpineNode,
  SpineTable,
  VersionColumn,
} from '../../../src/pages/workspace-map/product/spine';

function node(partial: Partial<SpineNode> & { name: string; levelNumber: number }): SpineNode {
  return {
    id: partial.id ?? partial.name,
    description: null,
    status: null,
    sortOrder: 0,
    attributes: null,
    rollup: {},
    children: [],
    ...partial,
  };
}

function version(
  id: string,
  name: string,
  productName: string,
  components: Record<string, string[]>,
): VersionColumn {
  return {
    id,
    name,
    status: 'Active',
    productName,
    lobId: 'lob-1',
    lobName: 'Test LOB',
    segmentName: 'Test Segment',
    components: new Map(
      Object.entries(components).map(([comp, elements], i) => [
        comp,
        {
          node: node({ id: `${id}-${comp}`, name: comp, levelNumber: 5, sortOrder: i }),
          elements: elements.map((e) => ({
            element: e,
            description: null,
            livesIn: null,
            format: null,
          })),
        },
      ]),
    ),
  };
}

describe('elementsOf', () => {
  it('parses attributes.elements defensively', () => {
    const n = node({
      name: 'Rating',
      levelNumber: 5,
      attributes: {
        elements: [
          { element: 'Base rate table', livesIn: 'PAS B', description: 'd', format: 'Excel' },
          { notAnElement: true },
          null,
        ],
      },
    });
    const els = elementsOf(n);
    expect(els).toHaveLength(1);
    expect(els[0]).toEqual({
      element: 'Base rate table',
      livesIn: 'PAS B',
      description: 'd',
      format: 'Excel',
      mandate: null,
      mandateCitation: null,
      formId: null,
      formNumber: null,
      formRole: null,
      formState: null,
    });
  });

  it('returns empty for missing or malformed attributes', () => {
    expect(elementsOf(node({ name: 'x', levelNumber: 5 }))).toEqual([]);
    expect(elementsOf(node({ name: 'x', levelNumber: 5, attributes: { elements: 'no' } }))).toEqual(
      [],
    );
  });
});

describe('elementSignature', () => {
  it('is blind to digits, punctuation and version tokens', () => {
    const tokens = versionTokensOf([
      version('v1', 'v9 — US-CA', 'PA Personal Auto 6-mo', {}),
      version('v2', 'v8 — US-OH', 'PA Personal Auto 6-mo', {}),
    ]);
    expect(elementSignature('Product code PPA6-CA', tokens)).toEqual(
      elementSignature('Product code PPA6-OH', tokens),
    );
    expect(elementSignature('Base rate table', tokens)).not.toEqual(
      elementSignature('Territory factor set', tokens),
    );
  });
});

describe('buildComparison', () => {
  const a = version('a', 'v9 — US-CA', 'Personal Auto', {
    Coverages: ['Bodily injury liability', 'Collision coverage'],
    Rating: ['Base rate table CA'],
  });
  const b = version('b', 'v8 — US-OH', 'Personal Auto', {
    Coverages: ['Bodily injury liability', 'Rental reimbursement'],
    Rating: ['Base rate table OH'],
  });

  it('classifies common, unique and folds jurisdiction twins', () => {
    const c = buildComparison([a, b]);
    expect(c.axis).toEqual(['Coverages', 'Rating']);
    const coverages = c.rows[0];
    const byName = new Map(coverages.groups.map((g) => [g.name, g.status]));
    expect(byName.get('Bodily injury liability')).toBe('COMMON');
    expect(byName.get('Collision coverage')).toBe('UNIQUE');
    expect(byName.get('Rental reimbursement')).toBe('UNIQUE');
    // "Base rate table CA" / "Base rate table OH" meet on one signature.
    expect(c.rows[1].groups).toHaveLength(1);
    expect(c.rows[1].groups[0].status).toBe('COMMON');
    expect(c.rawCount).toBe(6);
    expect(c.normalizedCount).toBe(4);
    expect(c.reviewCount).toBe(2);
  });

  it('marks everything SINGLE for a one-version decomposition', () => {
    const c = buildComparison([a]);
    expect(c.rows.flatMap((r) => r.groups).every((g) => g.status === 'SINGLE')).toBe(true);
    expect(c.reviewCount).toBe(0);
  });
});

describe('groupCitations', () => {
  const el = (livesIn: string | null): ComponentElement => ({
    element: 'Availability',
    description: null,
    livesIn,
    format: null,
  });
  const group = (perVersion: Record<string, ComponentElement | null>): ElementGroup => ({
    key: 'k',
    component: 'Product Taxonomy',
    name: 'Availability',
    status: 'COMMON',
    perVersion,
    presentIn: Object.values(perVersion).filter(Boolean).length,
  });

  it('unions distinct citations across all jurisdictions', () => {
    expect(
      groupCitations(
        group({
          ca: el('PAS B — availability config PPA6-CA'),
          oh: el('PAS B — availability config PPA6-OH'),
        }),
      ),
    ).toEqual(['PAS B — availability config PPA6-CA', 'PAS B — availability config PPA6-OH']);
  });

  it('splits ;-joined citations and drops exact repeats (case-insensitive)', () => {
    expect(
      groupCitations(
        group({
          ca: el('PAS B — availability config; UW rules engine AUTO_NB_ELIG'),
          oh: el('pas b — availability config'),
          tx: el(null),
        }),
      ),
    ).toEqual(['PAS B — availability config', 'UW rules engine AUTO_NB_ELIG']);
  });

  it('returns nothing when no jurisdiction carries a citation', () => {
    expect(groupCitations(group({ ca: el(null), oh: null }))).toEqual([]);
  });
});

describe('lobOptions', () => {
  it('lists only LOBs whose versions carry model components', () => {
    const withComponents = node({
      id: 'v1',
      name: 'v1 — US-NY',
      levelNumber: 4,
      children: [
        node({
          name: 'Coverages',
          levelNumber: 5,
          attributes: { elements: [{ element: 'Dwelling limit' }] },
        }),
      ],
    });
    const table: SpineTable = {
      levels: [],
      totals: {},
      roots: [
        node({
          name: 'Personal Lines',
          levelNumber: 1,
          children: [
            node({
              id: 'lob1',
              name: 'Homeowners',
              levelNumber: 2,
              children: [node({ name: 'HO-3', levelNumber: 3, children: [withComponents] })],
            }),
            node({ id: 'lob2', name: 'Empty LOB', levelNumber: 2 }),
          ],
        }),
      ],
    };
    const lobs = lobOptions(table);
    expect(lobs).toHaveLength(1);
    expect(lobs[0].name).toBe('Homeowners');
    expect(lobs[0].segmentName).toBe('Personal Lines');
    expect(lobs[0].versions[0].productName).toBe('HO-3');
    expect(lobs[0].versions[0].components.get('Coverages')?.elements[0].element).toBe(
      'Dwelling limit',
    );
  });
});
