// rationalization — CAPDAN vocabulary + the pct/statusDot/categoryTags logic.
import { describe, expect, it } from 'vitest';
import {
  CAPDAN_META,
  CAPDAN_ORDER,
  categoryTags,
  LAYERS,
  pct,
  STATUS_ORDER,
  statusDot,
} from '../../src/lib/rationalization';
import type { Finding } from '../../src/lib/rationalization';

describe('vocabulary', () => {
  it('keeps the fixed layer and CAPDAN orders with meta for each class', () => {
    expect(LAYERS).toEqual(['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure']);
    expect(CAPDAN_ORDER).toEqual(['Common', 'Different', 'Relocate', 'Eliminate']);
    for (const c of CAPDAN_ORDER) expect(CAPDAN_META[c].label).toBe(c);
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('Retired');
  });
});

describe('pct / statusDot', () => {
  it('formats a 0..1 ratio as a rounded percent', () => {
    expect(pct(0.614)).toBe('61%');
    expect(pct(1)).toBe('100%');
  });

  it('maps lifecycle statuses to dots with a grey fallback', () => {
    expect(statusDot('Migrated')).toBe('#10b981');
    expect(statusDot('Unknown status')).toBe('#d4d4d4');
  });
});

describe('categoryTags', () => {
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
    name: 'f',
    codeRef: null,
    migrationApproach: null,
    rationale: null,
    effort: null,
    complexity: null,
    migrationStatus: 'Identified',
    ...over,
  });

  it('groups one cell (app × layer) into (category, capdan) tags with counts', () => {
    const findings = [
      finding({ id: 'f1' }),
      finding({ id: 'f2' }),
      finding({ id: 'f3', capdan: 'Eliminate' }),
      finding({ id: 'f4', category: null }), // → "Other"
      finding({ id: 'f5', layer: 'UI' }), // other layer → excluded
      finding({ id: 'f6', appId: 'app2' }), // other app → excluded when appId filter set
    ];

    const tags = categoryTags(findings, 'Data', 'app1');
    expect(tags.map((t) => [t.category, t.capdan, t.count])).toEqual([
      ['Persistence', 'Common', 2],
      ['Other', 'Common', 1],
      ['Persistence', 'Eliminate', 1],
    ]);
    expect(tags[0].findings.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('sorts by CAPDAN order first, then descending count', () => {
    const findings = [
      finding({ id: 'a', capdan: 'Eliminate' }),
      finding({ id: 'b', capdan: 'Eliminate', category: 'Reports' }),
      finding({ id: 'c', capdan: 'Eliminate', category: 'Reports' }),
      finding({ id: 'd', capdan: 'Common' }),
    ];
    const tags = categoryTags(findings, 'Data');
    expect(tags.map((t) => [t.capdan, t.category])).toEqual([
      ['Common', 'Persistence'],
      ['Eliminate', 'Reports'], // count 2 before count 1 within Eliminate
      ['Eliminate', 'Persistence'],
    ]);
  });

  it('includes every app when no appId filter is given', () => {
    const findings = [finding({ id: 'x' }), finding({ id: 'y', appId: 'app2' })];
    expect(categoryTags(findings, 'Data')).toHaveLength(1);
    expect(categoryTags(findings, 'Data')[0].count).toBe(2);
  });

  it('filters by anatomy view when given, defaulting a missing view to COMPONENT', () => {
    const findings = [
      finding({ id: 'c1' }), // COMPONENT
      finding({ id: 'c2', view: null }), // missing → COMPONENT
      finding({ id: 'b1', view: 'BEHAVIOR', category: 'Validation rules' }),
    ];
    const comp = categoryTags(findings, 'Data', 'app1', 'COMPONENT');
    expect(comp).toHaveLength(1);
    expect(comp[0].findings.map((f) => f.id)).toEqual(['c1', 'c2']);
    const beh = categoryTags(findings, 'Data', 'app1', 'BEHAVIOR');
    expect(beh.map((t) => t.category)).toEqual(['Validation rules']);
    // no view → all findings, unchanged behavior
    expect(categoryTags(findings, 'Data', 'app1')).toHaveLength(2);
  });
});
