// Product-model findings CRUD (PM-07): create validation + tenant walk,
// reclassify/patch guards (zod, Unknown targetComponentId, cross-tenant 404),
// and the §2-C DELETE — all audited against the parent workspace.
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
  productModelFinding: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  legacyProductModel: { findFirst: vi.fn() },
  productModelComponent: { findFirst: vi.fn() },
  productModelAnatomyCategory: { findFirst: vi.fn() },
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

const MODEL = {
  id: 'm1',
  tenantId: TENANT_A,
  companyId: 'co1',
  workspaceId: 'pw1',
  name: 'PolicyPro — Commercial Package',
};

const FINDING = {
  id: 'pf1',
  tenantId: TENANT_A,
  companyId: 'co1',
  workspaceId: 'pw1',
  legacyModelId: 'm1',
  component: 'Rating & Pricing',
  name: 'Minimum premium $500 hard-coded in rate routine RT-114',
  detail: null,
  scope: 'Common',
  segmentValue: null,
  geographyValue: null,
  sourceRef: 'RT-114',
  anatomyCategoryId: null,
  targetComponentId: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
};

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.legacyProductModel.findFirst.mockImplementation(findFirstFrom([MODEL]));
  prismaMock.productModelFinding.findFirst.mockImplementation(findFirstFrom([FINDING]));
  prismaMock.productModelFinding.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...FINDING, ...data }),
  );
  prismaMock.productModelFinding.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'pf-new', ...data }),
  );
  prismaMock.productModelFinding.delete.mockResolvedValue(FINDING);
  server = await startRouteServer('/product-models', router);
  return () => server.close();
});

describe('POST /product-models/findings', () => {
  it('400s a body missing required fields via zod', async () => {
    const res = await server.request('POST', '/product-models/findings', {
      body: { workspaceId: 'pw1', legacyModelId: 'm1', name: 'x' }, // no component
    });
    expect(res.status).toBe(400);
    expect(prismaMock.productModelFinding.create).not.toHaveBeenCalled();
  });

  it('400s an invalid scope enum token', async () => {
    const res = await server.request('POST', '/product-models/findings', {
      body: {
        workspaceId: 'pw1',
        legacyModelId: 'm1',
        component: 'Rating & Pricing',
        name: 'x',
        scope: 'Regional', // not Common|Segment|Geography|Eliminate
      },
    });
    expect(res.status).toBe(400);
  });

  it("404s when the legacy model isn't reachable from the requester tenant", async () => {
    const res = await server.request('POST', '/product-models/findings', {
      tenant: TENANT_B,
      body: { workspaceId: 'pw1', legacyModelId: 'm1', component: 'Rating & Pricing', name: 'x' },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.productModelFinding.create).not.toHaveBeenCalled();
  });

  it('creates the finding under the model tenant/company/workspace and audits it', async () => {
    const res = await server.request<{ id: string; component: string }>(
      'POST',
      '/product-models/findings',
      {
        body: {
          workspaceId: 'pw1',
          legacyModelId: 'm1',
          component: 'Coverage & Perils',
          name: 'Hired & non-owned auto endorsement attached by default',
          scope: 'Segment',
          segmentValue: 'SMB',
        },
      },
    );
    expect(res.status).toBe(201);
    expect(prismaMock.productModelFinding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_A,
        companyId: 'co1',
        workspaceId: 'pw1',
        legacyModelId: 'm1',
        scope: 'Segment',
        segmentValue: 'SMB',
      }),
    });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_FINDING', entityId: 'pw1' }),
    );
  });
});

describe('PATCH /product-models/findings/:id', () => {
  it('404s (never 403) a cross-tenant patch', async () => {
    const res = await server.request('PATCH', '/product-models/findings/pf1', {
      tenant: TENANT_B,
      body: { deadCode: true },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.productModelFinding.update).not.toHaveBeenCalled();
  });

  it('400s an unknown targetComponentId (not on this board)', async () => {
    prismaMock.productModelComponent.findFirst.mockResolvedValue(null);
    const res = await server.request('PATCH', '/product-models/findings/pf1', {
      body: { targetComponentId: 'foreign-component' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unknown targetComponentId' });
    expect(prismaMock.productModelComponent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign-component', tenantId: TENANT_A, workspaceId: 'pw1' },
      }),
    );
    expect(prismaMock.productModelFinding.update).not.toHaveBeenCalled();
  });

  it('400s an invalid migrationStatus token', async () => {
    const res = await server.request('PATCH', '/product-models/findings/pf1', {
      body: { migrationStatus: 'Done' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid migrationStatus' });
  });

  it('reclassifies scope + values, persists deadCode and audits the change', async () => {
    const res = await server.request<{ scope: string; deadCode: boolean }>(
      'PATCH',
      '/product-models/findings/pf1',
      { body: { scope: 'Geography', geographyValue: 'US-NY', deadCode: true } },
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scope: 'Geography', deadCode: true });
    expect(prismaMock.productModelFinding.update).toHaveBeenCalledWith({
      where: { id: 'pf1' },
      data: { scope: 'Geography', geographyValue: 'US-NY', deadCode: true },
    });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_FINDING', entityId: 'pw1' }),
    );
  });
});

describe('DELETE /product-models/findings/:id', () => {
  it('404s (never 403) a cross-tenant delete without deleting', async () => {
    const res = await server.request('DELETE', '/product-models/findings/pf1', {
      tenant: TENANT_B,
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(prismaMock.productModelFinding.delete).not.toHaveBeenCalled();
  });

  it('deletes an in-tenant finding, audits it, and returns 204', async () => {
    const res = await server.request('DELETE', '/product-models/findings/pf1');
    expect(res.status).toBe(204);
    expect(prismaMock.productModelFinding.delete).toHaveBeenCalledWith({ where: { id: 'pf1' } });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_FINDING',
        entityType: 'ProductModelWorkspace',
        entityId: 'pw1',
        tenantId: TENANT_A,
      }),
    );
  });
});
