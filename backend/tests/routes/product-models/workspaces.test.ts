// Product-model board API: the §6.2 StageDetail-mirror DTO (domain, columnStats,
// normalizeStats, normalizationEntries with findingIds, findings with scope /
// segmentValue / geographyValue / deadCode / whyThisMoves), the PM-05 inspection
// filters, workspace create validation, and the matcher-driven rematch.
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
  productModelWorkspace: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  workspaceVocabulary: { findMany: vi.fn() },
  company: { findFirst: vi.fn() },
  productModelAnatomyCategory: { findMany: vi.fn() },
  productModelNormalizationEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
  productModelFinding: { updateMany: vi.fn() },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
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

const finding = (
  id: string,
  legacyModelId: string,
  over: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id,
  legacyModelId,
  component: 'Coverage & Perils',
  name: `Finding ${id}`,
  detail: null,
  scope: 'Common',
  segmentValue: null,
  geographyValue: null,
  sourceRef: null,
  anatomyCategoryId: null,
  targetComponentId: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
  ...over,
});

// Three legacy models across segments/geographies so every PM-05 filter has a
// discriminating fixture; findings follow their model through the filters.
const WORKSPACE = {
  id: 'pw1',
  tenantId: TENANT_A,
  companyId: 'co1',
  name: 'Commercial & Personal Lines North Star',
  description: null,
  northstar: null,
  status: 'Active',
  illustrative: true,
  layout: null,
  legacyModels: [
    {
      id: 'm1',
      name: 'PolicyPro — Commercial Package',
      sourceSystem: 'PolicyPro',
      segment: 'SMB',
      geography: 'US-East',
      disposition: 'Replace',
      position: 0,
    },
    {
      id: 'm2',
      name: 'QuoteMaster — Personal Auto',
      sourceSystem: 'QuoteMaster',
      segment: 'Personal Lines',
      geography: 'US',
      disposition: 'Refactor',
      position: 1,
    },
    {
      id: 'm3',
      name: 'London Market Binder',
      sourceSystem: 'Binder MGA platform',
      segment: 'SMB',
      geography: 'UK',
      disposition: 'Retain',
      position: 2,
    },
  ],
  components: [
    {
      id: 'pc1',
      component: 'Coverage & Perils',
      name: 'Coverage & Perils',
      principle: null,
      canonicalModelId: 'cm1',
      migrationStatus: 'Identified',
      sortOrder: 0,
    },
  ],
  canonicalModels: [
    {
      id: 'cm1',
      name: 'Commercial Package North Star',
      lineOfBusiness: 'Commercial Package',
      position: 0,
      ownerRole: { displayValue: 'Product Owner — Commercial' },
      components: [{ migrationStatus: 'In Migration' }],
    },
  ],
  findings: [
    finding('pf1', 'm1', {
      scope: 'Segment',
      segmentValue: 'SMB',
      normalizationEntryId: 'pn1',
      whyThisMoves: { captured: 'CA 20 01 endorsement default', lands: 'Coverage component' },
    }),
    finding('pf2', 'm2', { scope: 'Geography', geographyValue: 'US-NY' }),
    finding('pf3', 'm3', { scope: 'Eliminate', deadCode: true }),
  ],
  normalizationEntries: [
    {
      id: 'pn1',
      layer: 'Coverage & Perils',
      notation: 'N-301',
      name: 'Hired & non-owned auto endorsement',
      matchStatus: 'AUTO',
      matchBasis: '2→1 semantically same — names match',
      differenceNote: null,
      proposedResolution: null,
      sourceCards: null,
      componentId: 'pc1',
      findings: [{ id: 'pf1' }],
    },
  ],
};

interface PmBoardDetail {
  id: string;
  domain: string;
  counts: Record<string, number>;
  apps: { id: string; segment: string | null; geography: string | null }[];
  microservices: { id: string; status: string; ownerRole: string | null }[];
  columnStats: {
    sourceId: string;
    rawSteps: number;
    correct: number;
    move: number;
    deadCode: number;
  }[];
  normalizeStats: { raw: number; normalized: number; awaitingReview: number };
  normalizationEntries: {
    id: string;
    notation: string;
    matchStatus: string;
    findingIds: string[];
  }[];
  findings: {
    id: string;
    appId: string;
    layer: string;
    scope: string;
    segmentValue: string | null;
    geographyValue: string | null;
    deadCode: boolean;
    normalizationEntryId: string | null;
    whyThisMoves: Record<string, string> | null;
  }[];
}

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.productModelWorkspace.findFirst.mockImplementation(findFirstFrom([WORKSPACE]));
  prismaMock.workspaceVocabulary.findMany.mockResolvedValue([]); // pre-seed axis fallback
  prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' });
  prismaMock.productModelAnatomyCategory.findMany.mockResolvedValue([]);
  prismaMock.productModelNormalizationEntry.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.productModelNormalizationEntry.createMany.mockResolvedValue({ count: 0 });
  prismaMock.productModelFinding.updateMany.mockResolvedValue({ count: 0 });
  server = await startRouteServer('/product-models', router);
  return () => server.close();
});

describe('GET /product-models/workspaces/:id', () => {
  it('404s (never 403) a cross-tenant read', async () => {
    const res = await server.request('GET', '/product-models/workspaces/pw1', {
      tenant: TENANT_B,
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('serves the §6.2 contract: PRODUCT_MODEL domain, roll-ups, entries with findingIds, product-scoped findings', async () => {
    const res = await server.request<PmBoardDetail>('GET', '/product-models/workspaces/pw1');
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe('PRODUCT_MODEL');
    expect(res.body.counts).toEqual({
      findings: 3,
      Common: 0,
      Segment: 1,
      Geography: 1,
      Eliminate: 1,
    });

    // Eliminate scope counts as a move; deadCode is its own bucket.
    expect(res.body.columnStats).toEqual(
      expect.arrayContaining([
        { sourceId: 'm1', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
        { sourceId: 'm2', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
        { sourceId: 'm3', rawSteps: 1, correct: 0, move: 0, deadCode: 1 },
      ]),
    );
    expect(res.body.normalizeStats).toEqual({ raw: 3, normalized: 1, awaitingReview: 0 });
    expect(res.body.normalizationEntries[0]).toMatchObject({
      id: 'pn1',
      notation: 'N-301',
      matchStatus: 'AUTO',
      findingIds: ['pf1'],
    });

    // Canonical models fill the greenfield slot with the on-read status roll-up.
    expect(res.body.microservices[0]).toMatchObject({
      id: 'cm1',
      status: 'Building',
      ownerRole: 'Product Owner — Commercial',
    });

    const byId = new Map(res.body.findings.map((f) => [f.id, f]));
    expect(byId.get('pf1')).toMatchObject({
      appId: 'm1',
      layer: 'Coverage & Perils',
      scope: 'Segment',
      segmentValue: 'SMB',
      normalizationEntryId: 'pn1',
      whyThisMoves: { captured: 'CA 20 01 endorsement default', lands: 'Coverage component' },
    });
    expect(byId.get('pf2')).toMatchObject({ scope: 'Geography', geographyValue: 'US-NY' });
    expect(byId.get('pf3')).toMatchObject({ scope: 'Eliminate', deadCode: true });
  });

  it('?legacyModelIds= narrows the columns, findings and roll-ups to those models', async () => {
    const res = await server.request<PmBoardDetail>(
      'GET',
      '/product-models/workspaces/pw1?legacyModelIds=m1',
    );
    expect(res.body.apps.map((a) => a.id)).toEqual(['m1']);
    expect(res.body.findings.map((f) => f.id)).toEqual(['pf1']);
    expect(res.body.columnStats).toEqual([
      { sourceId: 'm1', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
    ]);
    expect(res.body.counts.findings).toBe(1);
  });

  it('?segments= keeps every model in the segment', async () => {
    const res = await server.request<PmBoardDetail>(
      'GET',
      '/product-models/workspaces/pw1?segments=SMB',
    );
    expect(res.body.apps.map((a) => a.id)).toEqual(['m1', 'm3']);
    expect(res.body.findings.map((f) => f.id)).toEqual(['pf1', 'pf3']);
  });

  it('?geographies= narrows to the matching geography', async () => {
    const res = await server.request<PmBoardDetail>(
      'GET',
      '/product-models/workspaces/pw1?geographies=UK',
    );
    expect(res.body.apps.map((a) => a.id)).toEqual(['m3']);
    expect(res.body.findings.map((f) => f.id)).toEqual(['pf3']);
    expect(res.body.normalizeStats.raw).toBe(1);
  });
});

describe('POST /product-models/workspaces', () => {
  it('400s a body without a name via zod', async () => {
    const res = await server.request('POST', '/product-models/workspaces', {
      body: { description: 'no name' },
    });
    expect(res.status).toBe(400);
    expect(prismaMock.productModelWorkspace.create).not.toHaveBeenCalled();
  });

  it('409s a duplicate workspace name within the company', async () => {
    const res = await server.request('POST', '/product-models/workspaces', {
      body: { name: 'Commercial & Personal Lines North Star' },
    });
    expect(res.status).toBe(409);
    expect(prismaMock.productModelWorkspace.create).not.toHaveBeenCalled();
  });
});

describe('POST /product-models/workspaces/:id/rematch', () => {
  it('404s a cross-tenant rematch', async () => {
    const res = await server.request('POST', '/product-models/workspaces/pw1/rematch', {
      tenant: TENANT_B,
    });
    expect(res.status).toBe(404);
    expect(prismaMock.productModelNormalizationEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('persists matcher verdicts against the anatomy concepts and links findings back', async () => {
    // pr1/pr2 both normalize onto the catalog's "Named Insured" concept → one
    // AUTO entry; pr3/pr4 are related names with no concept agreement → HELD.
    const REMATCH_WS = {
      id: 'pw1',
      tenantId: TENANT_A,
      companyId: 'co1',
      findings: [
        { id: 'pr1', legacyModelId: 'm1', component: 'Coverage & Perils', name: 'Named Insured' },
        { id: 'pr2', legacyModelId: 'm2', component: 'Coverage & Perils', name: 'Named insureds' },
        {
          id: 'pr3',
          legacyModelId: 'm1',
          component: 'Coverage & Perils',
          name: 'Blanket additional insured endorsement',
        },
        {
          id: 'pr4',
          legacyModelId: 'm2',
          component: 'Coverage & Perils',
          name: 'Additional insured endorsement schedule',
        },
      ],
      components: [{ id: 'pc1', component: 'Coverage & Perils' }],
    };
    prismaMock.productModelWorkspace.findFirst.mockImplementation(findFirstFrom([REMATCH_WS]));
    prismaMock.productModelAnatomyCategory.findMany.mockResolvedValue([
      { component: 'Coverage & Perils', slug: 'named-insured', name: 'Named Insured' },
    ]);
    const res = await server.request<{ ok: boolean; entries: number; awaitingReview: number }>(
      'POST',
      '/product-models/workspaces/pw1/rematch',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, entries: 2, awaitingReview: 1 });

    expect(prismaMock.productModelNormalizationEntry.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'pw1' },
    });
    const created = prismaMock.productModelNormalizationEntry.createMany.mock.calls[0][0] as {
      data: {
        layer: string;
        matchStatus: string;
        componentId: string | null;
        workspaceId: string;
        tenantId: string;
      }[];
    };
    const statuses = created.data.map((e) => e.matchStatus).sort();
    expect(statuses).toEqual(['AUTO', 'HELD']);
    expect(
      created.data.every(
        (e) => e.workspaceId === 'pw1' && e.tenantId === TENANT_A && e.componentId === 'pc1',
      ),
    ).toBe(true);

    const linkCalls = prismaMock.productModelFinding.updateMany.mock.calls.map(
      (c) => c[0] as { where: { id: { in: string[] } }; data: { normalizationEntryId: string } },
    );
    expect(linkCalls.flatMap((c) => c.where.id.in).sort()).toEqual(['pr1', 'pr2', 'pr3', 'pr4']);
    expect(linkCalls.every((c) => typeof c.data.normalizationEntryId === 'string')).toBe(true);
  });
});
