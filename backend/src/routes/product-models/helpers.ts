// Shared helpers for the /product-models feature module: active-company
// resolution and the product-component row axis (vocabulary-driven with a
// data-derived fallback so the board renders before the vocab seed runs).
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';

export async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}

/** CSV query param → value list (empty array when absent). */
export const csv = (v: unknown): string[] =>
  typeof v === 'string' && v.trim()
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * The 11-component row axis, from the seeded PRODUCT_MODEL LAYER vocabulary
 * (§6.4). Falls back to the distinct components present in the data so a
 * pre-seed environment still renders rows.
 */
export async function componentAxis(companyId: string, fallback: string[]): Promise<string[]> {
  const rows = await prisma.workspaceVocabulary.findMany({
    where: { companyId, domain: 'PRODUCT_MODEL', kind: 'LAYER' },
    orderBy: { sortOrder: 'asc' },
    select: { token: true },
  });
  if (rows.length > 0) return rows.map((r) => r.token);
  return [...new Set(fallback)];
}

export const SCOPES = ['Common', 'Segment', 'Geography', 'Eliminate'] as const;
export const DISPOSITIONS = ['Retain', 'Refactor', 'Replace', 'Retire'] as const;

export function scopeCounts(rows: { scope: string }[]) {
  const m: Record<string, number> = { Common: 0, Segment: 0, Geography: 0, Eliminate: 0 };
  for (const r of rows) m[r.scope] = (m[r.scope] ?? 0) + 1;
  return m;
}
