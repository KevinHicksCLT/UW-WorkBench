/**
 * Shared helpers for the erd_v5 explorer API — active-company resolution and
 * the company's ProcessLevelType id↔levelNumber map used by most handlers.
 */
import type { Request } from 'express';
import { prisma } from '../../db/prisma.js';


export async function activeCompany(req: Request, select: { id?: true; name?: true } = { id: true, name: true }) {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  return prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select,
  });
}

// process-level-type id → levelNumber for a company (cheap, used by several routes).
export async function processLevelMap(companyId: string) {
  const types = await prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } });
  return { byId: new Map(types.map((t) => [t.id, t.levelNumber])), idOf: (n: number) => types.find((t) => t.levelNumber === n)?.id ?? null };
}

// ── overview (map bootstrap) ────────────────────────────────────────────────
// domains = process L1, divisions = process L2 (the map's L2 row). Per-bucket
