// stats — the v3 board header roll-ups: client-side column stats fallback,
// header formatting, server-vs-client Normalize stats selection and the
// dead-code lane grouping.
import { describe, expect, it } from 'vitest';
import {
  clientColumnStat,
  columnStatSummary,
  columnDeadLabel,
  deadCodeGroups,
  normalizeHeaderStats,
} from '../../../src/pages/workspace-map/stats';
import type { BoardApp, Finding } from '../../../src/pages/workspace-map/types';

const finding = (over: Partial<Finding>): Finding => ({
  id: 'f',
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
  name: 'step',
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

const app = (id: string, name: string): BoardApp => ({
  id,
  name,
  kind: 'LEGACY',
  techStack: null,
  disposition: null,
  position: 0,
});

describe('clientColumnStat', () => {
  it('mirrors the backend split: dead apart, Relocate/Eliminate move, rest correct', () => {
    const s = clientColumnStat('a1', [
      finding({ id: '1' }),
      finding({ id: '2', capdan: 'Different' }),
      finding({ id: '3', capdan: 'Relocate' }),
      finding({ id: '4', capdan: 'Eliminate' }),
      finding({ id: '5', capdan: 'Relocate', deadCode: true }),
    ]);
    expect(s).toEqual({ sourceId: 'a1', rawSteps: 5, correct: 2, move: 2, deadCode: 1 });
  });
});

describe('column header formatting', () => {
  const stat = { sourceId: 'a1', rawSteps: 80, correct: 43, move: 17, deadCode: 3 };

  it('formats steps · correct · move', () => {
    expect(columnStatSummary(stat)).toBe('80 steps · 43 correct · 17 move');
  });

  it('labels dead code only when present', () => {
    expect(columnDeadLabel(stat)).toBe('3 dead code');
    expect(columnDeadLabel({ ...stat, deadCode: 0 })).toBeNull();
  });
});

describe('normalizeHeaderStats', () => {
  const server = { raw: 102, normalized: 58, awaitingReview: 5 };
  const client = { raw: 40, normalized: 22, awaitingReview: 1 };

  it('prefers the server roll-up for a whole-board scope', () => {
    expect(normalizeHeaderStats(server, client, true)).toBe(server);
  });

  it('recomputes client-side for narrowed scopes or when the field is absent', () => {
    expect(normalizeHeaderStats(server, client, false)).toBe(client);
    expect(normalizeHeaderStats(null, client, true)).toBe(client);
    expect(normalizeHeaderStats(undefined, client, true)).toBe(client);
  });
});

describe('deadCodeGroups', () => {
  const apps = [app('a1', 'ClaimsLegacy'), app('a2', 'PolicyHub')];

  it('groups dead findings per source, in apps order, dropping clean sources', () => {
    const groups = deadCodeGroups(
      [
        finding({ id: '1', appId: 'a2', deadCode: true }),
        finding({ id: '2', appId: 'a1' }),
        finding({ id: '3', appId: 'a2', deadCode: true }),
      ],
      apps,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].appName).toBe('PolicyHub');
    expect(groups[0].findings.map((f) => f.id)).toEqual(['1', '3']);
  });

  it('is empty when nothing is dead', () => {
    expect(deadCodeGroups([finding({ id: '1' })], apps)).toEqual([]);
  });
});
