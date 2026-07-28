import { describe, expect, it } from 'vitest';
import { buildReconciliation } from '../../../src/pages/workspace-map/spine/spineCompare';
import {
  defaultDecision,
  flowSteps,
} from '../../../src/pages/workspace-map/spine/VsNewProcessFlow';

// The Value-streams reconciliation engine: two streams' phase-aligned steps
// matched into canonical rows with merge / order-differs / only-one verdicts,
// and the surviving steps flattened into the new-process flow.

const task = (id: string, name: string, owner = 'Analyst', apps: string[] = ['ServiceNow']) => ({
  id,
  name,
  owner,
  apps,
});

const laneA = {
  id: 'svc',
  stages: [
    {
      id: 'sA1',
      name: 'Alert intake',
      subs: [
        {
          name: 'Monitoring',
          tasks: [
            task('a1', 'Watch the monitoring dashboards'),
            task('a2', 'Acknowledge the new alert'),
            task('a3', 'Correlate related alerts'),
            task('a4', 'Route the event to the correct group'),
          ],
        },
      ],
    },
  ],
};

const laneB = {
  id: 'ai',
  stages: [
    {
      id: 'sB1',
      name: 'Alert intake & scoring',
      subs: [
        {
          name: 'Event intelligence',
          tasks: [
            task('b1', 'Ingest the raw alert stream', 'AIOps Engineer', ['Azure']),
            task('b2', 'Correlate related alerts', 'AIOps Engineer', ['Azure']),
            task('b3', 'Score the event severity', 'AIOps Engineer'),
            task('b4', 'Route the event to the correct group', 'AIOps Engineer'),
          ],
        },
      ],
    },
  ],
};

describe('buildReconciliation', () => {
  it('pairs same-named steps and flags order differences', () => {
    const phases = buildReconciliation(laneA, laneB);
    expect(phases).toHaveLength(1);
    const rows = phases[0].rows;

    const correlate = rows.find((r) => r.canonName.startsWith('Correlate'));
    expect(correlate?.a?.seq).toBe(3);
    expect(correlate?.b?.seq).toBe(2);
    expect(correlate?.verdict).toBe('merge'); // |3-2| < 2 — same point in flow

    const route = rows.find((r) => r.canonName.startsWith('Route'));
    expect(route?.verdict).toBe('merge');
    expect(route?.a?.seq).toBe(4);
    expect(route?.b?.seq).toBe(4);

    const ack = rows.find((r) => r.canonName.startsWith('Acknowledge'));
    expect(ack?.verdict).toBe('onlyA');
    const score = rows.find((r) => r.canonName.startsWith('Score'));
    expect(score?.verdict).toBe('onlyB');
  });

  it('marks a pair as order-differs past the resequence delta', () => {
    const a = {
      id: 'x',
      stages: [
        {
          id: 's1',
          name: 'Phase',
          subs: [
            {
              name: 'Sub',
              tasks: [
                task('a1', 'Tune the rules'),
                task('a2', 'Step two'),
                task('a3', 'Step three'),
              ],
            },
          ],
        },
      ],
    };
    const b = {
      id: 'y',
      stages: [
        {
          id: 's2',
          name: 'Phase',
          subs: [
            {
              name: 'Sub',
              tasks: [
                task('b1', 'Step two'),
                task('b2', 'Step three'),
                task('b3', 'Tune the rules'),
              ],
            },
          ],
        },
      ],
    };
    const rows = buildReconciliation(a, b)[0].rows;
    const tune = rows.find((r) => r.canonName.startsWith('Tune'));
    expect(tune?.verdict).toBe('order'); // #1 here, #3 there
  });
});

describe('flowSteps', () => {
  it('merges, keeps both variants on Keep, and drops on Drop', () => {
    const rows = buildReconciliation(laneA, laneB)[0].rows;
    const merged = flowSteps(rows, defaultDecision, ['#0f766e', '#7c3aed'], ['#fff', '#fff']);
    // 2 merged pairs + 2 solo = 6 rows → 6 steps under default decisions.
    expect(merged).toHaveLength(6);
    const correlate = merged.find((s) => s.name.startsWith('Correlate'));
    expect(correlate?.sources).toHaveLength(2);
    expect(correlate?.badge).toBe('merged 2→1');
    // Apps union on a merged step.
    expect(correlate?.apps).toContain('ServiceNow');
    expect(correlate?.apps).toContain('Azure');

    const keepAll = flowSteps(rows, () => 'Keep', ['#0f766e', '#7c3aed'], ['#fff', '#fff']);
    expect(keepAll).toHaveLength(8); // every stream step carried separately

    const dropAll = flowSteps(rows, () => 'Drop', ['#0f766e', '#7c3aed'], ['#fff', '#fff']);
    expect(dropAll).toHaveLength(0);
  });
});
