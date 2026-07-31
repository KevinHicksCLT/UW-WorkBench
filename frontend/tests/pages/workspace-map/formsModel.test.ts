import { describe, expect, it } from 'vitest';
import { buildHeatmap } from '../../../src/pages/workspace-map/product/gridModel';
import {
  buildFormsHierarchy,
  classifyForm,
  FORMS_COMPONENT,
} from '../../../src/pages/workspace-map/product/formsModel';
import type {
  ComponentElement,
  LobOption,
  SpineNode,
  VersionColumn,
} from '../../../src/pages/workspace-map/product/spine';

// The forms-first derivation: form element groups classify into core / state
// variation / coverage endorsement / product exception, and the hierarchy's
// counts, cells and roll-ups stay consistent with the heatmap's Forms row.

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

const version = (
  id: string,
  name: string,
  lob: { id: string; name: string; segment: string },
  forms: ComponentElement[],
): VersionColumn => ({
  id,
  name,
  status: null,
  productName: 'Personal Auto',
  lobId: lob.id,
  lobName: lob.name,
  segmentName: lob.segment,
  components: new Map([[FORMS_COMPONENT, { node: node(FORMS_COMPONENT, forms), elements: forms }]]),
});

const f = (element: string, livesIn: string | null): ComponentElement => ({
  element,
  description: null,
  livesIn,
  format: null,
});

const BASE = f('PP 00 01 — Personal Auto Policy', 'ISO forms library; form-attach PP0001 ALL');
const CA = f('Amendment of Policy Provisions — California', 'form-attach STATE=CA mandatory');
const OH = f('Amendment of Policy Provisions — Ohio', 'form-attach STATE=OH mandatory');
const TOW = f('PP 03 03 — Towing and Labor Costs', 'attach with TOWING coverage');
const UBI = f('Telematics program endorsement', 'PAS rating module');

const lobDef = { id: 'lob1', name: 'Motor', segment: 'Personal Lines' };
const lob: LobOption = {
  id: lobDef.id,
  name: lobDef.name,
  segmentName: lobDef.segment,
  versions: [
    version('v1', 'v9 — US-CA', lobDef, [BASE, CA, TOW]),
    version('v2', 'v8 — US-OH', lobDef, [BASE, OH, TOW]),
    version('v3', 'v7 — US-TX', lobDef, [BASE, TOW, UBI]),
  ],
};

describe('classifyForm', () => {
  it('reads the STATE= token from livesIn', () => {
    expect(classifyForm('Some amendment', CA, false)).toEqual({
      layer: 'state',
      state: 'CA',
      coverage: null,
    });
  });
  it('falls back to a state name in the form title', () => {
    expect(classifyForm('UM endorsement — California', f('x', null), false).state).toBe('CA');
  });
  it('classifies coverage-attach forms as coverage endorsements', () => {
    expect(classifyForm(TOW.element, TOW, false)).toEqual({
      layer: 'coverage',
      state: null,
      coverage: 'TOWING',
    });
  });
  it('classifies unique stateless forms as product exceptions and the rest as core', () => {
    expect(classifyForm(UBI.element, UBI, true).layer).toBe('product');
    expect(classifyForm(BASE.element, BASE, false).layer).toBe('core');
  });
});

describe('buildFormsHierarchy', () => {
  const heat = buildHeatmap([lob], new Map());
  const formsRow = heat.rows.find((r) => r.component === FORMS_COMPONENT);
  if (!formsRow) throw new Error('Forms row missing from the heatmap fixture');
  const hierarchy = buildFormsHierarchy(formsRow);

  it('anchors the family on the base form and rolls the variations up beneath it', () => {
    expect(hierarchy.cores).toHaveLength(1);
    const core = hierarchy.cores[0];
    expect(core.label).toContain('Personal Auto Policy');
    const kinds = core.children.map((g) => g.kind);
    expect(kinds).toEqual(['state', 'coverage', 'product']);
    expect(core.children.find((g) => g.kind === 'state')?.rows).toHaveLength(2);
    expect(core.children.find((g) => g.kind === 'coverage')?.rows[0].sub).toContain('TOWING');
  });

  it('aggregates the collapsed core row over the whole family', () => {
    const core = hierarchy.cores[0];
    // base + CA + OH + towing + telematics = every group in the Forms row.
    expect(core.total).toBe(formsRow.total);
    expect(core.reviewRows).toHaveLength(formsRow.reviewRows.length);
    // Every version carries some family form → no NA cell on the core row.
    expect(core.cells.every((c) => !c.na)).toBe(true);
  });

  it('gives child rows single-group cells aligned to the columns', () => {
    const ca = hierarchy.cores[0].children
      .find((g) => g.kind === 'state')
      ?.rows.find((r) => r.sub?.includes('California'));
    expect(ca).toBeDefined();
    expect(ca?.total).toBe(1);
    // CA amendment lives only in the CA version column.
    expect(ca?.cells.map((c) => c.na)).toEqual([false, true, true]);
  });

  it('exposes every row for drill resolution and exact section totals', () => {
    expect(hierarchy.byKey.get(hierarchy.cores[0].key)).toBeDefined();
    expect(hierarchy.totals.total).toBe(formsRow.total);
    expect(hierarchy.counts).toEqual({ cores: 1, state: 2, coverage: 1, program: 0, product: 1 });
  });
});
