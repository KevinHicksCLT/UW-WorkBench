// Legacy product models (PM-03): the §6.2 master-list DTO, create validation
// (zod, workspace tenant walk, duplicate-name 409), and the PATCH tenant walk.
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

const prismaMock = vi.hoisted(() => ({
  legacyProductModel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  productModelWorkspace: { findFirst: vi.fn() },
  company: { findFirst: vi.fn() },
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

const MODEL = {
  id: 'm1',
  tenantId: TENANT_A,
  companyId: 'co1',
  workspaceId: 'pw1',
  name: 'PolicyPro — Commercial Package',
  description: 'Legacy commercial package definition',
  sourceSystem: 'PolicyPro',
  segment: 'SMB',
  geography: 'US-East',
  disposition: 'Replace',
  position: 0,
  illustrative: true,
  workspace: { id: 'pw1', name: 'Commercial & Personal Lines North Star' },
  _count: { findings: 4 },
};

interface ProductModelList {
  productModels: {
    id: string;
    name: string;
    sourceSystem: string | null;
    segment: string | null;
    geography: string | null;
    disposition: string | null;
    workspaces: { id: string; name: string }[];
    findingCount: number;
    illustrative: boolean;
  }[];
}

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' });
  prismaMock.legacyProductModel.findMany.mockResolvedValue([MODEL]);
  prismaMock.legacyProductModel.findFirst.mockImplementation(findFirstFrom([MODEL]));
  prismaMock.legacyProductModel.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...MODEL, ...data }),
  );
  prismaMock.productModelWorkspace.findFirst.mockImplementation(findFirstFrom([WS]));
  server = await startRouteServer('/product-models', router);
  return () => server.close();
});

describe('GET /product-models', () => {
  it('serves the §6.2 master-list DTO with workspace membership and finding counts', async () => {
    const res = await server.request<ProductModelList>('GET', '/product-models/');
    expect(res.status).toBe(200);
    expect(res.body.productModels).toEqual([
      {
        id: 'm1',
        name: 'PolicyPro — Commercial Package',
        description: 'Legacy commercial package definition',
        sourceSystem: 'PolicyPro',
        segment: 'SMB',
        geography: 'US-East',
        disposition: 'Replace',
        workspaces: [{ id: 'pw1', name: 'Commercial & Personal Lines North Star' }],
        findingCount: 4,
        illustrative: true,
      },
    ]);
    // The list is tenant- AND company-scoped.
    expect(prismaMock.legacyProductModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_A, companyId: 'co1' },
      }),
    );
  });
});

describe('POST /product-models', () => {
  it('400s an invalid disposition token via zod', async () => {
    const res = await server.request('POST', '/product-models/', {
      body: { workspaceId: 'pw1', name: 'New model', disposition: 'Sunset' },
    });
    expect(res.status).toBe(400);
    expect(prismaMock.legacyProductModel.create).not.toHaveBeenCalled();
  });

  it("404s when the target workspace isn't reachable from the requester tenant", async () => {
    const res = await server.request('POST', '/product-models/', {
      tenant: TENANT_B,
      body: { workspaceId: 'pw1', name: 'New model' },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.legacyProductModel.create).not.toHaveBeenCalled();
  });

  it('409s a duplicate model name on the same workspace', async () => {
    const res = await server.request('POST', '/product-models/', {
      body: { workspaceId: 'pw1', name: 'PolicyPro — Commercial Package' },
    });
    expect(res.status).toBe(409);
    expect(prismaMock.legacyProductModel.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /product-models/:id', () => {
  it('404s (never 403) a cross-tenant patch without writing', async () => {
    const res = await server.request('PATCH', '/product-models/m1', {
      tenant: TENANT_B,
      body: { disposition: 'Retire' },
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(prismaMock.legacyProductModel.update).not.toHaveBeenCalled();
  });

  it('patches an in-tenant model and audits the diff', async () => {
    const res = await server.request<{ disposition: string }>('PATCH', '/product-models/m1', {
      body: { disposition: 'Retire', geography: 'UK' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ disposition: 'Retire', geography: 'UK' });
    expect(prismaMock.legacyProductModel.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { disposition: 'Retire', geography: 'UK' },
    });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_LEGACY_MODEL', entityId: 'pw1' }),
    );
  });
});
