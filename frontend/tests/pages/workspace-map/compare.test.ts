import { describe, expect, it } from 'vitest';
import {
  computeCrossAppEntries,
  computeFunctionalAreas,
  CORE_AREA,
  matchScreensAcrossApps,
  synthesizeGreenfield,
  UNIFIED_GF_ID,
} from '../../../src/pages/workspace-map/compare';
import type { BoardScreen, Finding } from '../../../src/pages/workspace-map/types';

const finding = (over: Partial<Finding>): Finding => ({
  id: 'f1',
  appId: 'a1',
  layer: 'UI',
  category: null,
  view: null,
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  capdan: 'Common',
  targetLayer: null,
  sharedServiceId: null,
  name: 'Step',
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

const screen = (over: Partial<BoardScreen>): BoardScreen => ({
  id: 's1',
  appId: 'a1',
  name: 'Screen',
  kind: 'SCREEN',
  url: null,
  processNodeId: null,
  ...over,
});

describe('computeCrossAppEntries', () => {
  it('consolidates same-named steps from different applications', () => {
    const entries = computeCrossAppEntries([
      finding({ id: 'f1', appId: 'a1', name: 'Validate login' }),
      finding({ id: 'f2', appId: 'a2', name: 'validate_login()' }),
      finding({ id: 'f3', appId: 'a1', name: 'Only in app one' }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].findingIds.sort()).toEqual(['f1', 'f2']);
    expect(entries[0].matchStatus).toBe('AUTO');
    expect(entries[0].componentId).toBe('cmp:c:UI');
  });

  it('returns no entries when the applications share nothing', () => {
    const entries = computeCrossAppEntries([
      finding({ id: 'f1', appId: 'a1', name: 'Alpha' }),
      finding({ id: 'f2', appId: 'a2', name: 'Beta' }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it('never merges same-named steps inside ONE application', () => {
    const entries = computeCrossAppEntries([
      finding({ id: 'f1', appId: 'a1', name: 'Login' }),
      finding({ id: 'f2', appId: 'a1', name: 'Login' }),
    ]);
    expect(entries).toHaveLength(0);
  });
});

describe('matchScreensAcrossApps', () => {
  const screens = [
    screen({ id: 's1', appId: 'a1', name: 'Login' }),
    screen({ id: 's2', appId: 'a2', name: 'Login Page' }),
    screen({ id: 's3', appId: 'a2', name: 'Claims Review' }),
    screen({ id: 's4', appId: 'a3', name: 'Billing' }),
  ];

  it('matches the semantically similar screen of the other application', () => {
    const m = matchScreensAcrossApps(screens, 'a1', 'Login');
    expect(m.get('a2')).toBe('Login Page');
    expect(m.has('a3')).toBe(false); // Billing is not Login
  });

  it('never matches a screen back to the walked application', () => {
    const m = matchScreensAcrossApps(screens, 'a2', 'Login Page');
    expect(m.get('a1')).toBe('Login');
    expect(m.has('a2')).toBe(false);
  });

  it('ignores unrelated names below the similarity threshold', () => {
    const m = matchScreensAcrossApps(screens, 'a1', 'Dashboard');
    expect(m.size).toBe(0);
  });
});

describe('computeFunctionalAreas', () => {
  it('clusters matching screens across apps into one area and buckets the rest', () => {
    const screens = [
      screen({ id: 's1', appId: 'a1', name: 'Login' }),
      screen({ id: 's2', appId: 'a2', name: 'Login Page' }),
      screen({ id: 's3', appId: 'a2', name: 'Claims Review' }),
    ];
    const findings = [
      finding({ id: 'f1', appId: 'a1', screenRef: 'Login' }),
      finding({ id: 'f2', appId: 'a2', screenRef: 'Login Page' }),
      finding({ id: 'f3', appId: 'a2', screenRef: 'Claims Review' }),
      finding({ id: 'f4', appId: 'a2', screenRef: null }),
    ];
    const { areaOf, order } = computeFunctionalAreas(screens, findings, ['Claims Review', 'Login']);
    // Both login screens fall into ONE area, labelled by the dropdown's name.
    expect(areaOf.get('f1')).toBe('Login');
    expect(areaOf.get('f2')).toBe('Login');
    expect(areaOf.get('f3')).toBe('Claims Review');
    expect(areaOf.get('f4')).toBe(CORE_AREA);
    // Areas render in the screen dropdown's order, Core services last.
    expect(order).toEqual(['Claims Review', 'Login', CORE_AREA]);
  });

  it('sorts screens the dropdown does not list after the dropdown ones', () => {
    const screens = [
      screen({ id: 's1', appId: 'a1', name: 'Login' }),
      screen({ id: 's2', appId: 'a2', name: 'Billing' }),
    ];
    const findings = [
      finding({ id: 'f1', appId: 'a1', screenRef: 'Login' }),
      finding({ id: 'f2', appId: 'a2', screenRef: 'Billing' }),
    ];
    const { order } = computeFunctionalAreas(screens, findings, ['Login']);
    expect(order).toEqual(['Login', 'Billing']);
  });
});

describe('synthesizeGreenfield', () => {
  it('builds ONE platform whose slot is only as far along as the slowest board', () => {
    const boards = [
      {
        components: [
          {
            id: 'c1',
            layer: 'UI',
            name: 'A UI',
            destination: null,
            microserviceId: 'm1',
            migrationStatus: 'Migrated',
            targetDate: null,
          },
        ],
      },
      {
        components: [
          {
            id: 'c2',
            layer: 'UI',
            name: 'B UI',
            destination: null,
            microserviceId: 'm2',
            migrationStatus: 'Identified',
            targetDate: '2027-01-01',
          },
        ],
      },
    ];
    // Only the fields synthesizeGreenfield reads are provided.
    const { microservice, components } = synthesizeGreenfield(boards as never);
    expect(microservice.id).toBe(UNIFIED_GF_ID);
    expect(components).toHaveLength(1);
    expect(components[0].migrationStatus).toBe('Identified');
    expect(components[0].targetDate).toBe('2027-01-01');
    expect(components[0].microserviceId).toBe(UNIFIED_GF_ID);
  });
});
