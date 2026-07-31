import { describe, expect, it } from 'vitest';
import { buildHeatmap } from '../../../src/pages/workspace-map/product/gridModel';
import {
  buildFormsModel,
  classifyForm,
  FORMS_COMPONENT,
} from '../../../src/pages/workspace-map/product/formsModel';
import type {
  ComponentElement,
  LobOption,
  SpineNode,
  VersionColumn,
} from '../../../src/pages/workspace-map/product/spine';

// The forms register derivation: forms classify into the three
// rationalization layers (core national / state-required / product-specific)
// and each form's drill carries its contents (coverages, endorsements,
// clauses) from the rolled-up components.

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
  comps: Record<string, ComponentElement[]>,
): VersionColumn => ({
  id,
  name,
  status: null,
  productName: 'Personal Auto',
  lobId: lob.id,
  lobName: lob.name,
  segmentName: lob.segment,
  components: new Map(
    Object.entries(comps).map(([comp, elements]) => [
      comp,
      { node: node(comp, elements), elements },
    ]),
  ),
});

const el = (element: string, livesIn: string | null): ComponentElement => ({
  element,
  description: null,
  livesIn,
  format: null,
});

const BASE = el('PP 00 01 — Personal Auto Policy', 'ISO forms library; form-attach PP0001 ALL');
const CA = el('Amendment of Policy Provisions — California', 'form-attach STATE=CA mandatory');
const OH = el('Amendment of Policy Provisions — Ohio', 'form-attach STATE=OH mandatory');
const TOW = el('PP 03 03 — Towing and Labor Costs', 'attach with TOWING coverage');
const UBI = el('Telematics program endorsement', 'PAS rating module');

const COV_LIAB = el('Bodily injury liability', 'PAS coverage code BI');
const COV_TOW = el('Towing and roadside', 'PAS coverage code TOWING');
const CLAUSE = el('Cancellation and nonrenewal terms', 'policy jacket');

const lobDef = { id: 'lob1', name: 'Motor', segment: 'Personal Lines' };
const lob: LobOption = {
  id: lobDef.id,
  name: lobDef.name,
  segmentName: lobDef.segment,
  versions: [
    version('v1', 'v9 — US-CA', lobDef, {
      [FORMS_COMPONENT]: [BASE, CA, TOW],
      Coverages: [COV_LIAB, COV_TOW],
      Terms: [CLAUSE],
    }),
    version('v2', 'v8 — US-OH', lobDef, {
      [FORMS_COMPONENT]: [BASE, OH, TOW],
      Coverages: [COV_LIAB, COV_TOW],
      Terms: [CLAUSE],
    }),
    version('v3', 'v7 — US-TX', lobDef, {
      [FORMS_COMPONENT]: [BASE, TOW, UBI],
      Coverages: [COV_LIAB, COV_TOW],
      Terms: [CLAUSE],
    }),
  ],
};

describe('classifyForm', () => {
  it('reads the STATE= token from livesIn', () => {
    expect(classifyForm('Some amendment', CA, false).layer).toBe('state');
    expect(classifyForm('Some amendment', CA, false).state).toBe('CA');
  });
  it('falls back to a state name in the form title', () => {
    expect(classifyForm('UM endorsement — California', el('x', null), false).state).toBe('CA');
  });
  it('keeps countrywide coverage-attach forms in the core layer with the token', () => {
    const cls = classifyForm(TOW.element, TOW, false);
    expect(cls.layer).toBe('core');
    expect(cls.coverage).toBe('TOWING');
  });
  it('classifies unique stateless forms as product-specific', () => {
    expect(classifyForm(UBI.element, UBI, true).layer).toBe('product');
    expect(classifyForm(BASE.element, BASE, false).layer).toBe('core');
  });
});

describe('buildFormsModel', () => {
  const heat = buildHeatmap([lob], new Map());
  const model = buildFormsModel(heat);
  if (!model) throw new Error('Forms row missing from the heatmap fixture');
  const sectionOf = (layer: string) => model.sections.find((s) => s.layer === layer);

  it('breaks the register into the three rationalization layers', () => {
    expect(model.counts).toEqual({ core: 2, state: 2, product: 1 });
    expect(sectionOf('core')?.rows.map((r) => r.label)).toContain(BASE.element);
    expect(
      sectionOf('state')
        ?.rows.map((r) => r.state)
        .sort(),
    ).toEqual(['CA', 'OH']);
    expect(sectionOf('product')?.rows[0].label).toBe(UBI.element);
  });

  it('marks the widest-carried base policy form and lists it first', () => {
    const core = sectionOf('core');
    expect(core?.rows[0].isBase).toBe(true);
    expect(core?.rows[0].label).toBe(BASE.element);
  });

  it('rolls coverages, clauses and endorsements up beneath the base form', () => {
    const base = sectionOf('core')?.rows[0];
    const kinds = Object.fromEntries(
      (base?.contents ?? []).map((g) => [g.kind, g.rows.map((r) => r.label)]),
    );
    expect(kinds.coverage).toEqual(expect.arrayContaining([COV_LIAB.element, COV_TOW.element]));
    expect(kinds.clause).toEqual([CLAUSE.element]);
    // Every other form of the LOB attaches to the base as an endorsement.
    expect(kinds.endorsement).toHaveLength(4);
  });

  it('gives a coverage-attach endorsement its matched coverage as contents', () => {
    const tow = sectionOf('core')?.rows.find((r) => r.label === TOW.element);
    expect(tow?.contents.find((g) => g.kind === 'coverage')?.rows[0].label).toBe(COV_TOW.element);
  });

  it('keeps the heat-map row as the form OWN presence, and the drill aggregated', () => {
    const ca = sectionOf('state')?.rows.find((r) => r.state === 'CA');
    expect(ca?.total).toBe(1);
    expect(ca?.cells.map((c) => c.na)).toEqual([false, true, true]);
    // Drill payload for the base = the form + coverages + clauses + endorsements.
    const base = sectionOf('core')?.rows[0];
    const drill = model.byKey.get(base?.key ?? '');
    expect(drill?.reviewRows.length).toBe(1 + 2 + 1 + 4);
  });
});
