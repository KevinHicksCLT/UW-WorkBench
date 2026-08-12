// Server-side forms register — three-layer classification, base-form
// containment and the per-LOB state aggregation that keeps the register
// renderable at portfolio scale. Pure functions; prisma mocked, never touched.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/prisma.js', () => ({ prisma: {} }));

import {
  buildHeatmap,
  type SpineElement,
  type SpineLob,
  type SpineVersion,
} from '../../../src/lib/resolvers/productBoard.js';
import {
  buildFormsModel,
  classifyForm,
  clauseElement,
  clauseReviewRows,
} from '../../../src/lib/resolvers/productForms.js';

const el = (element: string, livesIn = 'Forms library'): SpineElement => ({
  element,
  description: `${element} detail`,
  livesIn,
  format: null,
});

const libEl = (
  element: string,
  formRole: 'baseForm' | 'declarations' | 'endorsement' | 'stateAmendatory',
  formState: string | null = null,
): SpineElement => ({
  ...el(element),
  formId: `form-${element.replace(/\W+/g, '-')}`,
  formNumber: element.split(' — ')[0],
  formRole,
  formState,
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
  productName: string,
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
  states: /US-([A-Z]{2})/.exec(name) ? [/US-([A-Z]{2})/.exec(name)![1]] : [],
  components: new Map(
    Object.entries(comps).map(([comp, els], i) => [
      comp,
      { name: comp, sortOrder: i, elements: els.map((e) => el(e)) },
    ]),
  ),
});

describe('classifyForm', () => {
  it('routes state-named forms to the state layer, unique to product, rest to core', () => {
    expect(classifyForm('State policy form — Massachusetts', null, false).layer).toBe('state');
    expect(classifyForm('State policy form — Massachusetts', null, false).state).toBe('MA');
    expect(classifyForm('PIP / no-fault form set — MI', null, false).state).toBe('MI');
    expect(classifyForm('CA state-mandated endorsement set', null, false).state).toBe('CA');
    expect(classifyForm('Premier tier wording', null, true).layer).toBe('product');
    expect(classifyForm('Homeowners policy — countrywide base form', null, false).layer).toBe(
      'core',
    );
  });

  it('routes library-backed forms by their FormProductNode role', () => {
    // Base papers and declarations are countrywide core even when uniquely
    // carried — the product-count judgement only demotes endorsements.
    expect(
      classifyForm('X', libEl('NM-PA-0001 — Personal Auto Policy', 'baseForm'), true).layer,
    ).toBe('core');
    expect(classifyForm('X', libEl('NM-PA-DEC — Declarations', 'declarations'), true).layer).toBe(
      'core',
    );
    expect(classifyForm('X', libEl('NSA 2114 — TNC Exclusion', 'endorsement'), true).layer).toBe(
      'product',
    );
    expect(classifyForm('X', libEl('CAF 2101 — Hired Auto', 'endorsement'), false).layer).toBe(
      'core',
    );
    const state = classifyForm(
      'X',
      libEl('HM 8100PA — Special Provisions', 'stateAmendatory', 'PA'),
      false,
    );
    expect(state.layer).toBe('state');
    expect(state.state).toBe('PA');
  });
});

describe('buildFormsModel', () => {
  const lobDef = { id: 'lobH', name: 'Homeowners', segment: 'Personal Lines' };
  const lob: SpineLob = {
    id: lobDef.id,
    name: lobDef.name,
    segmentName: lobDef.segment,
    versions: [
      version(
        'cw',
        'v1 — Countrywide',
        lobDef,
        {
          Forms: ['Homeowners policy — countrywide base form', 'Water backup endorsement'],
          Coverages: ['Dwelling', 'Contents'],
          Terms: ['All-peril deductible'],
        },
        'HO-3',
      ),
      version(
        'ma',
        'v1 — US-MA',
        lobDef,
        { Forms: ['State policy form — Massachusetts'], Filings: ['MA filing'] },
        'HO-3',
      ),
      version(
        'tx',
        'v1 — US-TX',
        lobDef,
        { Forms: ['State policy form — Texas'], Filings: ['TX filing'] },
        'HO-3',
      ),
    ],
  };

  it('builds the three sections, aggregates state forms per LOB, and sums buckets', () => {
    const heat = buildHeatmap([lob], new Map());
    const model = buildFormsModel(heat, [lob]);
    expect(model).not.toBeNull();
    const sections = Object.fromEntries(model!.sections.map((s) => [s.layer, s.rows]));

    // Two countrywide forms; the base policy form is flagged and sorts first.
    expect(sections.core.map((r) => r.isBase)).toEqual([true, false]);
    // Two state forms fold into ONE aggregated register row…
    expect(sections.state).toHaveLength(1);
    expect(sections.state[0].label).toContain('2 states');
    // …but the counts still count every member (buckets must sum).
    expect(model!.counts.state).toBe(2);
    expect(sections.state[0].total).toBe(2);

    // The aggregate's drill opens every member form.
    const drill = model!.byKey.get(sections.state[0].key);
    expect(drill?.reviewRows).toHaveLength(2);
    expect(new Set(Object.values(drill?.groupOf ?? {}))).toEqual(new Set(['Form']));
  });

  it('gives the base form its containment drill (coverages, clauses, endorsements)', () => {
    const heat = buildHeatmap([lob], new Map());
    const model = buildFormsModel(heat, [lob])!;
    const base = model.sections.find((s) => s.layer === 'core')!.rows.find((r) => r.isBase)!;
    const drill = model.byKey.get(base.key)!;
    // The form itself is the drill's TITLE (self), never one of its own rows.
    expect(drill.self?.group.name).toBe(base.label);
    const bands = new Set(Object.values(drill.groupOf));
    expect(bands.has('Form')).toBe(false);
    expect(bands.has('Coverages')).toBe(true);
    expect(bands.has('Clauses')).toBe(true);
    expect(bands.has('Endorsements')).toBe(true);
    // 2 coverages + 1 clause + 3 endorsements (water backup + 2 state).
    expect(drill.reviewRows).toHaveLength(6);
  });

  it('anchors one base per product and scopes each base drill to its own product', () => {
    const autoDef = { id: 'lobA', name: 'Auto / Motor', segment: 'Personal Lines' };
    const withForms = (v: SpineVersion, forms: SpineElement[]): SpineVersion => {
      v.components.set('Forms', { name: 'Forms', sortOrder: 0, elements: forms });
      return v;
    };
    const auto: SpineLob = {
      id: autoDef.id,
      name: autoDef.name,
      segmentName: autoDef.segment,
      versions: [
        withForms(
          version(
            'p1',
            'v1 — Countrywide',
            autoDef,
            { Coverages: ['P1 Liability'] },
            'Personal Auto',
          ),
          [
            libEl('NM-PA-0001 — Personal Auto Policy', 'baseForm'),
            libEl('NM-PA-2114 — TNC Exclusion', 'endorsement'),
          ],
        ),
        withForms(
          version(
            'p2',
            'v1 — Countrywide',
            autoDef,
            { Coverages: ['P2 Liability'] },
            'Non-Standard Auto',
          ),
          [libEl('NSA 1001 — Non-Standard Auto Policy', 'baseForm')],
        ),
        withForms(version('p3', 'v1 — Countrywide', autoDef, {}, 'Rideshare'), [
          libEl('TNC 1001 — Rideshare Policy', 'baseForm'),
        ]),
      ],
    };
    // Same LOB name under another segment — labels must disambiguate.
    const commDef = { id: 'lobB', name: 'Auto / Motor', segment: 'Commercial Lines' };
    const comm: SpineLob = {
      id: commDef.id,
      name: commDef.name,
      segmentName: commDef.segment,
      versions: [
        withForms(version('c1', 'v1 — Countrywide', commDef, {}, 'Commercial Auto Fleet'), [
          libEl('CAF 1001 — Commercial Auto Fleet Policy', 'baseForm'),
        ]),
      ],
    };
    const lobs = [auto, comm];
    const model = buildFormsModel(buildHeatmap(lobs, new Map()), lobs)!;
    const sections = Object.fromEntries(model.sections.map((s) => [s.layer, s.rows]));

    // Every product's base paper is core + anchored, none demoted to
    // product-specific by the carriage count.
    const core = sections.core;
    expect(core.filter((r) => r.isBase)).toHaveLength(4);
    expect(core.map((r) => r.label)).toContain('NM-PA-0001 — Personal Auto Policy');
    // The uniquely-carried endorsement still lands product-specific.
    expect(sections.product.map((r) => r.label)).toEqual(['NM-PA-2114 — TNC Exclusion']);

    // Ambiguous LOB names pick up their segment.
    const pa = core.find((r) => r.label.startsWith('NM-PA-0001'))!;
    expect(pa.sub).toContain('Auto / Motor (Personal Lines)');
    expect(pa.sub).toContain('Personal Auto');

    // The Personal Auto base drill holds ITS coverages/endorsements only.
    const drill = model.byKey.get(pa.key)!;
    const names = drill.reviewRows.map((r) => r.group.name);
    expect(names).toContain('P1 Liability');
    expect(names).toContain('NM-PA-2114 — TNC Exclusion');
    expect(names).not.toContain('P2 Liability');
    expect(names).not.toContain('NSA 1001 — Non-Standard Auto Policy');
  });

  it('returns null when the scope has no Forms component', () => {
    const bare: SpineLob = {
      ...lob,
      versions: [version('x', 'v1 — Countrywide', lobDef, { Coverages: ['Dwelling'] }, 'HO-3')],
    };
    const heat = buildHeatmap([bare], new Map());
    expect(buildFormsModel(heat, [bare])).toBeNull();
  });
});

describe('clauseReviewRows / clauseElement', () => {
  const lobDef = { id: 'lobH', name: 'Homeowners', segment: 'Personal Lines' };
  const lob: SpineLob = {
    id: lobDef.id,
    name: lobDef.name,
    segmentName: lobDef.segment,
    versions: [
      version(
        'cw',
        'v1 — Countrywide',
        lobDef,
        { Forms: ['Homeowners policy — countrywide base form'], Coverages: ['Dwelling'] },
        'HO-3',
      ),
      version(
        'ma',
        'v1 — US-MA',
        lobDef,
        { Forms: ['State policy form — Massachusetts'], Filings: ['MA filing'] },
        'HO-3',
      ),
    ],
  };
  const lib = {
    formNumber: 'HO-3 0001',
    clauses: [
      {
        ordinal: 1,
        heading: 'Insuring Agreement',
        text: 'We will provide the insurance described.',
      },
      { ordinal: 2, heading: null, text: 'x'.repeat(600) },
    ],
  };

  it('synthesizes contained, non-decision rows that mirror the form itself', () => {
    const heat = buildHeatmap([lob], new Map());
    const model = buildFormsModel(heat, [lob])!;
    const base = model.sections.find((s) => s.layer === 'core')!.rows.find((r) => r.isBase)!;
    const self = model.byKey.get(base.key)!.self!;

    const rows = clauseReviewRows(self, 'form-1', lib);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.contained).toBe(true);
      expect(r.needsDecision).toBe(false);
      expect(r.decision).toBeNull();
      // Presence + status mirror the drilled form — the clause lights the same
      // columns its form does (countrywide coverage extension included).
      expect(r.presence).toEqual(self.presence);
      expect(r.group.status).toBe(self.group.status);
      expect(Object.keys(r.group.perVersion)).toEqual(Object.keys(self.group.perVersion));
    }
    // Heading names the row; a heading-less clause falls back to number+ordinal.
    expect(rows[0].group.name).toBe('Insuring Agreement');
    expect(rows[1].group.name).toBe('HO-3 0001 — clause 2');
    // Keys are namespaced so they can never collide with spine group keys.
    expect(rows.map((r) => r.group.key)).toEqual(['clause:form-1:1', 'clause:form-1:2']);
  });

  it('caps clause text and cites the forms library', () => {
    const e = clauseElement('form-1', lib, lib.clauses[1]);
    expect(e.description!.length).toBeLessThanOrEqual(481); // 480 + ellipsis
    expect(e.description!.endsWith('…')).toBe(true);
    expect(e.livesIn).toBe('HO-3 0001 — Forms library');
    expect(e.format).toBe('Clause');
    expect(e.formId).toBe('form-1');
  });
});
