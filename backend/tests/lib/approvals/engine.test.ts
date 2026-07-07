// approvals/engine.ts — hold, quorum evaluation, stage advance, finalize +
// replay. Prisma and the seat resolver mocked; the apply registry is real so
// finalization is asserted through an actually-registered handler.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  approvalPolicy: { findUnique: vi.fn() },
  approvalRequest: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  approvalAssignment: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  auditEntry: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const resolveMock = vi.hoisted(() => ({ resolveStageSeats: vi.fn() }));
vi.mock('../../../src/lib/approvals/resolve.js', () => resolveMock);

const { maybeHold, decideRequest } = await import('../../../src/lib/approvals/engine.js');
const { registerApplyHandler } = await import('../../../src/lib/approvals/registry.js');

const actor = { tenantId: 't1', userId: 'approver-1', email: 'approver@x.y' };
const requester = { tenantId: 't1', userId: 'creator-1', email: 'creator@x.y' };

const policy = (stages: object[]) => ({
  id: 'pol-1',
  tenantId: 't1',
  decisionKey: 'test.decision',
  enabled: true,
  slaHours: 72,
  stages,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditEntry.create.mockResolvedValue({});
  prismaMock.approvalAssignment.createMany.mockResolvedValue({ count: 1 });
  prismaMock.approvalAssignment.update.mockResolvedValue({});
  prismaMock.approvalAssignment.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.approvalRequest.update.mockResolvedValue({});
  // Callback form runs against the mock; array form settles its members.
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock),
  );
});

const holdSpec = {
  decisionKey: 'test.decision',
  entityType: 'Widget',
  entityId: 'w1',
  action: 'UPDATE',
  summary: 'Change widget w1',
  payload: { a: 1 },
};

describe('maybeHold', () => {
  it('returns null when no enabled policy governs the key', async () => {
    prismaMock.approvalPolicy.findUnique.mockResolvedValue(null);
    expect(await maybeHold(requester, holdSpec)).toBeNull();
    prismaMock.approvalPolicy.findUnique.mockResolvedValue({
      ...policy([{ order: 1, quorum: 'ANY_OF', n: null, seats: [{ kind: 'SITE_ADMINS' }] }]),
      enabled: false,
    });
    expect(await maybeHold(requester, holdSpec)).toBeNull();
  });

  it('creates the request + stage-1 assignments and returns the 202 body', async () => {
    prismaMock.approvalPolicy.findUnique.mockResolvedValue(
      policy([{ order: 1, quorum: 'ANY_OF', n: null, seats: [{ kind: 'SITE_ADMINS' }] }]),
    );
    prismaMock.approvalRequest.findFirst.mockResolvedValue(null); // no duplicate
    prismaMock.approvalRequest.create.mockResolvedValue({ id: 'req-1' });
    resolveMock.resolveStageSeats.mockResolvedValue([
      { seatKey: 'site-admins', userIds: ['a1', 'a2'], escalated: false },
    ]);

    const held = await maybeHold(requester, holdSpec);
    expect(held).toMatchObject({
      approval: 'PENDING',
      requestId: 'req-1',
      summary: holdSpec.summary,
    });
    const rows = prismaMock.approvalAssignment.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ requestId: 'req-1', seatKey: 'site-admins', stageOrder: 1 });
  });

  it('409s when the entity already has a pending request for this decision', async () => {
    prismaMock.approvalPolicy.findUnique.mockResolvedValue(
      policy([{ order: 1, quorum: 'ANY_OF', n: null, seats: [{ kind: 'SITE_ADMINS' }] }]),
    );
    prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: 'req-existing' });
    await expect(maybeHold(requester, holdSpec)).rejects.toMatchObject({ status: 409 });
  });
});

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tenantId: 't1',
    status: 'PENDING',
    currentStage: 1,
    requestedById: 'creator-1',
    summary: 'Change widget w1',
    subjectAttrs: null,
    policy: policy([{ order: 1, quorum: 'ANY_OF', n: null, seats: [{ kind: 'SITE_ADMINS' }] }]),
    assignments: [
      {
        id: 'as-1',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'approver-1',
        status: 'PENDING',
      },
      {
        id: 'as-2',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'approver-2',
        status: 'PENDING',
      },
    ],
    ...overrides,
  };
}

describe('decideRequest', () => {
  it('404s for a caller without a pending assignment on the current stage', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue(pendingRequest({ assignments: [] }));
    await expect(
      decideRequest(actor, 'req-1', 'APPROVE', undefined, 'IN_APP'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the creator tries to decide their own request (defense in depth)', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue(
      pendingRequest({
        requestedById: 'approver-1', // the actor somehow holds an assignment too
      }),
    );
    await expect(
      decideRequest(actor, 'req-1', 'APPROVE', undefined, 'IN_APP'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('REJECT terminates the request and cancels every other pending assignment', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue(pendingRequest());
    const out = await decideRequest(actor, 'req-1', 'REJECT', 'not justified', 'IN_APP');
    expect(out.status).toBe('REJECTED');
    expect(prismaMock.approvalAssignment.update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      method: 'IN_APP',
      comment: 'not justified',
    });
    expect(prismaMock.approvalAssignment.updateMany.mock.calls[0][0].data.status).toBe('CANCELLED');
  });

  it('APPROVE on a satisfied final stage finalizes and replays via the registry', async () => {
    const applied: unknown[] = [];
    registerApplyHandler('test.decision', async (ctx) => {
      applied.push(ctx.payload);
    });
    prismaMock.approvalRequest.findFirst
      .mockResolvedValueOnce(pendingRequest()) // decide fetch
      .mockResolvedValueOnce({
        // applyRequest fetch
        id: 'req-1',
        tenantId: 't1',
        status: 'APPROVED',
        entityId: 'w1',
        payload: { a: 1 },
        policy: { decisionKey: 'test.decision' },
        requestedBy: { email: 'creator@x.y' },
      });
    // Post-approve stage snapshot: my seat approved.
    prismaMock.approvalAssignment.findMany.mockResolvedValue([
      {
        id: 'as-1',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'approver-1',
        status: 'APPROVED',
      },
      {
        id: 'as-2',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'approver-2',
        status: 'SUPERSEDED',
      },
    ]);

    const out = await decideRequest(actor, 'req-1', 'APPROVE', undefined, 'IN_APP');
    expect(out.status).toBe('APPROVED');
    expect(applied).toEqual([{ a: 1 }]);
    // The sibling candidate on the same seat was superseded, not left dangling.
    expect(prismaMock.approvalAssignment.updateMany.mock.calls[0][0].data.status).toBe(
      'SUPERSEDED',
    );
  });

  it('APPROVE that completes a non-final stage advances and resolves the next stage', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue(
      pendingRequest({
        policy: policy([
          { order: 1, quorum: 'ANY_OF', n: null, seats: [{ kind: 'SITE_ADMINS' }] },
          { order: 2, quorum: 'MANAGER', n: null, seats: [{ kind: 'MANAGER' }] },
        ]),
      }),
    );
    prismaMock.approvalAssignment.findMany.mockResolvedValue([
      {
        id: 'as-1',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'approver-1',
        status: 'APPROVED',
      },
    ]);
    resolveMock.resolveStageSeats.mockResolvedValue([
      { seatKey: 'manager', userIds: ['mgr-1'], escalated: false },
    ]);

    const out = await decideRequest(actor, 'req-1', 'APPROVE', undefined, 'IN_APP');
    expect(out.status).toBe('PENDING');
    // Stage-2 assignments created for the resolved manager.
    const created = prismaMock.approvalAssignment.createMany.mock.calls.at(-1)?.[0].data;
    expect(created).toEqual([
      expect.objectContaining({ stageOrder: 2, seatKey: 'manager', assigneeId: 'mgr-1' }),
    ]);
    // Request status was never finalized.
    const statusUpdates = prismaMock.approvalRequest.update.mock.calls
      .map((c) => c[0].data.status)
      .filter(Boolean);
    expect(statusUpdates).not.toContain('APPROVED');
  });

  it('ALL_OF stage stays pending until every seat has approved', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue(
      pendingRequest({
        policy: policy([
          {
            order: 1,
            quorum: 'ALL_OF',
            n: null,
            seats: [{ kind: 'MANAGER' }, { kind: 'ENTITY_ROLE', attr: 'sponsorRoleId' }],
          },
        ]),
        assignments: [
          {
            id: 'as-1',
            stageOrder: 1,
            seatKey: 'manager',
            assigneeId: 'approver-1',
            status: 'PENDING',
          },
          {
            id: 'as-2',
            stageOrder: 1,
            seatKey: 'entity-role:sponsorRoleId',
            assigneeId: 'sponsor-1',
            status: 'PENDING',
          },
        ],
      }),
    );
    prismaMock.approvalAssignment.findMany.mockResolvedValue([
      {
        id: 'as-1',
        stageOrder: 1,
        seatKey: 'manager',
        assigneeId: 'approver-1',
        status: 'APPROVED',
      },
      {
        id: 'as-2',
        stageOrder: 1,
        seatKey: 'entity-role:sponsorRoleId',
        assigneeId: 'sponsor-1',
        status: 'PENDING',
      },
    ]);
    const out = await decideRequest(actor, 'req-1', 'APPROVE', undefined, 'IN_APP');
    expect(out.status).toBe('PENDING');
  });
});
