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
import { buildFormsModel, classifyForm } from '../../../src/lib/resolvers/productForms.js';

const el = (element: string, livesIn = 'Forms library'): SpineElement => ({
  element,
  description: `${element} detail`,
  livesIn,
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
    const bands = new Set(Object.values(drill.groupOf));
    expect(bands.has('Form')).toBe(true);
    expect(bands.has('Coverages')).toBe(true);
    expect(bands.has('Clauses')).toBe(true);
    expect(bands.has('Endorsements')).toBe(true);
    // Form + 2 coverages + 1 clause + 3 endorsements (water backup + 2 state).
    expect(drill.reviewRows).toHaveLength(7);
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
