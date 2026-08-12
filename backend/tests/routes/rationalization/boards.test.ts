// GET /rationalization/:id — the v3 board detail DTO (§6.2 contract guard):
// columnStats / normalizeStats / normalizationEntries (with findingIds) /
// findings (deadCode, whyThisMoves, normalizationEntryId), and the tenant walk
// that 404s cross-tenant reads.
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
  rationalizationWorkspace: { findFirst: vi.fn() },
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

const { default: router } = await import('../../../src/routes/rationalization/index.js');

const cap = (
  id: string,
  appId: string,
  over: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id,
  appId,
  layer: 'UI',
  category: 'Screens',
  view: 'COMPONENT',
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  capdan: 'Common',
  targetLayer: null,
  sharedServiceId: null,
  name: `Finding ${id}`,
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
  ...over,
});

// Two legacy apps; app1 has 1 correct + 1 relocation + 1 dead-code finding,
// app2 has 1 correct — the wireframe's per-column header math.
const WORKSPACE = {
  id: 'ws1',
  tenantId: TENANT_A,
  name: 'Stage 1',
  application: 'ClaimsLegacy',
  applicationRef: { name: 'ClaimsLegacy' },
  stageOrder: 0,
  businessProcess: 'FNOL',
  description: null,
  northstar: null,
  status: 'Active',
  domain: 'APPLICATION',
  illustrative: true,
  layout: null,
  apps: [
    {
      id: 'a1',
      name: 'Legacy 1',
      applicationRef: { id: 'app1', name: 'ClaimsLegacy', scanStatus: 'SCANNED' },
      kind: 'LEGACY',
      techStack: 'COBOL',
      disposition: 'Replace',
      position: 0,
    },
    {
      id: 'a2',
      name: 'Legacy 2',
      applicationRef: null,
      kind: 'LEGACY',
      techStack: null,
      disposition: 'Replace',
      position: 1,
    },
  ],
  microservices: [
    {
      id: 'ms1',
      name: 'Claims — Greenfield',
      kind: 'Platform',
      status: 'Planned',
      techStack: 'Java 21',
      ownerRole: { displayValue: 'Claims Product Owner' },
      targetDate: null,
    },
  ],
  components: [
    {
      id: 'c1',
      layer: 'UI',
      name: 'UI Components / Fields',
      principle: null,
      pattern: null,
      targetTech: null,
      destination: null,
      microserviceId: 'ms1',
      migrationStatus: 'Identified',
      targetDate: null,
    },
  ],
  capabilities: [
    cap('f1', 'a1', { normalizationEntryId: 'n1' }),
    cap('f2', 'a1', {
      capdan: 'Relocate',
      targetLayer: 'Business Service',
      whyThisMoves: { captured: 'loss facts', lands: 'Claims domain service' },
    }),
    cap('f3', 'a1', { deadCode: true }),
    cap('f4', 'a2', { normalizationEntryId: 'n1' }),
  ],
  screens: [
    { id: 's1', appId: 'a1', name: 'Loss Capture', kind: 'SCREEN', url: null, processNodeId: null },
  ],
  normalizationEntries: [
    {
      id: 'n1',
      layer: 'UI',
      notation: 'N-101',
      name: 'Loss Capture Form',
      matchStatus: 'AUTO',
      matchBasis: 'all 14 fields match on name, type and order',
      differenceNote: null,
      proposedResolution: null,
      sourceCards: null,
      componentId: 'c1',
      capabilities: [{ id: 'f1' }, { id: 'f4' }],
    },
    {
      id: 'n2',
      layer: 'UI',
      notation: 'N-102',
      name: 'Adjuster Assignment',
      matchStatus: 'REVIEW',
      matchBasis: null,
      differenceNote: 'same 22 fields — flow shape and validation timing differ',
      proposedResolution: 'adopt app1 flow',
      sourceCards: null,
      componentId: 'c1',
      capabilities: [{ id: 'f2' }],
    },
  ],
};

interface BoardDetail {
  id: string;
  domain: string;
  application: string;
  counts: Record<string, number>;
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
    layer: string;
    notation: string;
    name: string;
    matchStatus: string;
    matchBasis: string | null;
    differenceNote: string | null;
    proposedResolution: string | null;
    componentId: string | null;
    findingIds: string[];
  }[];
  findings: {
    id: string;
    appId: string;
    layer: string;
    deadCode: boolean;
    normalizationEntryId: string | null;
    whyThisMoves: Record<string, string> | null;
  }[];
}

let server: RouteServer;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.rationalizationWorkspace.findFirst.mockImplementation(findFirstFrom([WORKSPACE]));
  server = await startRouteServer('/rationalization', router);
  return () => server.close();
});

describe('GET /rationalization/:id', () => {
  it('404s (never 403) a cross-tenant read', async () => {
    const res = await server.request('GET', '/rationalization/ws1', { tenant: TENANT_B });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('serves the §6.2 board-detail contract: columnStats, normalizeStats, normalizationEntries with findingIds', async () => {
    const res = await server.request<BoardDetail>('GET', '/rationalization/ws1');
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe('APPLICATION');
    // Catalog-linked name wins over the free-text label.
    expect(res.body.application).toBe('ClaimsLegacy');

    // Per-legacy-column roll-up: dead code is counted apart from moves.
    expect(res.body.columnStats).toEqual(
      expect.arrayContaining([
        { sourceId: 'a1', rawSteps: 3, correct: 1, move: 1, deadCode: 1 },
        { sourceId: 'a2', rawSteps: 1, correct: 1, move: 0, deadCode: 0 },
      ]),
    );
    expect(res.body.normalizeStats).toEqual({ raw: 4, normalized: 2, awaitingReview: 1 });

    const n1 = res.body.normalizationEntries.find((n) => n.id === 'n1');
    expect(n1).toMatchObject({
      layer: 'UI',
      notation: 'N-101',
      name: 'Loss Capture Form',
      matchStatus: 'AUTO',
      matchBasis: 'all 14 fields match on name, type and order',
      componentId: 'c1',
      findingIds: ['f1', 'f4'],
    });
    const n2 = res.body.normalizationEntries.find((n) => n.id === 'n2');
    expect(n2?.matchStatus).toBe('REVIEW');
    expect(n2?.differenceNote).toContain('flow shape and validation timing differ');
    expect(n2?.proposedResolution).toBe('adopt app1 flow');
  });

  it('serves findings with the v3 fields: deadCode, normalizationEntryId, whyThisMoves', async () => {
    const res = await server.request<BoardDetail>('GET', '/rationalization/ws1');
    const byId = new Map(res.body.findings.map((f) => [f.id, f]));
    expect(byId.get('f1')).toMatchObject({ deadCode: false, normalizationEntryId: 'n1' });
    expect(byId.get('f2')?.whyThisMoves).toEqual({
      captured: 'loss facts',
      lands: 'Claims domain service',
    });
    expect(byId.get('f3')?.deadCode).toBe(true);
    // Absent whyThisMoves serializes as null, not undefined — the panel checks it.
    expect(byId.get('f1')?.whyThisMoves).toBeNull();
  });
});
