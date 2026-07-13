// Shared helpers for the /rationalization feature module: active-company
// resolution, CSV lens params, CAPDAN counting, the role→value-stream lens
// walk, and the audited string-field patch used by every board-box edit.
import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logAudit, computeDiff } from '../../services/audit.js';

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

export function capdanCounts(rows: { capdan: string }[]) {
  const m: Record<string, number> = { Common: 0, Different: 0, Relocate: 0, Eliminate: 0 };
  for (const r of rows) m[r.capdan] = (m[r.capdan] ?? 0) + 1;
  return m;
}

/** CSV query param → id list (empty array when absent). */
export const csv = (v: unknown): string[] =>
  typeof v === 'string' && v.trim()
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * WR-01 roles lens: roles → the tasks they own/participate in (NodeRole) →
 * the L2 value streams above those tasks (closure) — the streams a role
 * actually works in. Batched: two queries + one level lookup, no fan-out.
 */
export async function valueStreamIdsForRoles(
  companyId: string,
  roleIds: string[],
): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const links = await prisma.nodeRole.findMany({
    where: { companyId, roleId: { in: roleIds } },
    select: { processNodeId: true },
  });
  const nodeIds = [...new Set(links.map((l) => l.processNodeId))];
  if (nodeIds.length === 0) return [];
  const l2 = await prisma.processNode.findMany({
    where: {
      companyId,
      processLevelType: { levelNumber: 2 },
      ancestorEdges: { some: { descendantId: { in: nodeIds } } },
    },
    select: { id: true },
  });
  return l2.map((n) => n.id);
}

// Shared string-field patch: whitelist fields, blank → null, diff + audit
// against the parent workspace so every box edit lands in the change log.
export async function patchBoxEntity(
  req: Request,
  res: Response,
  load: () => Promise<
    ({ id: string; workspaceId: string; name: string } & Record<string, unknown>) | null
  >,
  update: (
    id: string,
    data: Record<string, unknown>,
  ) => Promise<{ id: string; workspaceId: string; name: string } & Record<string, unknown>>,
  fields: readonly string[],
  action: string,
) {
  const before = await load();
  if (!before) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v !== null && typeof v !== 'string') {
      res.status(400).json({ error: `${f} must be a string` });
      return null;
    }
    data[f] = typeof v === 'string' && v.trim() === '' ? null : v;
  }
  if (data.name === null) {
    res.status(400).json({ error: 'name is required' });
    return null;
  }
  if (Object.keys(data).length === 0) return before;
  const updated = await update(before.id, data);
  const changes = computeDiff(before, updated, [...fields]);
  if (Object.keys(changes).length) {
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'RationalizationWorkspace',
      entityId: updated.workspaceId,
      action,
      diff: { subject: updated.name, changes },
    });
  }
  return updated;
}
