// GET /rationalization/vocabulary — the DB-as-source-of-truth board vocabulary
// (plan §3 2-B, §6.2 DTO): domain validation, single-domain filter, and the
// both-domains behavior when ?domain is omitted.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuthModule, fakePermissionsModule, startRouteServer, TENANT_A } from '../harness.js';
import type { RouteServer } from '../harness.js';

const prismaMock = vi.hoisted(() => ({
  company: { findFirst: vi.fn() },
  workspaceVocabulary: { findMany: vi.fn() },
  anatomyCategory: { findMany: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/middleware/auth.js', () => fakeAuthModule());
vi.mock('../../../src/middleware/permissions.js', () => fakePermissionsModule());

const { default: router } = await import('../../../src/routes/rationalization/index.js');

const APP_ROW = {
  domain: 'APPLICATION',
  kind: 'LAYER',
  token: 'UI',
  label: 'UI',
  color: 'sky',
  sortOrder: 0,
  meta: null,
};
const PM_ROW = {
  domain: 'PRODUCT_MODEL',
  kind: 'CLASSIFICATION',
  token: 'Segment',
  label: 'Segment',
  color: 'amber',
  sortOrder: 1,
  meta: { legend: 'segment-specific' },
};

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' });
  prismaMock.workspaceVocabulary.findMany.mockResolvedValue([APP_ROW, PM_ROW]);
  server = await startRouteServer('/rationalization', router);
  return () => server.close();
});

describe('GET /rationalization/vocabulary', () => {
  it('400s on an unknown ?domain= before touching the DB', async () => {
    const res = await server.request('GET', '/rationalization/vocabulary?domain=BOGUS');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('domain must be one of APPLICATION | PRODUCT_MODEL');
    expect(prismaMock.workspaceVocabulary.findMany).not.toHaveBeenCalled();
  });

  it('filters to one domain when ?domain= is valid', async () => {
    prismaMock.workspaceVocabulary.findMany.mockResolvedValue([PM_ROW]);
    const res = await server.request<{ vocabulary: (typeof PM_ROW)[] }>(
      'GET',
      '/rationalization/vocabulary?domain=PRODUCT_MODEL',
    );
    expect(res.status).toBe(200);
    expect(res.body.vocabulary).toEqual([PM_ROW]);
    expect(prismaMock.workspaceVocabulary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'co1', domain: 'PRODUCT_MODEL' },
      }),
    );
  });

  it('serves BOTH domains when ?domain is omitted (no domain filter)', async () => {
    const res = await server.request<{ vocabulary: { domain: string }[] }>(
      'GET',
      '/rationalization/vocabulary',
    );
    expect(res.status).toBe(200);
    expect(res.body.vocabulary.map((v) => v.domain)).toEqual(['APPLICATION', 'PRODUCT_MODEL']);
    // The where clause must not constrain domain at all.
    expect(prismaMock.workspaceVocabulary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'co1' } }),
    );
  });

  it('resolves the active company from the requester tenant and 404s when none exists', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null);
    const res = await server.request('GET', '/rationalization/vocabulary');
    expect(res.status).toBe(404);
    expect(prismaMock.company.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } }),
    );
  });
});
