// lib/roleProfile — pure profile assembly: deliverable grouping (direct +
// via-task union, Owner beats Contributor), task summary with deliverable
// ties, strongest-relation collapsing, participation, org unpacking, empties.
import { describe, expect, it } from 'vitest';
import { assembleRoleProfile, groupByChecklist } from '../../src/lib/roleProfile.js';

const role = {
  id: 'r1',
  displayValue: 'Reserving Actuary',
  description: 'Sets reserves.',
  roleFamily: 'Actuarial',
  roleLevel: 'Individual Contributor',
  company: { id: 'c1', name: 'ABC Insurance' },
  orgUnit: {
    id: 'dept1',
    displayValue: 'Reserving',
    orgLevelType: { levelNumber: 3 },
    parent: { id: 'div1', displayValue: 'Actuarial', orgLevelType: { levelNumber: 2 } },
  },
};

const node = (id: string, name: string, sortOrder = 1) => ({ id, displayValue: name, sortOrder });

// NodeRole row with unreviewed validation defaults (overridable per test).
let seq = 0;
const link = (
  role_: string,
  processNode: ReturnType<typeof node>,
  validation: Partial<{
    id: string;
    validationStatus: string;
    validationNote: string | null;
    validatedByEmail: string | null;
    validatedAt: Date | null;
    reassignedToRole: { id: string; displayValue: string } | null;
    reassignedToApplication: { id: string; name: string } | null;
    reassignedToExternalParty: { id: string; name: string } | null;
  }> = {},
) => ({
  id: validation.id ?? `nr${++seq}`,
  role_,
  processNode,
  validationStatus: 'UNREVIEWED',
  validationNote: null,
  validatedByEmail: null,
  validatedAt: null,
  reassignedToRole: null,
  reassignedToApplication: null,
  reassignedToExternalParty: null,
  ...validation,
});

const loc = new Map([
  [
    't1',
    {
      valueStreamId: 'vs1',
      valueStreamName: 'Actuarial',
      l3: 'Experience Studies',
      l4: 'Mortality Study',
    },
  ],
  [
    't2',
    {
      valueStreamId: 'vs1',
      valueStreamName: 'Actuarial',
      l3: 'Experience Studies',
      l4: 'Mortality Study',
    },
  ],
  ['t3', { valueStreamId: 'vs2', valueStreamName: 'Finance', l3: 'Close', l4: 'Reserve Close' }],
]);

function assemble(overrides: Partial<Parameters<typeof assembleRoleProfile>[0]> = {}) {
  return assembleRoleProfile({
    role,
    nodeRoles: [
      link('Owner', node('t1', 'Extract in-force data', 1)),
      link('Participant', node('t2', 'Review lapse assumptions', 2)),
      link('Owner', node('t3', 'Book quarterly reserves', 3)),
    ],
    roleDelivs: [{ role_: 'Owner', deliverable: { id: 'd1', title: 'Mortality Study' } }],
    nodeDelivs: [
      { processNodeId: 't1', deliverable: { id: 'd1', title: 'Mortality Study' } },
      { processNodeId: 't2', deliverable: { id: 'd1', title: 'Mortality Study' } },
      { processNodeId: 't3', deliverable: { id: 'd2', title: 'Reserve Package' } },
    ],
    checkItems: [],
    loc,
    ...overrides,
  });
}

describe('assembleRoleProfile', () => {
  it('unions direct and via-task deliverables, carrying the Owner chip', () => {
    const p = assemble();
    expect(p.deliverables).toHaveLength(2);
    const study = p.deliverables.find((d) => d.id === 'd1')!;
    expect(study.role_).toBe('Owner');
    expect(study.tasks.map((t) => t.name)).toEqual([
      'Extract in-force data',
      'Review lapse assumptions',
    ]);
    expect(study.valueStreamName).toBe('Actuarial');
    // Via-task only → no chip, still drillable.
    const pkg = p.deliverables.find((d) => d.id === 'd2')!;
    expect(pkg.role_).toBeNull();
    expect(pkg.tasks.map((t) => t.name)).toEqual(['Book quarterly reserves']);
  });

  it('orders deliverables Owner → Contributor → via-task', () => {
    const p = assemble({
      roleDelivs: [
        { role_: 'Contributor', deliverable: { id: 'd3', title: 'Assumption Memo' } },
        { role_: 'Owner', deliverable: { id: 'd1', title: 'Mortality Study' } },
      ],
    });
    expect(p.deliverables.map((d) => d.role_)).toEqual(['Owner', 'Contributor', null]);
  });

  it('Owner beats Contributor when a deliverable is linked twice', () => {
    const p = assemble({
      roleDelivs: [
        { role_: 'Contributor', deliverable: { id: 'd1', title: 'Mortality Study' } },
        { role_: 'Owner', deliverable: { id: 'd1', title: 'Mortality Study' } },
      ],
    });
    expect(p.deliverables.find((d) => d.id === 'd1')!.role_).toBe('Owner');
  });

  it('taskSummary carries relation, location, and deliverable ties per task', () => {
    const p = assemble();
    expect(p.taskSummary).toHaveLength(3);
    const t3 = p.taskSummary.find((t) => t.nodeId === 't3')!;
    expect(t3).toMatchObject({
      relation: 'Lead',
      valueStreamName: 'Finance',
      l3: 'Close',
      l4: 'Reserve Close',
      deliverables: [{ id: 'd2', title: 'Reserve Package' }],
    });
  });

  it('collapses duplicate Owner+Participant rows on one node to Lead', () => {
    const p = assemble({
      nodeRoles: [
        link('Participant', node('t1', 'Extract in-force data'), { id: 'nr-part' }),
        link('Owner', node('t1', 'Extract in-force data'), {
          id: 'nr-own',
          validationStatus: 'CONFIRMED',
          validatedByEmail: 'kelly@abc.example',
          validatedAt: new Date('2026-07-07T00:00:00Z'),
        }),
      ],
      nodeDelivs: [],
    });
    expect(p.taskSummary).toHaveLength(1);
    expect(p.taskSummary[0].relation).toBe('Lead');
    // The Owner link's id + validation win so attestations land on it.
    expect(p.taskSummary[0].nodeRoleId).toBe('nr-own');
    expect(p.taskSummary[0].validation.status).toBe('CONFIRMED');
  });

  it('carries each link validation state onto tasks and deliverable groupings', () => {
    const p = assemble({
      nodeRoles: [
        link('Owner', node('t1', 'Extract in-force data', 1), {
          id: 'nr1',
          validationStatus: 'REASSIGNED',
          validatedByEmail: 'kelly@abc.example',
          validatedAt: new Date('2026-07-07T00:00:00Z'),
          reassignedToApplication: { id: 'app1', name: 'Policy Admin System' },
        }),
      ],
    });
    const t = p.taskSummary.find((x) => x.nodeId === 't1')!;
    expect(t.validation).toMatchObject({
      status: 'REASSIGNED',
      reassignedTo: { kind: 'application', id: 'app1', name: 'Policy Admin System' },
    });
    // The deliverable-grouped view derives from the SAME link state.
    const study = p.deliverables.find((d) => d.id === 'd1')!;
    expect(study.tasks[0].validation.status).toBe('REASSIGNED');
    expect(study.tasks[0].nodeRoleId).toBe('nr1');
  });

  it('participation reports the strongest relation per value stream, Leads first', () => {
    const p = assemble();
    expect(p.participation).toEqual([
      { valueStreamId: 'vs1', valueStreamName: 'Actuarial', participationType: 'Lead' },
      { valueStreamId: 'vs2', valueStreamName: 'Finance', participationType: 'Lead' },
    ]);
    const supportOnly = assemble({
      nodeRoles: [link('Participant', node('t2', 'Review lapse assumptions'))],
      nodeDelivs: [],
    });
    expect(supportOnly.participation).toEqual([
      { valueStreamId: 'vs1', valueStreamName: 'Actuarial', participationType: 'Support' },
    ]);
  });

  it('unpacks an L3 home into department + division, and an L2 home into division only', () => {
    const p = assemble();
    expect(p.department).toEqual({ id: 'dept1', name: 'Reserving' });
    expect(p.division).toEqual({ id: 'div1', name: 'Actuarial' });
    const l2 = assemble({
      role: {
        ...role,
        orgUnit: {
          id: 'div1',
          displayValue: 'Actuarial',
          orgLevelType: { levelNumber: 2 },
          parent: null,
        },
      },
    });
    expect(l2.division).toEqual({ id: 'div1', name: 'Actuarial' });
    expect(l2.department).toBeNull();
  });

  it('an empty role (the imported-42 case) yields empty sections, not errors', () => {
    const p = assemble({ nodeRoles: [], roleDelivs: [], nodeDelivs: [], loc: new Map() });
    expect(p.taskSummary).toEqual([]);
    expect(p.deliverables).toEqual([]);
    expect(p.participation).toEqual([]);
    expect(p.description).toBe('Sets reserves.');
  });
});

describe('groupByChecklist', () => {
  it('groups by checklist, dedupes normalized text, sorts categories', () => {
    const groups = groupByChecklist([
      { text: 'Review reserves', checklist: 'Quarterly Close' },
      { text: 'review  reserves', checklist: 'Quarterly Close' },
      { text: 'File AOMR', checklist: 'Annual' },
      { text: 'Sign statement', checklist: null },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Annual', 'Quarterly Close', 'Uncategorized']);
    expect(groups[1].items).toEqual(['Review reserves']);
  });
});
