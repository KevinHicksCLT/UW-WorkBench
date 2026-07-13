// lib/ontology/matcher — name normalization, concept matching, and the
// AUTO / REVIEW / HELD verdict table that powers the Normalize column.
import { describe, expect, it } from 'vitest';
import {
  matchConcept,
  matchItems,
  normalizeName,
  tokenComparator,
  type Concept,
  type NameComparator,
  type RawItem,
} from '../../../src/lib/ontology/matcher.js';

const CONCEPTS: Concept[] = [
  { slug: 'pma-loss-capture-form', label: 'Loss Capture Form', altLabels: ['Loss Intake Form'] },
  { slug: 'pma-beneficiary-entry', label: 'Beneficiary Entry' },
  { slug: 'pma-eligibility-rule', label: 'Annuity Eligibility Rule' },
];

const item = (over: Partial<RawItem> & Pick<RawItem, 'id' | 'sourceId' | 'name'>): RawItem => over;

describe('normalizeName', () => {
  it('casefolds, strips punctuation and stopwords, singularizes', () => {
    expect(normalizeName('The Loss-Capture Forms (v2)')).toBe('loss capture form v2');
    expect(normalizeName('Beneficiaries of the Policy')).toBe('beneficiary policy');
    expect(normalizeName('Eligibility rules for annuities')).toBe('eligibility rule annuity');
  });

  it('keeps double-s words and short tokens intact', () => {
    expect(normalizeName('Business Address')).toBe('business address');
    expect(normalizeName('GIS Ops')).toBe('gis ops');
  });
});

describe('tokenComparator', () => {
  it('scores identical-after-normalization names at 1', () => {
    expect(tokenComparator.similarity('Loss Capture Forms', 'loss capture form')).toBe(1);
  });

  it('scores disjoint names at 0 and partial overlap in between', () => {
    expect(tokenComparator.similarity('Premium Tax', 'Beneficiary Entry')).toBe(0);
    const partial = tokenComparator.similarity('Loss Capture Form', 'Loss Capture Screen');
    expect(partial).toBeGreaterThan(0.4);
    expect(partial).toBeLessThan(1);
  });
});

describe('matchConcept', () => {
  it('matches exact normalized labels and altLabels', () => {
    expect(matchConcept('loss capture forms', CONCEPTS)).toBe('pma-loss-capture-form');
    expect(matchConcept('Loss Intake Form', CONCEPTS)).toBe('pma-loss-capture-form');
  });

  it('returns null when nothing clears the auto threshold', () => {
    expect(matchConcept('Surrender Charge Schedule', CONCEPTS)).toBeNull();
  });
});

describe('matchItems — verdict table', () => {
  it('AUTO: two sources, same concept, identical attributes', () => {
    const groups = matchItems(
      [
        item({
          id: 'f1',
          sourceId: 'claims-legacy',
          name: 'Loss Capture Form',
          attributes: { fields: 14, layout: 'single-page' },
        }),
        item({
          id: 'f2',
          sourceId: 'fnol-portal',
          name: 'Loss capture form',
          attributes: { fields: 14, layout: 'single-page' },
        }),
      ],
      CONCEPTS,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('AUTO');
    expect(groups[0].conceptSlug).toBe('pma-loss-capture-form');
    expect(groups[0].matchBasis).toBe('2→1 semantically same — all 2 attributes match');
  });

  it('REVIEW: same concept but attribute deltas', () => {
    const groups = matchItems(
      [
        item({
          id: 'f1',
          sourceId: 'a',
          name: 'Annuity Eligibility Rule',
          attributes: { maxIssueAge: 78, premiumMin: 5000 },
        }),
        item({
          id: 'f2',
          sourceId: 'b',
          name: 'Annuity eligibility rules',
          attributes: { maxIssueAge: 85, premiumMin: 5000 },
        }),
      ],
      CONCEPTS,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('REVIEW');
    expect(groups[0].differenceNote).toContain('maxIssueAge');
    expect(groups[0].differenceNote).not.toContain('premiumMin');
  });

  it('HELD: related names with no concept agreement', () => {
    const groups = matchItems(
      [
        item({ id: 'f1', sourceId: 'a', name: 'Surrender charge tiered schedule' }),
        item({ id: 'f2', sourceId: 'b', name: 'Surrender charge flat schedule' }),
      ],
      CONCEPTS,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('HELD');
    expect(groups[0].conceptSlug).toBeNull();
    expect(groups[0].differenceNote).toContain('held for sign-off');
  });

  it('AUTO single-source: lone items carry over without reconciliation', () => {
    const groups = matchItems(
      [item({ id: 'f1', sourceId: 'a', name: 'Premium factor table' })],
      CONCEPTS,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('AUTO');
    expect(groups[0].matchBasis).toBe('single source — carried over as-is');
  });

  it('keeps unrelated items in separate clusters', () => {
    const groups = matchItems(
      [
        item({ id: 'f1', sourceId: 'a', name: 'Beneficiary Entry' }),
        item({ id: 'f2', sourceId: 'b', name: 'Nightly batch feed' }),
      ],
      CONCEPTS,
    );
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.status)).toEqual(['AUTO', 'AUTO']);
  });

  it('honors an injected comparator (PM-09 swap point)', () => {
    const always: NameComparator = { similarity: () => 1 };
    const groups = matchItems(
      [
        item({ id: 'f1', sourceId: 'a', name: 'Completely unrelated' }),
        item({ id: 'f2', sourceId: 'b', name: 'Nothing in common' }),
      ],
      [],
      always,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('AUTO');
  });
});
