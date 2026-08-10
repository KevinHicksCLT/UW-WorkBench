// services/userProvisioning — the single user write path. Covers tenant-scoped
// reference validation, externalId-vs-email targeting, the audit-diff password
// ban, the present-fields-only IAM update policy, and P2002 → 409 mapping.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const txMock = vi.hoisted(() => ({
  user: { create: vi.fn(), update: vi.fn() },
  userValueStream: { deleteMany: vi.fn(), createMany: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), update: vi.fn() },
  orgUnit: { findFirst: vi.fn() },
  role: { findFirst: vi.fn() },
  processNode: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

const logAuditMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/audit.js')>();
  return { ...actual, logAudit: logAuditMock };
});

const invalidateMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/permissionService.js', () => ({
  invalidateUserPermissions: invalidateMock,
  invalidateTenantPermissions: vi.fn(),
}));

const { validateUserRefs, upsertUser, deactivateUser, EmailConflictError } =
  await import('../../src/services/userProvisioning.js');

const TENANT = 'tenant-1';

const existingUser = {
  id: 'u-existing',
  tenantId: TENANT,
  email: 'alice@example.com',
  name: 'Alice',
  password: 'old-hash',
  role: 'MEMBER',
  status: 'ACTIVE',
  externalId: 'okta|1',
  orgUnitId: null,
  geography: null,
  operatingRoleId: null,
  isManager: false,
  reportsToId: null,
  isApprover: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
    fn(txMock),
  );
  txMock.user.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    ...existingUser,
    ...args.data,
  }));
  txMock.user.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'u-new',
    ...args.data,
  }));
});

describe('validateUserRefs', () => {
  it('returns no errors when every ref resolves inside the tenant', async () => {
    prismaMock.orgUnit.findFirst.mockResolvedValue({ id: 'org-1' });
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-1' });
    prismaMock.processNode.findMany.mockResolvedValue([{ id: 'vs-1' }, { id: 'vs-2' }]);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'mgr-1' });

    const errors = await validateUserRefs(TENANT, {
      orgUnitId: 'org-1',
      operatingRoleId: 'role-1',
      valueStreamIds: ['vs-1', 'vs-2'],
      reportsToId: 'mgr-1',
    });
    expect(errors).toEqual([]);
    // Every spine ref is checked through company → tenantId, never trusted raw.
    expect(prismaMock.orgUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-1', company: { tenantId: TENANT } } }),
    );
    expect(prismaMock.processNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: { tenantId: TENANT },
          processLevelType: { levelNumber: 2 },
        }),
      }),
    );
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mgr-1', tenantId: TENANT } }),
    );
  });

  it('flags cross-tenant / missing refs with typed field errors', async () => {
    prismaMock.orgUnit.findFirst.mockResolvedValue(null);
    prismaMock.role.findFirst.mockResolvedValue(null);
    prismaMock.processNode.findMany.mockResolvedValue([{ id: 'vs-1' }]); // vs-2 missing (wrong tenant or not L2)
    prismaMock.user.findFirst.mockResolvedValue(null);

    const errors = await validateUserRefs(TENANT, {
      orgUnitId: 'org-other-tenant',
      operatingRoleId: 'role-other-tenant',
      valueStreamIds: ['vs-1', 'vs-2'],
      reportsToId: 'mgr-other-tenant',
    });
    expect(errors.map((e) => e.field).sort()).toEqual([
      'operatingRoleId',
      'orgUnitId',
      'reportsToId',
      'valueStreamIds',
    ]);
    expect(errors.find((e) => e.field === 'valueStreamIds')?.message).toContain('vs-2');
  });

  it('skips checks for absent refs', async () => {
    const errors = await validateUserRefs(TENANT, { email: 'x@y.com', name: 'X' });
    expect(errors).toEqual([]);
    expect(prismaMock.orgUnit.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.processNode.findMany).not.toHaveBeenCalled();
  });
});

describe('upsertUser targeting', () => {
  it('matches by externalId when byExternalId is given (update path)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    const result = await upsertUser({
      tenantId: TENANT,
      actorLabel: 'apiKey:okta',
      byExternalId: 'okta|1',
      source: 'PROVISION',
      data: { name: 'Alice Renamed' },
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { tenantId: TENANT, externalId: 'okta|1' },
    });
    expect(result.created).toBe(false);
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-existing' } }),
    );
    expect(invalidateMock).toHaveBeenCalledWith('u-existing');
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVISION_UPDATE' }),
    );
  });

  it('falls back to email matching and creates when nothing exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const result = await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      data: {
        email: 'new@example.com',
        name: 'New User',
        role: 'MEMBER',
        valueStreamIds: ['vs-1'],
      },
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { tenantId: TENANT, email: 'new@example.com' },
    });
    expect(result.created).toBe(true);
    expect(txMock.user.create).toHaveBeenCalledTimes(1);
    expect(txMock.userValueStream.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u-new', processNodeId: 'vs-1' }],
    });
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
  });

  it('hashes a random credential when no password is provided (IAM users)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'apiKey:okta',
      byExternalId: 'okta|9',
      data: { email: 'iam@example.com', name: 'IAM User' },
    });
    const created = txMock.user.create.mock.calls[0][0].data as {
      password: string;
      externalId: string;
    };
    expect(created.password).toMatch(/^\$2[aby]\$/); // bcrypt hash, never empty/plaintext
    expect(created.externalId).toBe('okta|9');
  });

  it('hashes a provided password rather than storing it raw', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- test fixture proving the raw value is hashed, never stored
      data: { email: 'p@example.com', name: 'P', password: 'hunter2secret' },
    });
    const created = txMock.user.create.mock.calls[0][0].data as { password: string };
    expect(created.password).not.toContain('hunter2secret');
    expect(bcrypt.compareSync('hunter2secret', created.password)).toBe(true);
  });

  it('rejects a create without email/name with a 400-shaped error', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(
      upsertUser({
        tenantId: TENANT,
        actorLabel: 'x',
        byExternalId: 'okta|404',
        data: { name: 'No Email' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('firstName/lastName composition', () => {
  it('composes the display name from first+last on create and stores the components', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      data: { email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', role: 'MEMBER' },
    });
    const created = txMock.user.create.mock.calls[0][0].data as {
      name: string;
      firstName: string;
      lastName: string;
    };
    expect(created).toMatchObject({ name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe' });
  });

  it('recomposes the name from the existing surname when only firstName changes', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...existingUser,
      name: 'Alice Smith',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      byId: 'u-existing',
      data: { firstName: 'Alicia' },
    });
    const updateArgs = txMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    // firstName written, surname untouched, and name recomposed from both.
    expect(updateArgs.data.firstName).toBe('Alicia');
    expect(updateArgs.data.lastName).toBeUndefined();
    expect(updateArgs.data.name).toBe('Alicia Smith');
  });

  it('leaves the display name alone when neither component is supplied (IAM path)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'apiKey:okta',
      byExternalId: 'okta|1',
      source: 'PROVISION',
      data: { name: 'Alice Renamed' },
    });
    const updateArgs = txMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(updateArgs.data)).toEqual(['name']);
    expect(updateArgs.data.name).toBe('Alice Renamed');
  });
});

describe('audit diff hygiene', () => {
  it('never includes the password (raw or hash) in the audit diff', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- test fixture proving the raw value never reaches the audit diff
      data: { email: 'p2@example.com', name: 'P2', password: 'ultrasecretpw' },
    });
    const call = logAuditMock.mock.calls[0][0] as { diff: unknown };
    const serialized = JSON.stringify(call.diff);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('ultrasecretpw');
  });

  it('update diff covers changed identity fields only — no password key', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'admin@example.com',
      byId: 'u-existing',
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- test fixture proving password changes stay out of the diff
      data: { name: 'Alice B', password: 'newpassword1' },
    });
    const call = logAuditMock.mock.calls[0][0] as { diff: Record<string, unknown> };
    expect(Object.keys(call.diff)).toEqual(['name']);
    expect(JSON.stringify(call.diff)).not.toContain('newpassword1');
  });
});

describe('IAM update field policy', () => {
  it('writes only the fields present on the payload', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'apiKey:okta',
      byExternalId: 'okta|1',
      source: 'PROVISION',
      data: { name: 'Alice Updated', status: 'ACTIVE' },
    });
    const updateArgs = txMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(updateArgs.data).sort()).toEqual(['name', 'status']);
    // Untouched: value-stream links (not provided) and override/preference rows
    // (this service has no code path that reaches them).
    expect(txMock.userValueStream.deleteMany).not.toHaveBeenCalled();
    expect(txMock.userValueStream.createMany).not.toHaveBeenCalled();
  });

  it('replaces value-stream links transactionally when provided', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    await upsertUser({
      tenantId: TENANT,
      actorLabel: 'apiKey:okta',
      byExternalId: 'okta|1',
      data: { valueStreamIds: ['vs-1', 'vs-2'] },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.userValueStream.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-existing' },
    });
    expect(txMock.userValueStream.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u-existing', processNodeId: 'vs-1' },
        { userId: 'u-existing', processNodeId: 'vs-2' },
      ],
    });
  });
});

describe('email conflicts (P2002)', () => {
  it('maps a unique-email violation on create to a 409 EmailConflictError', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    txMock.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(
      upsertUser({
        tenantId: TENANT,
        actorLabel: 'admin@example.com',
        data: { email: 'taken-elsewhere@example.com', name: 'T' },
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Email already in use' });
    await expect(
      upsertUser({
        tenantId: TENANT,
        actorLabel: 'admin@example.com',
        data: { email: 'taken-elsewhere@example.com', name: 'T' },
      }),
    ).rejects.toBeInstanceOf(EmailConflictError);
  });

  it('maps a unique-email violation on update (email change) the same way', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    txMock.user.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(
      upsertUser({
        tenantId: TENANT,
        actorLabel: 'admin@example.com',
        byId: 'u-existing',
        data: { email: 'collides@example.com' },
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Email already in use' });
  });

  it('rethrows non-P2002 errors untouched', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    txMock.user.create.mockRejectedValue(new Error('db exploded'));
    await expect(
      upsertUser({ tenantId: TENANT, actorLabel: 'x', data: { email: 'a@b.co', name: 'A' } }),
    ).rejects.toThrow('db exploded');
  });
});

describe('deactivateUser', () => {
  it('sets DEACTIVATED, invalidates permissions, and audits with the source prefix', async () => {
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    prismaMock.user.update.mockResolvedValue({ ...existingUser, status: 'DEACTIVATED' });
    const user = await deactivateUser(TENANT, { externalId: 'okta|1' }, 'apiKey:okta', 'PROVISION');
    expect(user?.status).toBe('DEACTIVATED');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u-existing' },
      data: { status: 'DEACTIVATED' },
    });
    expect(invalidateMock).toHaveBeenCalledWith('u-existing');
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVISION_DEACTIVATE' }),
    );
  });

  it('returns null for an unknown target (routes answer 404)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    expect(await deactivateUser(TENANT, { externalId: 'nope' }, 'apiKey:okta')).toBeNull();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe('upsertUser byId', () => {
  it('throws 404-shaped when the id does not exist in the tenant', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(
      upsertUser({ tenantId: TENANT, actorLabel: 'a', byId: 'ghost', data: { name: 'X' } }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
