// fieldMapping.ts — the field-plane suggestion engine. INV-F1 (do-not-map
// exclusion) is a spec invariant: a regression here ships mis-mapped
// signature anchors downstream, so it gets explicit coverage.
import { describe, expect, it } from 'vitest';
import {
  normalizeSourceName,
  scoreMapping,
  suggestMapping,
  type MappingCandidate,
} from '../../../src/lib/forms/fieldMapping.js';

const FEIN: MappingCandidate = {
  id: 'fd1',
  key: 'insured.tax.fein',
  stability: 'stable',
  optionValues: [],
};
const STATE: MappingCandidate = {
  id: 'fd2',
  key: 'policy.address.state',
  stability: 'stable',
  optionValues: ['NY', 'CA', 'TX'],
};
const DO_NOT_MAP: MappingCandidate = {
  id: 'fd3',
  key: 'insured.tax.fein.legacy',
  stability: 'do-not-map',
  optionValues: [],
};

describe('normalizeSourceName', () => {
  it('strips XFA engine prefixes and array suffixes (FORMS-LLR-019)', () => {
    expect(normalizeSourceName('topmostSubform[0].page1[0].InsuredFEIN[0]')).toBe('InsuredFEIN');
    expect(normalizeSourceName('PlainName')).toBe('PlainName');
  });
});

describe('scoreMapping', () => {
  it('persists all three signals and blends them 0.4/0.45/0.15', () => {
    const s = scoreMapping(
      { sourceName: 'InsuredFEIN', label: 'Insured FEIN', optionLabels: [] },
      FEIN,
    );
    expect(s.nameSim).toBeGreaterThan(0);
    expect(s.labelSim).toBeGreaterThan(0);
    expect(s.optionOverlap).toBe(0);
    expect(s.confidence).toBeCloseTo(0.4 * s.nameSim + 0.45 * s.labelSim, 3);
  });

  it('rewards option-set overlap for choice fields', () => {
    const withOptions = scoreMapping(
      { sourceName: 'State', label: 'State', optionLabels: ['NY', 'CA', 'TX'] },
      STATE,
    );
    const without = scoreMapping({ sourceName: 'State', label: 'State', optionLabels: [] }, STATE);
    expect(withOptions.optionOverlap).toBe(1);
    expect(withOptions.confidence).toBeGreaterThan(without.confidence);
  });
});

describe('suggestMapping', () => {
  it('picks the best-scoring candidate', () => {
    const s = suggestMapping(
      { sourceName: 'InsuredFEIN', label: 'Federal Employer ID (FEIN)', optionLabels: [] },
      [FEIN, STATE],
    );
    expect(s?.fieldDefinitionId).toBe('fd1');
  });

  it('NEVER suggests a do-not-map definition, even as the best match (INV-F1)', () => {
    const s = suggestMapping(
      { sourceName: 'insured.tax.fein.legacy', label: 'insured tax fein legacy', optionLabels: [] },
      [DO_NOT_MAP],
    );
    expect(s).toBeNull();
  });

  it('returns null when nothing clears the noise floor', () => {
    const s = suggestMapping({ sourceName: 'zzqx', label: null, optionLabels: [] }, [FEIN, STATE]);
    expect(s).toBeNull();
  });
});
