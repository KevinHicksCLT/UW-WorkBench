import { describe, expect, it } from 'vitest';
import { buildReconciliation } from '../../../src/pages/workspace-map/spine/spineCompare';
import {
  defaultDecision,
  flowSteps,
} from '../../../src/pages/workspace-map/spine/VsNewProcessFlow';

// The Value-streams reconciliation engine: N streams' phase-aligned steps
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

const laneC = {
  id: 'noc',
  stages: [
    {
      id: 'sC1',
      name: 'Alert intake desk',
      subs: [
        {
          name: 'NOC desk',
          tasks: [
            task('c1', 'Page the on-call engineer', 'NOC Operator'),
            task('c2', 'Correlate related alerts', 'NOC Operator', ['PagerDuty']),
          ],
        },
      ],
    },
  ],
};

describe('buildReconciliation (N-way)', () => {
  it('pairs same-named steps across two streams with per-lane cells', () => {
    const phases = buildReconciliation([laneA, laneB]);
    expect(phases).toHaveLength(1);
    const rows = phases[0].rows;

    const correlate = rows.find((r) => r.canonName.startsWith('Correlate'));
    expect(correlate?.cells[0]?.seq).toBe(3);
    expect(correlate?.cells[1]?.seq).toBe(2);
    expect(correlate?.presentIn).toBe(2);
    expect(correlate?.verdict).toBe('merge'); // spread 1 < 2 — same point in flow

    const ack = rows.find((r) => r.canonName.startsWith('Acknowledge'));
    expect(ack?.verdict).toBe('only');
    expect(ack?.onlyIdx).toBe(0);
    const score = rows.find((r) => r.canonName.startsWith('Score'));
    expect(score?.onlyIdx).toBe(1);
  });

  it('reconciles three streams — presentIn counts every carrier', () => {
    const phases = buildReconciliation([laneA, laneB, laneC]);
    const rows = phases.flatMap((p) => p.rows);
    const correlate = rows.find((r) => r.canonName.startsWith('Correlate'));
    expect(correlate?.presentIn).toBe(3);
    expect(correlate?.cells).toHaveLength(3);
    expect(correlate?.cells[2]?.owner).toBe('NOC Operator');

    const page = rows.find((r) => r.canonName.startsWith('Page'));
    expect(page?.presentIn).toBe(1);
    expect(page?.onlyIdx).toBe(2);
  });

  it('marks a pair as order-differs past the resequence delta', () => {
    const mk = (id: string, names: string[]) => ({
      id,
      stages: [
        {
          id: `${id}-s`,
          name: 'Phase',
          subs: [{ name: 'Sub', tasks: names.map((n, i) => task(`${id}${i}`, n)) }],
        },
      ],
    });
    const rows = buildReconciliation([
      mk('x', ['Tune the rules', 'Step two', 'Step three']),
      mk('y', ['Step two', 'Step three', 'Tune the rules']),
    ])[0].rows;
    const tune = rows.find((r) => r.canonName.startsWith('Tune'));
    expect(tune?.verdict).toBe('order'); // #1 here, #3 there
  });
});

describe('flowSteps', () => {
  it('merges k→1, keeps every variant on Keep, drops on Drop', () => {
    const rows = buildReconciliation([laneA, laneB])[0].rows;
    const merged = flowSteps(rows, defaultDecision);
    // 2 merged pairs + 2 solo-A-side + 2 solo-B-side = 6 steps.
    expect(merged).toHaveLength(6);
    const correlate = merged.find((s) => s.name.startsWith('Correlate'));
    expect(correlate?.sources).toHaveLength(2);
    expect(correlate?.badge).toBe('merged 2→1');
    expect(correlate?.apps).toContain('ServiceNow');
    expect(correlate?.apps).toContain('Azure');

    const keepAll = flowSteps(rows, () => 'Keep');
    expect(keepAll).toHaveLength(8); // every stream step carried separately

    const dropAll = flowSteps(rows, () => 'Drop');
    expect(dropAll).toHaveLength(0);
  });

  it('badges a three-way merge with every source', () => {
    const rows = buildReconciliation([laneA, laneB, laneC]).flatMap((p) => p.rows);
    const steps = flowSteps(rows, defaultDecision);
    const correlate = steps.find((s) => s.name.startsWith('Correlate'));
    expect(correlate?.badge).toBe('merged 3→1');
    expect(correlate?.sources).toHaveLength(3);
    expect(correlate?.apps).toEqual(expect.arrayContaining(['ServiceNow', 'Azure', 'PagerDuty']));
  });
});
