import { prisma } from '../db/prisma.js';

type AuditInput = {
  tenantId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: unknown;
};

export async function logAudit({ tenantId, actorEmail, entityType, entityId, action, diff }: AuditInput) {
  try {
    await prisma.auditEntry.create({
      data: {
        tenantId,
        actorEmail,
        entityType,
        entityId,
        action,
        diff: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch (e) {
    console.error('Audit log failed:', (e as Error).message);
  }
}

// Field-level diff between two records, restricted to the editable field names.
// Only changed fields are kept. Dates are normalized to ISO strings so two
// equal instants don't read as a change.
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
) {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    const a = norm(before[f]);
    const b = norm(after[f]);
    if (a !== b) diff[f] = { from: a, to: b };
  }
  return diff;
}
