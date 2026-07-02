// tenant — app-layer tenant scoping helper (mocked prisma).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  company: { findFirst: vi.fn() },
}));
vi.mock('../../src/db/prisma.js', () => ({ prisma: prismaMock }));

import { tenantCompany } from '../../src/lib/tenant.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tenantCompany', () => {
  it('scopes the lookup by BOTH id and tenantId', async () => {
    const row = { id: 'c1', tenantId: 't1', name: 'Acme' };
    prismaMock.company.findFirst.mockResolvedValue(row);

    expect(await tenantCompany('c1', 't1')).toBe(row);
    expect(prismaMock.company.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 't1' } });
  });

  it('returns null on a cross-tenant or missing id (caller turns this into a 404)', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null);
    expect(await tenantCompany('c1', 'other-tenant')).toBeNull();
  });
});
