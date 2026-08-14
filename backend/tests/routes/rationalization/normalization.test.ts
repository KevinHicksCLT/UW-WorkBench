// Normalize-column write paths: PATCH /rationalization/normalization-entries/:id
// (approve / hold / re-map, audited) and POST /rationalization/:id/rematch (the
// matcher-driven rebuild that persists matchStatus back onto the entries).
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
  normalizationEntry: {
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  rationalizationComponent: { findFirst: vi.fn() },
  rationalizationCapability: { updateMany: vi.fn() },
  rationalizationWorkspace: { findFirst: vi.fn() },
  anatomyCategory: { findMany: vi.fn() },
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

const { default: router } = await import('../../../src/routes/rationalization/index.js');

const ENTRY = {
  id: 'n1',
  tenantId: TENANT_A,
  workspaceId: 'ws1',
  layer: 'UI',
  notation: 'N-101',
  name: 'Loss Capture Form',
  matchStatus: 'REVIEW',
  matchBasis: null,
  differenceNote: 'validation timing differs',
  proposedResolution: null,
  componentId: null,
};

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.normalizationEntry.findFirst.mockImplementation(findFirstFrom([ENTRY]));
  prismaMock.normalizationEntry.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...ENTRY, ...data }),
  );
  prismaMock.normalizationEntry.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.normalizationEntry.createMany.mockResolvedValue({ count: 0 });
  prismaMock.rationalizationCapability.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.anatomyCategory.findMany.mockResolvedValue([]);
  server = await startRouteServer('/rationalization', router);
  return () => server.close();
});

describe('PATCH /rationalization/normalization-entries/:id', () => {
  it('404s (never 403) a cross-tenant patch without writing', async () => {
    const res = await server.request('PATCH', '/rationalization/normalization-entries/n1', {
      tenant: TENANT_B,
      body: { matchStatus: 'AUTO' },
    });
    expect(res.status).toBe(404);
    expect(prismaMock.normalizationEntry.update).not.toHaveBeenCalled();
  });

  it('400s a bad matchStatus via zod before any lookup', async () => {
    const res = await server.request('PATCH', '/rationalization/normalization-entries/n1', {
      body: { matchStatus: 'MAYBE' },
    });
    expect(res.status).toBe(400);
    expect(prismaMock.normalizationEntry.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a componentId from another board with 400 Unknown componentId', async () => {
    prismaMock.rationalizationComponent.findFirst.mockResolvedValue(null);
    const res = await server.request('PATCH', '/rationalization/normalization-entries/n1', {
      body: { componentId: 'other-board-comp' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unknown componentId' });
    // The re-map target lookup must be pinned to the entry's own workspace.
    expect(prismaMock.rationalizationComponent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-board-comp', tenantId: TENANT_A, workspaceId: 'ws1' },
      }),
    );
    expect(prismaMock.normalizationEntry.update).not.toHaveBeenCalled();
  });

  it('approves a REVIEW entry (matchStatus → AUTO) and audits the resolution', async () => {
    const res = await server.request<{ matchStatus: string }>(
      'PATCH',
      '/rationalization/normalization-entries/n1',
      { body: { matchStatus: 'AUTO', proposedResolution: 'adopt app1 flow' } },
    );
    expect(res.status).toBe(200);
    expect(res.body.matchStatus).toBe('AUTO');
    expect(prismaMock.normalizationEntry.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { matchStatus: 'AUTO', proposedResolution: 'adopt app1 flow' },
    });
    expect(auditMock.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        entityType: 'RationalizationWorkspace',
        entityId: 'ws1',
        action: 'RESOLVE_NORMALIZATION',
      }),
    );
  });
});

describe('POST /rationalization/:id/rematch', () => {
  const WS = {
    id: 'ws1',
    tenantId: TENANT_A,
    companyId: 'co1',
    // UI: the same form named identically in both apps → one AUTO entry.
    // Data: overlapping-but-different names, no concept agreement → HELD.
    capabilities: [
      { id: 'f1', appId: 'a1', layer: 'UI', name: 'Loss Capture Form', componentId: null },
      { id: 'f2', appId: 'a2', layer: 'UI', name: 'Loss capture form', componentId: null },
      { id: 'f3', appId: 'a1', layer: 'Data', name: 'Premium billing schedule', componentId: null },
      { id: 'f4', appId: 'a2', layer: 'Data', name: 'Premium schedule', componentId: null },
    ],
    components: [
      { id: 'c-ui', layer: 'UI' },
      { id: 'c-data', layer: 'Data' },
    ],
  };

  it('404s a cross-tenant rematch', async () => {
    prismaMock.rationalizationWorkspace.findFirst.mockImplementation(findFirstFrom([WS]));
    const res = await server.request('POST', '/rationalization/ws1/rematch', { tenant: TENANT_B });
    expect(res.status).toBe(404);
    expect(prismaMock.normalizationEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('rebuilds the entries and persists the matcher verdicts (AUTO + HELD)', async () => {
    prismaMock.rationalizationWorkspace.findFirst.mockImplementation(findFirstFrom([WS]));
    const res = await server.request<{ ok: boolean; entries: number; awaitingReview: number }>(
      'POST',
      '/rationalization/ws1/rematch',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, entries: 2, awaitingReview: 1 });

    // Wholesale rebuild: old entries dropped for this workspace only.
    expect(prismaMock.normalizationEntry.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws1' },
    });

    const created = prismaMock.normalizationEntry.createMany.mock.calls[0][0] as {
      data: {
        layer: string;
        notation: string;
        matchStatus: string;
        componentId: string | null;
        workspaceId: string;
        tenantId: string;
      }[];
    };
    const ui = created.data.find((e) => e.layer === 'UI');
    const data = created.data.find((e) => e.layer === 'Data');
    // Same normalized name across both sources → AUTO, homed on the UI component.
    expect(ui).toMatchObject({ matchStatus: 'AUTO', notation: 'N-101', componentId: 'c-ui' });
    // Related names, no concept agreement → HELD (layer index 4 → N-4xx).
    expect(data).toMatchObject({ matchStatus: 'HELD', notation: 'N-401', componentId: 'c-data' });
    expect(created.data.every((e) => e.workspaceId === 'ws1' && e.tenantId === TENANT_A)).toBe(
      true,
    );

    // Raw findings are linked back to their new entries.
    const linkCalls = prismaMock.rationalizationCapability.updateMany.mock.calls.map(
      (c) => c[0] as { where: { id: { in: string[] } }; data: { normalizationEntryId: string } },
    );
    const linkedIds = linkCalls.flatMap((c) => c.where.id.in).sort();
    expect(linkedIds).toEqual(['f1', 'f2', 'f3', 'f4']);
    expect(linkCalls.every((c) => typeof c.data.normalizationEntryId === 'string')).toBe(true);
  });
});
