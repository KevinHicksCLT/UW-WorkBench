/**
 * Shared helpers for the generic /admin CRUD surface — entity resolution from
 * the adminRegistry, tenant/company read+write scoping, the money-rollup
 * recompute hook, and Prisma error translation.
 */
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getEntity, companyWhere, type AdminEntity } from '../../lib/adminRegistry.js';
import { recomputeInitiative } from '../../services/portfolioRollup.js';

// Line items whose writes change an initiative's denormalized money rollup, so the
// admin recomputes the parent after create/update/delete (audit A3/ARCH-8).
export const RECOMPUTE_MODELS = new Set(['benefitLine', 'costLine']);
export function maybeRecompute(entity: AdminEntity, row: { initiativeId?: string } | null) {
  if (row?.initiativeId && RECOMPUTE_MODELS.has(entity.model)) void recomputeInitiative(row.initiativeId);
}

// tenantId filter fragment — empty for tenant-less line items (isolation comes from
// the company/parent scope instead).
export function tenantWhere(req: Request, entity: AdminEntity): Record<string, unknown> {
  return entity.hasTenantId === false ? {} : { tenantId: req.tenantId };
}

// Generic, schema-driven CRUD over every tenant-scoped operating-model table.
// One router serves all ~25 entities: the registry (derived from Prisma DMMF)
// describes each entity's editable fields; this router enforces tenant scoping,
// type coercion, and audit logging uniformly. ADMIN-only.
/** Structural view over a dynamic Prisma model delegate (registry-driven CRUD). */
export type DynamicDelegate = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
};

// Typed access to a dynamic Prisma model delegate.
export function modelDelegate(slug: string): DynamicDelegate {
  return (prisma as unknown as Record<string, DynamicDelegate>)[slug];
}
export function delegate(entity: AdminEntity) {
  return modelDelegate(entity.model);
}

// Resolve `:entity` once; 404 on an unknown slug.
export function resolve(req: Request, res: Response): AdminEntity | null {
  const entity = getEntity(req.params.entity);
  if (!entity) {
    res.status(404).json({ error: `Unknown entity: ${req.params.entity}` });
    return null;
  }
  return entity;
}

// Company scoping for reads. Returns the `where` fragment that isolates the
// active company, or null (after sending 400) when a company-scoped entity is
// requested without a companyId. The Company table itself scopes to {} (tenant).
export function readScope(req: Request, res: Response, entity: AdminEntity): Record<string, unknown> | null {
  if (!entity.companyVia) return {};
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) {
    res.status(400).json({ error: 'companyId query parameter is required' });
    return null;
  }
  return companyWhere(entity, cid, req.tenantId);
}

// The active companyId, or null after sending a 400 (used by the unified
// value-stream handlers, which always scope to a company).
export function requireCompanyId(req: Request, res: Response): string | null {
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) {
    res.status(400).json({ error: 'companyId query parameter is required' });
    return null;
  }
  return cid;
}

// Company scoping for writes. Verifies the company belongs to the tenant, sets
// companyId for direct-scoped entities, and validates that a chosen parent FK
// (transitive entities) belongs to the active company. Returns false (after
// sending the error response) when scoping fails.
export async function applyWriteScope(req: Request, res: Response, entity: AdminEntity, data: Record<string, unknown>): Promise<boolean> {
  const v = entity.companyVia;
  if (!v) return true; // Company table — tenant scoped only.
  const cid = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  if (!cid) { res.status(400).json({ error: 'companyId query parameter is required' }); return false; }
  const company = await prisma.company.findFirst({ where: { id: cid, tenantId: req.tenantId }, select: { id: true } });
  if (!company) { res.status(400).json({ error: 'Unknown company for this tenant' }); return false; }

  if (v.kind === 'direct') {
    data.companyId = cid;
  } else if (data[v.scalarField] != null) {
    const parent = await modelDelegate(v.targetSlug).findFirst({
      // Only filter on tenantId when the parent table carries it.
      where: { id: data[v.scalarField], companyId: cid, ...(v.targetHasTenantId ? { tenantId: req.tenantId } : {}) },
      select: { id: true },
    });
    if (!parent) {
      res.status(400).json({ error: `Selected ${v.objectField} does not belong to the active company` });
      return false;
    }
  }
  return true;
}

// through to the central handler.
export function handlePrismaError(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = (e.meta?.target as string[] | undefined)?.join(', ');
      return Object.assign(new Error(`Duplicate value violates a unique constraint${target ? ` (${target})` : ''}`), { status: 400 });
    }
    if (e.code === 'P2003') {
      return Object.assign(new Error('Related record not found (invalid foreign key)'), { status: 400 });
    }
    if (e.code === 'P2025') {
      return Object.assign(new Error('Cannot delete: record is referenced by other rows, or no longer exists'), { status: 409 });
    }
  }
  return e;
}

