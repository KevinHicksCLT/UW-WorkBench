// fixtures — the §6.4 vocabulary seed contract and the §6.2 product demo
// board must stay internally consistent (they are what the board renders
// until Agent 2's endpoints land, and what the unit suite builds against).
import { describe, expect, it } from 'vitest';
import {
  fixtureProductAnatomy,
  fixtureProductModels,
  fixtureProductWorkspace,
  fixtureVocabulary,
} from '../../../src/pages/greenfield-migration/fixtures';
import { layersFrom } from '../../../src/lib/rationalization';

describe('vocabulary fixture (§6.4 frozen tokens)', () => {
  it('carries the APPLICATION contract tokens', () => {
    const rows = fixtureVocabulary('APPLICATION');
    expect(layersFrom(rows)).toEqual([
      'UI',
      'Integration',
      'Business Service',
      'Data',
      'Infrastructure',
    ]);
    expect(rows.filter((r) => r.kind === 'CLASSIFICATION').map((r) => r.token)).toEqual([
      'Common',
      'Different',
      'Relocate',
      'Eliminate',
    ]);
    expect(rows.filter((r) => r.kind === 'MATCH_STATUS').map((r) => r.token)).toEqual([
      'AUTO',
      'REVIEW',
      'HELD',
    ]);
  });

  it('carries the PRODUCT_MODEL contract tokens (11 components, scopes, modes, dispositions)', () => {
    const rows = fixtureVocabulary('PRODUCT_MODEL');
    expect(layersFrom(rows)).toEqual([
      'Party & Roles',
      'Product Hierarchy',
      'Coverage & Perils',
      'Limits & Deductibles',
      'Rating & Pricing',
      'Forms & Wordings',
      'Eligibility & UW Rules',
      'Exposures & Schedules',
      'Reinsurance & Layering',
      'Regulatory & Filings',
      'Distribution',
    ]);
    expect(rows.filter((r) => r.kind === 'CLASSIFICATION').map((r) => r.token)).toEqual([
      'Common',
      'Segment',
      'Geography',
      'Eliminate',
    ]);
    expect(rows.filter((r) => r.kind === 'MODE').map((r) => r.token)).toEqual([
      'Legacy Product Models',
      'Segment',
      'Geography',
    ]);
    expect(rows.filter((r) => r.kind === 'DISPOSITION').map((r) => r.token)).toEqual([
      'Retain',
      'Refactor',
      'Replace',
      'Retire',
    ]);
  });

  it('legend metadata exists for the wireframe legend chips', () => {
    const legends = fixtureVocabulary().filter((r) => typeof r.meta?.legend === 'string');
    expect(legends.length).toBeGreaterThanOrEqual(4);
  });
});

describe('product workspace fixture (§6.2 shape + referential integrity)', () => {
  const w = fixtureProductWorkspace();
  const models = fixtureProductModels();
  const layers = layersFrom(fixtureVocabulary('PRODUCT_MODEL'));

  it('is a PRODUCT_MODEL board whose sources are the fixture product models', () => {
    expect(w.domain).toBe('PRODUCT_MODEL');
    expect(w.apps.map((a) => a.id).sort()).toEqual(models.map((m) => m.id).sort());
  });

  it('every finding sits on a vocabulary layer of a known source, scope = capdan', () => {
    const appIds = new Set(w.apps.map((a) => a.id));
    for (const f of w.findings) {
      expect(appIds.has(f.appId)).toBe(true);
      expect(layers).toContain(f.layer);
      expect(f.scope).toBe(f.capdan);
    }
  });

  it('normalization entries reference existing findings on their own layer', () => {
    const byId = new Map(w.findings.map((f) => [f.id, f]));
    for (const e of w.normalizationEntries ?? []) {
      expect(layers).toContain(e.layer);
      expect(e.findingIds.length).toBeGreaterThan(0);
      for (const id of e.findingIds) {
        const f = byId.get(id);
        expect(f, `entry ${e.notation} references missing finding ${id}`).toBeDefined();
        expect(f?.layer).toBe(e.layer);
      }
      if (e.componentId) expect(w.components.some((c) => c.id === e.componentId)).toBe(true);
    }
  });

  it('components map onto vocabulary layers and existing canonical models', () => {
    const msIds = new Set(w.microservices.map((m) => m.id));
    for (const c of w.components) {
      expect(layers).toContain(c.layer);
      if (c.microserviceId) expect(msIds.has(c.microserviceId)).toBe(true);
    }
  });

  it('carries dead-code findings for the dead lane and HELD/REVIEW entries for review cards', () => {
    expect(w.findings.filter((f) => f.deadCode).length).toBeGreaterThanOrEqual(3);
    const statuses = new Set((w.normalizationEntries ?? []).map((e) => e.matchStatus));
    expect(statuses.has('AUTO')).toBe(true);
    expect(statuses.has('REVIEW')).toBe(true);
    expect(statuses.has('HELD')).toBe(true);
  });

  it('anatomy rows sit on vocabulary layers with scoped sub-categories', () => {
    for (const a of fixtureProductAnatomy()) {
      expect(layers).toContain(a.layer);
      expect(['COMMON', 'SEGMENT', 'GEOGRAPHY']).toContain(a.scope);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });
});
