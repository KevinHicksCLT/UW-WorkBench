// rationalization — vocabulary-derived lookups (3-A: no hardcoded vocab),
// the §6.2 v3 derivations, and the categoryTags grouping logic.
import { describe, expect, it } from 'vitest';
import {
  categoryTags,
  classificationFrom,
  colorMeta,
  defaultStays,
  deriveColumnStats,
  deriveNormalizeStats,
  findingView,
  layerHintsFrom,
  layersFrom,
  legendFrom,
  lensModeOf,
  matchMetaFrom,
  normalizeFinding,
  optionsFrom,
  pct,
  statusDot,
  statusesFrom,
  staysHere,
  withV3Defaults,
  type AppCol,
  type Finding,
  type NormalizationEntry,
  type StageDetail,
  type VocabularyRow,
} from '../../src/lib/rationalization';

const row = (over: Partial<VocabularyRow>): VocabularyRow => ({
  domain: 'APPLICATION',
  kind: 'LAYER',
  token: 'UI',
  label: 'UI',
  color: null,
  sortOrder: 0,
  meta: null,
  ...over,
});

const VOCAB: VocabularyRow[] = [
  row({
    kind: 'LAYER',
    token: 'Data',
    label: 'Data',
    sortOrder: 1,
    meta: { hint: "what's stored" },
  }),
  row({ kind: 'LAYER', token: 'UI', label: 'UI', sortOrder: 0 }),
  row({
    kind: 'CLASSIFICATION',
    token: 'Common',
    label: 'Common',
    color: 'green',
    sortOrder: 0,
    meta: { stays: true, legend: 'correct — stays in its layer' },
  }),
  row({
    kind: 'CLASSIFICATION',
    token: 'Relocate',
    label: 'Relocate',
    color: 'violet',
    sortOrder: 1,
    meta: { stays: false, legend: 'misplaced — needs to move' },
  }),
  row({ kind: 'CLASSIFICATION', token: 'Odd', label: 'Odd', sortOrder: 2 }), // no meta.stays
  row({ kind: 'STATUS', token: 'Migrated', label: 'Migrated', color: 'green', sortOrder: 0 }),
  row({ kind: 'MODE', token: 'Value streams', label: 'Value streams', sortOrder: 1 }),
  row({ kind: 'MODE', token: 'Applications', label: 'Applications', sortOrder: 0 }),
  row({ kind: 'VIEW', token: 'COMPONENT', label: 'Components', sortOrder: 0 }),
  row({
    kind: 'MATCH_STATUS',
    token: 'AUTO',
    label: 'AUTO',
    color: 'green',
    sortOrder: 0,
    meta: { legend: '2→1 semantically same · auto' },
  }),
];

describe('vocabulary derivations', () => {
  it('orders LAYER tokens by sortOrder and exposes hints from meta', () => {
    expect(layersFrom(VOCAB)).toEqual(['UI', 'Data']);
    expect(layerHintsFrom(VOCAB)).toEqual({ Data: "what's stored" });
  });

  it('builds classification meta with vocabulary colors, stays flags and legend', () => {
    const c = classificationFrom(VOCAB);
    expect(c.order).toEqual(['Common', 'Relocate', 'Odd']);
    expect(c.byToken.Common.stays).toBe(true);
    expect(c.byToken.Common.dot).toBe('#10b981'); // green alias → emerald
    expect(c.byToken.Relocate.stays).toBe(false);
    expect(c.byToken.Relocate.legend).toBe('misplaced — needs to move');
    // No meta.stays → the §6.4 default (only Relocate/Eliminate move).
    expect(c.byToken.Odd.stays).toBe(true);
    expect(staysHere('Common', c)).toBe(true);
    expect(staysHere('Relocate', c)).toBe(false);
    expect(staysHere('Unknown', c)).toBe(true); // falls back to defaultStays
    expect(defaultStays('Eliminate')).toBe(false);
  });

  it('maps STATUS rows to dots with a neutral fallback', () => {
    const s = statusesFrom(VOCAB);
    expect(statusDot('Migrated', s)).toBe('#10b981');
    expect(statusDot('Unknown status', s)).toBe('#d4d4d4');
  });

  it('exposes MODE/VIEW options in vocabulary order', () => {
    expect(optionsFrom(VOCAB, 'MODE')).toEqual([
      { value: 'Applications', label: 'Applications' },
      { value: 'Value streams', label: 'Value streams' },
    ]);
    expect(optionsFrom(VOCAB, 'VIEW')).toEqual([{ value: 'COMPONENT', label: 'Components' }]);
  });

  it('collects every legend-bearing row across kinds', () => {
    expect(legendFrom(VOCAB).map((l) => l.text)).toEqual([
      'correct — stays in its layer',
      'misplaced — needs to move',
      '2→1 semantically same · auto',
    ]);
  });

  it('builds match-status meta with legends', () => {
    const m = matchMetaFrom(VOCAB);
    expect(m.AUTO.legend).toBe('2→1 semantically same · auto');
    expect(m.AUTO.dot).toBe('#10b981');
  });

  it('resolves palette aliases and falls back to neutral', () => {
    expect(colorMeta('tan').dot).toBe(colorMeta('amber').dot);
    expect(colorMeta('grey').dot).toBe(colorMeta('slate').dot);
    expect(colorMeta(null).dot).toBe('#d4d4d4');
    expect(colorMeta('not-a-color').dot).toBe('#d4d4d4');
  });

  it('maps label-like MODE tokens onto lens behavior keys', () => {
    expect(lensModeOf('Applications')).toBe('applications');
    expect(lensModeOf('Value streams')).toBe('valueStreams');
    expect(lensModeOf('Roles')).toBe('roles');
    expect(lensModeOf('Legacy Product Models')).toBe('models');
    expect(lensModeOf('Segment')).toBe('segment');
    expect(lensModeOf('Geography')).toBe('geography');
  });
});

describe('pct', () => {
  it('formats a 0..1 ratio as a rounded percent', () => {
    expect(pct(0.614)).toBe('61%');
    expect(pct(1)).toBe('100%');
  });
});

// ── v3 derivations ──────────────────────────────────────────────────────────

let seq = 0;
const finding = (over: Partial<Finding>): Finding => ({
  id: `fixture-${seq++}`,
  appId: 'app1',
  layer: 'Data',
  category: 'Persistence',
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

const app = (id: string, kind = 'LEGACY'): AppCol => ({
  id,
  name: id,
  kind,
  techStack: null,
  disposition: null,
  position: 0,
});

describe('normalizeFinding / findingView', () => {
  it('defaults the §6.2 v3 fields for pre-v3 payloads', () => {
    const raw = finding({}) as Partial<Finding>;
    delete raw.deadCode;
    delete raw.normalizationEntryId;
    delete raw.whyThisMoves;
    const f = normalizeFinding(raw as Parameters<typeof normalizeFinding>[0]);
    expect(f.deadCode).toBe(false);
    expect(f.normalizationEntryId).toBeNull();
    expect(f.whyThisMoves).toBeNull();
  });

  it('treats a missing anatomy view as COMPONENT', () => {
    expect(findingView(finding({ view: null }))).toBe('COMPONENT');
    expect(findingView(finding({ view: 'BEHAVIOR' }))).toBe('BEHAVIOR');
  });
});

describe('deriveColumnStats / deriveNormalizeStats', () => {
  const classification = classificationFrom(VOCAB);

  it('splits per-source findings into raw / correct / move / dead', () => {
    const findings = [
      finding({ appId: 'a' }), // correct
      finding({ appId: 'a', capdan: 'Relocate' }), // move
      finding({ appId: 'a', capdan: 'Relocate', deadCode: true }), // dead
      finding({ appId: 'b' }),
    ];
    const stats = deriveColumnStats(
      [app('a'), app('b'), app('s', 'SHARED_SERVICE')],
      findings,
      classification,
    );
    expect(stats).toEqual([
      { sourceId: 'a', rawSteps: 3, correct: 1, move: 1, deadCode: 1 },
      { sourceId: 'b', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
    ]);
  });

  it('derives the Normalize roll-up from entries + live findings', () => {
    const entries: NormalizationEntry[] = [
      {
        id: 'e1',
        layer: 'Data',
        notation: 'N-1',
        name: 'n',
        matchStatus: 'AUTO',
        matchBasis: null,
        differenceNote: null,
        proposedResolution: null,
        componentId: null,
        findingIds: [],
      },
      {
        id: 'e2',
        layer: 'Data',
        notation: 'N-2',
        name: 'n2',
        matchStatus: 'REVIEW',
        matchBasis: null,
        differenceNote: null,
        proposedResolution: null,
        componentId: null,
        findingIds: [],
      },
    ];
    const findings = [finding({}), finding({ deadCode: true })];
    expect(deriveNormalizeStats(entries, findings)).toEqual({
      raw: 1,
      normalized: 2,
      awaitingReview: 1,
    });
  });

  it('withV3Defaults fills domain, stats and entry list only when absent', () => {
    const detail = {
      id: 'w1',
      name: 'W',
      application: null,
      stageOrder: 0,
      businessProcess: null,
      description: null,
      northstar: null,
      status: 'Active',
      illustrative: true,
      layout: null,
      progress: 0,
      counts: { findings: 1 },
      byLayer: [],
      apps: [app('a')],
      components: [],
      microservices: [],
      screens: [],
      findings: [finding({ appId: 'a' })],
    } as unknown as StageDetail;
    const d = withV3Defaults(detail, classification);
    expect(d.domain).toBe('APPLICATION');
    expect(d.normalizationEntries).toEqual([]);
    expect(d.columnStats).toEqual([
      { sourceId: 'a', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
    ]);
    expect(d.normalizeStats).toEqual({ raw: 1, normalized: 0, awaitingReview: 0 });
    // Server-provided values win.
    const served = withV3Defaults(
      {
        ...detail,
        domain: 'PRODUCT_MODEL',
        normalizeStats: { raw: 9, normalized: 8, awaitingReview: 7 },
      },
      classification,
    );
    expect(served.domain).toBe('PRODUCT_MODEL');
    expect(served.normalizeStats).toEqual({ raw: 9, normalized: 8, awaitingReview: 7 });
  });
});

describe('categoryTags', () => {
  const classification = classificationFrom(VOCAB);

  it('groups one cell (app × layer) into (category, capdan) tags with counts and stays', () => {
    const findings = [
      finding({ id: 'f1' }),
      finding({ id: 'f2' }),
      finding({ id: 'f3', capdan: 'Relocate' }),
      finding({ id: 'f4', category: null }), // → "Other"
      finding({ id: 'f5', layer: 'UI' }), // other layer → excluded
      finding({ id: 'f6', appId: 'app2' }), // other app → excluded when appId filter set
    ];
    const tags = categoryTags(findings, 'Data', classification, 'app1');
    expect(tags.map((t) => [t.category, t.capdan, t.count, t.stays])).toEqual([
      ['Persistence', 'Common', 2, true],
      ['Other', 'Common', 1, true],
      ['Persistence', 'Relocate', 1, false],
    ]);
    expect(tags[0].findings.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('sorts by the vocabulary classification order first, then descending count', () => {
    const findings = [
      finding({ id: 'a', capdan: 'Relocate' }),
      finding({ id: 'b', capdan: 'Relocate', category: 'Reports' }),
      finding({ id: 'c', capdan: 'Relocate', category: 'Reports' }),
      finding({ id: 'd', capdan: 'Common' }),
    ];
    const tags = categoryTags(findings, 'Data', classification);
    expect(tags.map((t) => [t.capdan, t.category])).toEqual([
      ['Common', 'Persistence'],
      ['Relocate', 'Reports'], // count 2 before count 1 within Relocate
      ['Relocate', 'Persistence'],
    ]);
  });

  it('ranks classifications missing from the vocabulary last', () => {
    const findings = [
      finding({ id: 'x', capdan: 'Mystery', category: 'M' }),
      finding({ id: 'y', capdan: 'Relocate', category: 'R' }),
    ];
    const tags = categoryTags(findings, 'Data', classification);
    expect(tags.map((t) => t.capdan)).toEqual(['Relocate', 'Mystery']);
  });

  it('filters by anatomy view when given, defaulting a missing view to COMPONENT', () => {
    const findings = [
      finding({ id: 'c1' }), // COMPONENT
      finding({ id: 'c2', view: null }), // missing → COMPONENT
      finding({ id: 'b1', view: 'BEHAVIOR', category: 'Validation rules' }),
    ];
    const comp = categoryTags(findings, 'Data', classification, 'app1', 'COMPONENT');
    expect(comp).toHaveLength(1);
    expect(comp[0].findings.map((f) => f.id)).toEqual(['c1', 'c2']);
    const beh = categoryTags(findings, 'Data', classification, 'app1', 'BEHAVIOR');
    expect(beh.map((t) => t.category)).toEqual(['Validation rules']);
    // no view → all findings, unchanged behavior
    expect(categoryTags(findings, 'Data', classification, 'app1')).toHaveLength(2);
  });
});
