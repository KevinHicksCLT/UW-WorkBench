import { describe, expect, it } from 'vitest';
import {
  buildTarget,
  columnKeySets,
  dedupeTasks,
  makeKeyOf,
  recommendedTarget,
  roleFacts,
  roleRecs,
  roleShort,
  stepFate,
  type RoleColumnInput,
  type RoleTask,
} from '../../../src/pages/workspace-map/spine/roleConsolidation';

// The Roles lens consolidation engine: facts, target recommendation, per-step
// fates and the resulting target role (fuzzy canonical keys via makeKeyOf).

const t = (id: string, name: string, vs = 'Compliance', involvement = 'Owner'): RoleTask => ({
  id,
  name,
  involvement,
  valueStream: vs,
  l3: 'Area',
  l4: 'Sub',
  apps: [],
  agent: null,
});

const analyst: RoleColumnInput = {
  id: 'r1',
  name: 'Compliance Analyst',
  subtitle: null,
  tasks: [
    t('1', 'Aggregate compliance metrics'),
    t('2', 'Classify issue severity'),
    t('3', 'Sample transactions for control testing', 'Control Testing'),
  ],
};
const manager: RoleColumnInput = {
  id: 'r2',
  name: 'Compliance Manager',
  subtitle: null,
  tasks: [
    t('4', 'Aggregate compliance metrics'),
    t('5', 'Classify issue severity'),
    t('6', 'Approve the annual audit plan'),
    t('7', 'Escalate breaches to the risk committee', 'Governance'),
  ],
};
const cols = [analyst, manager];
const keyOf = makeKeyOf(cols);

describe('roleFacts / recommendedTarget', () => {
  it('counts duplicated vs sole work and picks the covering role as target', () => {
    const facts = roleFacts(cols, keyOf);
    expect(facts[0]).toMatchObject({ steps: 3, dup: 2, only: 1, streams: 2 });
    expect(facts[1]).toMatchObject({ steps: 4, dup: 2, only: 2, streams: 2 });
    // Equal coverage both ways (2 each) — the bigger role wins the tie.
    expect(recommendedTarget(cols, keyOf)).toBe(1);
  });

  it('recommends consolidation only past the overlap threshold', () => {
    const recs = roleRecs(cols, roleFacts(cols, keyOf), 1, keyOf);
    expect(recs[1].rec).toBe('TARGET');
    // 2 of the analyst's 3 steps (67%) already live in the manager.
    expect(recs[0].rec).toBe('CONSOLIDATE');
  });
});

describe('stepFate', () => {
  it('labels covered, moving and staying steps under the decisions', () => {
    const keySets = columnKeySets(cols, keyOf);
    const going = [true, false];
    expect(stepFate(analyst.tasks[0], 0, cols, keySets, going, 1, keyOf).kind).toBe('covered');
    expect(stepFate(analyst.tasks[2], 0, cols, keySets, going, 1, keyOf).kind).toBe('moves');
    expect(stepFate(manager.tasks[2], 1, cols, keySets, going, 1, keyOf).kind).toBe('stays');
  });
});

describe('buildTarget', () => {
  it('folds a consolidating role into the target with provenance', () => {
    const { steps, merged, moved } = buildTarget(cols, [true, false], 1, {}, keyOf);
    // Manager's 4 + analyst's 1 unique moved in; 2 analyst steps merged away.
    expect(steps).toHaveLength(5);
    expect(merged).toBe(2);
    expect(moved).toBe(1);
    const agg = steps.find((s) => s.name.startsWith('Aggregate'));
    expect(agg?.badge).toBe('merged');
    expect(agg?.sources.map((s) => s.id).sort()).toEqual(['r1', 'r2']);
    const sample = steps.find((s) => s.name.startsWith('Sample'));
    expect(sample?.badge).toBe('moved');
  });

  it('honors per-step Keep and Drop overrides', () => {
    const { steps } = buildTarget(cols, [true, false], 1, { 'r1:3': 'Drop' }, keyOf);
    expect(steps.find((s) => s.name.startsWith('Sample'))).toBeUndefined();
    const kept = buildTarget(cols, [true, false], 1, { 'r1:3': 'Keep' }, keyOf);
    expect(kept.steps.find((s) => s.name.startsWith('Sample'))).toBeUndefined();
    expect(kept.moved).toBe(0);
  });

  it('returns only the target set when nothing consolidates', () => {
    const { steps, merged, moved } = buildTarget(cols, [false, false], 1, {}, keyOf);
    expect(steps).toHaveLength(4);
    expect(merged).toBe(0);
    expect(moved).toBe(0);
  });
});

describe('helpers', () => {
  it('builds short role codes and dedupes Owner/Participant task rows', () => {
    expect(roleShort('Compliance Analyst')).toBe('CA');
    expect(roleShort('Analyst')).toBe('ANA');
    const deduped = dedupeTasks([
      t('1', 'Same task', 'VS', 'Participant'),
      t('1', 'Same task', 'VS', 'Owner'),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].involvement).toBe('Owner');
  });
});
