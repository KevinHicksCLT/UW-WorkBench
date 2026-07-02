// linkNames — generic id → display-string resolver over the four link models,
// exercised with a structural PrismaClient double (no DB).
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { linkNames } from '../../../src/lib/resolvers/linkNames.js';

function makePrisma() {
  const doubles = {
    processNode: { findMany: vi.fn() },
    orgUnit: { findMany: vi.fn() },
    role: { findMany: vi.fn() },
    application: { findMany: vi.fn() },
  };
  return { doubles, prisma: doubles as unknown as PrismaClient };
}

describe('linkNames', () => {
  it('resolves processNode ids to displayValue', async () => {
    const { doubles, prisma } = makePrisma();
    doubles.processNode.findMany.mockResolvedValue([
      { id: 'n1', displayValue: 'Claims' },
      { id: 'n2', displayValue: 'Underwriting' },
    ]);

    const out = await linkNames(prisma, ['n1', 'n2'], 'processNode');
    expect(out.get('n1')).toBe('Claims');
    expect(out.get('n2')).toBe('Underwriting');
    expect(doubles.processNode.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] } },
      select: { id: true, displayValue: true },
    });
  });

  it('resolves orgUnit and role ids to displayValue', async () => {
    const { doubles, prisma } = makePrisma();
    doubles.orgUnit.findMany.mockResolvedValue([{ id: 'ou1', displayValue: 'Operations' }]);
    doubles.role.findMany.mockResolvedValue([{ id: 'r1', displayValue: 'Adjuster' }]);

    expect((await linkNames(prisma, ['ou1'], 'orgUnit')).get('ou1')).toBe('Operations');
    expect((await linkNames(prisma, ['r1'], 'role')).get('r1')).toBe('Adjuster');
  });

  it('resolves application ids to the canonical name field', async () => {
    const { doubles, prisma } = makePrisma();
    doubles.application.findMany.mockResolvedValue([{ id: 'a1', name: 'Guidewire' }]);

    const out = await linkNames(prisma, ['a1'], 'application');
    expect(out.get('a1')).toBe('Guidewire');
    expect(doubles.application.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1'] } },
      select: { id: true, name: true },
    });
  });

  it('dedupes ids and skips null/undefined/empty entries', async () => {
    const { doubles, prisma } = makePrisma();
    doubles.role.findMany.mockResolvedValue([{ id: 'r1', displayValue: 'Adjuster' }]);

    await linkNames(prisma, ['r1', null, undefined, '', 'r1'], 'role');
    expect(doubles.role.findMany).toHaveBeenCalledTimes(1);
    expect(doubles.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['r1'] } } }),
    );
  });

  it('returns an empty map without querying when no usable ids remain', async () => {
    const { doubles, prisma } = makePrisma();
    const out = await linkNames(prisma, [null, undefined, ''], 'processNode');
    expect(out.size).toBe(0);
    expect(doubles.processNode.findMany).not.toHaveBeenCalled();
  });

  it('omits rows whose name is null', async () => {
    const { doubles, prisma } = makePrisma();
    doubles.processNode.findMany.mockResolvedValue([
      { id: 'n1', displayValue: null },
      { id: 'n2', displayValue: 'Named' },
    ]);
    const out = await linkNames(prisma, ['n1', 'n2'], 'processNode');
    expect(out.has('n1')).toBe(false);
    expect(out.get('n2')).toBe('Named');
  });
});
