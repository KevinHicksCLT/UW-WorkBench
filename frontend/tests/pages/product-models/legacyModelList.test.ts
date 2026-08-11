import { describe, expect, it } from 'vitest';
import {
  dispositionTone,
  summarizeModels,
  workspaceNames,
  type LegacyProductModel,
} from '../../../src/pages/product-models/legacyModelList';

const model = (over: Partial<LegacyProductModel>): LegacyProductModel => ({
  id: 'm1',
  name: 'PolicyPro — Commercial Package (East)',
  description: null,
  sourceSystem: 'PolicyPro (C# / .NET 4.7, SQL Server)',
  segment: 'SMB',
  geography: 'US-East',
  disposition: 'Replace',
  workspaces: [{ id: 'w1', name: 'Product Model Rationalization' }],
  findingCount: 12,
  illustrative: true,
  ...over,
});

describe('dispositionTone', () => {
  it('maps each seeded disposition token to its pill tone', () => {
    expect(dispositionTone('Retain')).toBe('green');
    expect(dispositionTone('Refactor')).toBe('blue');
    expect(dispositionTone('Replace')).toBe('amber');
    expect(dispositionTone('Retire')).toBe('red');
  });

  it('falls back to neutral for missing or unknown tokens', () => {
    expect(dispositionTone(null)).toBe('slate');
    expect(dispositionTone('Rewrite')).toBe('slate');
  });
});

describe('workspaceNames', () => {
  it('returns every workspace name for the multi-valued column', () => {
    const m = model({
      workspaces: [
        { id: 'w1', name: 'Product Model Rationalization' },
        { id: 'w2', name: 'Annuity Consolidation' },
      ],
    });
    expect(workspaceNames(m)).toEqual(['Product Model Rationalization', 'Annuity Consolidation']);
  });

  it('returns an empty list for a model on no board', () => {
    expect(workspaceNames(model({ workspaces: [] }))).toEqual([]);
  });
});

describe('summarizeModels', () => {
  it('counts distinct source systems and outbound (Replace/Retire) models', () => {
    const rows = [
      model({ id: 'a', sourceSystem: 'PolicyPro', disposition: 'Replace' }),
      model({ id: 'b', sourceSystem: 'PolicyPro', disposition: 'Retain' }),
      model({ id: 'c', sourceSystem: 'QuoteMaster', disposition: 'Retire' }),
      model({ id: 'd', sourceSystem: null, disposition: 'Refactor' }),
    ];
    expect(summarizeModels(rows)).toBe('2 source systems · 2 to replace or retire');
  });

  it('handles an empty visible set', () => {
    expect(summarizeModels([])).toBe('0 source systems · 0 to replace or retire');
  });
});
