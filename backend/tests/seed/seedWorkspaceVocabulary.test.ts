// Vocabulary completeness per domain — the token sets are the frozen contract
// (plan §6.4); Agents 2/3 render the board axis/chips/legend from these rows.
import { describe, expect, it } from 'vitest';
import {
  buildVocabularyRows,
  PRODUCT_COMPONENTS,
  type VocabRow,
} from '../../src/seed/seedWorkspaceVocabulary.js';

const rows = buildVocabularyRows();
const tokens = (domain: VocabRow['domain'], kind: VocabRow['kind']) =>
  rows.filter((r) => r.domain === domain && r.kind === kind).map((r) => r.token);

describe('buildVocabularyRows', () => {
  it('covers every contract kind in both domains', () => {
    const kinds = [
      'LAYER',
      'CLASSIFICATION',
      'STATUS',
      'MODE',
      'VIEW',
      'DISPOSITION',
      'MATCH_STATUS',
    ] as const;
    for (const domain of ['APPLICATION', 'PRODUCT_MODEL'] as const) {
      for (const kind of kinds) {
        expect(tokens(domain, kind).length, `${domain}/${kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('APPLICATION layer axis matches the frozen §6.4 tokens in order', () => {
    expect(tokens('APPLICATION', 'LAYER')).toEqual([
      'UI',
      'Integration',
      'Business Service',
      'Data',
      'Infrastructure',
    ]);
  });

  it('APPLICATION classification is the CAPDAN set', () => {
    expect(tokens('APPLICATION', 'CLASSIFICATION')).toEqual([
      'Common',
      'Different',
      'Relocate',
      'Eliminate',
    ]);
  });

  it('PRODUCT_MODEL layer axis is the 11 product components in order', () => {
    expect(tokens('PRODUCT_MODEL', 'LAYER')).toEqual([...PRODUCT_COMPONENTS]);
    expect(PRODUCT_COMPONENTS).toHaveLength(11);
  });

  it('PRODUCT_MODEL classification carries the wireframe scope colors', () => {
    const cls = rows.filter((r) => r.domain === 'PRODUCT_MODEL' && r.kind === 'CLASSIFICATION');
    expect(cls.map((r) => [r.token, r.color])).toEqual([
      ['Common', 'blue'],
      ['Segment', 'amber'],
      ['Geography', 'slate'],
      ['Eliminate', 'rose'],
    ]);
  });

  it('match statuses are AUTO | REVIEW | HELD with legend meta in both domains', () => {
    for (const domain of ['APPLICATION', 'PRODUCT_MODEL'] as const) {
      const ms = rows.filter((r) => r.domain === domain && r.kind === 'MATCH_STATUS');
      expect(ms.map((r) => r.token)).toEqual(['AUTO', 'REVIEW', 'HELD']);
      for (const r of ms) {
        expect(r.meta, `${domain}/${r.token} legend`).toMatchObject({ legend: expect.any(String) });
      }
    }
  });

  it('migration statuses and dispositions match the board ladders', () => {
    for (const domain of ['APPLICATION', 'PRODUCT_MODEL'] as const) {
      expect(tokens(domain, 'STATUS')).toEqual([
        'Identified',
        'In Analysis',
        'Normalized',
        'In Migration',
        'Migrated',
        'Retired',
      ]);
      expect(tokens(domain, 'DISPOSITION')).toEqual(['Retain', 'Refactor', 'Replace', 'Retire']);
    }
  });

  it('PRODUCT_MODEL modes are the three inspection modes', () => {
    const modes = rows.filter((r) => r.domain === 'PRODUCT_MODEL' && r.kind === 'MODE');
    expect(modes.map((r) => r.label)).toEqual(['Legacy Product Models', 'Segment', 'Geography']);
  });

  it('APPLICATION scaffold rows replace the GF_NEW/COMP_NEW route literals', () => {
    const scaffolds = rows.filter((r) => r.domain === 'APPLICATION' && r.kind === 'SCAFFOLD');
    expect(scaffolds.map((r) => r.token)).toEqual([
      'UI',
      'Integration',
      'Business Service',
      'Data',
      'Infrastructure',
    ]);
    for (const s of scaffolds) {
      expect(s.meta).toMatchObject({
        suffix: expect.any(String),
        kind: expect.any(String),
        tech: expect.any(String),
        owner: expect.any(String),
        component: expect.any(String),
      });
    }
  });

  it('has no duplicate (domain, kind, token) keys', () => {
    const keys = rows.map((r) => `${r.domain}|${r.kind}|${r.token}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
