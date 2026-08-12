// Canonical (north-star) product models (PM-08): create validation + the
// canonical-name 409, patch guards (cross-tenant 404, Unknown componentIds),
// the exclusive component re-link transaction, the on-read status roll-up,
// and the §2-C DELETE (components detach via SetNull, never deleted here).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fakeAuthModule,
  fakePermissionsModule,
  findFirstFrom,
  startRouteServer,
  TENANT_A,
  TENANT_B,
} from '../harness.js';
import type { RouteServer } from '../harness.js';

const txMock = vi.hoisted(() => ({
  productModelComponent: { updateMany: vi.fn() },
  canonicalProductModel: { update: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  canonicalProductModel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  productModelWorkspace: { findFirst: vi.fn() },
  productModelComponent: { count: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/middleware/auth.js', () => fakeAuthModule());
vi.mock('../../../src/middleware/permissions.js', () => fakePermissionsModule());
const auditMock = vi.hoisted(() => ({ logAudit: vi.fn() }));
vi.mock('../../../src/services/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/audit.js')>();
  return { ...actual, logAudit: auditMock.logAudit };
});

const { default: router } = await import('../../../src/routes/product-models/index.js');

const WS = { id: 'pw1', tenantId: TENANT_A, companyId: 'co1' };

const CANONICAL = {
  id: 'cm1',
  tenantId: TENANT_A,
  companyId: 'co1',
  workspaceId: 'pw1',
  name: 'Commercial Package North Star',
  description: null,
  lineOfBusiness: 'Commercial Package',
  ownerRoleId: null,
  position: 0,
  illustrative: true,
};

const UPDATED_INCLUDE = {
  ownerRole: null,
  components: [
    {
      id: 'pc1',
      component: 'Coverage & Perils',
      name: 'Coverage & Perils',
      migrationStatus: 'Migrated',
    },
    {
      id: 'pc2',
      component: 'Rating & Pricing',
      name: 'Rating & Pricing',
      migrationStatus: 'Retired',
    },
  ],
};

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.productModelWorkspace.findFirst.mockImplementation(findFirstFrom([WS]));
  prismaMock.canonicalProductModel.findFirst.mockImplementation(findFirstFrom([CANONICAL]));
  prismaMock.canonicalProductModel.delete.mockResolvedValue(CANONICAL);
  prismaMock.productModelComponent.count.mockResolvedValue(0);
  txMock.canonicalProductModel.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...CANONICAL, ...data, ...UPDATED_INCLUDE }),
  );
  txMock.productModelComponent.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.$transaction.mockImplementation(
    (arg: ((tx: typeof txMock) => Promise<unknown>) | Promise<unknown>[]) =>
      typeof arg === 'function' ? arg(txMock) : Promise.all(arg),
  );
  server = await startRouteServer('/product-models', router);
  return () => server.close();
});

describe('POST /product-models/canonical-models', () => {
  it('400s a nameless body via zod', async () => {
    const res = await server.request('POST', '/product-models/canonical-models', {
      body: { workspaceId: 'pw1' },
    });
    expect(res.status).toBe(400);
    expect(prismaMock.canonicalProductModel.create).not.toHaveBeenCalled();
  });

  it("404s when the workspace isn't reachable from the requester tenant", async () => {
    const res = await server.request('POST', '/product-models/canonical-models', {
      tenant: TENANT_B,
      body: { workspaceId: 'pw1', name: 'Personal Auto North Star' },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.canonicalProductModel.create).not.toHaveBeenCalled();
  });

  it('409s a duplicate canonical-model name on the same workspace', async () => {
    const res = await server.request('POST', '/product-models/canonical-models', {
      body: { workspaceId: 'pw1', name: 'Commercial Package North Star' },
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'A canonical model with that name already exists' });
    expect(prismaMock.canonicalProductModel.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /product-models/canonical-models/:id', () => {
  it('404s (never 403) a cross-tenant patch', async () => {
    const res = await server.request('PATCH', '/product-models/canonical-models/cm1', {
      tenant: TENANT_B,
      body: { name: 'Renamed' },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("400s componentIds that don't all live on this board", async () => {
    prismaMock.productModelComponent.count.mockResolvedValue(1); // only 1 of 2 owned
    const res = await server.request('PATCH', '/product-models/canonical-models/cm1', {
      body: { componentIds: ['pc1', 'foreign'] },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unknown componentIds' });
    expect(prismaMock.productModelComponent.count).toHaveBeenCalledWith({
      where: { id: { in: ['pc1', 'foreign'] }, tenantId: TENANT_A, workspaceId: 'pw1' },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('re-links components exclusively (detach all, attach listed) and rolls up status on read', async () => {
    prismaMock.productModelComponent.count.mockResolvedValue(2);
    const res = await server.request<{ status: string; components: { id: string }[] }>(
      'PATCH',
      '/product-models/canonical-models/cm1',
      { body: { componentIds: ['pc1', 'pc2'] } },
    );
    expect(res.status).toBe(200);
    // Exclusive re-link: previously-linked components detach first.
    expect(txMock.productModelComponent.updateMany).toHaveBeenNthCalledWith(1, {
      where: { canonicalModelId: 'cm1' },
      data: { canonicalModelId: null },
    });
    expect(txMock.productModelComponent.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['pc1', 'pc2'] } },
      data: { canonicalModelId: 'cm1' },
    });
    // All linked components Migrated/Retired → the DTO status computes Live.
    expect(res.body.status).toBe('Live');
    expect(res.body.components.map((c) => c.id)).toEqual(['pc1', 'pc2']);
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_CANONICAL_MODEL', entityId: 'pw1' }),
    );
  });
});

describe('DELETE /product-models/canonical-models/:id', () => {
  it('404s (never 403) a cross-tenant delete without deleting', async () => {
    const res = await server.request('DELETE', '/product-models/canonical-models/cm1', {
      tenant: TENANT_B,
    });
    expect(res.status).toBe(404);
    expect(prismaMock.canonicalProductModel.delete).not.toHaveBeenCalled();
  });

  it('deletes an in-tenant canonical model, audits it, and returns 204', async () => {
    const res = await server.request('DELETE', '/product-models/canonical-models/cm1');
    expect(res.status).toBe(204);
    expect(prismaMock.canonicalProductModel.delete).toHaveBeenCalledWith({
      where: { id: 'cm1' },
    });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_CANONICAL_MODEL',
        entityType: 'ProductModelWorkspace',
        entityId: 'pw1',
      }),
    );
  });
});
