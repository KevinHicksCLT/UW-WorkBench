// workPlan — the Work Library plan read-model: taskPlans row derivation
// (generic keys minus suppressed, plus custom steps, plus tied evidence) and
// the one-round-trip subtreePlanRollup math, against a mocked prisma client.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  nodeWorkTemplate: { findMany: vi.fn() },
  nodeTemplateAnswer: { findMany: vi.fn() },
  nodeStandard: { findMany: vi.fn() },
  nodeRegulation: { findMany: vi.fn() },
  nodeStandardEvidence: { findMany: vi.fn() },
  nodeRegulationEvidence: { findMany: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { subtreePlanRollup, taskPlans } from '../../src/lib/workPlan.js';

// One node ("n1") with a checklist template (keys Owner/Reviewer), a testing
// template (key Test method), and a mix of answered/suppressed/custom answers.
const LINKS = [
  {
    processNodeId: 'n1',
    template: {
      id: 'tpl-ck',
      kind: 'CHECKLIST',
      sortOrder: 1,
      keys: [
        { id: 'k1', key: 'Owner' },
        { id: 'k2', key: 'Reviewer' },
      ],
    },
  },
  {
    processNodeId: 'n1',
    template: { id: 'tpl-ts', kind: 'TEST', sortOrder: 2, keys: [{ id: 'k3', key: 'Test method' }] },
  },
];

const answer = (over: Record<string, unknown>) => ({
  processNodeId: 'n1',
  templateKeyId: null,
  customKey: null,
  kind: null,
  suppressed: false,
  value: null,
  application: null,
  role: null,
  deliverable: null,
  sortOrder: 0,
  ...over,
});

const ANSWERS = [
  // k1 answered via an entity FK — role beats the raw text value.
  answer({ templateKeyId: 'k1', role: { displayValue: 'Alice' }, value: 'stale text' }),
  // k2 suppressed → its generic row disappears.
  answer({ templateKeyId: 'k2', suppressed: true }),
  // Item-specific custom checklist step, no value yet.
  answer({ customKey: 'Extra step' }),
  // Custom TEST step defined via a deliverable FK.
  answer({ customKey: 'Perf test', kind: 'TEST', deliverable: { title: 'Perf report' } }),
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.nodeWorkTemplate.findMany.mockResolvedValue(LINKS);
  prismaMock.nodeTemplateAnswer.findMany.mockResolvedValue(ANSWERS);
  prismaMock.nodeStandard.findMany.mockResolvedValue([]);
  prismaMock.nodeRegulation.findMany.mockResolvedValue([]);
  prismaMock.nodeStandardEvidence.findMany.mockResolvedValue([]);
  prismaMock.nodeRegulationEvidence.findMany.mockResolvedValue([]);
});

describe('taskPlans', () => {
  it('returns an empty map without querying for no node ids', async () => {
    expect((await taskPlans([])).size).toBe(0);
    expect(prismaMock.nodeWorkTemplate.findMany).not.toHaveBeenCalled();
  });

  it('derives checklist/testing rows: generic keys minus suppressed, plus custom steps', async () => {
    const plans = await taskPlans(['n1']);
    const plan = plans.get('n1');

    expect(plan?.checklist).toEqual([
      { key: 'Owner', value: 'Alice', defined: true }, // role FK resolved, not the raw value
      { key: 'Extra step', value: null, defined: false },
    ]);
    expect(plan?.testing).toEqual([
      { key: 'Test method', value: null, defined: false },
      { key: 'Perf test', value: 'Perf report', defined: true },
    ]);
    expect(plan?.standards).toEqual([]);
    expect(plan?.regulations).toEqual([]);
    expect(plan?.defined).toBe(2);
    expect(plan?.total).toBe(4);

    // includeTied not requested → no standard/regulation reads at all.
    expect(prismaMock.nodeStandard.findMany).not.toHaveBeenCalled();
    expect(prismaMock.nodeRegulationEvidence.findMany).not.toHaveBeenCalled();
  });

  it('batches the reads with {in: nodeIds} (no per-row fan-out)', async () => {
    await taskPlans(['n1', 'n2']);
    expect(prismaMock.nodeWorkTemplate.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.nodeWorkTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processNodeId: { in: ['n1', 'n2'] } } }),
    );
    expect(prismaMock.nodeTemplateAnswer.findMany).toHaveBeenCalledTimes(1);
  });

  it('yields an empty plan for a node with no templates or answers', async () => {
    const plans = await taskPlans(['n1', 'bare']);
    expect(plans.get('bare')).toEqual({
      checklist: [],
      testing: [],
      standards: [],
      regulations: [],
      defined: 0,
      total: 0,
    });
  });

  it('includeTied attaches the node OWN standards/regulations with their evidence rows, name-sorted', async () => {
    prismaMock.nodeStandard.findMany.mockResolvedValue([
      { processNodeId: 'n1', standard: { id: 's2', name: 'Zeta Standard', department: 'IT' } },
      { processNodeId: 'n1', standard: { id: 's1', name: 'Alpha Standard', department: 'Risk' } },
    ]);
    prismaMock.nodeRegulation.findMany.mockResolvedValue([
      { processNodeId: 'n1', regulation: { id: 'r1', title: 'GDPR Art. 5', regime: 'EU' } },
    ]);
    prismaMock.nodeStandardEvidence.findMany.mockResolvedValue([
      answer({ standardId: 's1', kind: 'CHECKLIST', step: 'Verify log', value: 'done' }),
      answer({ standardId: 's1', kind: 'TEST', step: 'Sample audit' }),
    ]);
    prismaMock.nodeRegulationEvidence.findMany.mockResolvedValue([
      answer({ regId: 'r1', kind: 'CHECKLIST', step: 'Record consent', application: { name: 'OneTrust' } }),
    ]);

    const plan = (await taskPlans(['n1'], { includeTied: true })).get('n1');

    expect(plan?.standards.map((s) => s.name)).toEqual(['Alpha Standard', 'Zeta Standard']);
    expect(plan?.standards[0]).toMatchObject({
      id: 's1',
      source: 'Risk',
      direct: true,
      checklist: [{ key: 'Verify log', value: 'done', defined: true }],
      testing: [{ key: 'Sample audit', value: null, defined: false }],
    });
    expect(plan?.regulations[0]).toMatchObject({
      id: 'r1',
      name: 'GDPR Art. 5',
      source: 'EU',
      checklist: [{ key: 'Record consent', value: 'OneTrust', defined: true }],
    });
    // 2 own rows + 1 tied std + 1 tied reg evidence defined; totals include all rows.
    expect(plan?.defined).toBe(4);
    expect(plan?.total).toBe(7);
  });
});

describe('subtreePlanRollup', () => {
  it('combines the counting sub-queries into the rollup shape', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        tasks_with_plan: 2,
        generic_ck: 5,
        generic_ts: 3,
        suppressed_ck: 1,
        suppressed_ts: 0,
        custom_ck: 2,
        custom_ts: 1,
        defined_answers: 4,
        sev_total: 2,
        sev_def: 1,
        rev_total: 1,
        rev_def: 0,
      },
    ]);

    expect(await subtreePlanRollup('root-1')).toEqual({
      tasksWithPlan: 2,
      defined: 5, // 4 answers + 1 std evidence + 0 reg evidence
      total: 13, // (5-1+2) checklist + (3-0+1) testing + 2 + 1 evidence rows
      checklistKeys: 6,
      testingKeys: 4,
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1); // ONE SQL round trip
  });

  it('defaults every count to 0 when the query returns nothing', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    expect(await subtreePlanRollup('root-1')).toEqual({
      tasksWithPlan: 0,
      defined: 0,
      total: 0,
      checklistKeys: 0,
      testingKeys: 0,
    });
  });
});
