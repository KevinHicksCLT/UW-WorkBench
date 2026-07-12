// lib/ontology/taxonomy — scheme builders against a mocked prisma client and
// the flat→compact viewer-tree nesting ({l, n, e, c}, empty keys omitted).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  processNode: { findMany: vi.fn(), count: vi.fn() },
  orgUnit: { findMany: vi.fn(), count: vi.fn() },
  standard: { findMany: vi.fn(), count: vi.fn() },
  application: { findMany: vi.fn(), count: vi.fn() },
  role: { findMany: vi.fn(), count: vi.fn() },
  productModelAnatomyCategory: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import {
  SCHEMES,
  buildScheme,
  conceptUri,
  isScheme,
  schemeCounts,
  toViewerTree,
  type TaxonomyNode,
} from '../../../src/lib/ontology/taxonomy.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toViewerTree', () => {
  const nodes: TaxonomyNode[] = [
    { id: 'a', label: 'Claims', notation: 'CL', parentId: null, extra: { level: 1 } },
    { id: 'b', label: 'FNOL Intake', notation: null, parentId: 'a', extra: null },
    { id: 'c', label: 'Orphan', notation: null, parentId: 'missing', extra: {} },
  ];

  it('nests children under parents and omits empty n/e/c keys', () => {
    const tree = toViewerTree(nodes);
    expect(tree).toEqual([
      { l: 'Claims', n: 'CL', e: { level: 1 }, c: [{ l: 'FNOL Intake' }] },
      { l: 'Orphan' },
    ]);
  });

  it('viewer tree node count equals flat node count', () => {
    const countAll = (t: { c?: unknown[] }[]): number =>
      t.reduce((sum, n) => sum + 1 + countAll((n.c ?? []) as { c?: unknown[] }[]), 0);
    expect(countAll(toViewerTree(nodes))).toBe(nodes.length);
  });
});

describe('scheme registry', () => {
  it('knows its schemes and rejects unknown ones', () => {
    expect(SCHEMES).toContain('process');
    expect(isScheme('roles')).toBe(true);
    expect(isScheme('product-model')).toBe(true);
    expect(isScheme('nonsense')).toBe(false);
  });

  it('mints tbi: concept URIs', () => {
    expect(conceptUri('product-model', 'pm-rating-pricing')).toBe(
      'https://w3id.org/transformation-bridge/id/product-model-pm-rating-pricing',
    );
  });
});

describe('buildScheme', () => {
  it('process: maps nodes with level + task extras and code notation', async () => {
    prismaMock.processNode.findMany.mockResolvedValue([
      {
        id: 'p1',
        displayValue: 'Claims',
        code: 'CL',
        parentId: null,
        isTask: false,
        processLevelType: { levelNumber: 2 },
      },
      {
        id: 'p2',
        displayValue: 'Log FNOL',
        code: null,
        parentId: 'p1',
        isTask: true,
        processLevelType: { levelNumber: 5 },
      },
    ]);
    const nodes = await buildScheme('process', 'co1');
    expect(prismaMock.processNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'co1' } }),
    );
    expect(nodes).toEqual([
      { id: 'p1', label: 'Claims', notation: 'CL', parentId: null, extra: { level: 2 } },
      {
        id: 'p2',
        label: 'Log FNOL',
        notation: null,
        parentId: 'p1',
        extra: { level: 5, task: true },
      },
    ]);
  });

  it('applications: synthesizes category top concepts and parents apps under them', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      {
        id: 'a1',
        name: 'Guidewire',
        code: null,
        kind: 'SystemOfRecord',
        category: 'Claims',
        vendor: 'Guidewire',
      },
      { id: 'a2', name: 'HomeGrown', code: 'HG', kind: 'Tool', category: null, vendor: null },
    ]);
    const nodes = await buildScheme('applications', 'co1');
    const cats = nodes.filter((n) => n.parentId === null);
    expect(cats.map((c) => c.label)).toEqual(['Claims', 'Uncategorized']);
    const gw = nodes.find((n) => n.id === 'a1');
    expect(gw?.parentId).toBe('app-category:claims');
    expect(gw?.extra).toEqual({ kind: 'SystemOfRecord', vendor: 'Guidewire' });
    const hg = nodes.find((n) => n.id === 'a2');
    expect(hg?.parentId).toBe('app-category:uncategorized');
    expect(hg?.notation).toBe('HG');
  });

  it('product-model: components become top concepts, anatomy rows their children', async () => {
    prismaMock.productModelAnatomyCategory.findMany.mockResolvedValue([
      {
        component: 'Rating & Pricing',
        scope: 'COMMON',
        view: 'COMPONENT',
        slug: 'base-rate-tables',
        name: 'Base rate tables',
        recommendedComponent: null,
      },
      {
        component: 'Rating & Pricing',
        scope: 'GEOGRAPHY',
        view: 'MISPLACED',
        slug: 'state-minimum-premium',
        name: 'State minimum premium',
        recommendedComponent: 'Regulatory & Filings',
      },
    ]);
    const nodes = await buildScheme('product-model', 'co1');
    expect(nodes).toEqual([
      {
        id: 'pm-rating-pricing',
        label: 'Rating & Pricing',
        notation: null,
        parentId: null,
        extra: null,
      },
      {
        id: 'pma-base-rate-tables',
        label: 'Base rate tables',
        notation: null,
        parentId: 'pm-rating-pricing',
        extra: { scope: 'COMMON' },
      },
      {
        id: 'pma-state-minimum-premium',
        label: 'State minimum premium',
        notation: null,
        parentId: 'pm-rating-pricing',
        extra: {
          scope: 'GEOGRAPHY',
          view: 'MISPLACED',
          recommendedComponent: 'Regulatory & Filings',
        },
      },
    ]);
  });

  it('roles: org units that home roles become top concepts', async () => {
    prismaMock.role.findMany.mockResolvedValue([
      {
        id: 'r1',
        displayValue: 'Adjuster',
        orgUnitId: 'ou1',
        roleFamily: 'Claims',
        roleLevel: null,
      },
      { id: 'r2', displayValue: 'Freelance', orgUnitId: null, roleFamily: null, roleLevel: null },
    ]);
    prismaMock.orgUnit.findMany.mockResolvedValue([{ id: 'ou1', displayValue: 'Claims Ops' }]);
    const nodes = await buildScheme('roles', 'co1');
    expect(nodes).toEqual([
      { id: 'ou1', label: 'Claims Ops', notation: null, parentId: null, extra: null },
      { id: 'r1', label: 'Adjuster', notation: null, parentId: 'ou1', extra: { family: 'Claims' } },
      { id: 'r2', label: 'Freelance', notation: null, parentId: null, extra: {} },
    ]);
    // Only org units that actually home roles are queried as parents.
    expect(prismaMock.orgUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'co1', roles: { some: {} } },
      }),
    );
  });
});

describe('schemeCounts', () => {
  it('counts every scheme in parallel, scoped to the company', async () => {
    prismaMock.processNode.count.mockResolvedValue(5);
    prismaMock.orgUnit.count.mockResolvedValue(4);
    prismaMock.standard.count.mockResolvedValue(3);
    prismaMock.application.count.mockResolvedValue(2);
    prismaMock.role.count.mockResolvedValue(1);
    prismaMock.productModelAnatomyCategory.count.mockResolvedValue(6);
    await expect(schemeCounts('co1')).resolves.toEqual({
      process: 5,
      organization: 4,
      standards: 3,
      applications: 2,
      roles: 1,
      'product-model': 6,
    });
    expect(prismaMock.standard.count).toHaveBeenCalledWith({ where: { companyId: 'co1' } });
  });
});
